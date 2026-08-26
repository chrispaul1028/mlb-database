// Vercel serverless function: fetches your Airtable base server-side and
// returns ALL players (for the Player Hub) with bio, photo, and contract
// history (for the Contracts tab).
//
// Robustness:
//  1. Link fields between tables are AUTO-DETECTED by record ids.
//  2. Field names are matched fuzzily (case/space/punctuation-insensitive)
//     against candidate lists below.
//  3. Linked "Team Name" values (record ids) are resolved via the Teams table.
//
// Env vars required: AIRTABLE_TOKEN, AIRTABLE_BASE_ID

const TABLES = {
  players: "Players",
  contracts: "Contracts",
  years: "Contract Years",
  teams: "Teams", // optional - used to resolve linked team names
  stats: "Player Stats", // optional - one row per player per season
  teamStats: "Team Stats", // optional - W/L and run rates per team per season
  statsImport: "Stats Import", // optional - Savant-style extras (Barrel %, HR/9, batted balls)
};

const FIELDS = {
  playerName: ["Name", "Player Name", "Full Name"],
  playerPos: ["Position", "Pos"],
  playerNo: ["No.", "No", "Number", "Jersey", "Jersey Number"],
  playerTeamName: ["Team Name", "Team", "Current Team"],
  playerStatus: ["Status", "Player Status", "Availability"],
  player2K: ["The Show Rating", "MLB The Show Rating", "The Show", "Show Rating", "OVR", "Overall"],
  playerInjury: ["Injury Notes", "Injury Note", "Injury", "Injury Status", "Injury Report"],
  playerPhoto: ["Photo", "Headshot", "Headshots", "Player Photo", "Image", "Img", "Pic", "Picture", "Attachment", "Attachments"],
  playerHeight: ["Height"],
  playerWeight: ["Weight"],
  playerAge: ["Age"],
  playerStatus: ["Status"],
  playerArchetype: ["Archetype", "Player Type", "Play Style"],
  playerRole: ["Role", "Depth Chart", "Depth", "Lineup Role", "Rotation"],
  playerSort: ["Sort Priority", "Batting Order", "Rotation Order", "Rotation", "Pitching Order", "Pitcher Order", "SP Order", "Depth Chart", "Depth", "Sort", "Priority", "Depth Order", "Order"],
  playerDraft: ["Draft", "Draft Info", "Drafted"],
  playerDraftYear: ["Draft Year"],
  playerDraftRound: ["Draft Round", "Round", "Rd"],
  playerDraftPick: ["Draft Pick", "Pick", "Pick No", "Pick Number"],
  playerBirthplace: ["Birthplace", "Birth Place", "Born", "Hometown"],
  playerCollege: ["College", "School", "College/Country"],
  playerBT: ["Bats/Throws", "B/T", "Bats-Throws", "Handedness", "Bats Throws"],
  playerAwards: ["Awards", "Accolades", "Honors"],
  teamConference: ["League", "Conference", "Conf"],
  teamDivision: ["Division", "Div"],
  teamWins: ["W", "Wins"],
  teamPPG: ["RS/G", "Runs Per Game", "Runs Scored", "RS", "PPG", "Points Per Game"],
  teamOppPPG: ["RA/G", "Runs Against", "Runs Allowed", "RA", "OPP PPG", "Opp PPG"],
  teamLosses: ["L", "Losses"],
  teamName: ["Name", "Team Name", "Team"],
  teamAbbr: ["TM", "Abbreviation", "Abbr", "Short Name", "Code"],
  cKind: ["Contract Type", "Kind", "Type", "Deal Type"],
  cStatus: ["Status", "Contract Status"],
  cTeam: ["Team", "Signing Team"],
  cSigned: ["Signed Date", "Signed", "Date Signed", "Signed Year"],
  ySeason: ["Season", "Year"],
  sSeason: ["Season", "Year"],
  sGP: ["GP", "G", "Games", "Games Played", "Gms", "# Games", "Game Count", "GP (Games Played)"],
  sAVG: ["AVG", "BA", "Batting Average"],
  sHR: ["HR", "Home Runs", "HRs"],
  sRBI: ["RBI", "RBIs"],
  sSB: ["SB", "Stolen Bases", "SBs"],
  sOPS: ["OPS"],
  sW: ["W", "Wins"],
  sL: ["L", "Losses"],
  sERA: ["ERA"],
  sSO: ["SO", "K", "Strikeouts", "Ks"],
  sSV: ["SV", "Saves"],
  sIP: ["IP", "Innings Pitched", "Innings"],
  sWHIP: ["WHIP"],
  sAVGvL: ["AVG vL", "AVG vs L", "AVG vs LHP"],
  sOPSvL: ["OPS vL", "OPS vs L", "OPS vs LHP"],
  sAVGvR: ["AVG vR", "AVG vs R", "AVG vs RHP"],
  sOPSvR: ["OPS vR", "OPS vs R", "OPS vs RHP"],
  sStreak: ["Hit Streak", "Hitting Streak", "Streak"],
  ySalary: ["Salary", "Amount", "Cap Hit"],
  yType: ["Type", "Year Type", "Guarantee"],
  yDecision: ["Decision", "Option Decision"],
  yGuaranteed: ["Guaranteed $", "Guaranteed", "Guaranteed Amount", "Gtd"],
};

// Keys are normalized (lowercase, no spaces/punctuation) to match norm()
const TYPE_MAP = {
  "guaranteed": "G",
  "playeroption": "PO",
  "teamoption": "TO",
  "nonguaranteed": "NG",
  "partiallyguaranteed": "PG",
  "ufa": "UFA",
  "rfa": "RFA",
};


// Accepts a number, a numeric string ("4"), or an array holding either
// (single selects and lookups often arrive as strings/arrays).
function coerceNum(v) {
  if (Array.isArray(v)) v = v[0];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? null : n;
  }
  return null;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const isRecId = (v) => typeof v === "string" && /^rec[a-zA-Z0-9]{14}$/.test(v);

function getField(fields, candidates) {
  const keys = Object.keys(fields);
  for (const cand of candidates) {
    const target = norm(cand);
    for (const k of keys) {
      if (norm(k) === target) return fields[k];
    }
  }
  return undefined;
}

// Returns a clean string; resolves linked record ids via resolver map;
// never lets a raw rec id through.
function asText(val, resolver) {
  if (val == null) return "";
  if (Array.isArray(val)) {
    const parts = val
      .map((v) => asText(v, resolver))
      .filter(Boolean);
    return parts.join(", ");
  }
  if (isRecId(val)) return (resolver && resolver[val]) || "";
  return String(val);
}

function photoUrl(val) {
  if (Array.isArray(val) && val[0] && typeof val[0] === "object" && val[0].url) {
    const att = val[0];
    return (att.thumbnails && att.thumbnails.large && att.thumbnails.large.url) || att.url;
  }
  return null;
}

// Fallback: scan every field for an attachment-shaped value (array of
// objects with a url). Finds the headshot no matter what the field is named.
function findAnyPhoto(fields) {
  for (const val of Object.values(fields)) {
    const url = photoUrl(val);
    if (url) return url;
  }
  return null;
}

async function fetchAll(base, table, token) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable table "${table}": ${res.status} ${await res.text()} · server used base "${base}" (${base.length} chars)`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

function findLink(fields, targetIds) {
  for (const val of Object.values(fields)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        if (isRecId(item) && targetIds.has(item)) return item;
      }
    }
  }
  return null;
}

function seasonLabel(s) {
  if (!s) return "";
  const parts = String(s).split("-");
  const end = parts[1] || parts[0];
  return "'" + String(end).slice(-2);
}

// ESPN-style position sequence used to rank "QB1"/"RB2"-style sort labels.
const POS_SEQ = ["SP", "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH", "IF", "UT",
  "RP", "CP", "CL"];
function sortRank(raw) {
  if (raw == null) return null;
  const s = String(Array.isArray(raw) ? raw[0] : raw).trim().toUpperCase();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s); // plain numbers still work
  const m = s.match(/^([A-Z]+)\s*(\d*)$/);
  if (!m) return null;
  const i = POS_SEQ.indexOf(m[1]);
  // Unknown prefixes ("SP5", "CL1", anything new) still order by their
  // number within the group instead of silently dropping to the fallback.
  return (i === -1 ? 50 : i) * 100 + (m[2] ? Number(m[2]) : 0);
}

export default async function handler(req, res) {
  try {
    const token = (process.env.AIRTABLE_TOKEN || "").trim();
    const base = (process.env.AIRTABLE_BASE_ID || "").trim();
    if (!token || !base) {
      return res.status(500).json({ error: "Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID env var" });
    }

    // Resolve real table IDs via the metadata API so that invisible name
    // mismatches (trailing spaces, casing) can never cause a 404. Falls back
    // to the literal names if the token lacks schema.bases:read.
    const T = { ...TABLES };
    try {
      const metaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${base}/tables`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
        const byName = {};
        for (const t of meta.tables || []) byName[norm(t.name)] = t.id;
        for (const [key, name] of Object.entries(TABLES)) {
          if (byName[norm(name)]) T[key] = byName[norm(name)];
        }
      }
    } catch {}

    const [players, contracts, years] = await Promise.all([
      fetchAll(base, T.players, token),
      fetchAll(base, T.contracts, token),
      fetchAll(base, T.years, token),
    ]);

    // Stats are optional: prefer a single "Stats" table; fall back to the
    // legacy per-season table name if it exists.
    let statRecords = [];
    let impliedSeason = null;
    try {
      statRecords = await fetchAll(base, T.stats, token);
    } catch {
      try {
        statRecords = await fetchAll(base, "Stats", token); // pre-rename fallback
      } catch {
        statRecords = [];
      }
    }

    // Teams table is optional - used only to translate linked ids to names.
    let teamNameById = {};
    let teamsOut = [];
    try {
      const teams = await fetchAll(base, T.teams, token);
      for (const t of teams) {
        const abbr = asText(getField(t.fields, FIELDS.teamAbbr));
        const name = asText(getField(t.fields, FIELDS.teamName));
        teamNameById[t.id] = abbr || name || "";
        teamsOut.push({
          id: t.id,
          name: name || abbr,
          abbr,
          conference: asText(getField(t.fields, FIELDS.teamConference)),
          division: asText(getField(t.fields, FIELDS.teamDivision)),
          wins: coerceNum(getField(t.fields, FIELDS.teamWins)),
          ppg: coerceNum(getField(t.fields, FIELDS.teamPPG)),
          oppPpg: coerceNum(getField(t.fields, FIELDS.teamOppPPG)),
          losses: coerceNum(getField(t.fields, FIELDS.teamLosses)),
          logo: findAnyPhoto(t.fields),
        });
      }
      teamsOut.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    } catch {
      teamNameById = {};
      teamsOut = [];
    }

    // Optional "Team Stats" table: one row per team (per season). When
    // present, its W/L and run rates override the Teams-table columns.
    try {
      const tsRecords = await fetchAll(base, T.teamStats, token);
      const bestByTeam = {};
      for (const r of tsRecords) {
        const linkVal = getField(r.fields, ["Team", "Teams", "Team Name"]);
        let key = null;
        if (Array.isArray(linkVal) && linkVal.length) {
          const v = linkVal[0];
          if (typeof v === "string" && v.startsWith("rec")) key = v; // REST link: bare record id
          else if (v && v.id) key = v.id;
          else key = "name:" + String(v && v.name != null ? v.name : v).trim().toLowerCase();
        } else if (linkVal != null) {
          key = "name:" + String(linkVal).trim().toLowerCase();
        }
        if (!key) continue;
        const season = asText(getField(r.fields, ["Season", "Year"]));
        const prev = bestByTeam[key];
        if (!prev || String(season) > String(prev.season)) {
          bestByTeam[key] = {
            season,
            wins: coerceNum(getField(r.fields, ["W", "Wins"])),
            losses: coerceNum(getField(r.fields, ["L", "Losses"])),
            rs: coerceNum(getField(r.fields, ["RS", "Runs Scored", "Runs"])),
            ra: coerceNum(getField(r.fields, ["RA", "Runs Allowed", "Runs Against"])),
            ppg: coerceNum(getField(r.fields, ["RS/G", "Runs Per Game"])),
            oppPpg: coerceNum(getField(r.fields, ["RA/G", "Opp RPG"])),
          };
        }
      }
      for (const t of teamsOut) {
        const hit = bestByTeam[t.id] || bestByTeam["name:" + String(t.name).trim().toLowerCase()];
        if (!hit) continue;
        if (hit.wins != null) t.wins = hit.wins;
        if (hit.losses != null) t.losses = hit.losses;
        if (hit.rs != null) t.rs = hit.rs;
        if (hit.ra != null) t.ra = hit.ra;
        const g = (t.wins || 0) + (t.losses || 0);
        t.ppg = hit.ppg != null ? hit.ppg : (t.rs != null && g > 0 ? Math.round((t.rs / g) * 10) / 10 : t.ppg);
        t.oppPpg = hit.oppPpg != null ? hit.oppPpg : (t.ra != null && g > 0 ? Math.round((t.ra / g) * 10) / 10 : t.oppPpg);
      }
    } catch {}


    const playerIds = new Set(players.map((p) => p.id));
    const contractIds = new Set(contracts.map((c) => c.id));

    const statsByPlayer = {};
    for (const r of statRecords) {
      const pid = findLink(r.fields, playerIds);
      if (!pid) continue;
      (statsByPlayer[pid] ??= []).push({
        season: asText(getField(r.fields, FIELDS.sSeason)) || impliedSeason || "",
        gp: coerceNum(getField(r.fields, FIELDS.sGP)),
        avg: coerceNum(getField(r.fields, FIELDS.sAVG)),
        hr: coerceNum(getField(r.fields, FIELDS.sHR)),
        rbi: coerceNum(getField(r.fields, FIELDS.sRBI)),
        sb: coerceNum(getField(r.fields, FIELDS.sSB)),
        ops: coerceNum(getField(r.fields, FIELDS.sOPS)),
        w: coerceNum(getField(r.fields, FIELDS.sW)),
        l: coerceNum(getField(r.fields, FIELDS.sL)),
        era: coerceNum(getField(r.fields, FIELDS.sERA)),
        so: coerceNum(getField(r.fields, FIELDS.sSO)),
        sv: coerceNum(getField(r.fields, FIELDS.sSV)),
        ip: coerceNum(getField(r.fields, FIELDS.sIP)),
        whip: coerceNum(getField(r.fields, FIELDS.sWHIP)),
        avgVl: coerceNum(getField(r.fields, FIELDS.sAVGvL)),
        opsVl: coerceNum(getField(r.fields, FIELDS.sOPSvL)),
        avgVr: coerceNum(getField(r.fields, FIELDS.sAVGvR)),
        opsVr: coerceNum(getField(r.fields, FIELDS.sOPSvR)),
        streak: coerceNum(getField(r.fields, FIELDS.sStreak)),
      });
    }
    for (const [pid, arr] of Object.entries(statsByPlayer)) {
      const bySeason = {};
      for (const st of arr) {
        const key = String(st.season);
        if (!bySeason[key] || (st.gp ?? 0) > (bySeason[key].gp ?? 0)) bySeason[key] = st;
      }
      statsByPlayer[pid] = Object.values(bySeason);
    }
    for (const arr of Object.values(statsByPlayer)) {
      for (const st of arr) {
        // MLB: totals stay as-entered; normalize rate stats typed without
        // the decimal ("312" -> .312) while leaving "0.312" untouched.
        for (const k of ["avg", "ops", "avgVl", "opsVl", "avgVr", "opsVr"]) {
          if (st[k] != null && st[k] > 10) st[k] = st[k] / 1000;
        }
      }
      arr.sort((a, b) => String(b.season).localeCompare(String(a.season)));
    }

    const yearsByContract = {};
    for (const y of years) {
      const cid = findLink(y.fields, contractIds);
      if (!cid) continue;
      const rawSalary = getField(y.fields, FIELDS.ySalary);
      const rawType = asText(getField(y.fields, FIELDS.yType));
      const rawGtd = getField(y.fields, FIELDS.yGuaranteed);
      const season = asText(getField(y.fields, FIELDS.ySeason));
      (yearsByContract[cid] ??= []).push({
        s: seasonLabel(season),
        season,
        salary: typeof rawSalary === "number" ? rawSalary / 1e6 : null,
        type: TYPE_MAP[norm(rawType)] || rawType || "G",
        decision: asText(getField(y.fields, FIELDS.yDecision)) || null,
        gtd: typeof rawGtd === "number" ? rawGtd / 1e6 : null,
      });
    }

    const contractsByPlayer = {};
    for (const c of contracts) {
      const pid = findLink(c.fields, playerIds);
      if (!pid) continue;
      const yrs = (yearsByContract[c.id] || []).sort((a, b) =>
        a.season.localeCompare(b.season)
      );
      const signedRaw = getField(c.fields, FIELDS.cSigned);
      let signed = null;
      if (typeof signedRaw === "number") signed = signedRaw;
      else if (signedRaw) {
        const d = new Date(signedRaw);
        if (!isNaN(d)) signed = d.getFullYear();
      }
      (contractsByPlayer[pid] ??= []).push({
        kind: asText(getField(c.fields, FIELDS.cKind), teamNameById) || "Contract",
        team: asText(getField(c.fields, FIELDS.cTeam), teamNameById),
        status: asText(getField(c.fields, FIELDS.cStatus)) || "Active",
        signed,
        years: yrs,
      });
    }

    const out = players
      .map((p) => ({
        id: p.id,
        name: asText(getField(p.fields, FIELDS.playerName)) || "Unknown",
        pos: asText(getField(p.fields, FIELDS.playerPos)),
        no: asText(getField(p.fields, FIELDS.playerNo)),
        teamName: asText(getField(p.fields, FIELDS.playerTeamName), teamNameById),
        teamId: (() => {
          const v = getField(p.fields, FIELDS.playerTeamName);
          return Array.isArray(v) && typeof v[0] === "string" && /^rec[a-zA-Z0-9]{14}$/.test(v[0]) ? v[0] : null;
        })(),
        status: asText(getField(p.fields, FIELDS.playerStatus)),
        rating2k: coerceNum(getField(p.fields, FIELDS.player2K)),
        injuryNotes: asText(getField(p.fields, FIELDS.playerInjury)),
        photo: photoUrl(getField(p.fields, FIELDS.playerPhoto)) || findAnyPhoto(p.fields),
        height: asText(getField(p.fields, FIELDS.playerHeight)),
        weight: asText(getField(p.fields, FIELDS.playerWeight)),
        age: asText(getField(p.fields, FIELDS.playerAge)),
        status: asText(getField(p.fields, FIELDS.playerStatus)),
        rating2k: coerceNum(getField(p.fields, FIELDS.player2K)),
        archetype: asText(getField(p.fields, FIELDS.playerArchetype)),
        role: asText(getField(p.fields, FIELDS.playerRole)),
        sort: sortRank(getField(p.fields, FIELDS.playerSort)),
        sortLabel: asText(getField(p.fields, FIELDS.playerSort)),
        bt: asText(getField(p.fields, FIELDS.playerBT)),
        draft: asText(getField(p.fields, FIELDS.playerDraft)).replace(/^\s*\d{4}\s*[:\u00b7\-]?\s*/, ""),
        draftYear: coerceNum(getField(p.fields, FIELDS.playerDraftYear)),
        birthplace: asText(getField(p.fields, FIELDS.playerBirthplace)),
        college: asText(getField(p.fields, FIELDS.playerCollege)),
        draftRound: coerceNum(getField(p.fields, FIELDS.playerDraftRound)),
        draftPick: coerceNum(getField(p.fields, FIELDS.playerDraftPick)),
        stats: statsByPlayer[p.id] || [],
        awards: (() => { const v = getField(p.fields, FIELDS.playerAwards); return Array.isArray(v) ? v.filter((x) => typeof x === "string" && !isRecId(x)) : (v ? [String(v)] : []); })(),
        contracts: (contractsByPlayer[p.id] || []).sort(
          (a, b) => (b.signed || 0) - (a.signed || 0)
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // ── LIVE BATTING ORDER OVERLAY ─────────────────────────────────
    // On every load, pull the latest official lineup from MLB's free API
    // for any team with a real roster here (5+ players), and override
    // Sort Priority in-memory. No Airtable writes, no script needed:
    // refresh the app and the newest posted lineup is what you see.
    // Optional "Stats Import" table: Barrel % / BBE for hitters, HR/9 for
    // pitchers - attached to players by link or (accent-insensitive) name.
    const importOnly = [];
    const importDebug = { tableName: T.statsImport, rows: 0, attachedToPlayers: 0, importOnly: 0, sampleFields: [], error: null };
    try {
      const impRecords = await fetchAll(base, T.statsImport, token);
      importDebug.rows = impRecords.length;
      if (impRecords.length) importDebug.sampleFields = Object.keys(impRecords[0].fields || {});
      // Accents, dotless-i, periods and Jr./Sr./II/III all dropped so the
      // MLB roster name and the Savant import name land on the same key.
      const normI = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u0131\u0130]/g, "i").replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
      const impById = {};
      const impByName = {};
      for (const r of impRecords) {
        const entry = {
          barrel: coerceNum(getField(r.fields, ["Barrel %", "Barrel%", "Brl%", "Barrel"])),
          brlL: coerceNum(getField(r.fields, ["Barrel % vs LHP", "Barrel% vs LHP", "Brl% vs L", "Barrel vs LHP"])),
          brlR: coerceNum(getField(r.fields, ["Barrel % vs RHP", "Barrel% vs RHP", "Brl% vs R", "Barrel vs RHP"])),
          hr9: coerceNum(getField(r.fields, ["HR/9", "HR9", "HR per 9"])),
          oaa: coerceNum(getField(r.fields, ["OAA", "Outs Above Average"])),
          bbe: coerceNum(getField(r.fields, ["Batted Balls", "BBE", "Batted Ball Events", "Attempts"])),
          // v92 additions (all optional - the app falls back to MLB API data):
          brlPa: coerceNum(getField(r.fields, ["Barrel/PA", "Barrel per PA", "Brl/PA", "brl_pa", "Barrel PA", "Barrel/PA %"])),
          gb: coerceNum(getField(r.fields, ["GB %", "GB%", "Ground Ball %", "Groundball %", "groundballs_percent", "GB Rate"])),
          pa: coerceNum(getField(r.fields, ["PA", "Plate Appearances"])),
          hr: coerceNum(getField(r.fields, ["HR", "Home Runs", "home_run"])),
        };
        const pv = getField(r.fields, ["Player", "Name"]);
        if (Array.isArray(pv) && pv.length) {
          const v = pv[0];
          if (typeof v === "string" && v.startsWith("rec")) impById[v] = entry;
          else if (v && v.id) impById[v.id] = entry;
          else impByName[normI(v && v.name != null ? v.name : v)] = entry;
        } else if (pv != null) {
          impByName[normI(pv)] = entry;
        }
      }
      const claimed = new Set();
      for (const p of out) {
        const hit = impById[p.id] || impByName[normI(p.name)];
        if (!hit) continue;
        claimed.add(hit);
        importDebug.attachedToPlayers++;
        if (hit.barrel != null) p.barrel = hit.barrel;
        if (hit.brlL != null) p.brlL = hit.brlL;
        if (hit.brlR != null) p.brlR = hit.brlR;
        if (hit.hr9 != null) p.hr9 = hit.hr9;
        if (hit.oaa != null) p.oaa = hit.oaa;
        if (hit.bbe != null) p.bbe = hit.bbe;
        if (hit.brlPa != null) p.brlPa = hit.brlPa;
        if (hit.gb != null) p.gb = hit.gb;
        if (hit.pa != null) p.pa = hit.pa;
        if (hit.hr != null) p.hr = hit.hr;
      }
      // League-wide coverage: Stats Import rows with no matching Players
      // record still ship to the app (name + numbers only) so the HR
      // Board can show data for every lineup, not just rostered players.
      for (const r of impRecords) {
        const pv = getField(r.fields, ["Player", "Name"]);
        const nameStr = Array.isArray(pv)
          ? (pv[0] && pv[0].name) || null
          : typeof pv === "string" && !pv.startsWith("rec") ? pv : null;
        if (!nameStr) continue;
        const entry = impByName[normI(nameStr)];
        if (!entry || claimed.has(entry)) continue;
        importOnly.push({
          name: nameStr,
          team: getField(r.fields, ["Team", "Tm"]) || null,
          barrel: entry.barrel, brlL: entry.brlL, brlR: entry.brlR,
          hr9: entry.hr9, bbe: entry.bbe,
          brlPa: entry.brlPa, gb: entry.gb, pa: entry.pa, hr: entry.hr,
        });
      }
    } catch (e) {
      importDebug.error = String((e && e.message) || e);
    }
    importDebug.importOnly = importOnly.length;
    if (req.query && req.query.debug === "imports") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(importDebug);
    }

    const lineupDebug = [];
    try {
      const rosterCounts = {};
      for (const p of out) {
        const tn = String(p.teamName || "").trim().toLowerCase();
        if (tn) rosterCounts[tn] = (rosterCounts[tn] || 0) + 1;
      }
      const myTeams = teamsOut.filter((t) => (rosterCounts[String(t.name).trim().toLowerCase()] || 0) >= 5
        || out.filter((p) => p.teamId === t.id).length >= 5);
      lineupDebug.push("rostered teams: " + (myTeams.map((t) => t.name).join(", ") || "NONE (no team with 5+ players)"));
      if (myTeams.length > 0) {
        const dirRes = await fetch("https://statsapi.mlb.com/api/v1/teams?sportId=1");
        const dir = await dirRes.json();
        // Dates in US Eastern - the server runs on UTC, where "today" flips
        // at 8pm ET and would otherwise look up tomorrow's game.
        const etDay = (offsetDays) => {
          const d = new Date(Date.now() - offsetDays * 86400000);
          return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
        };
        // ONE schedule call for the whole league, then boxscores in parallel.
        const schedRes = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${etDay(2)}&endDate=${etDay(0)}`);
        const sched = await schedRes.json();
        const allGames = (sched.dates || []).flatMap((d) => d.games || []);
        lineupDebug.push(allGames.length + " league game(s) between " + etDay(2) + " and " + etDay(0));

        const normName = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[\u0131\u0130]/g, "i").replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
        await Promise.all(myTeams.map(async (t) => {
          const mlbTeam = (dir.teams || []).find((x) => x.name.toLowerCase() === String(t.name).trim().toLowerCase());
          if (!mlbTeam) { lineupDebug.push(t.name + ": no MLB team by that name"); return; }

          // ── LIVE STATUS + INJURY NOTES (same freshness as lineups) ──
          try {
            const shortStatus = (desc) => {
              const d = String(desc || "");
              if (/^active$/i.test(d)) return "Active";
              const il = d.match(/(\d+)-day injured list/i);
              if (il) return "IL" + il[1];
              if (/60-day/i.test(d)) return "IL60";
              if (/minor/i.test(d)) return "Minors";
              return d || null;
            };
            const rosterRes = await fetch(`https://statsapi.mlb.com/api/v1/teams/${mlbTeam.id}/roster?rosterType=40Man`);
            const rosterData = await rosterRes.json();
            const statusByName = {};
            for (const e of rosterData.roster || []) {
              if (e.person && e.person.fullName) statusByName[normName(e.person.fullName)] = shortStatus(e.status && e.status.description);
            }
            const notesByName = {};
            const yr = etDay(0).slice(0, 4);
            const txRes = await fetch(`https://statsapi.mlb.com/api/v1/transactions?teamId=${mlbTeam.id}&startDate=${yr}-01-01&endDate=${etDay(0)}`);
            const txData = await txRes.json();
            for (const tx of txData.transactions || []) {
              if (!tx.person || !tx.person.fullName || !tx.description) continue;
              if (!/injured list/i.test(tx.description)) continue;
              const parts = tx.description.split(". ").map((x) => x.trim()).filter(Boolean);
              const last = parts[parts.length - 1].replace(/\.$/, "");
              if (last && !/injured list/i.test(last)) notesByName[normName(tx.person.fullName)] = last;
            }
            let statusMatched = 0;
            for (const p of out) {
              const mine = p.teamId === t.id || String(p.teamName || "").trim().toLowerCase() === String(t.name).trim().toLowerCase();
              if (!mine) continue;
              const liveStatus = statusByName[normName(p.name)];
              if (!liveStatus) continue;
              p.status = liveStatus;
              if (/^il/i.test(liveStatus)) {
                p.injuryNotes = notesByName[normName(p.name)] || p.injuryNotes || null;
              } else {
                p.injuryNotes = null;
              }
              statusMatched++;
            }
            lineupDebug.push(t.name + ": live status for " + statusMatched + " players");
          } catch {}

          const games = allGames.filter((g) =>
            (g.teams && g.teams.home && g.teams.home.team.id === mlbTeam.id) ||
            (g.teams && g.teams.away && g.teams.away.team.id === mlbTeam.id));
          for (let gi = games.length - 1; gi >= 0 && gi >= games.length - 2; gi--) {
            const boxRes = await fetch(`https://statsapi.mlb.com/api/v1/game/${games[gi].gamePk}/boxscore`);
            const box = await boxRes.json();
            const side = box.teams && box.teams.home && box.teams.home.team.id === mlbTeam.id ? "home" : "away";
            const order = (box.teams && box.teams[side] && box.teams[side].battingOrder) || [];
            if (!order.length) continue;
            const orderByName = {};
            const posByName = {};
            order.forEach((pid, i) => {
              const pd = box.teams[side].players["ID" + pid];
              if (pd && pd.person && pd.person.fullName) {
                const key = normName(pd.person.fullName);
                orderByName[key] = i + 1;
                if (pd.position && pd.position.abbreviation) posByName[key] = pd.position.abbreviation;
              }
            });
            // Pitchers never appear in a DH-era batting order, so the
            // overlay must leave their Airtable "Sort Priority" (rotation
            // slot 1-5, bullpen order) untouched. Previously every pitcher
            // was wiped to null here, which is why the rotation showed
            // "no sort" and fell back to salary order.
            const isPitcher = (p) => {
              const role = String(p.role || "").trim().toLowerCase();
              if (role === "pitching" || role === "bullpen") return true;
              const pos = String(p.pos || "").toUpperCase().replace(/\s+/g, "");
              return ["P", "SP", "RP", "CP", "CL", "LHP", "RHP", "SP/RP", "RP/SP"].includes(pos);
            };
            let matched = 0;
            for (const p of out) {
              const mine = p.teamId === t.id || String(p.teamName || "").trim().toLowerCase() === String(t.name).trim().toLowerCase();
              if (!mine) continue;
              if (isPitcher(p)) continue; // keep Airtable rotation order as-is
              const key = normName(p.name);
              const spot = orderByName[key];
              if (spot) { p.sort = spot; p.sortLabel = String(spot); if (posByName[key]) p.gamePos = posByName[key]; matched++; }
              else if (/^\d+$/.test(String(p.sortLabel || "").trim())) { p.sort = null; p.sortLabel = null; }
            }
            lineupDebug.push(t.name + ": matched " + matched + "/" + order.length +
              (matched < order.length ? " \u00b7 MLB names: " + Object.keys(orderByName).join(", ") : ""));
            return; // latest game with a lineup wins
          }
          lineupDebug.push(t.name + ": no game with a posted lineup in window");
        }));
      }
    } catch (e) { lineupDebug.push("overlay error: " + (e && e.message ? e.message : String(e))); }

    if (req.query && req.query.lineup === "1") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ lineupDebug });
    }

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ apiVersion: "v23.9", players: out, teams: teamsOut, imports: importOnly });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
