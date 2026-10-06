import { del } from '@vercel/blob';
import { mutate, advance } from '../lib/store.js';

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  try {
    if (req.method === 'GET') {
      const s = await mutate((s) => { advance(s, Date.now()); return s; });
      return res.json({
        currentId: s.current?.song.id || null,
        library: s.library,
        queue: s.queue.map(({ id, title, name, looped }) => ({ id, title, name, looped: !!looped })),
      });
    }
    if (req.method === 'POST') {
      const { id, action, to } = req.body || {};
      if (action === 'move') {
        // Put a song at queue position `to` (0 = plays next). Moved songs count as deliberate picks.
        await mutate((s) => {
          const i = s.queue.findIndex((x) => x.id === id);
          let song;
          if (i !== -1) song = s.queue.splice(i, 1)[0];
          else {
            const l = s.library.find((x) => x.id === id);
            if (!l) return;
            song = { ...l };
          }
          delete song.looped;
          const pos = Math.max(0, Math.min(Number(to) || 0, s.queue.length));
          s.queue.splice(pos, 0, song);
        });
        return res.json({ ok: true });
      }
      let url = null;
      await mutate((s) => {
        const song = s.library.find((x) => x.id === id) || s.queue.find((x) => x.id === id) ||
          (s.current?.song.id === id ? s.current.song : null);
        url = song?.url || null;
        s.library = s.library.filter((x) => x.id !== id);
        s.queue = s.queue.filter((x) => x.id !== id);
        if (s.current?.song.id === id) s.current = null; // skips it; next song starts immediately
        advance(s, Date.now());
      });
      if (url) await del(url).catch(() => {}); // also delete the audio file from Blob
      return res.json({ ok: true });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
