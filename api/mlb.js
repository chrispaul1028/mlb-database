// /api/mlb?path=<MLB Stats API path> — cached pass-through to statsapi.mlb.com.
// App.jsx no longer talks to MLB directly: every call goes through mlbFetch()
// in the app, which lands here. The JSON comes back UNCHANGED, so every screen
// reads exactly the shapes it always has — the win is Vercel's edge cache
// (repeat loads are instant and MLB gets hit once, not once per screen).
//
//   /api/mlb?path=v1/game/776543/boxscore
//   /api/mlb?path=v1/schedule%3FsportId%3D1%26date%3D2026-09-18
//
// Locked down: GET only, host is fixed to statsapi.mlb.com, and the path must
// start with v1/ or v1.1/ — it can't be pointed anywhere else.

const HOST = "https://statsapi.mlb.com/api/";

// Seconds to cache, first match wins. Live things tick; reference data sits.
const TTL = [
  [/^v1(\.1)?\/game\//, 15],               // boxscore / linescore / live feed
  [/^v1\/schedule/, 30],                   // today's slate, probables, scores
  [/^v1\/standings/, 300],
  [/^v1\/people\/search/, 86400],          // name -> MLB id never changes
  [/^v1\/people\/\d+\/stats/, 600],        // game logs (streaks, trends)
  [/^v1\/people\?/, 900],                  // season lines / platoon splits
  [/^v1\/teams\/\d+\/stats/, 1800],        // bullpen HR/9 etc.
  [/^v1\/teams\/\d+\/coaches/, 86400],
  [/^v1\/teams/, 86400],
];

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const path = String((req.query || {}).path || "").replace(/^\/+/, "");
  if (!/^v1(\.1)?\/[A-Za-z]/.test(path) || path.includes("..") || path.includes("//") || /[\s@\\#]/.test(path)) {
    return res.status(400).json({ error: "path must be an MLB Stats API path starting with v1/ or v1.1/" });
  }
  try {
    const r = await fetch(HOST + path, { headers: { accept: "application/json" } });
    const body = await r.text();
    const ttl = r.ok ? (TTL.find(([re]) => re.test(path)) || [null, 60])[1] : 0;
    res.setHeader("Cache-Control", ttl ? `s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}` : "no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(r.status).send(body);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: String(e.message || e) });
  }
}
