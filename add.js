import { randomUUID } from 'node:crypto';
import { mutate, advance, addSong, redis } from '../lib/store.js';

const clean = (v, max) => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { url, title, name, duration } = req.body || {};
    let host = '';
    try { host = new URL(url).hostname; } catch {}
    if (!host.endsWith('.public.blob.vercel-storage.com')) return res.status(400).json({ error: 'Invalid file' });

    const d = Number(duration);
    if (!(d >= 5 && d <= 15 * 60)) return res.status(400).json({ error: 'Songs must be between 5 seconds and 15 minutes' });

    // Basic abuse limit: 6 additions per 10 minutes per IP
    const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const rlKey = `ptd:rl:${ip}`;
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, 600);
    if (count > 6) return res.status(429).json({ error: 'Slow down — try again in a few minutes' });

    const song = {
      id: randomUUID(),
      title: clean(title, 80) || 'Untitled',
      name: clean(name, 30) || 'Anonymous',
      url,
      duration: d,
    };
    await mutate((s) => { addSong(s, song); advance(s, Date.now()); });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
