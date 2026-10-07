import { redis, read } from '../lib/store.js';
import { ipOf } from '../lib/limits.js';
import { EMOJIS } from '../lib/live.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { songId, emoji } = req.body || {};
    if (!EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Bad reaction' });

    // Reactions only count for the song that is playing right now.
    const s = await read();
    if (!s.current || s.current.song.id !== songId) return res.status(409).json({ error: 'That song is not playing' });

    // At most 30 reactions per person per song.
    const rk = `ptd:rxrl:${songId}:${ipOf(req)}`;
    const [n] = await redis.pipeline().incr(rk).expire(rk, 3600).exec();
    if (n > 30) return res.status(429).json({ error: 'Easy there' });

    await redis.pipeline()
      .hincrby('ptd:rx', songId, 1)
      .hincrby('ptd:rx', `${songId}:${emoji}`, 1)
      .exec();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
