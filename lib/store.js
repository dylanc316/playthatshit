import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const KEY = 'ptd:state';
const LOCK = 'ptd:lock';
const LIBRARY_MAX = 500;

export { redis };

// State shape:
// { library: Song[], queue: (Song & {looped?: true})[], current: { song, startedAt } | null }
// Song = { id, title, name, url, duration }
const empty = () => ({ library: [], queue: [], current: null });

// Plain read, no lock and no write: 1 Redis command.
export async function read() {
  return (await redis.get(KEY)) || empty();
}

// Run fn(state) under a short lock, then save. Keeps concurrent requests from corrupting the queue.
export async function mutate(fn) {
  for (let i = 0; i < 30; i++) {
    const got = await redis.set(LOCK, '1', { nx: true, ex: 5 });
    if (got) {
      try {
        const state = (await redis.get(KEY)) || empty();
        const result = fn(state);
        await redis.set(KEY, state);
        return result;
      } finally {
        await redis.del(LOCK);
      }
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error('Server busy, try again');
}

// Moves the radio forward to "now". Songs start exactly when the previous one ends,
// so everyone computes the same position no matter when they join.
export function advance(s, now) {
  for (let guard = 0; guard < 1000; guard++) {
    let startAt = now;
    if (s.current) {
      const end = s.current.startedAt + s.current.song.duration * 1000;
      if (now < end) break;
      startAt = end;
    }
    refill(s, s.current && s.current.song.id);
    if (!s.queue.length) { s.current = null; break; }
    const { looped, ...song } = s.queue.shift();
    s.current = { song, startedAt: startAt };
    refill(s, song.id);
  }
}

// EMPTY QUEUE BEHAVIOR: loop back through every song ever added.
// Looped songs are flagged so new uploads can jump ahead of them.
function refill(s, currentId) {
  if (s.queue.length || !s.library.length) return;
  // Start right after the current song and wrap around, so the loop keeps a stable order.
  const i = s.library.findIndex((x) => x.id === currentId);
  const pool = i === -1 ? s.library : [...s.library.slice(i + 1), ...s.library.slice(0, i)];
  s.queue = (pool.length ? pool : s.library).map((x) => ({ ...x, looped: true }));
}

export function addSong(s, song) {
  s.library.push(song);
  if (s.library.length > LIBRARY_MAX) s.library.shift();
  const firstLooped = s.queue.findIndex((x) => x.looped);
  if (firstLooped === -1) s.queue.push(song);
  else s.queue.splice(firstLooped, 0, song);
}
