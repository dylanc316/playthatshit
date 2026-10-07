import { mutate, advance, read, redis } from '../lib/store.js';
import { EMOJIS, WINDOW_MS, bucketKey } from '../lib/live.js';

export default async function handler(req, res) {
  try {
    const now = Date.now();
    let s = await read(); // no lock, no write

    // Only lock and write when the song has actually ended (or nothing is playing yet).
    const needsAdvance = s.current
      ? now >= s.current.startedAt + s.current.song.duration * 1000
      : s.library.length > 0;
    if (needsAdvance) s = await mutate((s) => { advance(s, now); return s; });

    // Listener count + reaction counts, fetched together in one round trip.
    const history = (s.history || []).slice(0, 10);
    const curId = s.current?.song.id;
    const fields = [...(curId ? EMOJIS.map((e) => `${curId}:${e}`) : []), ...history.map((h) => h.id)];
    const b = Math.floor(now / WINDOW_MS);
    const pipe = redis.pipeline().pfcount(bucketKey(b), bucketKey(b - 1));
    if (fields.length) pipe.hmget('ptd:rx', ...fields);
    const [listeners, counts] = await pipe.exec();
    const c = counts || {};
    const n = (k) => Number(c[k]) || 0;

    // Let Vercel's CDN reuse this answer for 2s, so many listeners share one server call.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=2');
    res.json({
      now,
      current: s.current,
      // Only the very next song includes its file link and length, so pages can preload it.
      next: s.queue.slice(0, 10).map(({ id, title, name, looped, url, duration }, i) =>
        i === 0 ? { id, title, name, looped: !!looped, url, duration } : { id, title, name, looped: !!looped }),
      queueLength: s.queue.filter((x) => !x.looped).length,
      listeners: Number(listeners) || 0,
      reactions: curId ? Object.fromEntries(EMOJIS.map((e) => [e, n(`${curId}:${e}`)])) : {},
      history: history.map((h) => ({ id: h.id, title: h.title, name: h.name, reactions: n(h.id) })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
