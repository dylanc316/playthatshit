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
      return res.json({ currentId: s.current?.song.id || null, library: s.library });
    }
    if (req.method === 'POST') {
      const { id, action } = req.body || {};

      if (action === 'reset') {
        // Start over from the first song in the library; the rest of the library becomes the queue.
        await mutate((s) => {
          const [first, ...rest] = s.library;
          s.current = first ? { song: first, startedAt: Date.now() } : null;
          s.queue = rest.map((x) => ({ ...x })); // plain songs, no "replay" flag
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
