// /api/standings — every team's record, division place, games back, streak,
// last 10, home/away splits and run differential, PLUS league ranks for the
// team stats that matter to this app (HR hit, HR allowed, runs, OPS, ERA…).
// The MLB twin of the NFL app's /api/standings.
//
//   /api/standings               current season
//   /api/standings?season=2025   a past season
//
// Before Opening Day the current season is all zeros, so this falls back to
// last season and says so with isCurrent:false (same trick as the NFL app).
// Team stats are non-fatal: if that call fails you still get the standings.

const API = "https://statsapi.mlb.com/api/v1";

const TEAM_ABBR = {
  108: "LAA", 109: "ARI", 110: "BAL", 111: "BOS", 112: "CHC", 113: "CIN", 114: "CLE", 115: "COL",
  116: "DET", 117: "HOU", 118: "KC", 119: "LAD", 120: "WSH", 121: "NYM", 133: "ATH", 134: "PIT",
  135: "SD", 136: "SEA", 137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 142: "MIN",
  143: "PHI", 144: "ATL", 145: "CWS", 146: "MIA", 147: "NYY", 158: "MIL",
};
const DIVISIONS = { 200: "AL West", 201: "AL East", 202: "AL Central", 203: "NL West", 204: "NL East", 205: "NL Central" };

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}
const num = (v) => { const n = Number(v); return v == null || v === "" || v === "-" || !Number.isFinite(n) ? null : n; };
const yearET = () => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()).slice(0, 4));

async function loadStandings(season) {
  const d = await getJson(`${API}/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`);
  const teams = [];
  for (const rec of d.records || []) {
    const divId = (rec.division || {}).id;
    for (const t of rec.teamRecords || []) {
      const id = (t.team || {}).id;
      const split = (type) => { const s = (((t.records || {}).splitRecords) || []).find((x) => x.type === type); return s ? `${s.wins}-${s.losses}` : null; };
      teams.push({
        id, abbr: TEAM_ABBR[id] || String((t.team || {}).abbreviation || "").toUpperCase(), name: (t.team || {}).name || "",
        logo: id ? `https://www.mlbstatic.com/team-logos/${id}.svg` : null,
        league: divId >= 203 ? "NL" : "AL", division: DIVISIONS[divId] || null,
        wins: t.wins ?? 0, losses: t.losses ?? 0, pct: num(t.winningPercentage), games: t.gamesPlayed ?? (t.wins ?? 0) + (t.losses ?? 0),
        gb: t.gamesBack === "-" ? "—" : t.gamesBack ?? null, wcGb: t.wildCardGamesBack === "-" ? "—" : t.wildCardGamesBack ?? null,
        divRank: num(t.divisionRank), leagueRank: num(t.leagueRank), wcRank: num(t.wildCardRank),
        streak: (t.streak || {}).streakCode || null, l10: split("lastTen"), homeRec: split("home"), awayRec: split("away"),
        rs: t.runsScored ?? null, ra: t.runsAllowed ?? null, diff: t.runDifferential ?? null,
        clinched: !!t.clinched, eliminated: t.eliminationNumber === "E",
      });
    }
  }
  return teams;
}

// League-wide team stats in one call per group, then ranked 1–30.
//   higher-is-better: runs, hr, avg, obp, slg, ops, sb, pitching so
//   lower-is-better:  batting so, era, whip, hr allowed, hr9, opp avg
async function loadTeamStats(season) {
  const pull = async (group) => {
    const d = await getJson(`${API}/teams/stats?season=${season}&sportIds=1&group=${group}&stats=season`);
    return ((d.stats || [])[0] || {}).splits || [];
  };
  const [hit, pit] = await Promise.all([pull("hitting"), pull("pitching")]);
  const out = {};
  const slot = (id) => (out[id] = out[id] || {});
  for (const s of hit) {
    const x = s.stat || {}; const g = x.gamesPlayed || 0;
    Object.assign(slot((s.team || {}).id), {
      runs: x.runs ?? null, rpg: g ? +(x.runs / g).toFixed(2) : null, hr: x.homeRuns ?? null, hrPg: g ? +(x.homeRuns / g).toFixed(2) : null,
      avg: num(x.avg), obp: num(x.obp), slg: num(x.slg), ops: num(x.ops), sb: x.stolenBases ?? null, soBat: x.strikeOuts ?? null,
    });
  }
  for (const s of pit) {
    const x = s.stat || {};
    const ip = parseFloat(x.inningsPitched || "0"); const outs = Math.floor(ip) * 3 + Math.round((ip % 1) * 10);
    Object.assign(slot((s.team || {}).id), {
      era: num(x.era), whip: num(x.whip), soPit: x.strikeOuts ?? null, hrAllowed: x.homeRuns ?? null,
      hr9: outs && x.homeRuns != null ? +((x.homeRuns * 27) / outs).toFixed(2) : null, oppAvg: num(x.avg),
    });
  }
  const LOWER = new Set(["soBat", "era", "whip", "hrAllowed", "hr9", "oppAvg"]);
  const ids = Object.keys(out);
  const keys = [...new Set(ids.flatMap((id) => Object.keys(out[id])))];
  for (const k of keys) {
    const sorted = ids.filter((id) => out[id][k] != null).sort((a, b) => (LOWER.has(k) ? out[a][k] - out[b][k] : out[b][k] - out[a][k]));
    let rank = 0, prev = null;
    sorted.forEach((id, i) => { if (out[id][k] !== prev) { rank = i + 1; prev = out[id][k]; } out[id][k + "Rank"] = rank; });   // ties share a rank
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const asked = Number((req.query || {}).season) || null;
    let season = asked || yearET();
    let teams = await loadStandings(season);
    let isCurrent = true;
    const played = teams.reduce((n, t) => n + t.wins + t.losses, 0);
    if (!asked && (!teams.length || played === 0)) { season -= 1; teams = await loadStandings(season); isCurrent = false; }

    let statsError = null;
    try {
      const stx = await loadTeamStats(season);
      for (const t of teams) t.stx = stx[t.id] || null;
    } catch (e) { statsError = String(e.message || e); for (const t of teams) t.stx = null; }

    teams.sort((a, b) => (a.division || "").localeCompare(b.division || "") || (a.divRank ?? 99) - (b.divRank ?? 99));
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    return res.status(200).json({ season, isCurrent, count: teams.length, teams, statsError, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
