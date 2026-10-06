import { mutate, advance } from '../lib/store.js';

export default async function handler(req, res) {
  try {
    const now = Date.now();
    const s = await mutate((s) => { advance(s, now); return s; });
    res.setHeader('Cache-Control', 'no-store');
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
