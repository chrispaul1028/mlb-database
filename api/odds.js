// ═══════════════════════════════════════════════════════════════════
// /api/odds — today's FanDuel "To Hit a Home Run" prices
// Source: The Odds API (https://the-odds-api.com), free tier = 500
// requests/month. One call lists today's games, then one call per game
// for the batter_home_runs market → ~16 calls per refresh. The
// s-maxage header below makes Vercel serve a cached copy for 2 hours,
// so refreshing the app all day still costs ~8 refreshes/day ≈ 130
// requests/day at most. Set ODDS_API_KEY in Vercel → Settings →
// Environment Variables. Without the key this returns {} and the app
// simply hides the FD column — fails quietly by design because odds
// are a convenience, not an input to HR%.
// ═══════════════════════════════════════════════════════════════════
const BOOK = "fanduel";
const MARKET = "batter_home_runs";

const nrm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=7200, stale-while-revalidate=600");
  const key = process.env.ODDS_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: "no ODDS_API_KEY", prices: {} });
  try {
    const base = "https://api.the-odds-api.com/v4/sports/baseball_mlb";
    const events = await (await fetch(`${base}/events?apiKey=${key}`)).json();
    if (!Array.isArray(events)) return res.status(200).json({ ok: false, reason: "events", prices: {} });
    // Only today's games (Eastern), so we don't burn quota on tomorrow's slate.
    const todayET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
    const todays = events.filter((e) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(e.commence_time)) === todayET);
    const prices = {};
    let remaining = null;
    await Promise.all(todays.map(async (e) => {
      try {
        const r = await fetch(`${base}/events/${e.id}/odds?apiKey=${key}&regions=us&markets=${MARKET}&bookmakers=${BOOK}&oddsFormat=american`);
        remaining = r.headers.get("x-requests-remaining") || remaining;
        const j = await r.json();
        for (const bk of j.bookmakers || []) {
          for (const m of bk.markets || []) {
            if (m.key !== MARKET) continue;
            for (const o of m.outcomes || []) {
              // outcome: { name: "Over", description: "Aaron Judge", price: 320, point: 0.5 }
              if (String(o.name).toLowerCase() !== "over" && String(o.name).toLowerCase() !== "yes") continue;
              const who = nrm(o.description || o.participant || "");
              if (!who || o.price == null) continue;
              const american = Number(o.price);
              const implied = american > 0 ? 100 / (american + 100) : -american / (-american + 100);
              prices[who] = { price: american, implied: Math.round(implied * 1000) / 10, game: `${e.away_team} @ ${e.home_team}` };
            }
          }
        }
      } catch {}
    }));
    return res.status(200).json({ ok: true, book: BOOK, count: Object.keys(prices).length, remaining, prices });
  } catch (err) {
    return res.status(200).json({ ok: false, reason: String(err && err.message || err), prices: {} });
  }
};
