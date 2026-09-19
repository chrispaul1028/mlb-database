// /api/season-stats — every MLB player's season line (hitting + pitching) in
// one cached payload, plus ready-made leaderboards for the Stats tab.
// The MLB twin of the NFL app's /api/season-stats. Replaces the per-player
// people/stats calls the app makes from the phone today.
//
//   /api/season-stats                current season (falls back to last season
//                                    before Opening Day, isCurrent:false)
//   /api/season-stats?season=2025
//   /api/season-stats?debug=1        counts only (quick health check)
//
// players   { [mlbId]: { id, name, team, pos, hit:{…}, pit:{…} } }
// byName    { normalizedName: mlbId }   (same normalizer as hrbNrm in App.jsx)
// leaders   { hr:[{id,v}…top 25], avg:[…], era:[…] … }  rate stats = qualified only
//
// Cached 30 min — season totals only move once a day per player.

const API = "https://statsapi.mlb.com/api/v1";
const PAGE = 1000;
const TOP = 25;

const TEAM_ABBR = {
  108: "LAA", 109: "ARI", 110: "BAL", 111: "BOS", 112: "CHC", 113: "CIN", 114: "CLE", 115: "COL",
  116: "DET", 117: "HOU", 118: "KC", 119: "LAD", 120: "WSH", 121: "NYM", 133: "ATH", 134: "PIT",
  135: "SD", 136: "SEA", 137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 142: "MIN",
  143: "PHI", 144: "ATL", 145: "CWS", 146: "MIA", 147: "NYY", 158: "MIL",
};

const nrm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[\u0131\u0130]/g, "i").replace(/\u00f8/g, "o").replace(/\u0142/g, "l")
  .replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}
const yearET = () => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()).slice(0, 4));
const n0 = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const ipToOuts = (ip) => { const f = parseFloat(ip || "0"); return Math.floor(f) * 3 + Math.round((f % 1) * 10); };
const outsToIp = (o) => `${Math.floor(o / 3)}.${o % 3}`;
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);

async function pull(group, season) {
  const all = [];
  for (let page = 0; page < 4; page++) {
    const d = await getJson(`${API}/stats?stats=season&group=${group}&season=${season}&sportIds=1&gameType=R&playerPool=ALL&limit=${PAGE}&offset=${page * PAGE}`);
    const splits = ((d.stats || [])[0] || {}).splits || [];
    all.push(...splits);
    if (splits.length < PAGE) break;
  }
  return all;
}

// A traded player comes back as one row per team (and sometimes a combined
// row). Use the combined row when MLB sends it; otherwise add the rows up.
function mergeRows(rows, counting) {
  const total = rows.find((s) => !s.team || n0(s.numTeams) > 1);
  if (total) return { stat: total.stat || {}, team: (rows.filter((s) => s.team).pop() || {}).team || null, summed: false };
  if (rows.length === 1) return { stat: rows[0].stat || {}, team: rows[0].team || null, summed: false };
  const sum = {};
  for (const k of counting) sum[k] = rows.reduce((t, s) => t + n0((s.stat || {})[k]), 0);
  sum._outs = rows.reduce((t, s) => t + ipToOuts((s.stat || {}).inningsPitched), 0);
  return { stat: sum, team: rows[rows.length - 1].team || null, summed: true };
}

const HIT_COUNT = ["gamesPlayed", "plateAppearances", "atBats", "runs", "hits", "doubles", "triples", "homeRuns", "rbi", "stolenBases", "baseOnBalls", "strikeOuts", "hitByPitch", "sacFlies", "totalBases"];
const PIT_COUNT = ["gamesPlayed", "gamesStarted", "wins", "losses", "saves", "holds", "hits", "runs", "earnedRuns", "homeRuns", "baseOnBalls", "strikeOuts", "battersFaced"];

function hitLine(m) {
  const s = m.stat; const ab = n0(s.atBats), h = n0(s.hits), bb = n0(s.baseOnBalls), hbp = n0(s.hitByPitch), sf = n0(s.sacFlies), tb = n0(s.totalBases), pa = n0(s.plateAppearances);
  const avg = m.summed ? r3(h / ab) : r3(Number(s.avg));
  const obp = m.summed ? r3((h + bb + hbp) / (ab + bb + hbp + sf)) : r3(Number(s.obp));
  const slg = m.summed ? r3(tb / ab) : r3(Number(s.slg));
  const ops = m.summed ? (obp != null && slg != null ? r3(obp + slg) : null) : r3(Number(s.ops));
  return {
    g: n0(s.gamesPlayed), pa, ab, r: n0(s.runs), h, d: n0(s.doubles), t: n0(s.triples), hr: n0(s.homeRuns), rbi: n0(s.rbi), sb: n0(s.stolenBases),
    bb, so: n0(s.strikeOuts), tb, avg, obp, slg, ops,
    iso: avg != null && slg != null ? r3(slg - avg) : null,
    hrPa: pa ? r3(n0(s.homeRuns) / pa) : null,                 // HR per plate appearance — the HR Board's native unit
    kPct: pa ? r3(n0(s.strikeOuts) / pa) : null, bbPct: pa ? r3(bb / pa) : null,
  };
}

function pitLine(m) {
  const s = m.stat; const outs = m.summed ? s._outs : ipToOuts(s.inningsPitched); const ip = outs / 3;
  const bf = n0(s.battersFaced);
  return {
    g: n0(s.gamesPlayed), gs: n0(s.gamesStarted), w: n0(s.wins), l: n0(s.losses), sv: n0(s.saves), hld: n0(s.holds),
    ip: outsToIp(outs), outs, h: n0(s.hits), er: n0(s.earnedRuns), hr: n0(s.homeRuns), bb: n0(s.baseOnBalls), so: n0(s.strikeOuts),
    era: outs ? (m.summed ? r2((n0(s.earnedRuns) * 9) / ip) : r2(Number(s.era))) : null,
    whip: outs ? (m.summed ? r2((n0(s.baseOnBalls) + n0(s.hits)) / ip) : r2(Number(s.whip))) : null,
    k9: outs ? r2((n0(s.strikeOuts) * 9) / ip) : null, bb9: outs ? r2((n0(s.baseOnBalls) * 9) / ip) : null, hr9: outs ? r2((n0(s.homeRuns) * 9) / ip) : null,
    kPct: bf ? r3(n0(s.strikeOuts) / bf) : null,
  };
}

function build(hitRows, pitRows) {
  const players = {};
  const group = (rows) => { const by = {}; for (const s of rows) { const id = (s.player || {}).id; if (id) (by[id] = by[id] || []).push(s); } return by; };
  const ensure = (id, rows, m) => {
    const first = rows[0];
    return (players[id] = players[id] || {
      id: Number(id), name: (first.player || {}).fullName || "", team: m.team ? TEAM_ABBR[m.team.id] || "" : "",
      pos: (first.position || {}).abbreviation || "", hit: null, pit: null,
    });
  };
  for (const [id, rows] of Object.entries(group(hitRows))) { const m = mergeRows(rows, HIT_COUNT); const line = hitLine(m); if (line.pa > 0) ensure(id, rows, m).hit = line; }
  for (const [id, rows] of Object.entries(group(pitRows))) { const m = mergeRows(rows, PIT_COUNT); const line = pitLine(m); if (line.outs > 0) ensure(id, rows, m).pit = line; }
  return players;
}

function leaders(players) {
  const list = Object.values(players);
  // Qualified = 3.1 PA (hitters) or 1 IP (pitchers) per team game. Team games ≈ the most games any hitter has played.
  const teamGames = list.reduce((m, p) => Math.max(m, p.hit ? p.hit.g : 0), 0);
  const qPa = Math.floor(teamGames * 3.1), qOuts = teamGames * 3;
  const top = (side, key, { asc = false, qual = false } = {}) => list
    .filter((p) => p[side] && p[side][key] != null && (!qual || (side === "hit" ? p.hit.pa >= qPa : p.pit.outs >= qOuts)))
    .sort((a, b) => (asc ? a[side][key] - b[side][key] : b[side][key] - a[side][key]))
    .slice(0, TOP).map((p) => ({ id: p.id, v: p[side][key] }));
  return {
    qualifiers: { teamGames, pa: qPa, ip: teamGames },
    hr: top("hit", "hr"), rbi: top("hit", "rbi"), r: top("hit", "r"), h: top("hit", "h"), sb: top("hit", "sb"), tb: top("hit", "tb"),
    avg: top("hit", "avg", { qual: true }), obp: top("hit", "obp", { qual: true }), slg: top("hit", "slg", { qual: true }),
    ops: top("hit", "ops", { qual: true }), iso: top("hit", "iso", { qual: true }), hrPa: top("hit", "hrPa", { qual: true }),
    w: top("pit", "w"), sv: top("pit", "sv"), so: top("pit", "so"),
    era: top("pit", "era", { asc: true, qual: true }), whip: top("pit", "whip", { asc: true, qual: true }),
    k9: top("pit", "k9", { qual: true }), hr9: top("pit", "hr9", { asc: true, qual: true }),
    hr9Worst: top("pit", "hr9", { qual: true }),             // most HR-prone qualified arms — handy for the HR Board
  };
}

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const asked = Number(q.season) || null;
    let season = asked || yearET();
    let isCurrent = true;
    let [hit, pit] = await Promise.all([pull("hitting", season), pull("pitching", season)]);
    if (!asked && hit.length === 0) { season -= 1; isCurrent = false; [hit, pit] = await Promise.all([pull("hitting", season), pull("pitching", season)]); }

    const players = build(hit, pit);
    const byName = {};
    for (const p of Object.values(players)) { const k = nrm(p.name); if (!byName[k]) byName[k] = p.id; if (p.team) byName[k + "|" + p.team] = p.id; }
    const lead = leaders(players);

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    if (q.debug) return res.status(200).json({ season, isCurrent, hittingRows: hit.length, pitchingRows: pit.length, players: Object.keys(players).length, qualifiers: lead.qualifiers, hrTop5: lead.hr.slice(0, 5).map((x) => ({ ...x, name: players[x.id].name })) });
    return res.status(200).json({ season, isCurrent, count: Object.keys(players).length, players, byName, leaders: lead, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
