// /api/sync-ratings — MLB The Show overall ratings → your Airtable "The Show
// Rating" field. The baseball twin of the football app's Madden sync.
//
// Source: San Diego Studio's own public API (mlb26.theshow.com/apis — the one
// documented on their site). Only LIVE SERIES cards count: those are the
// real-life current ratings that move with each roster update, not the
// boosted Diamond Dynasty specials.
//
// Runs every Friday via vercel.json cron (roster updates land on Fridays).
// Uses the SAME env vars as /api/contracts: AIRTABLE_TOKEN, AIRTABLE_BASE_ID.
// The token needs WRITE access to the base (data.records:write).
//
//   /api/sync-ratings?dry=1   look, don't touch: shows what WOULD change
//   /api/sync-ratings         writes the changes
//
// Safety: if the feed comes back short or a different shape, this fails loudly
// (502 + message) and writes NOTHING rather than zeroing your ratings. A player
// whose name matches two cards is only updated when the team matches too.

const CONFIG = {
  table: "Players",
  nameField: ["Name", "Player Name", "Full Name"],
  teamField: ["Team Name", "Team", "Current Team"],
  ratingField: ["The Show Rating", "MLB The Show Rating", "The Show", "Show Rating", "OVR", "Overall"],
  defaultRatingField: "The Show Rating",
  hosts: ["https://mlb26.theshow.com", "https://mlb25.theshow.com"],   // newest first; falls back if a title's site is down
  liveSeriesId: 1337,
  maxPages: 160,
  parallel: 6,
  minPlayers: 700,   // a real Live Series pull is ~1,700 cards
};

const NICKNAMES = { mike: "michael", matt: "matthew", josh: "joshua", alex: "alexander", cam: "cameron", dan: "daniel", zach: "zachary", zack: "zachary", nate: "nathan", nick: "nicholas", jake: "jacob", will: "william", chris: "christopher", tony: "anthony", andy: "andrew", drew: "andrew", ben: "benjamin", sam: "samuel", joe: "joseph", tom: "thomas", tommy: "thomas", jon: "jonathan", steve: "steven", gabe: "gabriel", manny: "manuel", vinny: "vincent", vinnie: "vincent" };
const nrm = (x) => {
  const s = String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0131\u0130]/g, "i").replace(/\u00f8/g, "o").replace(/\u0142/g, "l")
    .replace(/[.'’`]/g, "").replace(/-/g, " ").replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
  const parts = s.split(" ");
  if (parts.length > 1 && NICKNAMES[parts[0]]) parts[0] = NICKNAMES[parts[0]];
  return parts.join(" ");
};

// The Show uses nicknames ("Yankees"); Airtable may hold "New York Yankees" or "NYY".
const NICK_TO_ABBR = { angels: "LAA", diamondbacks: "ARI", "d-backs": "ARI", orioles: "BAL", "red sox": "BOS", cubs: "CHC", reds: "CIN", guardians: "CLE", rockies: "COL", tigers: "DET", astros: "HOU", royals: "KC", dodgers: "LAD", nationals: "WSH", mets: "NYM", athletics: "ATH", "a's": "ATH", pirates: "PIT", padres: "SD", mariners: "SEA", giants: "SF", cardinals: "STL", rays: "TB", rangers: "TEX", "blue jays": "TOR", twins: "MIN", phillies: "PHI", braves: "ATL", "white sox": "CWS", marlins: "MIA", yankees: "NYY", brewers: "MIL" };
const ABBR_FIX = { AZ: "ARI", CHW: "CWS", OAK: "ATH", WAS: "WSH", KCR: "KC", SDP: "SD", SFG: "SF", TBR: "TB" };
function teamAbbr(raw) {
  const s = String(Array.isArray(raw) ? raw[0] : raw || "").trim();
  if (!s || /^rec[A-Za-z0-9]{14}$/.test(s)) return null;                 // a linked-record id tells us nothing
  if (/^[A-Za-z]{2,3}$/.test(s)) return ABBR_FIX[s.toUpperCase()] || s.toUpperCase();
  const low = s.toLowerCase();
  for (const nick of Object.keys(NICK_TO_ABBR)) if (low === nick || low.endsWith(" " + nick)) return NICK_TO_ABBR[nick];
  return null;
}

const UA = { accept: "application/json", "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" };
async function getPage(host, page) {
  const r = await fetch(`${host}/apis/items.json?type=mlb_card&series_id=${CONFIG.liveSeriesId}&page=${page}`, { headers: UA });
  if (!r.ok) throw new Error(`The Show API HTTP ${r.status} on page ${page} (${host})`);
  const text = await r.text();
  if (!/^\s*\{/.test(text)) throw new Error(`The Show API sent a web page instead of data on page ${page} (${host}) — likely bot protection`);
  return JSON.parse(text);
}

async function fetchShowRatings() {
  let lastErr = null;
  for (const host of CONFIG.hosts) {
    try {
      const first = await getPage(host, 1);
      const pages = Math.min(CONFIG.maxPages, Number(first.total_pages) || 1);
      const all = [...(first.items || [])];
      for (let p = 2; p <= pages; p += CONFIG.parallel) {
        const batch = [];
        for (let q = p; q < p + CONFIG.parallel && q <= pages; q++) batch.push(getPage(host, q));
        for (const d of await Promise.all(batch)) all.push(...(d.items || []));
      }
      const live = all.filter((it) => String(it.series || "").toLowerCase() === "live" && it.name && Number.isFinite(Number(it.ovr)))
        .map((it) => ({ name: it.name, ovr: Math.round(Number(it.ovr)), team: teamAbbr(it.team), pos: it.display_position || null }));
      if (live.length < CONFIG.minPlayers) throw new Error(`only ${live.length} Live Series cards from ${host} (${all.length} items over ${pages} pages) — feed shape likely changed, nothing written`);
      const byName = {};
      for (const c of live) (byName[nrm(c.name)] = byName[nrm(c.name)] || []).push(c);
      return { byName, cards: live.length, pages, host };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("The Show API unreachable");
}

// ── Airtable ──
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
function getField(fields, candidates) {
  const keys = Object.keys(fields);
  for (const cand of candidates) for (const k of keys) if (norm(k) === norm(cand)) return { key: k, val: fields[k] };
  return null;
}
async function listAllRecords(base, token) {
  const records = []; let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(CONFIG.table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Airtable list HTTP ${r.status}: ${await r.text()}`);
    const d = await r.json();
    records.push(...(d.records || [])); offset = d.offset;
  } while (offset);
  return records;
}
async function patchBatch(base, token, updates) {
  for (let i = 0; i < updates.length; i += 10) {             // Airtable cap: 10 per request
    const r = await fetch(`https://api.airtable.com/v0/${base}/${encodeURIComponent(CONFIG.table)}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: updates.slice(i, i + 10) }),
    });
    if (!r.ok) {
      const body = await r.text();
      if (r.status === 403) throw new Error("Airtable refused the write (403): this token is read-only. In Airtable → Builder hub → Personal access tokens, add the data.records:write scope for this base. " + body);
      if (r.status === 422 && /UNKNOWN_FIELD_NAME/.test(body)) throw new Error(`Airtable has no "${CONFIG.defaultRatingField}" field on Players — add it as a Number field, then run this again. ` + body);
      throw new Error(`Airtable PATCH HTTP ${r.status}: ${body}`);
    }
    if (i + 10 < updates.length) await new Promise((res) => setTimeout(res, 250));
  }
}

export default async function handler(req, res) {
  try {
    const dry = !!(req.query || {}).dry;
    const token = (process.env.AIRTABLE_TOKEN || "").trim();
    const base = (process.env.AIRTABLE_BASE_ID || "").trim();
    if (!token || !base) return res.status(500).json({ error: "Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID env var" });

    const [show, records] = await Promise.all([fetchShowRatings(), listAllRecords(base, token)]);

    const updates = [], changes = [], unmatched = [], ambiguous = [];
    let matched = 0, ratingKey = null;
    for (const rec of records) { const f = getField(rec.fields || {}, CONFIG.ratingField); if (f) { ratingKey = f.key; break; } }
    if (!ratingKey) ratingKey = CONFIG.defaultRatingField;   // Airtable hides empty fields; first run on a blank column lands here

    for (const rec of records) {
      const f = rec.fields || {};
      const nameF = getField(f, CONFIG.nameField);
      if (!nameF || !nameF.val) continue;
      const name = Array.isArray(nameF.val) ? nameF.val[0] : nameF.val;
      const teamF = getField(f, CONFIG.teamField);
      const team = teamF ? teamAbbr(teamF.val) : null;
      const cands = show.byName[nrm(name)];
      if (!cands || !cands.length) { unmatched.push(name); continue; }
      let hit = cands[0];
      if (cands.length > 1) {
        hit = team ? cands.find((c) => c.team === team) : null;
        if (!hit) { ambiguous.push(name); continue; }        // two cards share the name and the team doesn't settle it — never guess
      }
      matched++;
      const oldOvr = f[ratingKey] != null && f[ratingKey] !== "" ? Math.round(Number(f[ratingKey])) : null;
      if (hit.ovr !== oldOvr) { updates.push({ id: rec.id, fields: { [ratingKey]: hit.ovr } }); changes.push({ name, from: oldOvr, to: hit.ovr }); }
    }

    if (!dry) await patchBatch(base, token, updates);

    return res.status(200).json({
      ok: true, dryRun: dry, source: show.host, liveSeriesCards: show.cards, pagesRead: show.pages,
      airtableRecords: records.length, matched, [dry ? "wouldUpdate" : "updated"]: updates.length, ratingField: ratingKey,
      changesSample: changes.sort((a, b) => Math.abs((b.to ?? 0) - (b.from ?? b.to ?? 0)) - Math.abs((a.to ?? 0) - (a.from ?? a.to ?? 0))).slice(0, 25),
      unmatchedSample: unmatched.slice(0, 20),     // minor leaguers / retired / spelling drift — The Show only rates players in the game
      ambiguousSample: ambiguous.slice(0, 20),     // shared names that need a Team Name in Airtable
      syncedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e.message || e) });
  }
}
