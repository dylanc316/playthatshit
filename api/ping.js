import { redis } from '../lib/store.js';
import { WINDOW_MS, bucketKey } from '../lib/live.js';

// Each listening browser calls this about every 45s. Counted with a HyperLogLog (tiny and cheap).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const id = String(req.body?.id || '').slice(0, 64);
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const k = bucketKey(Math.floor(Date.now() / WINDOW_MS));
    await redis.pipeline().pfadd(k, id).expire(k, 600).exec();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
