// /api/injuries — who's hurt, from TWO sources merged into one report:
//   1. ESPN's MLB injury report  → IL / day-to-day, the injury itself, est. return
//   2. MLB's own 40-man rosters  → the OFFICIAL status of every player: injured
//      list (10/15/60-day), optioned to the minors, suspended, bereavement…
// ESPN brings the detail; MLB is the authority on whether a player is actually
// on the IL, and catches anyone ESPN's report is missing. MLB also tells us who
// has been sent to the minors (code "MIN") so the app can tag them on its own.
//
// Keyed by the app's normalized name (same normalizer as hrbNrm in App.jsx),
// plus a "name|TEAM" key so two players sharing a name never share a tag.
//
//   /api/injuries              everything
//   /api/injuries?debug=1      counts by status, what each source contributed
//   /api/injuries?find=judge   one player's record(s)
//
// Cached 10 min. Fails quietly ({injuries:{}}) — tags are a convenience.
// Either source may fail on its own; the other still comes through.

const nrm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[\u0131\u0130]/g, "i").replace(/\u00f8/g, "o").replace(/\u0142/g, "l")
  .replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();

const TEAM_ABBR = {
  108: "LAA", 109: "ARI", 110: "BAL", 111: "BOS", 112: "CHC", 113: "CIN", 114: "CLE", 115: "COL",
  116: "DET", 117: "HOU", 118: "KC", 119: "LAD", 120: "WSH", 121: "NYM", 133: "ATH", 134: "PIT",
  135: "SD", 136: "SEA", 137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 142: "MIN",
  143: "PHI", 144: "ATL", 145: "CWS", 146: "MIA", 147: "NYY", 158: "MIL",
};
// ESPN abbreviations -> the ones the app uses
const ABBR_FIX = { CHW: "CWS", WAS: "WSH", AZ: "ARI", OAK: "ATH", KCR: "KC", SDP: "SD", SFG: "SF", TBR: "TB" };
const fixAbbr = (a) => { const u = String(a || "").toUpperCase(); return ABBR_FIX[u] || u; };

// ESPN status text -> short tag code + whether the player is unavailable today.
function classifyEspn(status) {
  const s = String(status || "").toLowerCase();
  const il = s.match(/(\d+)\s*-?\s*day/);
  if (il && /il|injured|dl/.test(s)) return { code: "IL" + il[1], out: true };
  if (/day\s*-?\s*to\s*-?\s*day|dtd/.test(s)) return { code: "DTD", out: false };
  if (/suspen/.test(s)) return { code: "SUSP", out: true };
  if (/bereave/.test(s)) return { code: "BRV", out: true };
  if (/patern/.test(s)) return { code: "PAT", out: true };
  if (/restrict/.test(s)) return { code: "RES", out: true };
  if (/out/.test(s)) return { code: "OUT", out: true };
  return { code: s ? "INJ" : null, out: false };
}

// MLB roster status ({code:"D10", description:"Injured 10-Day"}) -> same codes. null = active / nothing to show.
function classifyMlb(st) {
  const code = String((st && st.code) || "").toUpperCase();
  const d = String((st && st.description) || "").toLowerCase();
  if (code === "A" || d === "active") return null;
  const days = /^D(\d+)$/.exec(code) || (/injur|\bil\b|disabled/.test(d) ? /(\d+)\s*-?\s*day/.exec(d) : null);
  if (days) return { code: "IL" + days[1], out: true };
  if (/injur/.test(d)) return { code: "OUT", out: true };
  if (/minor|option|reassign/.test(d) || code === "RM" || code === "MIN") return { code: "MIN", out: true };
  if (/suspen/.test(d)) return { code: "SUSP", out: true };
  if (/bereave/.test(d)) return { code: "BRV", out: true };
  if (/patern/.test(d)) return { code: "PAT", out: true };
  if (/restrict/.test(d)) return { code: "RES", out: true };
  return null;
}

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

async function loadEspn() {
  const d = await getJson("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries");
  const list = [];
  for (const team of d.injuries || []) {
    for (const it of team.injuries || []) {
      const a = it.athlete || {}; const det = it.details || {};
      if (!a.displayName) continue;
      const c = classifyEspn(it.status);
      list.push({
        name: a.displayName, espnId: a.id ? String(a.id) : null, mlbId: null,
        team: fixAbbr((a.team || {}).abbreviation || (team.team || {}).abbreviation), pos: (a.position || {}).abbreviation || null,
        status: it.status || null, code: c.code, out: c.out, date: it.date || null,
        type: det.type || null, location: det.location || null, side: det.side || null, detail: det.detail || null,
        returnDate: det.returnDate || null, comment: it.shortComment || it.longComment || null, source: "espn",
      });
    }
  }
  return list;
}

async function loadMlb() {
  const ids = Object.keys(TEAM_ABBR);
  const res = await Promise.allSettled(ids.map((id) => getJson(`https://statsapi.mlb.com/api/v1/teams/${id}/roster?rosterType=40Man`)));
  const list = []; const seen = new Set(); let failed = 0;
  res.forEach((r, i) => {
    if (r.status !== "fulfilled") { failed++; return; }
    for (const p of r.value.roster || []) {
      const st = p.status || {};
      seen.add(`${st.code || "?"}: ${st.description || "?"}`);
      const c = classifyMlb(st);
      if (!c || !p.person || !p.person.fullName) continue;
      list.push({
        name: p.person.fullName, espnId: null, mlbId: p.person.id || null, team: TEAM_ABBR[ids[i]], pos: (p.position || {}).abbreviation || null,
        status: st.description || st.code || null, code: c.code, out: c.out, date: null,
        type: null, location: null, side: null, detail: null, returnDate: null, comment: null, source: "mlb",
      });
    }
  });
  return { list, statuses: [...seen].sort(), failed };
}

export default async function handler(req, res) {
  const q = req.query || {};
  const [espnR, mlbR] = await Promise.allSettled([loadEspn(), loadMlb()]);
  const espn = espnR.status === "fulfilled" ? espnR.value : [];
  const mlb = mlbR.status === "fulfilled" ? mlbR.value : { list: [], statuses: [], failed: 30 };
  const errors = [espnR.status === "rejected" ? "espn: " + String(espnR.reason && espnR.reason.message || espnR.reason) : null,
    mlbR.status === "rejected" ? "mlb: " + String(mlbR.reason && mlbR.reason.message || mlbR.reason) : null].filter(Boolean);

  // Merge: start from ESPN (it has the detail), then lay MLB's official status over it.
  const byKey = new Map();
  for (const r of espn) byKey.set(nrm(r.name) + "|" + r.team, r);
  let mlbAdded = 0, mlbUpgraded = 0;
  for (const m of mlb.list) {
    const k = nrm(m.name) + "|" + m.team;
    const e = byKey.get(k);
    if (!e) { byKey.set(k, m); mlbAdded++; continue; }
    e.mlbId = m.mlbId;
    // MLB says injured list but ESPN only had him day-to-day (or vaguer): MLB is the authority.
    if (/^IL\d+$/.test(m.code) && !/^IL\d+$/.test(String(e.code))) { e.code = m.code; e.out = true; e.status = m.status; e.source = "espn+mlb"; mlbUpgraded++; }
  }
  const list = [...byKey.values()];

  const out = {};
  for (const rec of list) {
    const k = nrm(rec.name);
    if (rec.team) out[k + "|" + rec.team] = rec;       // exact: name + team
    if (!out[k]) out[k] = rec;                         // fallback: name only (first seen wins)
  }

  if (q.debug || q.find) {
    const find = nrm(q.find || "");
    const byCode = {};
    for (const x of list) byCode[x.code] = (byCode[x.code] || 0) + 1;
    return res.status(200).json({
      total: list.length, byCode, fromEspn: espn.length, fromMlb: mlb.list.length, mlbAdded, mlbUpgraded, mlbRostersFailed: mlb.failed,
      withReturnDate: list.filter((x) => x.returnDate).length, errors,
      espnStatuses: [...new Set(espn.map((x) => x.status))], mlbStatuses: mlb.statuses,
      match: find ? list.filter((x) => nrm(x.name).includes(find)) : undefined,
    });
  }

  if (list.length) res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
  return res.status(200).json({ updatedAt: new Date().toISOString(), count: list.length, injuries: out, errors: errors.length ? errors : undefined });
}
