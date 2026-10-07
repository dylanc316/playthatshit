import { ipOf, creditsLeft, DAILY_CREDITS, resetsAt } from '../lib/limits.js';

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ remaining: await creditsLeft(ipOf(req)), total: DAILY_CREDITS, resetsAt: resetsAt() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
