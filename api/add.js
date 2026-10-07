import { randomUUID } from 'node:crypto';
import { mutate, advance, addSong } from '../lib/store.js';
import { ipOf, useCredit, refundCredit } from '../lib/limits.js';

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

    // Spend one of today's upload credits (refunded below if adding fails).
    const ip = ipOf(req);
    if (!(await useCredit(ip))) return res.status(429).json({ error: "You're out of uploads for today. Come back tomorrow." });

    const song = {
      id: randomUUID(),
      title: clean(title, 80) || 'Untitled',
      name: clean(name, 30) || 'Anonymous',
      url,
      duration: d,
    };
    try {
      await mutate((s) => { addSong(s, song); advance(s, Date.now()); });
    } catch (e) {
      await refundCredit(ip);
      throw e;
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
