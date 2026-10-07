import { redis } from './store.js';

export const DAILY_CREDITS = Number(process.env.DAILY_CREDITS) || 3;

// Vercel sets these headers itself, so visitors can't fake them.
export const ipOf = (req) =>
  String(req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown')
    .split(',')[0].trim();

const day = () => new Date().toISOString().slice(0, 10); // credits reset at midnight UTC
const creditKey = (ip) => `ptd:credits:${day()}:${ip}`;

export const resetsAt = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
};

export async function creditsLeft(ip) {
  const used = Number(await redis.get(creditKey(ip))) || 0;
  return Math.max(0, DAILY_CREDITS - used);
}

// Spend one credit. Returns false (and spends nothing) if there are none left.
export async function useCredit(ip) {
  const k = creditKey(ip);
  const [used] = await redis.pipeline().incr(k).expire(k, 172800).exec();
  if (used > DAILY_CREDITS) { await redis.decr(k); return false; }
  return true;
}

export async function refundCredit(ip) {
  await redis.decr(creditKey(ip));
}

// Caps how many upload tokens one IP can request per day (stops uploads that never become songs).
export async function allowTokenRequest(ip) {
  const k = `ptd:tok:${day()}:${ip}`;
  const [n] = await redis.pipeline().incr(k).expire(k, 172800).exec();
  return n <= DAILY_CREDITS * 3;
}
