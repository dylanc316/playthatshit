import { redis } from '../lib/store.js';
import { ipOf } from '../lib/limits.js';

// PLACEHOLDER: only records that someone clicked "Boost". No payment, and the queue never changes.
// REPLACE ME later with a real checkout.
//
// To read the results in Upstash's Data Browser:
//   ptd:boost         (hash)  field "total" = every click
//   ptd:boost:people  (set)   one entry per distinct browser, so its size = how many different people clicked
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const cid = String(req.body?.cid || '').slice(0, 64);

    // Light abuse guard: 30 clicks per hour per person.
    const rk = `ptd:boostrl:${ipOf(req)}`;
    const [n] = await redis.pipeline().incr(rk).expire(rk, 3600).exec();
    if (n > 30) return res.json({ ok: true });

    const p = redis.pipeline().hincrby('ptd:boost', 'total', 1);
    if (cid) p.sadd('ptd:boost:people', cid);
    await p.exec();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
