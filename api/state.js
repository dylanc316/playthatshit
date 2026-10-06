import { mutate, advance, read } from '../lib/store.js';

export default async function handler(req, res) {
  try {
    const now = Date.now();
    let s = await read(); // 1 Redis command, no lock

    // Only lock and write when the song has actually ended (or nothing is playing yet).
    const needsAdvance = s.current
      ? now >= s.current.startedAt + s.current.song.duration * 1000
      : s.library.length > 0;
    if (needsAdvance) s = await mutate((s) => { advance(s, now); return s; });

    // Let Vercel's CDN reuse this answer for 2s, so many listeners share one server call.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=2');
    res.json({
      now,
      current: s.current,
      next: s.queue.slice(0, 15).map(({ id, title, name, looped }) => ({ id, title, name, looped: !!looped })),
      queueLength: s.queue.filter((x) => !x.looped).length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
