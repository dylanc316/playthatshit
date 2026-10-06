// Tiny endpoint for clock sync. No database access.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ now: Date.now() });
}
