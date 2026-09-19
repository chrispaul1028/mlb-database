// /api/injuries — ESPN's league-wide MLB injury report (same feed the NFL app
// uses, baseball edition): IL-10 / IL-15 / IL-60 / day-to-day, the injury
// detail, and the estimated return date when a team has published one.
//
// The MLB app knows players by NAME (Airtable) and MLB id, not ESPN id, so
// this is keyed by the app's normalized name — the exact same normalizer as
// hrbNrm in App.jsx, so "Luis García Jr." and "Luis Garcia" land on one key.
// Two players sharing a name are kept apart with a "name|TEAM" key as well.
//
//   /api/injuries              everything
//   /api/injuries?debug=1      counts by status + how many carry a return date
//   /api/injuries?find=judge   one player's record(s)
//
// Cached 10 min. Fails quietly ({injuries:{}}) — tags are a convenience.

const nrm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[\u0131\u0130]/g, "i").replace(/\u00f8/g, "o").replace(/\u0142/g, "l")
  .replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();

// ESPN abbreviations -> the ones the app uses
const ABBR_FIX = { CHW: "CWS", WAS: "WSH", AZ: "ARI", OAK: "ATH", KCR: "KC", SDP: "SD", SFG: "SF", TBR: "TB" };
const fixAbbr = (a) => { const u = String(a || "").toUpperCase(); return ABBR_FIX[u] || u; };

// ESPN status text -> short tag code + whether the player is unavailable today.
function classify(status) {
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

export default async function handler(req, res) {
  const q = req.query || {};
  try {
    const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries", { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();

    const out = {};
    const list = [];
    for (const team of d.injuries || []) {
      for (const it of team.injuries || []) {
        const a = it.athlete || {}; const det = it.details || {};
        const abbr = fixAbbr((a.team || {}).abbreviation || (team.team || {}).abbreviation);
        const c = classify(it.status);
        const rec = {
          name: a.displayName || "", espnId: a.id ? String(a.id) : null, team: abbr, teamName: team.displayName || (a.team || {}).displayName || null,
          pos: (a.position || {}).abbreviation || null,
          status: it.status || null, code: c.code, out: c.out, date: it.date || null,
          type: det.type || null, location: det.location || null, side: det.side || null, detail: det.detail || null,
          returnDate: det.returnDate || null, comment: it.shortComment || it.longComment || null,
        };
        if (!rec.name) continue;
        list.push(rec);
        const k = nrm(rec.name);
        if (abbr) out[k + "|" + abbr] = rec;          // exact: name + team
        if (!out[k]) out[k] = rec;                    // fallback: name only (first seen wins)
      }
    }

    if (q.debug || q.find) {
      const find = nrm(q.find || "");
      const byCode = {};
      for (const x of list) byCode[x.code] = (byCode[x.code] || 0) + 1;
      return res.status(200).json({
        total: list.length, byCode, withReturnDate: list.filter((x) => x.returnDate).length,
        rawStatuses: [...new Set(list.map((x) => x.status))],
        match: find ? list.filter((x) => nrm(x.name).includes(find)) : undefined,
      });
    }

    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
    return res.status(200).json({ updatedAt: new Date().toISOString(), count: list.length, injuries: out });
  } catch (e) {
    return res.status(200).json({ injuries: {}, error: String(e.message || e) });
  }
}
