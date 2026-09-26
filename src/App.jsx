import React from "react";
import { useState, useMemo, useEffect, useRef } from "react";

// ═══════════════ THEME (edit these to restyle the app) ═══════════
// Player detail header color:
//   "team"   -> uses the player's CURRENT team color
//   any hex  -> one fixed color for everyone, e.g. "#1e293b"
const HEADER_COLOR = "team";

// Season used for team payroll totals (must match your Season select format)
const CURRENT_SEASON = "2026";

// Salary bar colors by year type - change any hex you like.
const BAR_COLORS = {
  G: "#2563eb",    // guaranteed        (blue)
  PO: "#22c55e",   // player option     (green)
  TO: "#dc2626",   // team option       (red)
  NG: "#cbd5e1",   // non-guaranteed    (slate)
  PG: "#d2b48c",   // partially gtd     (tan)
  UFA: "#e2e8f0",  // free agent stub
  RFA: "#fecdd3",  // restricted stub
};
// Accent for the Total tile + featured contract border.
const ACCENT_TEXT = "text-emerald-600";
const ACCENT_BORDER = "border-emerald-200";

// ═══════════════ CHIP THEME (edit these to restyle every stat pill) ═══
// Every colored stat chip in the app - Brl%, GB%, HR/9, lineup chips,
// board pills - reads from these four strings. Green always means
// "good for the HR bet", red always means "fights it".
const CHIP = {
  good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  bad: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300",
  none: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
};
// The headline HR% number and scorecard accents.
const HR_ACCENT = "text-emerald-600 dark:text-emerald-400";

const TEAM_COLORS = {
  ARI: "#A71930", ATL: "#CE1141", BAL: "#DF4601", BOS: "#BD3039",
  CHC: "#0E3386", CWS: "#27251F", CHW: "#27251F", CIN: "#C6011F",
  CLE: "#00385D", COL: "#333366", DET: "#0C2340", HOU: "#002D62",
  KC: "#004687", LAA: "#BA0021", LAD: "#005A9C", MIA: "#00A3E0",
  MIL: "#12284B", MIN: "#002B5C", NYM: "#002D72", NYY: "#0C2340",
  OAK: "#003831", ATH: "#003831", PHI: "#E81828", PIT: "#0a0a0a",
  SD: "#2F241D", SF: "#FD5A1E", SEA: "#0C2C56", STL: "#C41E3A",
  TB: "#092C5C", TEX: "#003278", TOR: "#134A8E", WSH: "#AB0003",
};

// Full team names -> abbreviations, so a player's current team
// (which may be stored as "New York Knicks") maps to its color.
const NAME_TO_ABBR = {
  "arizona diamondbacks": "ARI", "atlanta braves": "ATL", "baltimore orioles": "BAL",
  "boston red sox": "BOS", "chicago cubs": "CHC", "chicago white sox": "CWS",
  "cincinnati reds": "CIN", "cleveland guardians": "CLE", "colorado rockies": "COL",
  "detroit tigers": "DET", "houston astros": "HOU", "kansas city royals": "KC",
  "los angeles angels": "LAA", "los angeles dodgers": "LAD", "miami marlins": "MIA",
  "milwaukee brewers": "MIL", "minnesota twins": "MIN", "new york mets": "NYM",
  "new york yankees": "NYY", "oakland athletics": "ATH", "athletics": "ATH",
  "philadelphia phillies": "PHI", "pittsburgh pirates": "PIT", "san diego padres": "SD",
  "san francisco giants": "SF", "seattle mariners": "SEA", "st. louis cardinals": "STL",
  "st louis cardinals": "STL", "tampa bay rays": "TB", "texas rangers": "TEX",
  "toronto blue jays": "TOR", "washington nationals": "WSH",
};

function toAbbr(team) {
  if (!team) return "";
  const t = String(team).trim();
  if (TEAM_COLORS[t.toUpperCase()]) return t.toUpperCase();
  return NAME_TO_ABBR[t.toLowerCase()] || "";
}
const teamColor = (abbr) => TEAM_COLORS[String(abbr).toUpperCase()] || "#334155";
const hexRgb = (hex) => { const h = String(hex || "#334155").replace("#", ""); const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0); };
const lumOf = (hex) => { const [r, g, b] = hexRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
// shade(c, -12) = 12% darker, shade(c, 12) = 12% lighter
const shade = (hex, pct) => { const t = pct < 0 ? 0 : 255, k = Math.abs(pct) / 100; return "#" + hexRgb(hex).map((v) => Math.round(v + (t - v) * k).toString(16).padStart(2, "0")).join(""); };
// Matchup banner colour: a pale cap (Pirates gold, Marlins blue) is deepened so the white score holds up
const bannerColor = (abbr) => { const c = teamColor(abbr), l = lumOf(c); return l > 0.55 ? shade(c, -(l * 100 - 42)) : c; };
// Current-team color first; falls back to the contract team if no current team.
function playerHeaderColor(p) {
  if (HEADER_COLOR !== "team") return HEADER_COLOR;
  const current = toAbbr(p.teamName);
  if (current) return teamColor(current);
  const act = activeOf(p);
  return teamColor(act?.team || "");
}

const TYPE_LABEL = { G: "Guaranteed", PO: "Player Option", TO: "Team Option", NG: "Non-Guaranteed", PG: "Partially Gtd", UFA: "Free Agent", RFA: "Restricted FA" };
const BADGE = { PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", TO: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300", NG: "bg-slate-100 text-slate-500 dark:text-slate-400", PG: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", UFA: "bg-slate-100 text-slate-500 dark:text-slate-400", RFA: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300" };

const fmtM = (v) => "$" + v.toFixed(1) + "M";
const cleanNo = (no) => String(no || "").replace(/^#+/, "");
const salaried = (c) => c.years.filter((y) => y.salary != null);
const total = (c) => salaried(c).reduce((a, y) => a + y.salary, 0);
const terms = (c) => salaried(c).length + " yrs / " + fmtM(total(c));
const displayLine = (c) => terms(c) + (c.team ? " (" + c.team + ")" : "") + " · " + c.kind;
const activeOf = (p) => p.contracts.find((c) => c.status === "Active") || p.contracts[0] || null;

// Years in the league, computed from Draft Year vs the current season.
function latestStats(p) {
  return p.stats && p.stats.length > 0 ? p.stats[0] : null;
}
const fmt1 = (v) => (v == null ? null : Number(v).toFixed(1));

// Inclusive season count: drafted 2014 -> 2025-26 is season #12.
function experienceOf(p) {
  if (!p.draftYear) return "";
  const nowYear = parseInt(String(CURRENT_SEASON).slice(0, 4), 10);
  const seasons = nowYear - p.draftYear + 1;
  if (isNaN(seasons) || seasons < 1) return "";
  return seasons === 1 ? "Rookie" : ordinal(seasons) + " season";
}

// Search matches player name, current team (full name or abbreviation),
// or the active contract's team. "knicks", "NY", "jalen" all work.
function matchesQuery(p, q) {
  if (!q) return true;
  const s = q.toLowerCase().trim();
  return hrbNrm(p.name).includes(hrbNrm(s));   // players are searched by name only
}
function matchesQueryWithTeam(p, q) {
  if (!q) return true;
  const s = q.toLowerCase().trim();
  if (p.name.toLowerCase().includes(s)) return true;
  const team = String(p.teamName || "").toLowerCase();
  if (team.includes(s)) return true;
  const abbr = toAbbr(p.teamName) || (activeOf(p) && activeOf(p).team) || "";
  if (String(abbr).toLowerCase().includes(s)) return true;
  const actTeam = activeOf(p) ? String(activeOf(p).team).toLowerCase() : "";
  if (actTeam.includes(s)) return true;
  for (const c of p.contracts) {
    if (String(c.kind).toLowerCase().includes(s)) return true;
  }
  return false;
}


// ═══════════════ MLB DATA LAYER (v106) ═══════════════════════════
// Every MLB Stats API call goes through mlbFetch() → /api/mlb on our own
// server (Vercel edge-cached). Same JSON as before, so no screen changes.
//  • identical requests made at the same moment share ONE network call
//    (the board, the game screen and the field view all want the same box)
//  • answers are remembered briefly, so flipping between screens is instant
//  • if /api/mlb is ever unreachable it falls back to MLB directly — the app
//    can't be bricked by a missing server file
const MLB_DIRECT = "https://statsapi.mlb.com/api/";
const MLB_MEMO = new Map(); // path -> { at, job: Promise<{ok,status,body}> }
const mlbTtl = (path) => (/^v1(\.1)?\/game\/|^v1\/schedule/.test(path) ? 10000
  : /^v1\/people\/search|^v1\/teams(\?|$|\/\d+\/coaches)/.test(path) ? 3600000
  : 300000);
function mlbFetch(path) {
  path = String(path).replace(MLB_DIRECT, "");
  const now = Date.now();
  const hit = MLB_MEMO.get(path);
  let job = hit && now - hit.at < mlbTtl(path) ? hit.job : null;
  if (!job) {
    job = (async () => {
      try {
        const r = await fetch("/api/mlb?path=" + encodeURIComponent(path));
        if (r.ok) { const t = await r.text(); if (/^\s*[\[{]/.test(t)) return { ok: true, status: 200, body: t }; } // must be JSON
      } catch {}
      const d = await fetch(MLB_DIRECT + path);                 // fallback: straight to MLB
      return { ok: d.ok, status: d.status, body: await d.text() };
    })();
    MLB_MEMO.set(path, { at: now, job });
    const forget = () => { if ((MLB_MEMO.get(path) || {}).job === job) MLB_MEMO.delete(path); };
    job.then((x) => { if (!x.ok) forget(); }, forget);          // never remember a failure
    for (const [k, v] of MLB_MEMO) { if (now - v.at > Math.max(mlbTtl(k), 60000)) MLB_MEMO.delete(k); } // drop stale copies (box scores are big)
  }
  // Looks like a fetch Response to the callers; each gets its own parsed copy.
  return job.then((x) => ({ ok: x.ok, status: x.status, json: async () => JSON.parse(x.body), text: async () => x.body }));
}

// ═══════════════ SHARED PIECES ═══════════════════════════════════
const MLB_ID_CACHE = {};
const STREAK_BY_ID = {};
function LiveStreak({ p }) {
  const key = String(p.name || "").toLowerCase();
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let mid = MLB_ID_CACHE[key];
        if (mid === undefined) {
          const d = await (await mlbFetch(`v1/people/search?names=${encodeURIComponent(p.name)}`)).json();
          mid = (d.people || [])[0] ? d.people[0].id : null;
          MLB_ID_CACHE[key] = mid;
        }
        if (!mid || STREAK_BY_ID[mid] !== undefined) { if (alive) force((x) => x + 1); return; }
        const gl = await (await mlbFetch(`v1/people/${mid}/stats?stats=gameLog&group=hitting`)).json();
        const splits = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
        const todayET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
        let n = 0;
        for (let j = splits.length - 1; j >= 0; j--) {
          if (splits[j].date === todayET) continue;
          const st = splits[j].stat || {};
          if ((st.atBats ?? 0) === 0) continue;
          if ((st.hits ?? 0) > 0) { if (n < 0) break; n++; }
          else { if (n > 0) break; n--; }
        }
        STREAK_BY_ID[mid] = n;
        if (alive) force((x) => x + 1);
      } catch {}
    })();
    return () => { alive = false; };
  }, [key]);
  const mid = MLB_ID_CACHE[key];
  const n = mid != null ? STREAK_BY_ID[mid] : undefined;
  if (n == null) return null;
  if (n >= 5) return <span className="ml-1 text-[11px] font-extrabold text-orange-500">{n}🔥</span>;
  if (n <= -5) return <span className="ml-1 text-[11px] font-extrabold text-sky-400">{-n}❄️</span>;
  return null;
}
function Avatar({ p, size }) {
  const px = size === "lg" ? "w-20 h-20 text-2xl" : size === "md" ? "w-14 h-14 text-base" : "w-11 h-11 text-sm";
  const team = p._virtual ? (p.teamAbbr || "") : teamOfPlayer(p);
  const key = String(p.name || "").toLowerCase() + (team ? "|" + team : "");          // name + team: two players sharing a name never share a photo
  const byName = LEADERS_CACHE.stats && LEADERS_CACHE.stats.byName;
  const known = p.mlbId || (byName && (team ? byName[hrbNrm(p.name) + "|" + team] : byName[hrbNrm(p.name)])) || null;
  if (known && MLB_ID_CACHE[key] == null) MLB_ID_CACHE[key] = known;
  const [mid, setMid] = useState(MLB_ID_CACHE[key]);
  useEffect(() => {
    if (p.photo || MLB_ID_CACHE[key] != null) { if (MLB_ID_CACHE[key] !== mid) setMid(MLB_ID_CACHE[key]); return; }
    if (MLB_ID_CACHE[key] === null) return;
    let alive = true;
    MLB_ID_CACHE[key] = null; // claim so parallel rows don't double-fetch
    mlbFetch(`v1/people/search?names=${encodeURIComponent(p.name)}&hydrate=currentTeam`)
      .then((r) => r.json())
      .then((d) => {
        const people = d.people || [];
        const tid = MLB_TEAM_ID[team];
        const person = people.find((x) => x.active && x.currentTeam && x.currentTeam.id === tid)   // right team, still playing
          || people.find((x) => x.active) || people[0];
        MLB_ID_CACHE[key] = person ? person.id : null;
        if (alive) setMid(MLB_ID_CACHE[key]);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [key]);
  if (p.photo) {
    return <img src={p.photo} alt={p.name} className={px + " rounded-full object-cover object-top bg-white shrink-0"} />;
  }
  if (mid) {
    return <img src={"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png,q_auto:best,f_auto/v1/people/" + mid + "/headshot/silo/current"}
      alt={p.name} className={px + " rounded-full object-cover object-top bg-white shrink-0"} loading="lazy" />;
  }
  const no = cleanNo(p.no);
  const label = no ? "#" + no : p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className={px + " rounded-full bg-slate-200 text-slate-500 dark:text-slate-400 dark:bg-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0"}>
      {label}
    </div>
  );
}


function rankOf(teams, team, key, dir) {
  if (!teams || team[key] == null) return null;
  const vals = teams.filter((t) => t[key] != null);
  if (vals.length < 2) return null;
  const sorted = vals.slice().sort((a, b) => (dir === "asc" ? a[key] - b[key] : b[key] - a[key]));
  const rank = sorted.findIndex((t) => t.id === team.id) + 1;
  if (!rank) return null;
  const cls =
    rank <= 10 ? "text-green-600 dark:text-green-400"
    : rank <= 20 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  return { label: "(" + ordinal(rank) + ")", cls };
}

function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return n + "th";
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return n + suffix;
}

function Tile({ value, label, sub, accent, valueClass, topColor }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-2 py-4 text-center shadow-sm flex flex-col items-center justify-start"
      style={topColor ? { borderTop: "3px solid " + topColor } : undefined}>
      <div className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">{label}</div>
      <div className={"text-2xl font-extrabold tracking-tight " + (valueClass ? valueClass : accent ? ACCENT_TEXT : "text-slate-900 dark:text-slate-100")}>{value}</div>
      {sub && (
        <div className={"text-[10px] font-bold mt-0.5 " + (typeof sub === "object" && sub.cls ? sub.cls : "text-blue-600 dark:text-blue-400")}>
          {typeof sub === "object" && sub.label !== undefined ? sub.label : sub}
        </div>
      )}
    </div>
  );
}


// "2026-2027" -> "'26-'27"; falls back to the old single-year tick
function seasonTick(y) {
  const raw = String(y.season || "");
  const m = raw.match(/(\d{4})\s*-\s*(\d{4})/);
  if (m) return "'" + m[1].slice(2) + "-'" + m[2].slice(2);
  const single = raw.match(/(\d{4})/);
  if (single) return single[1];
  return y.s;
}

function SalaryBars({ years }) {
  const max = Math.max(...years.map((y) => y.salary ?? 0), 1);
  return (
    <div className="flex items-end gap-2 h-32 mt-2">
      {years.map((y, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
            {y.salary == null ? y.type : fmtM(y.salary)}
          </div>
          <div
            className="w-full rounded-t-md"
            style={{
              backgroundColor: BAR_COLORS[y.type] || BAR_COLORS.G,
              height: y.salary == null ? "6px" : Math.max((y.salary / max) * 100, 8) + "%",
            }}
          />
          <div className="text-[10px] font-semibold text-slate-400 mt-1 whitespace-nowrap">{seasonTick(y)}</div>
        </div>
      ))}
    </div>
  );
}

function ContractCard({ c, big }) {
  return (
    <div className={"bg-white dark:bg-slate-900 rounded-2xl border shadow-sm px-4 py-4 " + (big ? ACCENT_BORDER : "border-slate-200 dark:border-slate-800")}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase truncate">
            {c.kind}{c.team ? " · " + c.team : ""}{c.signed ? " · " + c.signed : ""}
          </div>
          <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">{terms(c)}</div>
        </div>
        <span className={"text-[10px] font-bold px-2 py-1 rounded-full shrink-0 " + (c.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300")}>
          {c.status}
        </span>
      </div>
      <SalaryBars years={c.years} />
      <div className="flex flex-wrap gap-1.5 mt-3">
        {c.years
          .filter((y) => y.type !== "G")
          .filter((y, _, arr) => {
            const isFA = y.type === "UFA" || y.type === "RFA";
            const hasOption = arr.some((o) => (o.type === "PO" || o.type === "TO") && !o.decision);
            return !(isFA && hasOption); // option chip covers it - FA chip is redundant
          })
          .map((y, i) => (
          <span key={i} className={"text-[11px] font-semibold px-2 py-1 rounded-full " + (BADGE[y.type] || "bg-slate-100 text-slate-500 dark:text-slate-400")}>
            {y.season || y.s} · {TYPE_LABEL[y.type] || y.type}
            {y.decision ? " · " + y.decision : ""}
            {y.gtd != null ? " (" + fmtM(y.gtd) + " gtd)" : ""}
          </span>
        ))}
        {c.years.length > 0 && c.years.every((y) => y.type === "G") && (
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Fully guaranteed</span>
        )}
      </div>
    </div>
  );
}

function BioRow({ k, v }) {
  if (!v) return null;
  return (
    <div className="flex justify-between px-4 py-3 text-sm">
      <span className="text-slate-400 font-medium">{k}</span>
      <span className="text-slate-800 dark:text-slate-200 font-semibold">{v}</span>
    </div>
  );
}

// ═══════════════ PLAYER DETAIL ═══════════════════════════════════
// ═══════════════ PLAYER PAGE: live bio + season block + trend chart ═════
// Same shape as the football player card: "2026 SEASON · GP" tile grid, then
// pills that switch a line chart. Hitters and pitchers get their own tiles,
// their own pills and their own game log — never the same chart for both.
const fmtDateLong = (iso) => { if (!iso) return ""; const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z"); return isNaN(d) ? "" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d); };
const fmtHeight = (h) => { const m = /(\d)\D+(\d{1,2})/.exec(String(h || "")); return m ? `${m[1]}'${m[2]}"` : String(h || "").trim(); };
const fmtWeight = (w) => { const m = /(\d{2,3})/.exec(String(w || "")); return m ? m[1] + " lbs" : ""; };

// MLB's own record for this player (birth date, debut, height/weight) + his live season line.
function useMlbPerson(p) {
  const { stats } = useLeagueData();
  const [person, setPerson] = useState(null);
  const line = seasonLineFor(stats, p, teamOfPlayer(p));
  const lineId = line ? line.id : null;
  useEffect(() => {
    if (!stats) return;                      // wait for the league file: its id is exact, a name search can hit the wrong man
    let alive = true;
    (async () => {
      try {
        let id = lineId || MLB_ID_CACHE[String(p.name || "").toLowerCase()];
        if (!id) { const s = await (await mlbFetch(`v1/people/search?names=${encodeURIComponent(p.name)}`)).json(); id = ((s.people || [])[0] || {}).id; }
        if (!id) return;
        const d = await (await mlbFetch(`v1/people/${id}`)).json();
        if (alive) setPerson((d.people || [])[0] || { id });
      } catch {}
    })();
    return () => { alive = false; };
  }, [p.id, lineId, !!stats]);
  return { person, line, stats };
}

// [key, pill label, gameLog stat field] — rate pills (AVG / ERA) are computed over a rolling window
const BAT_PILLS = [["h", "Hits", "hits"], ["hr", "HR", "homeRuns"], ["rbi", "RBI", "rbi"], ["r", "Runs", "runs"], ["tb", "Total Bases", "totalBases"], ["so", "K", "strikeOuts"], ["avg", "AVG", null]];
const PIT_PILLS = [["so", "K", "strikeOuts"], ["ip", "IP", "inningsPitched"], ["er", "Earned Runs", "earnedRuns"], ["h", "Hits", "hits"], ["bb", "Walks", "baseOnBalls"], ["np", "Pitches", "numberOfPitches"], ["era", "ERA", null]];
const ipNum = (ip) => { const f = parseFloat(ip || "0"); return Math.floor(f) + Math.round((f % 1) * 10) / 3; };

function SeasonPanel({ p, person, line, season }) {
  const pitcher = isPitcherP(p) ? !!(line && line.pit) || !(line && line.hit) : !(line && line.hit) && !!(line && line.pit);
  const S = line ? (pitcher ? line.pit : line.hit) : null;
  const pills = pitcher ? PIT_PILLS : BAT_PILLS;
  const [pick, setPick] = useState(pills[0][0]);
  const [gl, setGl] = useState(null);
  const id = person && person.id;
  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const g = await (await mlbFetch(`v1/people/${id}/stats?stats=gameLog&group=${pitcher ? "pitching" : "hitting"}`)).json();
        const sp = (g.stats && g.stats[0] && g.stats[0].splits) || [];
        if (alive) setGl(sp.filter((x) => x.stat && (pitcher ? x.stat.inningsPitched != null : (x.stat.plateAppearances ?? x.stat.atBats ?? 0) > 0)).slice(-30));
      } catch { if (alive) setGl([]); }
    })();
    return () => { alive = false; };
  }, [id, pitcher]);
  if (!S) return null;

  const tc = playerHeaderColor(p);
  const per = (v, g) => (g ? (v / g >= 10 ? (v / g).toFixed(1) : (v / g).toFixed(2)).replace(/\.?0+$/, "") + "/g" : null);
  const tiles = pitcher
    ? [["ERA", fmt2(S.era)], ["W-L", S.w + "-" + S.l], ["K", S.so, per(S.so, S.g)], ["WHIP", fmt2(S.whip)],
       ["IP", S.ip, S.g ? (S.outs / 3 / S.g).toFixed(1) + "/g" : null], [S.sv > 0 || !S.hld ? "Saves" : "Holds", S.sv > 0 || !S.hld ? S.sv : S.hld], ["Walks", S.bb, S.bb9 != null ? fmt2(S.bb9) + "/9" : null], ["HR Allowed", S.hr, S.hr9 != null ? fmt2(S.hr9) + "/9" : null]]
    : [["AVG", fmt3(S.avg)], ["HR", S.hr, per(S.hr, S.g)], ["RBI", S.rbi, per(S.rbi, S.g)], ["OPS", fmt3(S.ops)],
       ["Hits", S.h, per(S.h, S.g)], ["Runs", S.r, per(S.r, S.g)], ["SB", S.sb, per(S.sb, S.g)], ["HR / PA", S.hrPa != null ? (S.hrPa * 100).toFixed(1) + "%" : "—"]];

  // ── chart series: dots = each game, line = rolling average (the trend) ──
  const cur = pills.find((x) => x[0] === pick) || pills[0];
  const win = pitcher ? 3 : 7;
  const games = gl || [];
  const raw = games.map((x) => (cur[2] === "inningsPitched" ? ipNum(x.stat.inningsPitched) : cur[2] ? Number(x.stat[cur[2]] || 0) : null));
  const roll = games.map((_, i) => {
    const w = games.slice(Math.max(0, i - (cur[0] === "avg" ? 10 : cur[0] === "era" ? 5 : win) + 1), i + 1);
    if (cur[0] === "avg") { const ab = w.reduce((n, x) => n + (x.stat.atBats || 0), 0), h = w.reduce((n, x) => n + (x.stat.hits || 0), 0); return ab ? h / ab : null; }
    if (cur[0] === "era") { const ip = w.reduce((n, x) => n + ipNum(x.stat.inningsPitched), 0), er = w.reduce((n, x) => n + (x.stat.earnedRuns || 0), 0); return ip ? (er * 9) / ip : null; }
    return w.reduce((n, x) => n + (cur[2] === "inningsPitched" ? ipNum(x.stat.inningsPitched) : Number(x.stat[cur[2]] || 0)), 0) / w.length;
  });
  const rate = cur[2] == null;
  const vals = roll.filter((v) => v != null);
  const top = Math.max(rate ? (cur[0] === "avg" ? 0.4 : 6) : 2, ...vals) * 1.08;
  const W = 320, H = 150, L = 30, R = 8, T = 14, B = 20;
  const X = (i) => L + (games.length > 1 ? (i / (games.length - 1)) * (W - L - R) : (W - L - R) / 2);
  const Y = (v) => T + (1 - v / top) * (H - T - B);
  const pts = roll.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
  const fmtV = (v) => (cur[0] === "avg" ? fmt3(v) : cur[0] === "era" ? fmt2(v) : Number.isInteger(v) ? String(v) : v.toFixed(1));
  const ticks = [0, top / 2 / 1.08, top / 1.08];
  const lastV = roll.length ? roll[roll.length - 1] : null;
  // Total over the whole window (the answer to "how many hits in these 30 games?")
  const total = (() => {
    if (!games.length) return null;
    if (cur[0] === "avg") { const ab = games.reduce((n, x) => n + (x.stat.atBats || 0), 0), h = games.reduce((n, x) => n + (x.stat.hits || 0), 0); return ab ? fmt3(h / ab) + " AVG (" + h + "-for-" + ab + ")" : null; }
    if (cur[0] === "era") { const ip = games.reduce((n, x) => n + ipNum(x.stat.inningsPitched), 0), er = games.reduce((n, x) => n + (x.stat.earnedRuns || 0), 0); return ip ? fmt2((er * 9) / ip) + " ERA (" + er + " ER / " + Math.floor(ip) + "." + Math.round((ip % 1) * 3) + " IP)" : null; }
    const sum = raw.reduce((n, v) => n + (v || 0), 0);
    if (cur[2] === "inningsPitched") return Math.floor(sum) + "." + Math.round((sum % 1) * 3) + " IP";
    return sum + " " + cur[1] + " · " + (sum / games.length).toFixed(2).replace(/\.?0+$/, "") + " per " + (pitcher ? "outing" : "game");
  })();
  const winLbl = cur[0] === "avg" ? "10-game rolling average" : cur[0] === "era" ? "5-outing rolling ERA" : "per " + (pitcher ? "outing" : "game") + ", " + win + "-" + (pitcher ? "outing" : "game") + " rolling average";

  return (
    <>
      <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">{season} Season · {S.g} GP</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="grid grid-cols-4 gap-2 p-3">
          {tiles.map(([lbl, v, sub]) => (
            <div key={lbl} className="rounded-xl border-2 bg-white dark:bg-slate-900 text-center overflow-hidden" style={{ borderColor: tc + "66" }}>
              <div className="text-[7px] font-extrabold tracking-wider uppercase text-white truncate px-0.5 py-1" style={{ backgroundColor: tc }}>{lbl}</div>
              <div className="text-[19px] leading-tight font-black tabular-nums text-slate-900 dark:text-white mt-1.5">{v ?? "—"}</div>
              <div className="text-[9px] font-semibold tabular-nums text-slate-400 h-3 mb-1.5">{sub || ""}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 px-3 pt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {pills.map(([k, lbl]) => (
            <button key={k} onClick={() => setPick(k)}
              className={"shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold " + (cur[0] === k ? "text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}
              style={cur[0] === k ? { backgroundColor: tc } : undefined}>{lbl}</button>
          ))}
        </div>
        <div className="px-2 pt-2 pb-3">
          {gl != null && games.length >= 2 && total && (
            <div className="flex items-baseline justify-between px-2 mb-1">
              <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400">Last {games.length} {pitcher ? "outings" : "games"}</span>
              <span className="text-[13px] font-black tabular-nums text-slate-900 dark:text-white">{total}</span>
            </div>
          )}
          {gl == null ? <div className="text-center text-[11px] text-slate-400 py-12">Loading game log…</div>
            : games.length < 2 ? <div className="text-center text-[11px] text-slate-400 py-12">Not enough games yet for a trend.</div> : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-[color:var(--tc)] dark:text-sky-300" style={{ "--tc": tc }}>
              {ticks.map((t, i) => (
                <g key={i}>
                  <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" strokeDasharray={i === 0 ? undefined : "3 3"} />
                  <text x={L - 5} y={Y(t) + 3} textAnchor="end" className="fill-slate-400" fontSize="8" fontWeight="600">{fmtV(cur[0] === "avg" || cur[0] === "era" ? t : Math.round(t * 10) / 10)}</text>
                </g>
              ))}
              {pts.length > 1 && <polygon points={[[pts[0][0], Y(0)], ...pts, [pts[pts.length - 1][0], Y(0)]].map((q) => q.join(",")).join(" ")} fill="currentColor" fillOpacity="0.10" />}
              {pts.length > 1 && <polyline points={pts.map((q) => q.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />}
              {pts.length > 0 && lastV != null && (
                <g>
                  <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.4" fill="currentColor" stroke="#fff" strokeWidth="1.2" />
                  <text x={Math.min(W - R - 2, pts[pts.length - 1][0])} y={Math.max(9, pts[pts.length - 1][1] - 7)} textAnchor="end" className="fill-slate-800 dark:fill-white" fontSize="9.5" fontWeight="800">{fmtV(lastV)}</text>
                </g>
              )}
              <text x={L} y={H - 5} className="fill-slate-400" fontSize="8" fontWeight="600">{String(games[0].date || "").slice(5).replace("-", "/")}</text>
              <text x={W - R} y={H - 5} textAnchor="end" className="fill-slate-400" fontSize="8" fontWeight="600">{String(games[games.length - 1].date || "").slice(5).replace("-", "/")}</text>
            </svg>
          )}
          {gl != null && games.length >= 2 && <div className="text-[9px] text-slate-400 text-center mt-1">{cur[1]} · {winLbl} over his last {games.length} {pitcher ? "outings" : "games"}</div>}
        </div>
      </div>
    </>
  );
}

function PlayerDetail({ p, onBack, backLabel, mode = "full" }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useBackSwipe(onBack);
  const act = activeOf(p);
  const past = p.contracts.filter((c) => c !== act);
  const no = cleanNo(p.no);
  const { person, line, stats: leagueStats } = useMlbPerson(p);      // MLB's record + live season line
  const M = person || {};
  const debutYear = M.mlbDebutDate ? Number(String(M.mlbDebutDate).slice(0, 4)) : null;
  const expText = (() => { if (!debutYear) return experienceOf(p); const n = parseInt(String(CURRENT_SEASON).slice(0, 4), 10) - debutYear + 1; return n <= 1 ? "Rookie" : ordinal(n) + " season"; })();
  const hw = [fmtHeight(M.height || p.height), fmtWeight(M.weight || p.weight)].filter(Boolean).join(", ");
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24">
      <div className="px-5 pb-6 text-white" style={{ backgroundColor: playerHeaderColor(p), paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ {backLabel}</button>
        <div className="flex items-center gap-4">
          <Avatar p={p} size="lg" />
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-tight truncate">
              {p.name}
            </div>
            <div className="text-[13px] opacity-85 font-medium mt-0.5 leading-snug">
              {[teamFullName(p), cleanNo(p.no) ? "#" + cleanNo(p.no) : "", posFull(p.pos)].filter(Boolean).join(" · ")}
            </div>
            <div className="mt-1.5"><LiveStatus p={p} lg /></div>
            <InjuryLine p={p} />
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        {(p.rating2k != null || currentSalary(p) > 0 || nextEvent(p)) && (
        <div className="grid grid-cols-3 gap-2">
          <Tile
            value={p.rating2k != null ? Math.round(p.rating2k) : "—"}
            label="The Show"
            valueClass={p.rating2k == null ? null
              : Math.round(p.rating2k) >= 90 ? "text-amber-500 dark:text-amber-400"
              : Math.round(p.rating2k) >= 80 ? "text-slate-500 dark:text-slate-300"
              : "text-orange-700 dark:text-orange-400"}
          />
          <Tile value={currentSalary(p) > 0 ? fmtM(currentSalary(p)) : "—"} label={CURRENT_SEASON + " Salary"} />
          {(() => {
            const ev = nextEvent(p);
            const labels = { PO: "Player Option", TO: "Team Option", UFA: "Free Agent", RFA: "Restricted FA" };
            const colors = {
              PO: "text-emerald-600 dark:text-emerald-400",
              TO: "text-red-600 dark:text-red-400",
              UFA: "text-slate-500 dark:text-slate-400",
              RFA: "text-purple-600 dark:text-purple-400",
            };
            return (
              <Tile
                value={ev ? seasonTick({ season: ev.season }) : "—"}
                label={ev ? labels[ev.kind] : "Free Agent"}
                valueClass={ev ? colors[ev.kind] : null}
              />
            );
          })()}
        </div>)}

        {mode === "full" && (hw || p.age || M.birthDate || M.mlbDebutDate || p.birthplace) && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Bio</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              <BioRow k="Height / Weight" v={hw} />
              <BioRow k="Date of Birth" v={fmtDateLong(M.birthDate)} />
              <BioRow k="Age" v={M.currentAge || p.age} />
              <BioRow k="MLB Debut" v={fmtDateLong(M.mlbDebutDate)} />
              <BioRow k="Experience" v={expText} />
              <BioRow
                k={["Pitching", "Bullpen"].includes(unitOf(p)) ? "Throws" : ["Batting", "Bench"].includes(unitOf(p)) ? "Bats" : "Bats / Throws"}
                v={(() => {
                  const parts = String(p.bt || "").split("/").map((x) => x.trim()).filter(Boolean);
                  if (parts.length < 2) return p.bt;
                  return ["Pitching", "Bullpen"].includes(unitOf(p)) ? parts[parts.length - 1] : parts[0];
                })()}
              />
              <BioRow k="College" v={p.college} />
              <BioRow k="Birthplace" v={p.birthplace || [M.birthCity, M.birthStateProvince || M.birthCountry].filter(Boolean).join(", ")} />
            </div>
          </>
        )}

        {mode === "full" && line && <SeasonPanel p={p} person={person} line={line} season={leagueStats ? leagueStats.season : ""} />}

        {act && salaried(act).length > 0 && (
          <div className="mt-4"><ContractCard c={act} big /></div>
        )}

        {past.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Contract history</div>
            <div className="flex flex-col gap-3">
              {past.map((c, i) => <ContractCard key={i} c={c} />)}
            </div>
          </>
        )}


        {mode === "full" && p.awards && p.awards.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Awards</div>
            <div className="flex flex-wrap gap-1.5">
              {p.awards.map((a, i) => (
                <span key={i} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  🏆 {a}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════ LIST HEADER (shared) ════════════════════════════
function ListHeader({ title, q, setQ, placeholder }) {
  if (!setQ) return (
    <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
      <div className="text-2xl font-extrabold tracking-tight">{title}</div>
    </div>
  );
  return (
    <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
      <div className="text-2xl font-extrabold tracking-tight">{title}</div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || "Search players…"}
        className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white/95 dark:bg-slate-900/80 placeholder-slate-400 outline-none"
      />
    </div>
  );
}

// Populated once data loads: abbr -> logo URL
const TEAM_LOGOS = {};
// Logos that read better as a white mark on their team colour
const WHITE_LOGOS = new Set(["NYY", "LAD", "STL", "PHI", "KC"]);
const logoFx = (abbr) => (WHITE_LOGOS.has(String(abbr || "").toUpperCase()) ? " brightness-0 invert" : "");

function TeamPill({ team }) {
  const abbr = toAbbr(team) || team;
  if (!abbr) return null;
  const logo = TEAM_LOGOS[abbr];
  if (logo) {
    return <img src={logo} alt={abbr} className={"w-10 h-10 object-contain shrink-0 drop-shadow" + logoFx(abbr)} />;
  }
  return (
    <span className="text-[10px] font-bold text-white px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: teamColor(abbr) }}>
      {abbr}
    </span>
  );
}

// ═══════════════ TAB: PLAYER HUB ═════════════════════════════════
const TX_TYPES = {
  // MLB typeCode → label + colour
  ASG: ["Assigned", "bg-slate-500"], CU: ["Called Up", "bg-emerald-600"], SC: ["Called Up", "bg-emerald-600"], OPT: ["Optioned", "bg-orange-500"], OUT: ["Outrighted", "bg-orange-500"],
  SFA: ["Signed (FA)", "bg-sky-600"], SGN: ["Signed", "bg-sky-600"], TR: ["Traded", "bg-violet-600"], CLW: ["Claimed", "bg-violet-600"], DES: ["DFA", "bg-rose-600"], REL: ["Released", "bg-rose-600"],
  RET: ["Retired", "bg-slate-500"], SE: ["Selected", "bg-emerald-600"], DFA: ["DFA", "bg-rose-600"], NUM: ["Number Change", "bg-slate-500"], SUS: ["Suspended", "bg-rose-600"], REC: ["Recalled", "bg-emerald-600"],
};
const txLabel = (t) => {
  const d = String(t.text || t.description || "").toLowerCase();
  if (/placed .* on the .*injured list|10-day il|15-day il|60-day il/.test(d)) return ["To IL", "bg-rose-600"];
  if (/activated .* from the .*injured list|reinstated/.test(d)) return ["Off IL", "bg-emerald-600"];
  if (/recalled|selected the contract|called up/.test(d)) return ["Called Up", "bg-emerald-600"];
  if (/optioned|sent .* to the minors|assigned .* to (?!the )/.test(d) && !/injured/.test(d)) return ["To Minors", "bg-orange-500"];
  if (/designated .* for assignment/.test(d)) return ["DFA", "bg-rose-600"];
  if (/traded/.test(d)) return ["Traded", "bg-violet-600"];
  if (/claimed/.test(d)) return ["Claimed", "bg-violet-600"];
  if (/released/.test(d)) return ["Released", "bg-rose-600"];
  if (/signed/.test(d)) return ["Signed", "bg-sky-600"];
  if (/paternity|bereavement/.test(d)) return ["Leave", "bg-slate-500"];
  return TX_TYPES[t.typeCode] || [t.typeDesc || "Move", "bg-slate-500"];
};
const TX_CACHE = { at: 0, list: null };
function TransactionsTab({ players, onSelect, q }) {
  const [list, setList] = useState(TX_CACHE.list);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (TX_CACHE.list && Date.now() - TX_CACHE.at < 10 * 60000) return;
    let alive = true;
    (async () => {
      try {
        const day = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + n * 86400000));
        const d = await (await mlbFetch(`v1/transactions?sportId=1&startDate=${day(-14)}&endDate=${day(0)}`)).json();
        const rows = (d.transactions || []).filter((t) => t.person && t.person.fullName && t.description)
          .map((t) => ({ id: t.id, name: t.person.fullName, pid: t.person.id, team: (t.toTeam && TEAM_ABBR_BY_ID[t.toTeam.id]) || (t.fromTeam && TEAM_ABBR_BY_ID[t.fromTeam.id]) || "", teamName: (t.toTeam && t.toTeam.name) || (t.fromTeam && t.fromTeam.name) || "", date: t.date || t.effectiveDate || "", text: t.description, typeCode: t.typeCode, typeDesc: t.typeDesc }))
          .filter((t) => t.team)                                            // big-league moves only
          .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
        TX_CACHE.list = rows; TX_CACHE.at = Date.now();
        if (alive) setList(rows);
      } catch { if (alive) setFailed(true); }
    })();
    return () => { alive = false; };
  }, []);
  useInjuries();
  // jersey number + position for everyone in the feed, from MLB (one batched call)
  const [bio, setBio] = useState({});
  useEffect(() => {
    if (!list || !list.length) return;
    const ids = [...new Set(list.map((t) => t.pid).filter((id) => id && bio[id] == null))];
    if (!ids.length) return;
    let alive = true;
    (async () => {
      const out = {};
      for (let i = 0; i < ids.length; i += 60) {
        try {
          const d = await (await mlbFetch(`v1/people?personIds=${ids.slice(i, i + 60).join(",")}`)).json();
          for (const per of d.people || []) out[per.id] = { no: per.primaryNumber || "", pos: (per.primaryPosition || {}).abbreviation || "" };
        } catch {}
      }
      if (alive) setBio((b) => ({ ...b, ...out }));
    })();
    return () => { alive = false; };
  }, [list]);
  const mine = useMemo(() => { const m = {}; for (const p of players || []) (m[hrbNrm(p.name)] = m[hrbNrm(p.name)] || []).push(p); return m; }, [players]);
  const findP = (t) => { const c = mine[hrbNrm(t.name)] || []; return c.length > 1 ? c.find((p) => teamOfPlayer(p) === t.team) || c[0] : c[0]; };
  const shown = (list || []).filter((t) => !q || hrbNrm(t.name).includes(hrbNrm(q)) || hrbNrm(t.teamName).includes(hrbNrm(q)) || String(t.team).toLowerCase() === q.toLowerCase().trim());
  const fmtDay = (iso) => { const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z"); return isNaN(d) ? iso : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d); };
  let lastDay = null;
  return (
    <div className="px-4 pb-28 mt-4">
      <div className="text-[11px] font-semibold text-slate-400 mb-3">MLB transaction log · {list ? shown.length + " moves" : "loading"} · last 14 days · newest first</div>
      {!list && !failed && <BallLoader label="Loading transactions" full={false} />}
      {failed && <div className="text-center text-sm text-slate-400 py-12">Couldn't reach MLB's transaction log. Tap the pill again to retry.</div>}
      {list && shown.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No moves found.</div>}
      {shown.map((t) => {
        const day = String(t.date).slice(0, 10);
        const head = day !== lastDay; lastDay = day;
        const [lbl, cls] = txLabel(t);
        const p = findP(t);
        const vp = p || { id: "tx:" + t.pid, name: t.name, mlbId: t.pid, teamAbbr: t.team, _virtual: true };
        return (
          <React.Fragment key={t.id}>
            {head && <div className="text-[10px] font-extrabold tracking-widest uppercase text-slate-400 mt-4 mb-2 px-1">{fmtDay(day)}</div>}
            {(() => {
              const b = bio[t.pid] || {};
              const no = cleanNo((p && p.no) || b.no), pos = (p && p.pos) || b.pos || "";
              const inj = injFor(t.name, t.team);
              const status = inj ? <InjBadge name={t.name} team={t.team} /> : lbl === "To Minors" ? <span className="inline-block px-1.5 py-px rounded text-[9px] font-extrabold uppercase tracking-wide bg-orange-500 text-white">Minors</span> : lbl === "Leave" ? <span className="inline-block px-1.5 py-px rounded text-[9px] font-extrabold uppercase tracking-wide bg-slate-600 text-white">Leave</span> : <span className="inline-block px-1.5 py-px rounded text-[9px] font-extrabold uppercase tracking-wide bg-emerald-500 text-white">Active</span>;
              const note = inj ? injText(inj) : "";
              return (
            <button onClick={p ? () => onSelect(p) : undefined} className={"w-full text-left flex items-start gap-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-3 mb-2 " + (p ? "active:bg-slate-50 dark:active:bg-slate-800" : "")}
              style={{ borderLeft: "4px solid " + teamColor(t.team) }}>
              <span className="shrink-0 w-11 text-center rounded-md py-1 mt-3 text-[11px] font-extrabold text-white tabular-nums" style={{ backgroundColor: bannerColor(t.team) }}>{no ? "#" + no : "—"}</span>
              <Avatar p={vp} size="md" />
              <span className="flex-1 min-w-0">
                <span className="flex items-start justify-between gap-2 min-w-0">
                  <span className="flex items-center gap-1.5 min-w-0">
                    {pos && <span className="text-[13px] font-bold text-slate-400 shrink-0">{pos}</span>}
                    <span className="text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate">{t.name}</span>
                    {TEAM_LOGOS[t.team] && <img src={TEAM_LOGOS[t.team]} alt={t.team} className={"w-6 h-6 object-contain shrink-0" + (WHITE_LOGOS.has(t.team) ? " dark:brightness-0 dark:invert" : "")} />}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-400 mt-0.5">{fmtDay(day)}</span>
                </span>
                <span className="flex items-center gap-2 mt-1.5">{status}<span className={"rounded px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-white " + cls}>{lbl}</span></span>
                {note && <span className="block text-[11px] font-semibold text-rose-500 mt-1">({note})</span>}
                {inj && <ReturnLine r={inj} className="mt-0.5" />}
                <span className="block text-[12px] text-slate-500 dark:text-slate-300 leading-snug mt-1.5">{t.text}</span>
              </span>
            </button>
              );
            })()}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function PlayersTab({ players, onSelect }) {
  const [q, setQ] = useState("");
  const [pill, setPill] = useState("active");
  const isRetired = (p) => String(p.status || "").toLowerCase().includes("retire");
  const list = useMemo(
    () => players.filter((p) => (pill === "retired" ? isRetired(p) : !isRetired(p))).filter((p) => matchesQuery(p, q)),
    [players, q, pill]
  );
  const pillsBar = (
    <div className="flex gap-2 px-4 mt-3">
      {[["active", "Active"], ["moves", "Transactions"], ["contracts", "Contracts"], ["retired", "Retired"]].map(([id, label]) => (
        <button key={id} onClick={() => setPill(id)}
          className={"flex-1 py-2 rounded-full text-[11px] font-extrabold " + (pill === id
            ? "bg-blue-600 text-white"
            : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-800")}>
          {label}
        </button>
      ))}
    </div>
  );
  if (pill === "moves") return (
    <div>
      <ListHeader title="Players" q={q} setQ={setQ} />
      {pillsBar}
      <TransactionsTab players={players} onSelect={onSelect} q={q} />
    </div>
  );
  if (pill === "contracts") return (
    <div>
      <ListHeader title="Players" q={q} setQ={setQ} />
      {pillsBar}
      <ContractsTab players={players} onSelect={onSelect} embedded extQ={q} />
    </div>
  );
  return (
    <div>
      <ListHeader title="Players" q={q} setQ={setQ} />
      {pillsBar}
      {pill === "retired" && list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No retired players saved yet.</div>}
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {list.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
              <span className="shrink-0 w-11 text-center rounded-md py-1 text-[11px] font-extrabold uppercase text-white tabular-nums" style={{ backgroundColor: bannerColor(teamOfPlayer(p)) }}>{p.pos || "—"}</span>
              <Avatar p={p} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name} <InjBadge name={p.name} team={teamOfPlayer(p)} /></span>
                <span className="block text-[11px] text-slate-400 font-medium truncate">
                  {[p.height, p.weight, p.age ? p.age + " yrs" : ""]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
                {(p.rating2k != null || p.archetype) && (
                  <span className="flex items-center gap-1.5 mt-1 min-w-0">
                    <Rating2kBadge r={p.rating2k} />
                    {p.archetype && <span className="text-[10px] font-semibold text-slate-400 truncate">{p.archetype}</span>}
                  </span>
                )}
              </span>
              <TeamPill team={teamOfPlayer(p) || p.teamName || activeOf(p)?.team} />
            </button>
          ))}
          {list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">{q ? `No players match "${q}".` : "No players yet."}</div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ TAB: CONTRACTS ══════════════════════════════════

// Upcoming free agency: the earliest UFA/RFA year at/after the current season
function faStatus(p) {
  let best = null;
  for (const c of p.contracts || []) {
    for (const y of c.years || []) {
      const t = String(y.type || "").toUpperCase();
      if (t !== "UFA" && t !== "RFA") continue;
      if (String(y.season) < CURRENT_SEASON) continue;
      if (!best || String(y.season) < String(best.season)) best = { type: t, season: y.season };
    }
  }
  if (!best) return null;
  const yr = String(best.season).slice(0, 4); // "2026-2027" -> hits market summer 2026
  return { ...best, label: best.type + " " + yr };
}


function Rating2kBadge({ r }) {
  if (r == null) return null;
  const n = Math.round(r);
  const cls =
    n >= 90 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"        // gold
    : n >= 80 ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"          // silver
    : "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300";            // bronze
  return (
    <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold " + cls}>
      {n} OVR
    </span>
  );
}

// Next contract event: earliest pending PO/TO or upcoming UFA/RFA on the active deal

// First year of a season string: "2026-2027" | "2026-27" -> 2026
function startYear(s) {
  const m = String(s || "").match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function nextEvent(p) {
  let best = null;
  for (const c of p.contracts || []) {
    if (String(c.status).toLowerCase() === "expired") continue; // blank status still counts
    for (const y of c.years || []) {
      if (startYear(y.season) != null && startYear(y.season) < startYear(CURRENT_SEASON)) continue;
      const t = String(y.type || "").toUpperCase();
      let kind = null;
      if ((t === "PO" || t === "TO") && !y.decision) kind = t;
      else if (t === "UFA" || t === "RFA") kind = t;
      if (!kind) continue;
      if (!best || String(y.season) < String(best.season)) best = { kind, season: y.season };
    }
  }
  if (!best) return null;
  return { ...best, label: best.kind + " " + String(best.season).slice(0, 4) };
}

const EVENT_WORDS = { PO: "Player Option", TO: "Team Option", UFA: "Free Agent", RFA: "Restricted FA" };
const EVENT_COLORS = {
  PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  TO: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300",
  UFA: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  RFA: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
};

function EventPill({ ev }) {
  if (!ev) return null;
  const cls = EVENT_COLORS[ev.kind] || EVENT_COLORS.UFA;
  return (
    <span className={"inline-flex shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + cls}>
      {EVENT_WORDS[ev.kind] || ev.kind} {seasonTick({ season: ev.season })}
    </span>
  );
}


// The season after the current one - "2025-2026" -> "2026-2027". Rolls forward with CURRENT_SEASON.
function nextSeason(s) {
  const m = String(s).match(/(\d{4})\s*-\s*(\d{4})/);
  if (!m) return null;
  return (Number(m[1]) + 1) + "-" + (Number(m[2]) + 1);
}

function ContractsTab({ players, onSelect, embedded = false, extQ }) {
  const [qState, setQ] = useState("");
  const q = embedded ? (extQ || "") : qState;
  const [faOnly, setFaOnly] = useState(false);
  const list = useMemo(
    () =>
      players
        .filter((p) => p.contracts.length > 0)
        .filter((p) => matchesQuery(p, q))
        .filter((p) => {
          if (!faOnly) return true;
          const ev = nextEvent(p);                       // UFA, RFA, player + team options
          return ev && startYear(ev.season) === startYear(CURRENT_SEASON) + 1;
        })
        .slice()
        .sort((x, y) => {
          if (faOnly) {
            const rank = { UFA: 0, RFA: 1, PO: 2, TO: 3 };
            const ex = nextEvent(x), ey = nextEvent(y);
            const rx = rank[ex?.kind] ?? 9, ry = rank[ey?.kind] ?? 9;
            if (rx !== ry) return rx - ry;              // free agents first, then options
          }
          const sx = currentSalary(x), sy = currentSalary(y);
          if (sy !== sx) return sy - sx;               // biggest current-season salary first
          return x.name.localeCompare(y.name);          // $0 group: alphabetical
        }),
    [players, q, faOnly]
  );
  return (
    <div>
      {!embedded && <ListHeader title="Contracts" q={qState} setQ={setQ} />}
      <div className="px-4 mt-3 flex gap-2">
        {[["All", false], ["Free Agency " + (startYear(CURRENT_SEASON) + 1), true]].map(([lbl, v]) => (
          <button key={lbl} onClick={() => setFaOnly(v)}
            className={"px-4 py-1.5 rounded-full text-xs font-bold " + (faOnly === v
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
            {lbl}
          </button>
        ))}
      </div>
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {list.map((p) => {
            const act = activeOf(p);
            return (
              <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                <Avatar p={p} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                  <span className="block text-[11px] text-slate-400 font-medium truncate">
                    {act ? displayLine(act) : "No contract"}
                  </span>
                  {nextEvent(p) && (
                    <span className="block mt-1"><EventPill ev={nextEvent(p)} /></span>
                  )}
                </span>
                {currentSalary(p) > 0 && (
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 shrink-0">{fmtM(currentSalary(p))}</span>
                )}
                <TeamPill team={teamOfPlayer(p) || act?.team} />
              </button>
            );
          })}
          {list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>}
        </div>
      </div>
    </div>
  );
}


// ═══════════════ TAB: TEAMS ══════════════════════════════════════
function teamOfPlayer(p) {
  return toAbbr(p.teamName) || (activeOf(p) ? toAbbr(activeOf(p).team) || activeOf(p).team : "");
}

function currentSalary(p) {
  const act = activeOf(p);
  if (!act) return 0;
  const yr = act.years.find((y) => y.season === CURRENT_SEASON && y.salary != null);
  if (yr) return yr.salary;
  const first = salaried(act)[0];
  return first ? first.salary : 0;
}

const ROLE_ORDER = ["Batting", "Pitching", "Bullpen", "Bench"];
const CAT_ORDER = ["__P__", "__C__", "__IF__", "__OF__", "__DH__"];
const CAT_LABELS = { __P__: "Pitchers", __C__: "Catchers", __IF__: "Infielders", __OF__: "Outfielders", __DH__: "Designated Hitters" };
const catOf = (p) => {
  // Split multi-position strings ("OF/1B", "CF-RF", "1B, OF") into tokens
  // and classify by the FIRST recognizable one — Bellinger-proof.
  const tokens = String(p.pos || "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  for (const t of tokens) {
    if (["P", "SP", "RP", "CP", "CL", "LHP", "RHP"].includes(t)) return "__P__";
    if (t === "C") return "__C__";
    if (["LF", "CF", "RF", "OF"].includes(t)) return "__OF__";
    if (["1B", "2B", "3B", "SS", "IF", "UT", "INF"].includes(t)) return "__IF__";
    if (t === "DH") return "__DH__";
  }
  return "__IF__";
};
const UNIT_LABELS = { Batting: "Batting Order", Pitching: "Pitching Rotation", Bullpen: "Bullpen", Bench: "Bench" };
// "R/R" -> throws with the right hand -> RHP
function pitcherHand(p) {
  const t = String(p.bt || "").trim().split("/").pop().trim().toUpperCase();
  return t === "R" ? "RHP" : t === "L" ? "LHP" : null;
}
// "L/R" -> bats left -> "L"; switch hitters show "S"
function batterHand(p) {
  const b = String(p.bt || "").trim().split("/")[0].trim().toUpperCase();
  return b === "L" || b === "R" || b === "S" ? b : null;
}
// Role wins in baseball (a Bench player keeps his fielding position), then
// position decides: SP -> Pitching, RP/CP -> Bullpen, everyone else Batting.
const POS_UNIT = {};
for (const p of ["SP"]) POS_UNIT[p] = "Pitching";
for (const p of ["RP", "CP", "CL"]) POS_UNIT[p] = "Bullpen";
for (const p of ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "OF", "DH", "IF", "UT"]) POS_UNIT[p] = "Batting";
function statusRank(p) {
  const s = String(p.status || "").toLowerCase();
  if (s.includes("active") || s.includes("available")) return 0;
  const m = s.match(/(\d+)\s*-?\s*day/) || s.match(/il-?(\d+)/);
  if (m) return 100 + Number(m[1]);
  if (s.includes("il") || s.includes("injur") || s.includes("out")) return 400;
  if (s.includes("minor")) return 900;
  return 500;
}

function unitOf(p) {
  if (ROLE_ORDER.includes(p.role)) return p.role;
  const pos = String(p.pos || "").toUpperCase().trim();
  if (POS_UNIT[pos]) return POS_UNIT[pos];
  if (pos === "P") return "Pitching";
  return "Roster";
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

function winPct(t) {
  const w = t.wins ?? 0, l = t.losses ?? 0;
  return w + l > 0 ? w / (w + l) : -1;
}

// HR park rank, 1 = most homer-friendly. Based on recent MLB park factors;
// edit freely - venue names must match MLB's official venue.name strings.
const PARK_HR_RANK = {
  "Great American Ball Park": 1, "Yankee Stadium": 2, "Citizens Bank Park": 3,
  "Dodger Stadium": 4, "Coors Field": 5, "Sutter Health Park": 6, "Truist Park": 7,
  "Angel Stadium": 8, "Rogers Centre": 9, "Wrigley Field": 10, "American Family Field": 11,
  "Daikin Park": 12, "Citi Field": 13, "Fenway Park": 14, "Rate Field": 15,
  "Chase Field": 16, "Nationals Park": 17, "Busch Stadium": 18, "Target Field": 19,
  "PNC Park": 20, "Kauffman Stadium": 21, "Oriole Park at Camden Yards": 22,
  "Progressive Field": 23, "loanDepot park": 24, "Petco Park": 25, "Oracle Park": 26,
  "T-Mobile Park": 27, "George M. Steinbrenner Field": 28, "Tropicana Field": 27, "Comerica Park": 29,
  "Globe Life Field": 30,
};
const TEAM_PARK = {
  ARI: "Chase Field", ATL: "Truist Park", BAL: "Oriole Park at Camden Yards", BOS: "Fenway Park", CHC: "Wrigley Field", CWS: "Rate Field",
  CIN: "Great American Ball Park", CLE: "Progressive Field", COL: "Coors Field", DET: "Comerica Park", HOU: "Daikin Park", KC: "Kauffman Stadium",
  LAA: "Angel Stadium", LAD: "Dodger Stadium", MIA: "loanDepot park", MIL: "American Family Field", MIN: "Target Field", NYM: "Citi Field",
  NYY: "Yankee Stadium", ATH: "Sutter Health Park", PHI: "Citizens Bank Park", PIT: "PNC Park", SD: "Petco Park", SF: "Oracle Park",
  SEA: "T-Mobile Park", STL: "Busch Stadium", TB: "Tropicana Field", TEX: "Globe Life Field", TOR: "Rogers Centre", WSH: "Nationals Park",
};
const PARK_RANK_NORM = (() => {
  const m = {};
  for (const k of Object.keys(PARK_HR_RANK)) m[k.toLowerCase().replace(/\s+/g, " ").trim()] = PARK_HR_RANK[k];
  return m;
})();
// ═══ HR park factors by BATTER HANDEDNESS (Statcast-style, 100 = avg) ═══
// 3-year HR factors, updated Aug 2026. Verified anchors: Cincinnati has
// boosted LHB homers ~40% and Oracle suppressed them ~23% over recent
// 3-yr windows; Progressive turned LHB-friendly after the 2024 fence/wind
// change; Citi favors L and punishes R; Petco plays ~+4% for HR.
// The rest are best available estimates - REFRESH EACH APRIL from
// baseballsavant.mlb.com/leaderboard/statcast-park-factors
// (Year → rolling 3 → stat HR → batSide L, then R) and paste over.
// Scoring damps these by ^0.7, so a few points of error stays small.
const PARK_HR_LR = {
  "coors field": { L: 112, R: 112 },
  "great american ball park": { L: 138, R: 124 },
  "yankee stadium": { L: 118, R: 104 },
  "citizens bank park": { L: 112, R: 114 },
  "angel stadium": { L: 104, R: 112 },
  "dodger stadium": { L: 112, R: 110 },
  "truist park": { L: 105, R: 108 },
  "globe life field": { L: 104, R: 104 },
  "rogers centre": { L: 104, R: 102 },
  "oriole park at camden yards": { L: 106, R: 96 },
  "camden yards": { L: 106, R: 96 },
  "fenway park": { L: 92, R: 104 },
  "wrigley field": { L: 102, R: 100 },
  "target field": { L: 100, R: 102 },
  "rate field": { L: 110, R: 108 },
  "guaranteed rate field": { L: 110, R: 108 },
  "progressive field": { L: 108, R: 96 },
  "daikin park": { L: 104, R: 110 },
  "minute maid park": { L: 104, R: 110 },
  "t-mobile park": { L: 96, R: 100 },
  "citi field": { L: 106, R: 94 },
  "nationals park": { L: 106, R: 100 },
  "busch stadium": { L: 92, R: 90 },
  "pnc park": { L: 84, R: 90 },
  "kauffman stadium": { L: 88, R: 90 },
  "ewing m. kauffman stadium": { L: 88, R: 90 },
  "comerica park": { L: 94, R: 96 },
  "american family field": { L: 108, R: 104 },
  "petco park": { L: 102, R: 104 },
  "oracle park": { L: 78, R: 94 },
  "chase field": { L: 104, R: 100 },
  "loandepot park": { L: 92, R: 94 },
  "tropicana field": { L: 96, R: 98 },
  "sutter health park": { L: 112, R: 106 },
  "george m. steinbrenner field": { L: 120, R: 110 },
  "steinbrenner field": { L: 120, R: 110 },
};
// batHand: "L" | "R" | "S"; pitHand used to resolve switch hitters.
// Returns { f: multiplier-for-scoring, shown: raw index, hand } or null.
function parkFactorLR(venueName, batHand, pitHand) {
  const rec = PARK_HR_LR[String(venueName || "").trim().toLowerCase()];
  if (!rec) return null;
  let hand = batHand === "S" ? (pitHand === "L" ? "R" : pitHand === "R" ? "L" : null) : batHand;
  const idx = hand === "L" ? rec.L : hand === "R" ? rec.R : (rec.L + rec.R) / 2;
  if (idx == null) return null;
  return { f: Math.pow(idx / 100, 0.7), shown: Math.round(idx), hand: hand || "S" };
}
function parkRankFor(name) {
  const n = String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (PARK_RANK_NORM[n]) return PARK_RANK_NORM[n];
  for (const k of Object.keys(PARK_RANK_NORM)) {
    if (n.includes(k) || k.includes(n)) return PARK_RANK_NORM[k];
  }
  return null;
}

function parkRankColor(rank) {
  if (rank <= 10) return "text-emerald-600 dark:text-emerald-400"; // most HR-friendly
  if (rank <= 20) return "text-yellow-400";
  return "text-red-500"; // toughest parks for homers
}
function wxEmoji(c) {
  const s = String(c || "").toLowerCase();
  if (s.includes("partly")) return "⛅";
  if (s.includes("sun") || s.includes("clear")) return "☀️";
  if (s.includes("cloud") || s.includes("overcast")) return "☁️";
  if (s.includes("storm") || s.includes("thunder")) return "⛈️";
  if (s.includes("rain") || s.includes("shower") || s.includes("drizzle")) return "🌧️";
  if (s.includes("snow")) return "❄️";
  if (s.includes("dome") || s.includes("roof")) return "🏟️";
  return "🌡️";
}

function ordinalize(n) {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return n + "st";
  if (j === 2 && k !== 12) return n + "nd";
  if (j === 3 && k !== 13) return n + "rd";
  return n + "th";
}

// ── Swipe gestures (same hook as the football app): right→left = next, left→right = previous/back ──
function useSwipe({ onLeft, onRight }) {
  const start = useRef(null);
  return {
    onTouchStart: (e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, t: Date.now() }; },
    onTouchEnd: (e) => {
      if (!start.current) return;
      const t = e.changedTouches[0], dx = t.clientX - start.current.x, dy = t.clientY - start.current.y, dt = Date.now() - start.current.t;
      start.current = null;
      if (dt > 700 || Math.abs(dy) > 70 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx > 0) onRight && onRight(); else onLeft && onLeft();
    },
  };
}

// ── Swipe right = back, on every page ──
// Each open page (team page, player page…) registers its own back action while
// it's on screen; a right swipe anywhere runs the top one. Pages stack, so
// Teams › Yankees › Judge backs out one level at a time. The bottom tab bar
// closes every page at once, so after a tab press there is nothing to back to.
const BACK = { stack: [] };
function useBackSwipe(fn) {
  const r = useRef(fn); r.current = fn;
  useEffect(() => { const e = { r }; BACK.stack.push(e); return () => { BACK.stack = BACK.stack.filter((x) => x !== e); }; }, []);
}
function useGlobalBackSwipe() {
  useEffect(() => {
    let st = null;
    const onStart = (e) => { const t = e.touches[0]; st = { x: t.clientX, y: t.clientY, t: Date.now(), el: e.target }; };
    const onEnd = (e) => {
      if (!st) return;
      const t = e.changedTouches[0], dx = t.clientX - st.x, dy = t.clientY - st.y, dt = Date.now() - st.t, el = st.el; st = null;
      if (dt > 700 || dx < 70 || Math.abs(dy) > 70 || dx < Math.abs(dy) * 1.5) return;                 // left→right only
      if (el && el.closest && el.closest("[data-own-swipe]")) return;                                    // game screen handles its own
      for (let n = el; n && n !== document.body; n = n.parentElement) { if (n.scrollWidth > n.clientWidth + 2 && n.scrollLeft > 0) return; }   // was scrolling a pill row
      const top = BACK.stack[BACK.stack.length - 1];
      if (top) top.r.current();
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => { document.removeEventListener("touchstart", onStart); document.removeEventListener("touchend", onEnd); };
  }, []);
}

// Live game feed from our own /api/game (Step 1). Ticks every 20s while the
// game is live, every 2 min before first pitch, stops at Final, and refreshes
// the moment the app comes back to the foreground. Returns null until loaded
// (or if the endpoint is unreachable) — every caller falls back to the
// schedule data it already had, so nothing breaks without it.
function useLiveGame(gamePk) {
  const [live, setLive] = useState(null);
  useEffect(() => {
    let alive = true, timer = null;
    const load = async () => {
      clearTimeout(timer);
      let next = 60000;
      try {
        const r = await fetch("/api/game?pk=" + gamePk);
        const d = r.ok ? await r.json() : null;
        if (d && !d.error && alive) { setLive(d); next = d.state === "in" ? 20000 : d.state === "pre" ? 120000 : 0; }
      } catch {}
      if (alive && next) timer = setTimeout(load, next);
    };
    load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [gamePk]);
  return live;
}

// Broadcast scorebug for a live game on the Matchups board — the TV layout:
//   away team + score on top, home team + score below, bases / count / inning /
//   outs / pitch count on the right, pitcher and batter (with his line) underneath.
const LIVE_CACHE = {};
function useLiveBug(pk, on) {
  const [d, setD] = useState(LIVE_CACHE[pk] || null);
  useEffect(() => {
    if (!on) return;
    let alive = true, timer = null;
    const load = async () => {
      try { const r = await fetch("/api/game?pk=" + pk); const j = r.ok ? await r.json() : null; if (alive && j && !j.error) { LIVE_CACHE[pk] = j; setD(j); } } catch {}
      if (alive) timer = setTimeout(load, 30000);
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [pk, on]);
  return d;
}
// The Matchups card, every state: away team on top, home below (logo · abbr/record · score),
// the right block is the game time (upcoming), FINAL, or the live situation; the bottom
// line is the probables (upcoming), W/L/SV (final), or pitcher + batter (live).
function MatchCard({ pk, g, sides, state }) {
  const isLive = state === "Live", isFinal = state === "Final";
  const d = useLiveBug(pk, isLive);
  const sit = d && d.state === "in" ? d.situation : null;
  const ls = g.linescore || {};
  const off = ls.offense || {};
  const on = (b) => (sit ? !!(sit.runners && sit.runners[b]) : !!off[b]);
  const balls = sit ? sit.balls : ls.balls, strikes = sit ? sit.strikes : ls.strikes, outs = sit ? sit.outs : ls.outs;
  const inning = sit ? d.inning : ls.currentInning, half = (sit ? d.inningHalf : ls.inningHalf) === "Top" ? "▲" : "▼";
  const battingAbbr = isLive ? (sit ? sit.battingTeam : (ls.inningHalf === "Top" ? sides.away.abbr : sides.home.abbr)) : null;
  const batSide = battingAbbr === sides.home.abbr ? "home" : "away";
  const pitcher = sit ? sit.pitcher : (ls.defense && ls.defense.pitcher ? { id: ls.defense.pitcher.id, name: ls.defense.pitcher.fullName } : null);
  const batter = sit ? sit.batter : (off.batter ? { id: off.batter.id, name: off.batter.fullName } : null);
  const bLine = d && batter ? ([...((d.box.away && d.box.away.batters) || []), ...((d.box.home && d.box.home.batters) || [])].find((x) => x.id === batter.id) || { h: 0, ab: 0, slot: null }) : null;
  const pitches = d && pitcher ? [...(d.box.away.pitchers || []), ...(d.box.home.pitchers || [])].find((x) => x.id === pitcher.id) : null;
  const base = (x, y, lit) => <rect x={x} y={y} width="8" height="8" rx="1.5" transform={`rotate(45 ${x + 4} ${y + 4})`} fill={lit ? "#f59e0b" : "transparent"} stroke={lit ? "#d97706" : "#94a3b8"} strokeWidth="1.3" />;
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(g.gameDate));
  const dec = g.decisions || {};
  const aS = g.teams.away.score, hS = g.teams.home.score;
  const era = (sd) => (sd.pitcher && sd.pitcher.era != null && sd.pitcher.era !== "" && !/^-/.test(String(sd.pitcher.era)) ? String(sd.pitcher.era) : null);
  const row = (k) => {
    const sd = sides[k]; const sc = g.teams[k].score;
    const lost = isFinal && sc != null && (k === "away" ? sc < hS : sc < aS);
    return (
      <span className={"grid grid-cols-[4px_40px_60px_40px] items-center gap-x-2.5 " + (lost ? "opacity-50" : "")}>
        <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: teamColor(sd.abbr) }} />
        {TEAM_LOGOS[sd.abbr] ? <img src={TEAM_LOGOS[sd.abbr]} alt="" className={"w-10 h-10 object-contain" + (WHITE_LOGOS.has(sd.abbr) ? " dark:brightness-0 dark:invert" : "")} /> : <span className="w-10 h-10 rounded-full" style={{ backgroundColor: teamColor(sd.abbr) }} />}
        <span className="min-w-0">
          <span className="block text-[15px] font-black tracking-wide text-slate-900 dark:text-white leading-tight">{sd.abbr}</span>
          <span className="block text-[10px] font-semibold text-slate-400 tabular-nums leading-tight">{sd.rec}</span>
        </span>
        <span className={"text-[26px] leading-none font-black tabular-nums text-right " + (lost ? "text-slate-400" : "text-slate-900 dark:text-white")}>{state !== "Preview" ? sc ?? 0 : ""}</span>
      </span>
    );
  };
  const pitLine = (sd) => (sd.pitcher
    ? <><span className="font-bold text-slate-800 dark:text-slate-100">{sd.pitcher.name}</span>{sd.pitcher.rec ? <span className="text-slate-400"> ({sd.pitcher.rec})</span> : null}{era(sd) ? <span className="text-slate-500 dark:text-slate-400 tabular-nums"> · {era(sd)} ERA</span> : null}</>
    : <span className="text-slate-400">Pitcher TBD</span>);
  return (
    <span className="block">
      <span className="flex items-stretch gap-3">
        <span className="flex flex-col justify-between gap-2 shrink-0">{row("away")}{row("home")}</span>
        <span className="flex-1 flex items-center justify-end gap-3">
          {isLive && <svg width="40" height="30" viewBox="0 0 40 30" aria-label="bases">{base(16, 2, on("second"))}{base(4, 14, on("third"))}{base(28, 14, on("first"))}</svg>}
          {isLive && (
            <span className="text-right">
              <span className="block text-[18px] font-black tabular-nums text-slate-900 dark:text-white leading-none">{half} {inning ?? "—"}</span>
              <span className="block text-[11px] font-extrabold tabular-nums text-slate-600 dark:text-slate-300 mt-1">{balls ?? 0}-{strikes ?? 0} <span className="text-slate-400">·</span> {outs ?? 0} OUT</span>
            </span>
          )}
          {isFinal && <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Final</span>}
          {state === "Preview" && <span className="text-right"><span className="block text-[16px] font-extrabold text-slate-900 dark:text-white tabular-nums">{time}</span><span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">ET</span></span>}
        </span>
      </span>
      <span className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
        {isLive && (<>
          <span className="min-w-0 truncate text-slate-700 dark:text-slate-200"><span className="font-black text-slate-400">P </span><span className="font-extrabold uppercase tracking-wide">{pitcher ? lastNameOf(pitcher.name) : "—"}</span>{pitches && pitches.pitches != null ? <span className="font-bold text-slate-400 tabular-nums"> · {pitches.pitches} P</span> : null}</span>
          <span className="min-w-0 truncate text-right text-slate-700 dark:text-slate-200">
            {bLine && bLine.slot ? <span className="font-bold text-slate-400">{bLine.slot}. </span> : null}
            <span className="font-extrabold uppercase tracking-wide">{batter ? lastNameOf(batter.name) : "—"}</span>
            {bLine ? <span className="font-bold text-slate-400 tabular-nums"> {bLine.h}-{bLine.ab}</span> : null}
          </span>
        </>)}
        {isFinal && (<>
          <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{dec.winner ? <><span className="font-black text-emerald-600">W </span><span className="font-bold">{lastNameOf(dec.winner.fullName)}</span></> : null}{dec.save ? <><span className="font-black text-sky-600">  SV </span><span className="font-bold">{lastNameOf(dec.save.fullName)}</span></> : null}</span>
          <span className="min-w-0 truncate text-right text-slate-700 dark:text-slate-200">{dec.loser ? <><span className="font-black text-rose-500">L </span><span className="font-bold">{lastNameOf(dec.loser.fullName)}</span></> : null}</span>
        </>)}
        {state === "Preview" && (<>
          <span className="min-w-0 truncate">{pitLine(sides.away)}</span>
          <span className="min-w-0 truncate text-right">{pitLine(sides.home)}</span>
        </>)}
      </span>
    </span>
  );
}

// Live strip on a Matchups card: bases · count · outs · who's pitching and his pitch count.
// Polls /api/game every 30s while the game is live (edge-cached, so cheap).
function LiveStrip({ pk }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let alive = true, timer = null;
    const load = async () => {
      try { const r = await fetch("/api/game?pk=" + pk); const j = r.ok ? await r.json() : null; if (alive && j && !j.error) setD(j); } catch {}
      if (alive) timer = setTimeout(load, 30000);
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [pk]);
  if (!d || d.state !== "in" || !d.situation) return null;
  const sit = d.situation;
  const on = (b) => !!(sit.runners && sit.runners[b]);
  const base = (x, y, lit) => <rect x={x} y={y} width="7" height="7" rx="1.2" transform={`rotate(45 ${x + 3.5} ${y + 3.5})`} fill={lit ? "#fbbf24" : "rgba(255,255,255,0.18)"} stroke={lit ? "#f59e0b" : "rgba(255,255,255,0.6)"} strokeWidth="1.2" />;
  const pitcher = sit.pitcher;
  const pitches = pitcher ? [...(d.box.away.pitchers || []), ...(d.box.home.pitchers || [])].find((x) => x.id === pitcher.id) : null;
  const runners = ["first", "second", "third"].filter(on).length;
  return (
    <span className="flex items-center gap-3 mt-2 pt-2 border-t border-white/20">
      <svg width="32" height="24" viewBox="0 0 32 24" className="shrink-0" aria-label={runners + " on base"}>
        {base(12.5, 2.5, on("second"))}{base(3, 12, on("third"))}{base(22, 12, on("first"))}
      </svg>
      <span className="shrink-0 text-center">
        <span className="block text-[12px] font-black tabular-nums text-white leading-none">{sit.balls ?? 0}-{sit.strikes ?? 0}</span>
        <span className="flex gap-1 mt-1 justify-center">{[0, 1, 2].map((i) => <span key={i} className={"w-1.5 h-1.5 rounded-full " + (i < (sit.outs ?? 0) ? "bg-rose-400" : "bg-white/30")} />)}</span>
      </span>
      <span className="min-w-0 flex-1 text-[10px] leading-snug text-white/90">
        {pitcher && <span className="block truncate"><span className="font-black text-white/60">P </span><span className="font-bold">{pitcher.name}</span>{pitches && pitches.pitches != null ? <span className="text-white/75"> · {pitches.pitches} pitches</span> : null}</span>}
        {sit.batter && <span className="block truncate text-white/75"><span className="font-black text-white/60">AB </span>{sit.batter.name}</span>}
      </span>
    </span>
  );
}

// Bases diamond + count + outs — the baseball answer to football's "2nd & 7 at the DAL 34".
function SituationStrip({ sit }) {
  const on = (b) => !!(sit.runners && sit.runners[b]);
  const base = (x, y, lit) => <rect x={x} y={y} width="9" height="9" rx="1.5" transform={`rotate(45 ${x + 4.5} ${y + 4.5})`} className={lit ? "fill-amber-400 stroke-amber-500" : "fill-transparent stroke-slate-300 dark:stroke-slate-600"} strokeWidth="1.5" />;
  return (
    <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
      <svg width="40" height="30" viewBox="0 0 40 30" className="shrink-0" aria-label="Runners on base">
        {base(15.5, 3, on("second"))}{base(3.5, 15, on("third"))}{base(27.5, 15, on("first"))}
      </svg>
      <div className="shrink-0 text-center">
        <div className="text-sm font-extrabold tabular-nums text-slate-900 dark:text-slate-100 leading-none">{sit.balls ?? 0}-{sit.strikes ?? 0}</div>
        <div className="flex gap-1 mt-1.5 justify-center">
          {[0, 1, 2].map((i) => <span key={i} className={"w-1.5 h-1.5 rounded-full " + (i < (sit.outs ?? 0) ? "bg-rose-500" : "bg-slate-200 dark:bg-slate-700")} />)}
        </div>
      </div>
      <div className="min-w-0 flex-1 text-[11px] leading-snug">
        {sit.batter && <div className="truncate text-slate-800 dark:text-slate-100"><span className="font-bold text-slate-400">AB </span><span className="font-bold">{sit.batter.name}</span></div>}
        {sit.pitcher && <div className="truncate text-slate-500 dark:text-slate-400"><span className="font-bold text-slate-400">P </span>{sit.pitcher.name}</div>}
      </div>
    </div>
  );
}

class HRBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  render() {
    if (this.state.err) return (
      <div className="p-6 pt-20">
        <div className="text-sm font-bold text-red-500 break-words">Breakdown error: {String((this.state.err && this.state.err.message) || this.state.err)}</div>
        <button className="mt-4 text-sm font-extrabold text-blue-600" onClick={this.props.onBack}>‹ Back</button>
      </div>
    );
    return this.props.children;
  }
}

function GameDetail({ g, players, onSelectPlayer, onBack, onPrev, onNext, index, total }) {
  const [side, setSide] = useState("away");
  const live = useLiveGame(g.gamePk);                       // /api/game — score, inning, count, last play, HRs
  const swipe = useSwipe({ onLeft: onNext || undefined, onRight: onPrev || onBack });
  // Follow the game: when the half-inning flips, show the team now batting (a tap on a logo still overrides until the next flip)
  const battingNow = live && live.state === "in" && live.situation ? live.situation.battingTeam : null;
  useEffect(() => { if (battingNow && live) setSide(live.away.abbr === battingNow ? "away" : "home"); }, [battingNow]);
  const [box, setBox] = useState(null);
  const [pstats, setPstats] = useState({});
  const [vsHand, setVsHand] = useState({});
  const [curBatter, setCurBatter] = useState(null);
  const [inning, setInning] = useState(null);
  const [wx, setWx] = useState(null);
  const [liveDef, setLiveDef] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const yr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()).slice(0, 4);
      const ids = ["away", "home"].map((k) => g.teams[k].probablePitcher && g.teams[k].probablePitcher.id).filter(Boolean);
      const [b, ppl, ls, feed] = await Promise.all([
        mlbFetch(`v1/game/${g.gamePk}/boxscore`).then((r) => r.json()).catch(() => ({})),
        ids.length ? mlbFetch(`v1/people?personIds=${ids.join(",")}&hydrate=stats(group=[pitching],type=[season])`).then((r) => r.json()).catch(() => ({})) : Promise.resolve({}),
        mlbFetch(`v1/game/${g.gamePk}/linescore`).then((r) => r.json()).catch(() => ({})),
        mlbFetch(`v1.1/game/${g.gamePk}/feed/live?fields=gameData,weather,condition,temp,wind`).then((r) => r.json()).catch(() => ({})),
      ]);
      if (!alive) return;
      setBox(b);
      setCurBatter((ls && ls.offense && ls.offense.batter && ls.offense.batter.id) || null);
      if (ls && ls.currentInning) setInning({ half: (ls.inningHalf || (ls.isTopInning ? "Top" : "Bot")).toLowerCase().startsWith("top") ? "TOP" : "BOT", num: ls.currentInning });
      if (feed && feed.gameData && feed.gameData.weather && feed.gameData.weather.temp) setWx(feed.gameData.weather);
      const lp = ls && ls.defense && ls.defense.pitcher;
      const offTeam = ls && ls.offense && ls.offense.team && ls.offense.team.id;
      if (lp && lp.id) setLiveDef({ id: lp.id, name: lp.fullName, offenseTeamId: offTeam });
      const outP = {};
      await Promise.all((ppl.people || []).map(async (person) => {
        const sp = (person.stats && person.stats[0] && person.stats[0].splits && person.stats[0].splits[0] && person.stats[0].splits[0].stat) || {};
        outP[person.id] = { hand: person.pitchHand && person.pitchHand.code, w: sp.wins, l: sp.losses, era: sp.era, ip: sp.inningsPitched, so: sp.strikeOuts, bb: sp.baseOnBalls, hr: sp.homeRuns, whip: sp.whip, gs: sp.gamesStarted };
        try {
          const gl = await (await mlbFetch(`v1/people/${person.id}/stats?stats=gameLog&season=${yr}&group=pitching`)).json();
          const gls = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
          outP[person.id].hrL9 = gls.slice(-9).reduce((acc, s) => acc + Number((s.stat && s.stat.homeRuns) || 0), 0);
        } catch {}
      }));
      // Reliever on the mound who wasn't a probable: pull his season line too
      const lp2 = ls && ls.defense && ls.defense.pitcher;
      if (lp2 && lp2.id && !outP[lp2.id]) {
        try {
          const extra = await (await mlbFetch(`v1/people?personIds=${lp2.id}&hydrate=stats(group=[pitching],type=[season])`)).json();
          for (const person of extra.people || []) {
            const sp2 = (person.stats && person.stats[0] && person.stats[0].splits && person.stats[0].splits[0] && person.stats[0].splits[0].stat) || {};
            outP[person.id] = { hand: person.pitchHand && person.pitchHand.code, w: sp2.wins, l: sp2.losses, era: sp2.era, ip: sp2.inningsPitched, so: sp2.strikeOuts, bb: sp2.baseOnBalls, hr: sp2.homeRuns, whip: sp2.whip };
          }
        } catch {}
      }
      if (!alive) return;
      setPstats(outP);
      try {
        const outSplits = {};
        await Promise.all(["away", "home"].map(async (k) => {
          const oppP = g.teams[k === "away" ? "home" : "away"].probablePitcher;
          const hand = oppP && outP[oppP.id] && outP[oppP.id].hand === "L" ? "vl" : "vr";
          const orderIds = (b.teams && b.teams[k] && b.teams[k].battingOrder) || [];
          if (!orderIds.length) return;
          const res = await mlbFetch(`v1/people?personIds=${orderIds.join(",")}&hydrate=stats(group=[hitting],type=[statSplits],sitCodes=[${hand}],season=${yr})`);
          const data = await res.json();
          for (const person of data.people || []) {
            outSplits[person.id] = outSplits[person.id] || {};
            if (person.batSide && person.batSide.code) outSplits[person.id].bats = person.batSide.code;
            for (const grp of person.stats || []) {
              for (const s of grp.splits || []) {
                if (s.split && (s.split.code === "vl" || s.split.code === "vr") && s.stat) {
                  outSplits[person.id].avg = s.stat.avg;
                  outSplits[person.id].hr = s.stat.homeRuns;
                  outSplits[person.id].rbi = s.stat.rbi;
                  outSplits[person.id].ops = s.stat.ops;
                }
              }
            }
          }
        }));
        if (alive) setVsHand(outSplits);
      } catch {}
    })();
    return () => { alive = false; };
  }, [g.gamePk]);
  const myByName = useMemo(() => {
    const m = {};
    for (const p of players || []) {
      const st = latestStats(p);
      m[hrbNrm(p.name)] = { player: p, photo: p.photo || null, streak: st && st.streak != null ? Math.round(st.streak) : 0, barrel: p.barrel, hr9: p.hr9, gb: p.gb, bbe: p.bbe };
    }
    return m;
  }, [players]);

  const abbrOf = (k) => {
    const nm = (g.teams[k].team && g.teams[k].team.name) || "";
    return NAME_TO_ABBR[nm.toLowerCase()] || toAbbr(nm) || "";
  };
  // Live feed wins when it has loaded; the schedule snapshot from the board is the fallback.
  const state = live ? { pre: "Preview", in: "Live", post: "Final" }[live.state] : g.status && g.status.abstractGameState;
  const sit = live && live.state === "in" ? live.situation : null;
  const scoreOf = (k) => (live && live.state !== "pre" && live[k].score != null ? live[k].score : g.teams[k].score);
  const inningNow = live && live.state === "in" && live.inning ? { half: live.inningHalf === "Top" ? "TOP" : "BOT", num: live.inning } : inning;
  const batterNow = sit && sit.batter ? sit.batter.id : curBatter;
  const timeLabel = live && /delay|postpon|suspend|cancel/i.test(live.detail) ? live.detail : state === "Final" ? "Final" : state === "Live" ? "LIVE" :
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(g.gameDate));
  const oppKey = side === "away" ? "home" : "away";
  const probable = g.teams[oppKey].probablePitcher;
  const sideTeamId = g.teams[side].team && g.teams[side].team.id;
  const liveDefNow = sit && sit.pitcher && sit.battingTeam
    ? { id: sit.pitcher.id, name: sit.pitcher.name, offenseTeamId: live.home.abbr === sit.battingTeam ? live.home.id : live.away.id } : liveDef;
  const liveNow = state === "Live" && liveDefNow && liveDefNow.offenseTeamId === sideTeamId && liveDefNow.id !== (probable && probable.id)
    ? { id: liveDefNow.id, fullName: liveDefNow.name } : null;
  const pp = liveNow || probable;
  const ps = pp ? pstats[pp.id] : null;
  // Once the game starts, the story is TODAY: each batter's line so far, and the pitcher's line.
  const inGame = live && live.state !== "pre";
  const todayBat = (pid) => { const b = inGame && live.box[side] && live.box[side].batters.find((x) => x.id === pid); return b || null; };
  const todayLine = (b) => {
    if (!b) return "";
    const parts = [];
    if (b.hr) parts.push(b.hr > 1 ? b.hr + " HR" : "HR");
    if (b.t) parts.push(b.t > 1 ? b.t + " 3B" : "3B");
    if (b.d) parts.push(b.d > 1 ? b.d + " 2B" : "2B");
    if (b.rbi) parts.push(b.rbi + " RBI");
    if (b.bb) parts.push(b.bb > 1 ? b.bb + " BB" : "BB");
    if (b.sb) parts.push(b.sb > 1 ? b.sb + " SB" : "SB");
    if (b.so) parts.push(b.so > 1 ? b.so + " K" : "K");
    return `${b.h}-for-${b.ab}` + (parts.length ? " · " + parts.join(", ") : "");
  };
  const todayPit = pp && inGame ? [...(live.box.away.pitchers || []), ...(live.box.home.pitchers || [])].find((x) => x.id === pp.id) : null;
  const myPP = pp ? myByName[hrbNrm(pp.fullName)] : undefined;
  const teamBox = box && box.teams && box.teams[side];
  const order = (teamBox && teamBox.battingOrder) || [];

  return (
    <div {...swipe} data-own-swipe="1">
      <div className="px-4 pb-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)", backgroundImage: `linear-gradient(100deg, ${bannerColor(abbrOf("away"))} 0%, ${bannerColor(abbrOf("away"))} 40%, ${shade(bannerColor(abbrOf("away")), -12)} 47%, ${shade(bannerColor(abbrOf("home")), -12)} 53%, ${bannerColor(abbrOf("home"))} 60%, ${bannerColor(abbrOf("home"))} 100%)` }}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="text-white/90 text-sm font-semibold">‹ Matchups</button>
          {total > 1 && (
            <div className="flex items-center gap-1 text-white/80">
              <button onClick={onPrev || undefined} disabled={!onPrev} aria-label="Previous game" className={"w-7 h-7 rounded-full text-base font-bold leading-none " + (onPrev ? "bg-white/15 active:bg-white/30" : "opacity-30")}>‹</button>
              <span className="text-[11px] font-bold tabular-nums px-1">{index + 1} / {total}</span>
              <button onClick={onNext || undefined} disabled={!onNext} aria-label="Next game" className={"w-7 h-7 rounded-full text-base font-bold leading-none " + (onNext ? "bg-white/15 active:bg-white/30" : "opacity-30")}>›</button>
            </div>
          )}
        </div>
        <div className="flex items-start justify-between">
          {["away", "home"].map((k) => {
            const ab = abbrOf(k);
            const logo = TEAM_LOGOS[ab];
            const rec = g.teams[k].leagueRecord ? g.teams[k].leagueRecord.wins + "-" + g.teams[k].leagueRecord.losses : "";
            const on = side === k;
            const col = (
              <button key={k} onClick={() => setSide(k)} aria-label={"Show " + ab + " box score"}
                className="flex flex-col items-center px-2 py-1.5 w-[104px]">
                {logo ? <img src={logo} alt="" className={"w-[76px] h-[76px] object-contain drop-shadow-xl" + logoFx(ab)} /> : <span className="w-[76px] h-[76px] rounded-full" style={{ backgroundColor: teamColor(ab) }} />}
                <span className="text-white font-extrabold text-lg leading-tight mt-1">{ab}</span>
                <span className="text-white/70 text-[11px] font-bold">{rec}</span>
                <span className={"mt-1.5 h-[3px] w-10 rounded-full " + (on ? "bg-white" : "bg-white/20")} />
              </button>
            );
            if (k === "away") return col;
            return (
              <React.Fragment key="mid">
                <div className="flex flex-col items-center justify-center pt-6 px-2 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={"text-4xl font-black tabular-nums " + (state === "Final" && scoreOf("away") < scoreOf("home") ? "text-white/60" : "text-white")}>{scoreOf("away") != null ? scoreOf("away") : "–"}</span>
                    <span className="text-white/50 text-xl font-bold">–</span>
                    <span className={"text-4xl font-black tabular-nums " + (state === "Final" && scoreOf("home") < scoreOf("away") ? "text-white/60" : "text-white")}>{scoreOf("home") != null ? scoreOf("home") : "–"}</span>
                  </div>
                  <span className={"text-[11px] font-extrabold tracking-widest uppercase mt-1 " + (state === "Live" ? "text-red-400" : "text-white/80")}>{state === "Live" && inningNow ? inningNow.half + " " + inningNow.num : timeLabel}</span>
                </div>
                {col}
              </React.Fragment>
            );
          })}
        </div>
        {wx && (
          <div className="text-center text-[11px] font-bold text-white/70 mt-1">
            {wxEmoji(wx.condition)} {wx.temp}° · {wx.condition}
            {wx.wind ? " · 💨 " + wx.wind : ""}
          </div>
        )}
        {(live && live.venue && live.venue.name) || (g.venue && g.venue.name) ? (
          <div className="text-center text-[11px] font-semibold text-white/60 mt-0.5">{(live && live.venue && live.venue.name) || g.venue.name}</div>
        ) : null}
      </div>
      <div className="px-4 pb-28">
        {live && live.state !== "pre" && live.away && live.away.linescores && (
          <div className="mt-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {(() => {
              const n = Math.max(9, live.away.linescores.length, live.home.linescores.length);
              const cols = Array.from({ length: n }, (_, i) => i);
              const cur = live.state === "in" ? (live.inning || 0) - 1 : -1;
              const cell = "w-6 text-center text-[11px] tabular-nums";
              return (
                <table className="w-full border-collapse">
                  <thead><tr>
                    <th className="w-10 text-left text-[9px] font-bold tracking-widest uppercase text-slate-400"></th>
                    {cols.map((i) => <th key={i} className={cell + " font-bold text-slate-400"}>{i + 1}</th>)}
                    {["R", "H", "E"].map((h) => <th key={h} className={cell + " font-black text-slate-500 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700"}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {["away", "home"].map((k) => { const t = live[k]; return (
                      <tr key={k} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-1 text-[11px] font-extrabold" style={{ color: teamColor(t.abbr) }}>{t.abbr}</td>
                        {cols.map((i) => { const v = t.linescores[i]; return <td key={i} className={cell + " font-semibold " + (v == null ? "text-slate-300 dark:text-slate-600" : v > 0 ? "text-slate-900 dark:text-white" : "text-slate-500")}>{v == null ? (i < (live.inning || 0) || live.state === "post" ? "-" : "") : v}</td>; })}
                        <td className={cell + " font-black text-slate-900 dark:text-white border-l border-slate-200 dark:border-slate-700"}>{t.score ?? 0}</td>
                        <td className={cell + " font-bold text-slate-700 dark:text-slate-200"}>{t.hits ?? 0}</td>
                        <td className={cell + " font-bold text-slate-700 dark:text-slate-200"}>{t.errors ?? 0}</td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        )}
        {sit && (sit.lastPlay || sit.batter) && (
          <div className="mt-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3">
            {sit.lastPlay && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-semibold tracking-widest uppercase text-rose-500">● Last play</span>
                  {sit.last && sit.last.hit && sit.last.hit.ev != null && (
                    <span className={"text-[10px] font-extrabold tabular-nums " + (sit.last.event === "Home Run" ? "text-orange-500" : "text-slate-400")}>
                      {sit.last.hit.ev.toFixed(1)} mph{sit.last.hit.dist ? " · " + Math.round(sit.last.hit.dist) + " ft" : ""}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-slate-800 dark:text-slate-100 leading-snug">{sit.lastPlay}</div>
              </div>
            )}
            <SituationStrip sit={sit} />
          </div>
        )}
        {live && live.scoring && live.scoring.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest uppercase mt-5 mb-2 px-1 text-slate-400">Scoring</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {live.scoring.map((sp, i) => (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2">
                  {TEAM_LOGOS[sp.team] ? <img src={TEAM_LOGOS[sp.team]} alt={sp.team} className={"w-6 h-6 object-contain shrink-0" + logoFx(sp.team)} /> : <span className="w-7 h-7 rounded-full shrink-0" style={{ backgroundColor: teamColor(sp.team) }} />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] text-slate-800 dark:text-slate-100 leading-snug">{sp.text}</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">{sp.event || "Run"}{sp.rbi > 1 ? " · " + sp.rbi + " RBI" : ""} · {sp.half} {sp.inning}{sp.hit && sp.hit.dist && sp.event === "Home Run" ? " · " + Math.round(sp.hit.dist) + " ft · " + sp.hit.ev.toFixed(1) + " mph" : ""}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-extrabold tabular-nums text-slate-900 dark:text-white">{sp.away}–{sp.home}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mt-4 text-[10px] font-bold tracking-widest uppercase text-slate-400 px-1">Box score · tap a team up top to switch</div>
        {!inGame && <div className="text-[11px] font-bold tracking-widest uppercase mt-6 mb-2 px-1" style={{ color: teamColor(abbrOf(oppKey)) }}>Pitcher</div>}
        {!inGame && <button onClick={myPP && onSelectPlayer ? () => onSelectPlayer(myPP.player) : undefined}
          className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3"
          style={{ borderLeft: "4px solid " + teamColor(abbrOf(oppKey)) }}>
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {(() => {
                const jn = pp && box && box.teams && box.teams[oppKey] && box.teams[oppKey].players && box.teams[oppKey].players["ID" + pp.id] && box.teams[oppKey].players["ID" + pp.id].jerseyNumber;
                return jn ? <span className="text-[11px] font-bold text-slate-400">#{jn} </span> : null;
              })()}
              {pp ? pp.fullName : "Starter TBD"}
              {ps && ps.hand && <span className="text-[11px] font-bold text-slate-400"> · {ps.hand}HP</span>}
              {todayPit && todayPit.note && <span className="ml-2 text-[11px] font-extrabold text-slate-500">{todayPit.note}</span>}
              {liveNow && <span className="ml-2 text-[9px] font-extrabold uppercase tracking-wide text-red-500">Now Pitching</span>}
            </div>
          </div>
          {false && (
            <div className="mt-3 grid grid-cols-7 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              {[["IP", todayPit.ip], ["H", todayPit.h], ["R", todayPit.r], ["ER", todayPit.er], ["BB", todayPit.bb], ["K", todayPit.so], ["P", todayPit.pitches ?? "—"]].map(([k, v]) => (
                <span key={k} className="text-center">
                  <span className="block text-[8px] font-extrabold uppercase tracking-wider text-white py-0.5" style={{ backgroundColor: bannerColor(abbrOf(oppKey)) }}>{k}</span>
                  <span className="block text-[15px] font-black tabular-nums text-slate-900 dark:text-white py-1.5 bg-white dark:bg-slate-900">{v}</span>
                </span>
              ))}
            </div>
          )}
          {ps && (
            <div className="mt-3">
              {/* Traditional line - two clean rows of five, scoreboard style */}
              <div className="grid grid-cols-5 gap-y-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                {[["W-L", (ps.w ?? 0) + "-" + (ps.l ?? 0)], ["ERA", ps.era ?? "—"], ["WHIP", ps.whip ?? "—"], ["IP", ps.ip ?? "—"], ["GS", ps.gs ?? "—"],
                  ["SO", ps.so ?? "—"], ["BB", ps.bb ?? "—"], ["HR", ps.hr ?? "—"], ["HR L9", ps.hrL9 ?? "—"],
                  ["BBE", (() => { const mp = pp ? myByName[hrbNrm(pp.fullName)] : null; return mp && mp.bbe != null ? Math.round(mp.bbe) : "—"; })()],
                ].map(([lbl, v]) => (
                  <span key={lbl} className="text-center">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wide">{lbl}</span>
                    <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v}</span>
                  </span>
                ))}
              </div>
              {/* Statcast strip - the colored, decision-driving numbers */}
              {(() => {
                const mp = pp ? myByName[hrbNrm(pp.fullName)] : null;
                if (!mp || (mp.barrel == null && mp.gb == null && mp.hr9 == null)) return null;
                return (
                  <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    {[["BRL%", mp.barrel != null ? Number(mp.barrel).toFixed(1) + "%" : "—", hrbPitBrlClass(mp.barrel)],
                      ["GB%", mp.gb != null ? Number(mp.gb).toFixed(0) + "%" : "—", hrbGbClass(mp.gb)],
                      ["HR/9", mp.hr9 != null ? Number(mp.hr9).toFixed(2) : "—", hrbHr9Class(mp.hr9)],
                    ].map(([lbl, v, cls]) => (
                      <span key={lbl} className="text-center">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wide">{lbl}</span>
                        <span className={"block text-xs font-extrabold rounded px-1.5 py-0.5 mx-auto w-fit tabular-nums " + cls}>{v}</span>
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </button>}

        <div className="text-[11px] font-bold tracking-widest uppercase mt-6 mb-2 px-1" style={{ color: teamColor(abbrOf(side)) }}>
          {(g.teams[side].team && g.teams[side].team.name) || ""}{inGame ? " · Batting" : " vs " + (ps && ps.hand === "L" ? "LHP" : "RHP")}
        </div>
        {inGame && order.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[28px_32px_1fr_repeat(6,30px)] items-center px-2 py-1.5 text-[8px] font-extrabold uppercase tracking-wider text-white" style={{ backgroundColor: bannerColor(abbrOf(side)) }}>
              <span></span><span>Pos</span><span>Batter</span>{["AB", "R", "H", "RBI", "BB", "K"].map((k) => <span key={k} className="text-center">{k}</span>)}
            </div>
            {order.map((pid, i) => {
              const pd = teamBox.players["ID" + pid] || {};
              const nm = (pd.person && pd.person.fullName) || "";
              const pos = (pd.position && pd.position.abbreviation) || "";
              const b = todayBat(pid);
              const mine = myByName[hrbNrm(nm)];
              const isBatting = batterNow === pid && state === "Live";
              const extra = b ? [b.hr ? (b.hr > 1 ? b.hr + " HR" : "HR") : "", b.t ? (b.t > 1 ? b.t + " 3B" : "3B") : "", b.d ? (b.d > 1 ? b.d + " 2B" : "2B") : "", b.sb ? (b.sb > 1 ? b.sb + " SB" : "SB") : ""].filter(Boolean).join(", ") : "";
              const hot = b && (b.hr || b.h >= 2);
              const RowTag = mine && onSelectPlayer ? "button" : "div";
              return (
                <RowTag key={pid} onClick={mine && onSelectPlayer ? () => onSelectPlayer(mine.player) : undefined}
                  className={"w-full text-left grid grid-cols-[28px_32px_1fr_repeat(6,30px)] items-center px-2 py-1.5 border-t border-slate-100 dark:border-slate-800 " + (isBatting ? "bg-emerald-50 dark:bg-emerald-900/30" : i % 2 ? "bg-slate-50/60 dark:bg-slate-800/30" : "")}>
                  <span className="text-[11px] font-extrabold tabular-nums text-slate-400">{i + 1}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{pos}</span>
                  <span className="min-w-0 pr-1">
                    <span className={"block text-[12px] font-bold truncate " + (isBatting ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-slate-100")}>
                      {lastNameOf(nm) || nm}{isBatting && <span className="ml-1.5 text-[8px] font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">At bat</span>}
                      <InjBadge name={nm} team={abbrOf(side)} />
                    </span>
                    {extra && <span className={"block text-[10px] font-bold " + (hot ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500")}>{extra}</span>}
                  </span>
                  {[b ? b.ab : 0, b ? b.r : 0, b ? b.h : 0, b ? b.rbi : 0, b ? b.bb : 0, b ? b.so : 0].map((v, j) => (
                    <span key={j} className={"text-center text-[12px] tabular-nums " + (j === 2 && v > 0 ? "font-black text-slate-900 dark:text-white" : v > 0 ? "font-bold text-slate-800 dark:text-slate-200" : "font-semibold text-slate-300 dark:text-slate-600")}>{v}</span>
                  ))}
                </RowTag>
              );
            })}
          </div>
        )}
        {inGame && box != null && order.length === 0 && <div className="text-center text-sm text-slate-400 py-10">Lineup not posted yet.</div>}
        {inGame && (() => {
          const staff = (live.box[side] && live.box[side].pitchers) || [];
          const onMound = sit && sit.pitcher ? sit.pitcher.id : null;
          if (!staff.length) return null;
          return (
            <>
              <div className="text-[11px] font-bold tracking-widest uppercase mt-6 mb-2 px-1" style={{ color: teamColor(abbrOf(side)) }}>{(g.teams[side].team && g.teams[side].team.name) || ""} · Pitching</div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[1fr_repeat(7,30px)] items-center px-2 py-1.5 text-[8px] font-extrabold uppercase tracking-wider text-white" style={{ backgroundColor: bannerColor(abbrOf(side)) }}>
                  <span>Pitcher</span>{["IP", "H", "R", "ER", "BB", "K", "P"].map((k) => <span key={k} className="text-center">{k}</span>)}
                </div>
                {staff.map((pt, i) => {
                  const now = pt.id === onMound && state === "Live";
                  const mp = myByName[hrbNrm(pt.name)];
                  const RowTag = mp && onSelectPlayer ? "button" : "div";
                  return (
                    <RowTag key={pt.id} onClick={mp && onSelectPlayer ? () => onSelectPlayer(mp.player) : undefined}
                      className={"w-full text-left grid grid-cols-[1fr_repeat(7,30px)] items-center px-2 py-1.5 border-t border-slate-100 dark:border-slate-800 " + (now ? "bg-emerald-50 dark:bg-emerald-900/30" : i % 2 ? "bg-slate-50/60 dark:bg-slate-800/30" : "")}>
                      <span className="min-w-0 pr-1">
                        <span className={"block text-[12px] font-bold truncate " + (now ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-slate-100")}>
                          {lastNameOf(pt.name) || pt.name}{pt.throws ? <span className="text-[10px] font-bold text-slate-400"> {pt.throws}HP</span> : null}{pt.note ? <span className="text-[10px] font-extrabold text-slate-500"> {pt.note}</span> : null}
                        </span>
                        {now && <span className="block text-[9px] font-extrabold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">On the mound{pt.pitches != null ? " · " + pt.pitches + " pitches" : ""}</span>}
                      </span>
                      {[pt.ip, pt.h, pt.r, pt.er, pt.bb, pt.so, pt.pitches ?? "—"].map((v, j) => (
                        <span key={j} className={"text-center text-[12px] tabular-nums " + (j === 0 || j === 5 ? "font-black text-slate-900 dark:text-white" : Number(v) > 0 ? "font-bold text-slate-800 dark:text-slate-200" : "font-semibold text-slate-300 dark:text-slate-600")}>{v}</span>
                      ))}
                    </RowTag>
                  );
                })}
              </div>
            </>
          );
        })()}
        <div className={"bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden " + (inGame ? "hidden" : "")}>
          {box == null && <SkeletonCards cards={2} rows={5} />}
          {box != null && order.length === 0 && <div className="text-center text-sm text-slate-400 py-10">Lineup not posted yet.</div>}
          {!inGame && order.map((pid, i) => {
            const pd = teamBox.players["ID" + pid] || {};
            const nm = (pd.person && pd.person.fullName) || "";
            const pos = (pd.position && pd.position.abbreviation) || "—";
            const season = (pd.seasonStats && pd.seasonStats.batting) || {};
            const sp = vsHand[pid] || {};
            // vs-hand splits where available, season numbers fill any gaps
            const bat = {
              avg: sp.avg != null ? sp.avg : season.avg,
              hr: sp.hr != null ? sp.hr : season.homeRuns,
              rbi: sp.rbi != null ? sp.rbi : season.rbi,
              ops: sp.ops != null ? sp.ops : season.ops,
            };
            const mine = myByName[hrbNrm(nm)];
            const streak = (mine && mine.streak) || 0;
            const isBatting = batterNow === pid && state === "Live";
            const RowTag = mine && onSelectPlayer ? "button" : "div";
            return (
              <RowTag key={pid}
                onClick={mine && onSelectPlayer ? () => onSelectPlayer(mine.player) : undefined}
                className={"w-full text-left flex items-center gap-3 px-4 py-3 " + (isBatting ? "ring-2 ring-inset ring-emerald-400 rounded-2xl bg-emerald-100/60 dark:bg-emerald-900/30" : "")}>
                <span className="shrink-0 flex items-center">
                  <span className="w-4 text-right text-[11px] font-extrabold tabular-nums text-[color:var(--tc)] dark:text-white" style={{ "--tc": teamColor(abbrOf(side)) }}>{i + 1}</span>
                  <span className="w-9 text-center text-[11px] font-extrabold text-slate-400 uppercase">{pos}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {pd.jerseyNumber && <span className="text-[11px] font-bold text-slate-400">#{pd.jerseyNumber} </span>}
                    {nm} <InjBadge name={nm} team={abbrOf(side)} />
                  </span>
                  <span className="flex gap-2 mt-1">
                    {[["AVG", bat.avg ? String(bat.avg).replace(/^0/, "") : "—"], ["HR", bat.hr != null ? bat.hr : "—"], ["RBI", bat.rbi != null ? bat.rbi : "—"], ["OPS", bat.ops ? String(bat.ops).replace(/^0/, "") : "—"], ["BRL%", mine && mine.barrel != null ? Number(mine.barrel).toFixed(1) + "%" : "—"]].map(([lbl, v]) => (
                      <span key={lbl} className="w-10 text-center">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                        <span className={"block text-[11px] font-extrabold tabular-nums " + (lbl === "BRL%" && v !== "—" ? "rounded px-0.5 " + hrbHitClass(parseFloat(v)) : lbl === "BRL%" ? "text-slate-300 dark:text-slate-600" : "text-slate-800 dark:text-slate-100")}>{v}</span>
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 flex items-center">
                  <span className="w-10 text-center text-[11px] font-extrabold text-orange-500 dark:text-orange-400">{streak >= 5 ? streak + "🔥" : ""}</span>
                  <span className="w-4 text-center text-[11px] font-extrabold uppercase text-[color:var(--tc)] dark:text-white" style={{ "--tc": teamColor(abbrOf(side)) }}>{sp.bats || ""}</span>
                </span>
              </RowTag>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TeamsTab({ teams, players, onSelect, onSelectPlayer }) {
  const [q, setQ] = useState("");
  const [conf, setConf] = useState("all"); // all | east | west
  const [div, setDiv] = useState(null);    // division name or null
  const s = q.toLowerCase().trim();
  // Direct team-name matches, plus teams of any player whose name matches -
  // searching "Brunson" surfaces the Knicks.
  const playerTeamAbbrs = new Set(
    s
      ? players
          .filter((p) => p.name.toLowerCase().includes(s))
          .map((p) => teamOfPlayer(p))
          .filter(Boolean)
      : []
  );
  const confOf = (t) => {
    const c = String(t.conference).toLowerCase();
    return c.startsWith("a") ? "al" : c.startsWith("n") ? "nl" : "other";
  };
  // Divisional rank across ALL teams (unaffected by search/filters)
  const divRank = {};
  {
    const byDiv = {};
    for (const t of teams) { if (t.division) (byDiv[t.division] ??= []).push(t); }
    for (const arr of Object.values(byDiv)) {
      arr.sort((a, b) => winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0));
      arr.forEach((t, i) => { divRank[t.id] = ORDINALS[i] || `${i + 1}th`; });
    }
  }
  const divisions = conf === "all" ? [] :
    [...new Set(teams.filter((t) => confOf(t) === conf).map((t) => t.division).filter(Boolean))].sort();
  let list = teams.filter((t) => {
    if (conf !== "all" && confOf(t) !== conf) return false;
    if (div && t.division !== div) return false;
    if (!s) return true;
    if ((t.name + " " + t.abbr).toLowerCase().includes(s)) return true;
    const abbr = t.abbr || toAbbr(t.name);
    return playerTeamAbbrs.has(abbr);
  });
  list = [...list].sort((a, b) =>
    conf === "all"
      ? String(a.name).localeCompare(String(b.name))
      : winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0)
  );
  const pickConf = (k) => { setConf(k); setDiv(null); };
  return (
    <div>
      <ListHeader title="Teams" />
      <div className="px-4 pb-28">
        <div className="flex gap-2 mt-4">
          {[["all", "All"], ["al", "American League"], ["nl", "National League"]].map(([k, lbl]) => (
            <button key={k} onClick={() => pickConf(k)}
              className={"flex-1 py-2 rounded-full text-xs font-bold transition-colors " + (conf === k
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
              {lbl}
            </button>
          ))}
        </div>
        {divisions.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
            {divisions.map((d) => (
              <button key={d} onClick={() => setDiv(div === d ? null : d)}
                className={"px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors " + (div === d
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
                {d}
              </button>
            ))}
          </div>
        )}
        {/* Each team is its own pill in that club's primary color. */}
        <div className="space-y-2 mt-4">
          {list.map((t) => {
            const abbr = t.abbr || toAbbr(t.name);
            const col = teamColor(abbr);
            return (
              <button key={t.id} onClick={() => onSelect(t)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left shadow-sm active:opacity-90 transition-opacity"
                style={{ backgroundColor: col }}>
                {t.logo ? (
                  <img src={t.logo} alt="" className={"w-14 h-14 object-contain shrink-0 drop-shadow-lg" + logoFx(abbr)} />
                ) : (
                  <span className="w-11 h-11 rounded-full shrink-0 bg-white/90 flex items-center justify-center text-[11px] font-extrabold" style={{ color: col }}>{abbr}</span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-extrabold text-white truncate drop-shadow-sm">{t.name}</span>
                  <span className="block text-[11px] font-semibold text-white/70 truncate">
                    {t.division ? (divRank[t.id] ? `${divRank[t.id]} in ${t.division}` : t.division) : "—"}
                  </span>
                </span>
                {(t.wins != null || t.losses != null) && (
                  <span className="flex gap-2 shrink-0 pr-1">
                    {[["W", t.wins ?? 0], ["L", t.losses ?? 0]].map(([lbl, v]) => (
                      <span key={lbl} className="w-7 text-center">
                        <span className="block text-[8px] font-bold text-white/60 uppercase">{lbl}</span>
                        <span className="block text-xs font-extrabold text-white tabular-nums">{v}</span>
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No teams match{q ? ` "${q}"` : " the selected filters"}.</div>}

      </div>
    </div>
  );
}


function StatusBadge({ status, lg = false }) {
  if (!status) return null;
  const s = String(status).toLowerCase().trim();
  if (lg && (s.includes("active") || s.includes("available")) && !s.includes("inactive")) return <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-emerald-500 text-white shadow-sm">{String(status)}</span>;
  const raw = String(status);
  const dayMatch = raw.match(/(\d+)\s*-?\s*day/i) || raw.match(/^il-?(\d+)$/i);
  const isMin = /minor|option/.test(s);
  const label = isMin ? "MIN" : dayMatch && /(il|injur)/i.test(raw) ? "IL" + dayMatch[1] : raw;
  let cls = "bg-slate-100 text-slate-500 dark:text-slate-400";
  if (isMin) return <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-orange-500 text-white">MINORS</span>;
  if (s === "ir" || s.includes("injured reserve") || s.includes("out") || s.includes("il") || s.includes("injur") || s.includes("day")) cls = "bg-rose-600 text-white";
  else if (s.includes("active") || s.includes("available")) cls = "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300";
  else if (s.includes("minor") || s.includes("question") || s.includes("doubt")) cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
  return (
    <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + cls}>
      {label}
    </span>
  );
}


// ═══════════════ LIVE INJURIES ═══════════════════════════════════
// /api/injuries (ESPN's MLB injury report) loaded once at app start and
// refreshed every 10 minutes. Kept in one shared store so any row anywhere
// can show a tag with <InjBadge name team /> — no prop plumbing.
// The live report WINS over the Status typed into Airtable: if Airtable still
// says IL-10 but the player is off the report, he shows as healthy.
const INJ = { map: null, subs: new Set() };
const injNrm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[\u0131\u0130]/g, "i").replace(/\u00f8/g, "o").replace(/\u0142/g, "l")
  .replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
function loadInjuries() {
  fetch("/api/injuries").then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (d && d.injuries && Object.keys(d.injuries).length) { INJ.map = d.injuries; INJ.subs.forEach((f) => f()); }
  }).catch(() => {});
}
function useInjuries() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); INJ.subs.add(f); return () => { INJ.subs.delete(f); }; }, []);
  return INJ.map;
}
// name + team is exact. Name alone is only trusted when we don't know the team
// or the teams agree — never tag the OTHER Max Muncy.
function injFor(name, team) {
  if (!INJ.map || !name) return null;
  const k = injNrm(name), t = String(team || "").toUpperCase();
  if (t && INJ.map[k + "|" + t]) return INJ.map[k + "|" + t];
  const r = INJ.map[k];
  return r && (!t || !r.team || r.team === t) ? r : null;
}
const INJ_STYLE = {
  il: "bg-rose-600 text-white",
  dtd: "bg-rose-600 text-white",
  off: "bg-slate-600 text-white",
  min: "bg-orange-500 text-white",
};
const injLabel = (r) => {
  const c = String(r.code || "");
  const il = /^IL(\d+)$/.exec(c);
  if (il) return ["IL-" + il[1], INJ_STYLE.il];
  if (c === "DTD") return ["DTD", INJ_STYLE.dtd];
  if (c === "MIN") return ["MINORS", INJ_STYLE.min];
  if (c === "OUT") return ["OUT", INJ_STYLE.il];
  if (c === "SUSP") return ["SUSP", INJ_STYLE.off];
  if (c === "BRV") return ["BEREAVEMENT", INJ_STYLE.off];
  if (c === "PAT") return ["PATERNITY", INJ_STYLE.off];
  if (c === "RES") return ["RESTRICTED", INJ_STYLE.off];
  return c ? ["INJ", INJ_STYLE.dtd] : null;
};
// "Left hamstring strain · Est. return Oct 1"
const injText = (r) => {
  const ok = (v) => (v && !/not specified|^n\/?a$/i.test(v) ? v : "");
  const what = [ok(r.side), ok(r.type) || ok(r.location), ok(r.detail)].filter(Boolean).join(" ").trim();
  return what ? what.charAt(0).toUpperCase() + what.slice(1).toLowerCase() : "";
};
// "Estimated Return Date: Sep 22" (month always capitalised)
const injReturn = (r) => {
  if (!r || !r.returnDate) return "";
  const d = new Date(r.returnDate);
  return isNaN(d) ? "" : "Estimated Return Date: " + new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
};
const ReturnLine = ({ r, className = "" }) => { const t = injReturn(r); return t ? <span className={"block text-[11px] font-bold text-rose-500 " + className}>{t}</span> : null; };
// ONE answer to "what tag does this player wear?", used by the field view, the
// bench and the roster so they can never disagree:
//   live report (ESPN + MLB's official roster status) → Airtable Status →
//   Airtable Injury Notes (your manual override: type a note and he's flagged
//   even when neither feed lists him).
// kind: il (red) · dtd (amber) · min (orange, minor leagues) · off (grey)
const STALE_INJ = /(^|[^a-z])(il|ir)([^a-z]|$)|injur|disabled|\d\s*-?\s*day|^out$|question|doubt|day.to.day|dtd/i;
function statusTag(p, team) {
  if (!p) return null;
  const t = team || (p._virtual ? "" : teamOfPlayer(p));
  const live = injFor(p.name, t);
  if (live) {
    const c = String(live.code || "");
    if (/^IL\d+$/.test(c)) return { label: c, kind: "il" };
    if (c === "DTD") return { label: "DTD", kind: "dtd" };
    if (c === "MIN") return { label: "MINORS", kind: "min" };
    if (c === "OUT") return { label: "OUT", kind: "il" };
    if (c) return { label: c === "INJ" ? "INJ" : c.slice(0, 4), kind: c === "INJ" ? "dtd" : "off" };
  }
  const raw = String(p.status || "").trim(), low = raw.toLowerCase();
  if (/minor|option/.test(low)) return { label: "MINORS", kind: "min" };
  const note = String(p.injuryNotes || "").trim();
  if (raw && low !== "active" && !/available/.test(low)) {
    const stale = INJ.map && STALE_INJ.test(raw) && !note;      // live report loaded and doesn't back it up
    if (!stale) {
      const d = /(\d+)/.exec(raw);
      if (/il|injur|disabled/.test(low)) return { label: d ? "IL" + d[1] : "IL", kind: "il" };
      if (/day.to.day|dtd|question/.test(low)) return { label: "DTD", kind: "dtd" };
      if (/out|nri|restricted|suspend/.test(low)) return { label: "OUT", kind: "il" };
      if (!STALE_INJ.test(raw)) return { label: raw.slice(0, 6).toUpperCase(), kind: "off" };
    }
  }
  return note ? { label: "INJ", kind: "dtd" } : null;
}
const isMinors = (p, team) => { const t = statusTag(p, team); return !!t && t.kind === "min"; };
const TAG_SOLID = { il: "bg-rose-600", dtd: "bg-rose-600", min: "bg-orange-500", off: "bg-slate-500" };
const TAG_RING = { il: "border-rose-500", dtd: "border-rose-500", min: "border-orange-400", off: "border-slate-400" };

function InjBadge({ name, team, lg = false }) {
  useInjuries();
  const r = injFor(name, team);
  const l = r && injLabel(r);
  if (!l) return null;
  return <span className={"inline-block align-middle font-extrabold rounded shrink-0 " + (lg ? "text-[11px] px-2 py-0.5 " : "text-[9px] px-1.5 py-px ") + l[1]}>{l[0]}</span>;
}
// Status shown for an Airtable player: live report first; otherwise his Airtable
// status — except a stale injury status the live report no longer backs up.
function LiveStatus({ p, lg = false }) {
  useInjuries();
  const team = teamOfPlayer(p);
  if (injFor(p.name, team)) return <InjBadge name={p.name} team={team} lg={lg} />;
  const t = statusTag(p, team);
  if (t && (t.kind === "min" || t.label === "INJ")) return <span className={"inline-block align-middle font-extrabold rounded shrink-0 " + (lg ? "text-[11px] px-2 py-0.5 " : "text-[9px] px-1.5 py-px ") + INJ_STYLE[t.kind]}>{t.label}</span>;
  if (!t && STALE_INJ.test(String(p.status || ""))) return lg && INJ.map ? <StatusBadge status="Active" lg /> : null;   // Airtable says hurt, live report says healthy → healthy
  return <StatusBadge status={p.status} lg={lg} />;
}
const POS_FULL = { C: "Catcher", "1B": "First Baseman", "2B": "Second Baseman", "3B": "Third Baseman", SS: "Shortstop", LF: "Left Fielder", CF: "Center Fielder", RF: "Right Fielder", OF: "Outfielder", IF: "Infielder", UT: "Utility", UTIL: "Utility", DH: "Designated Hitter", SP: "Starting Pitcher", RP: "Relief Pitcher", CP: "Closer", CL: "Closer", P: "Pitcher", RHP: "Right-Handed Pitcher", LHP: "Left-Handed Pitcher", TWP: "Two-Way Player" };
// "SF" or "Giants" in Airtable → "San Francisco Giants"
const teamFullName = (p) => {
  const raw = String(p.teamName || "").trim();
  if (raw.split(" ").length >= 2 && !/^[A-Z]{2,3}$/.test(raw) && raw.length > 4) return raw;
  const full = ABBR_TO_NAME[teamOfPlayer(p)] || "";
  return full ? full.replace(/\b\w/g, (c) => c.toUpperCase()) : raw;
};
const posFull = (pos) => POS_FULL[String(pos || "").toUpperCase()] || String(pos || "");
// Player-page line under the name: what the injury is and when he's due back.
function InjuryLine({ p }) {
  useInjuries();
  const r = injFor(p.name, teamOfPlayer(p));
  const text = r ? injText(r) : "";
  if (text || (r && r.returnDate)) return <div className="mt-1 text-[12px] font-semibold text-white/90 leading-snug">{text}<ReturnLine r={r} className="text-rose-200 mt-0.5" /></div>;
  if (!r && p.injuryNotes) return <div className="mt-1 text-[12px] font-semibold text-white/90 leading-snug">{p.injuryNotes}</div>;
  return null;
}

// Committed salary for a player in a given season (active deals only)
function salaryInSeason(p, season) {
  for (const c of p.contracts || []) {
    if (c.status !== "Active") continue;
    for (const y of c.years || []) {
      if (y.season === season && y.salary != null) return { salary: y.salary, type: y.type, decision: y.decision };
    }
  }
  return null;
}
function seasonsAhead(n) {
  const out = [CURRENT_SEASON];
  for (let i = 1; i < n; i++) out.push(nextSeason(out[i - 1]));
  return out.filter(Boolean);
}
const LINE_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b", "#0891b2"];

// ── Today's lineup, shared by the Fielding view and the Batting Order list ──
// CONFIRMED  = MLB has posted today's batting order (read from today's box score).
// PROJECTED  = nothing posted yet, so we show the lineup from the team's most
//              recent completed game — all nine hitters, in order.
// Re-checks every 3 minutes until today's lineup is confirmed, then stops.
// Returns null while loading, else { confirmed, noGame, order:[{slot,name,pos,id,no}], spots:{POS:name}, pitcher }.
function useTodayLineup(abbr, on = true) {
  const [lineup, setLineup] = useState(null);
  useEffect(() => {
    const tid = MLB_TEAM_ID[abbr];
    if (!on || !tid) return;
    let alive = true, timer = null;
    const day = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + n * 86400000));
    const readBox = async (g) => {
      const side = g.teams.away.team.id === tid ? "away" : "home";
      const box = await (await mlbFetch(`v1/game/${g.gamePk}/boxscore`)).json();
      const pl = (box.teams && box.teams[side] && box.teams[side].players) || {};
      const order = [], spots = {};
      for (const x of Object.values(pl)) if (x.person && x.person.id && x.person.fullName) MLB_ID_CACHE[String(x.person.fullName).toLowerCase() + "|" + abbr] = x.person.id;
      for (const x of Object.values(pl)) {
        if (x.battingOrder == null || Number(x.battingOrder) % 100 !== 0 || !x.person) continue;      // starters only (x00)
        const pos = String((x.position && x.position.abbreviation) || "").toUpperCase();
        order.push({ slot: Number(x.battingOrder) / 100, name: x.person.fullName, pos, id: x.person.id, no: x.jerseyNumber || "" });
        if (pos) spots[pos] = x.person.fullName;
      }
      order.sort((a, b) => a.slot - b.slot);
      return { order, spots };
    };
    const load = async () => {
      try {
        const sch = await (await mlbFetch(`v1/schedule?sportId=1&teamId=${tid}&date=${day(0)}&hydrate=probablePitcher`)).json();
        const games = (sch.dates && sch.dates[0] && sch.dates[0].games) || [];
        const g = games.find((x) => x.status && x.status.abstractGameState !== "Final") || games[games.length - 1] || null;   // doubleheader: the game still to play
        let pp = null, today = null;
        if (g) {
          const side = g.teams.away.team.id === tid ? "away" : "home";
          const ppo = g.teams[side].probablePitcher;
          pp = ppo ? ppo.fullName : null;
          if (ppo && ppo.id) MLB_ID_CACHE[String(ppo.fullName).toLowerCase() + "|" + abbr] = ppo.id;   // exact photo for the starter
          today = await readBox(g);
        }
        if (today && today.order.length) { if (alive) setLineup({ confirmed: true, noGame: false, ...today, pitcher: pp }); return; }
        let last = null;
        try {
          const past = await (await mlbFetch(`v1/schedule?sportId=1&teamId=${tid}&startDate=${day(-7)}&endDate=${day(0)}`)).json();
          const done = (past.dates || []).flatMap((d) => d.games || []).filter((x) => x.status && x.status.abstractGameState === "Final" && !/postpon|cancel/i.test(x.status.detailedState || ""))
            .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));
          if (done[0]) last = await readBox(done[0]);
        } catch {}
        if (alive) setLineup({ confirmed: false, noGame: !g, order: last ? last.order : [], spots: {}, pitcher: pp });
        if (g && alive) timer = setTimeout(load, 180000);
      } catch { if (alive) timer = setTimeout(load, 180000); }
    };
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [abbr, on]);
  return lineup;
}

// "Projected lineup" / "Confirmed lineup" tag — same look as the basketball app's court badge.
// onField = sits on the grass (translucent dark pill, bright text); otherwise a tinted pill for white cards.
function LineupBadge({ lineup, onField = false }) {
  const conf = !!(lineup && lineup.confirmed);
  const text = conf ? "Confirmed lineup" : "Projected lineup";
  const cls = onField
    ? "bg-black/40 backdrop-blur-sm shadow " + (conf ? "text-emerald-300" : "text-amber-300")
    : conf ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return <span className={"inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide " + cls}>{text}{!conf && lineup && lineup.noGame ? " · off day" : ""}</span>;
}

function FieldView({ roster, abbr, teamName, onSelectPlayer }) {
  // Today's lineup (confirmed by MLB, else projected) comes from the shared hook above.
  const lineup = useTodayLineup(abbr);
  const [coaches, setCoaches] = useState(null);
  useEffect(() => {
    const tid = MLB_TEAM_ID[abbr];
    if (!tid) return;
    let alive = true;
    (async () => {
      try {
        const c = await (await mlbFetch(`v1/teams/${tid}/coaches`)).json();
        const roles = {};
        for (const r of c.roster || []) {
          const job = String((r.job || r.jobId || "")).toLowerCase();
          const nm = r.person && r.person.fullName;
          if (!nm) continue;
          if (job === "manager") roles.manager = nm;
          else if (job.includes("bench")) roles.bench = nm;
          else if (job.includes("pitching") && !job.includes("assistant") && !job.includes("bullpen")) roles.pitching = nm;
          else if (job.includes("hitting") && !job.includes("assistant")) roles.hitting = nm;
        }
        if (alive) setCoaches(roles);
        // Tenure: walk back season by season while the same person holds the job
        const yr = parseInt(String(CURRENT_SEASON).slice(0, 4), 10);
        const since = {};
        const open = new Set(Object.keys(roles));
        for (let y = yr - 1; y >= yr - 30 && open.size; y -= 1) {
          let prev = null;
          try { prev = await (await mlbFetch(`v1/teams/${tid}/coaches?season=${y}`)).json(); } catch { break; }
          const had = {};
          for (const r of prev.roster || []) {
            const job = String((r.job || r.jobId || "")).toLowerCase(); const nm = r.person && r.person.fullName;
            if (!nm) continue;
            if (job === "manager") had.manager = nm;
            else if (job.includes("bench")) had.bench = nm;
            else if (job.includes("pitching") && !job.includes("assistant") && !job.includes("bullpen")) had.pitching = nm;
            else if (job.includes("hitting") && !job.includes("assistant")) had.hitting = nm;
          }
          for (const k of [...open]) { if (had[k] === roles[k]) since[k] = y; else open.delete(k); }
        }
        const seasons = {};
        for (const k of Object.keys(roles)) seasons[k] = yr - (since[k] ?? yr) + 1;
        if (alive) setCoaches({ ...roles, seasons });
      } catch {}
    })();
    return () => { alive = false; };
  }, [abbr]);

  useInjuries();                                   // re-draw when the live report lands / refreshes
  const tagOf = (pl) => statusTag(pl, abbr);       // { label, kind } or null — live report first
  const injTag = (pl) => { const t = tagOf(pl); return t ? t.label : null; };
  // Minor leaguers never appear here — not on the field, not on the bench (they live at the bottom of the Roster tab).
  const bigLeague = roster.filter((pl) => !isMinors(pl, abbr));
  const byName = {};
  for (const pl of roster) byName[hrbNrm(pl.name)] = pl;

  // Geometry (viewBox 0-100 x, 0-128 y). The diamond sits low so the catcher is
  // at the bottom edge and the outfield gets the room (fence 95 units from home).
  // Home 50,106 · 1B 74,82 · 2B 50,58 · 3B 26,82 · mound 50,82.
  // Fielders stand where they really play — BEHIND the bags, not on them: the
  // middle infielders deep on the back of the dirt, the corners up the line
  // toward the outfield grass. That keeps every photo, name and number chip
  // clear of the bases. The catcher squats centred directly below the plate,
  // low enough that home plate and both batter's boxes stay visible.
  // Only ONE pitcher here — today's starter (MLB's probable when posted,
  // else Sort Priority 1 from Airtable); the rest of the staff lives under
  // Roster › Pitching Rotation.
  const FIELD_H = 128;
  const SPOTS = [
    { lbl: "CF", x: 50, y: 27, aliases: ["CF", "OF"] },
    { lbl: "LF", x: 14, y: 36, aliases: ["LF", "OF"] },
    { lbl: "RF", x: 86, y: 36, aliases: ["RF", "OF"] },
    { lbl: "2B", x: 66, y: 53, aliases: ["2B"] },
    { lbl: "SS", x: 34, y: 53, aliases: ["SS"] },
    { lbl: "3B", x: 15, y: 68, aliases: ["3B"] },
    { lbl: "1B", x: 85, y: 68, aliases: ["1B"] },
    { lbl: "P",  x: 50, y: 70, aliases: ["SP", "P", "RHP", "LHP"] },    // today's starter, between the mound and 2B
    { lbl: "C",  x: 50, y: 116, aliases: ["C"] },
  ];
  // ── Assign ONE player per spot, computed once (no side effects) ──
  const used = new Set();
  const assigned = SPOTS.map((sp) => {
    let hit = null;
    if (sp.lbl === "P" && lineup && lineup.pitcher) {                  // probable pitcher counts even before the lineup is confirmed
      hit = byName[hrbNrm(lineup.pitcher)] || { name: lineup.pitcher, pos: "P", id: "mlb:" + lineup.pitcher, _virtual: true, teamAbbr: abbr };
    } else if (lineup && lineup.confirmed && sp.lbl !== "P") {
      const nm = lineup.spots[sp.lbl];
      if (nm) hit = byName[hrbNrm(nm)] || { name: nm, pos: sp.lbl, id: "mlb:" + nm, _virtual: true, teamAbbr: abbr };
    }
    if (!hit && sp.lbl === "P") {                                        // no probable yet: the #1 starter from Airtable's Sort Priority
      const slot = (pl) => (/^\d+$/.test(String(pl.sortLabel ?? "").trim()) ? Number(pl.sort) : null);
      hit = bigLeague.filter((pl) => sp.aliases.includes(String(pl.pos || "").toUpperCase()) && slot(pl) >= 1 && slot(pl) <= 5 && !tagOf(pl)).sort((a, b) => slot(a) - slot(b))[0] || null;
    }
    if (!hit) {
      const cands = bigLeague                        // projected lineup: skip the IL; a day-to-day player can still start (amber tag)
        .filter((pl) => sp.aliases.includes(String(pl.pos || "").toUpperCase()) && !used.has(pl.id) && (!tagOf(pl) || tagOf(pl).kind === "dtd"))
        .sort((a, b) => (b.rating2k ?? -1) - (a.rating2k ?? -1));
      hit = cands[0] || null;
    }
    if (hit) used.add(hit.id);
    return hit;
  });
  const onField = new Set(assigned.filter(Boolean).map((pl) => hrbNrm(pl.name)));

  const tc = teamColor(abbr) || "#1e3a8a";
  const isConf = !!(lineup && lineup.confirmed);

  // ── Bench groups: infield · outfield · bullpen, excluding anyone on the field ──
  const grpOf = (pl) => {
    const pos = String(pl.pos || "").toUpperCase();
    const unit = unitOf(pl);
    if (unit === "Pitching" || unit === "Bullpen" || /^(P|SP|RP|CL|CP|RHP|LHP)$/.test(pos)) return "Bullpen";
    if (/^(LF|CF|RF|OF)$/.test(pos)) return "Outfielders";
    return "Infielders";
  };
  const benchAll = bigLeague.filter((pl) => !onField.has(hrbNrm(pl.name)) && grpOf(pl) !== "Bullpen");   // no pitchers in this view
  const benchGroups = ["Infielders", "Outfielders"].map((gname) => ({
    name: gname,
    list: benchAll.filter((pl) => grpOf(pl) === gname).sort((a, b) => statusRank(a) - statusRank(b) || (b.rating2k ?? -1) - (a.rating2k ?? -1)),
  })).filter((g) => g.list.length);

  const PlayerBubble = ({ pl, size = "w-12 h-12" }) => (
    <button onClick={pl._virtual ? undefined : () => onSelectPlayer(pl)} className="text-center w-full">
      <span className="relative block">
        <span className={"block " + size + " mx-auto rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 " + (tagOf(pl) ? TAG_RING[tagOf(pl).kind] : "border-transparent")}>
          {pl._virtual ? <span className="w-full h-full flex items-center justify-center text-[9px] font-extrabold text-slate-500">{pl.pos}</span> : <Avatar p={pl} />}
        </span>
        {cleanNo(pl.no) && (
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 rounded-full text-[8px] font-extrabold tabular-nums shadow bg-slate-900/85 text-white">#{cleanNo(pl.no)}</span>
        )}
        {injTag(pl) && (
          <span className={"absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap px-1 py-0.5 rounded-full text-[7px] font-extrabold text-white shadow " + TAG_SOLID[tagOf(pl).kind] + (tagOf(pl).kind === "il" ? " animate-pulse" : "")}>{injTag(pl)}</span>
        )}
      </span>
      <span className={"block mt-2 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap " + (lastNameOf(pl.name).length > 9 ? "text-[8px]" : "text-[9px]")}>{lastNameOf(pl.name)}</span>
      <span className="block text-[8px] font-extrabold truncate text-[color:var(--tc)] dark:text-white/80" style={{ "--tc": tc }}>{pl.pos || ""}</span>
    </button>
  );

  return (
    <div className="mt-4">
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-[#1f6b34]"
        style={{ paddingBottom: FIELD_H + "%" }}>
        <svg className="absolute inset-0 w-full h-full" viewBox={"0 0 100 " + FIELD_H} preserveAspectRatio="none">
          <defs>
            <clipPath id="fairClip"><path d="M50,106 L125,31 A107,107 0 0 0 -25,31 Z" /></clipPath>
            <clipPath id="fvDirtClip"><path d="M50,106 L80.76,75.24 A28,28 0 1 0 19.24,75.24 Z" /></clipPath>
            <clipPath id="fvInGrassClip"><polygon points="50,101.5 68.5,82 50,62.5 31.5,82" /></clipPath>
            <radialGradient id="grassGlow" cx="50%" cy="72%" r="78%">
              <stop offset="0%" stopColor="#57a85c" /><stop offset="50%" stopColor="#38853f" /><stop offset="100%" stopColor="#1c5a2b" />
            </radialGradient>
            <radialGradient id="fvInGrass" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#56ab5d" /><stop offset="100%" stopColor="#3a8e45" />
            </radialGradient>
            {/* mowing pattern: two sets of stripes crossing on the foul-line angles = the classic ballpark checkerboard */}
            <pattern id="fvMowA" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45 50 106)">
              <rect width="5.5" height="11" fill="#ffffff" fillOpacity="0.08" />
            </pattern>
            <pattern id="fvMowB" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(-45 50 106)">
              <rect width="5.5" height="11" fill="#04260f" fillOpacity="0.13" />
            </pattern>
            <pattern id="fvMowIn" width="4.6" height="4.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45 50 82)">
              <rect width="2.3" height="4.6" fill="#ffffff" fillOpacity="0.09" />
            </pattern>
            {/* fine speckle so the turf and the clay read as texture, not flat paint */}
            <filter id="fvSoft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="0.8" /></filter>
            <filter id="fvGrain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" seed="4" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0.08  0 0 0 0 0  0 0 0 -1.6 1.15" />
            </filter>
            <filter id="fvClay" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.55 1.5" numOctaves="3" seed="9" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.30  0 0 0 0 0.16  0 0 0 0 0.05  0 0 0 -1.9 1.3" />
            </filter>
            <radialGradient id="dirtGrad" cx="50%" cy="40%" r="75%">
              <stop offset="0%" stopColor="#dca770" /><stop offset="55%" stopColor="#c48a52" /><stop offset="100%" stopColor="#99632f" />
            </radialGradient>
            <radialGradient id="fvMound" cx="42%" cy="36%" r="70%">
              <stop offset="0%" stopColor="#e6b582" /><stop offset="100%" stopColor="#b57a44" />
            </radialGradient>
            <radialGradient id="vig" cx="50%" cy="62%" r="72%">
              <stop offset="55%" stopColor="#000" stopOpacity="0" /><stop offset="100%" stopColor="#000" stopOpacity=".38" />
            </radialGradient>
          </defs>
          {/* ── turf: colour, mowing checkerboard, grain ── */}
          <rect x="-10" y="-10" width="120" height="150" fill="url(#grassGlow)" />
          <rect x="-10" y="-10" width="120" height="150" fill="url(#fvMowA)" />
          <rect x="-10" y="-10" width="120" height="150" fill="url(#fvMowB)" />
          <rect x="-10" y="-10" width="120" height="150" filter="url(#fvGrain)" opacity="0.24" />
          {/* stands */}
          <circle cx="50" cy="106" r="151" fill="none" stroke="#0b1220" strokeWidth="100" />
          <circle cx="50" cy="106" r="106" fill="none" stroke="#1e293b" strokeWidth="14" />
          {/* warning track, padded wall in team colour, yellow home-run line on top */}
          <g clipPath="url(#fairClip)">
            <circle cx="50" cy="106" r="93.5" fill="none" stroke="#b98a5a" strokeWidth="7" />
            <circle cx="50" cy="106" r="90.1" fill="none" stroke="#123d1e" strokeOpacity=".45" strokeWidth="0.4" />
            {/* wall shadow falling onto the warning track */}
            <circle cx="50" cy="106" r="94.3" fill="none" stroke="#000" strokeOpacity=".38" strokeWidth="2.6" filter="url(#fvSoft)" />
            {/* padded wall: base colour, dark foot, bright lip, pad seams */}
            <circle cx="50" cy="106" r="97.7" fill="none" stroke={tc} strokeWidth="5.4" />
            <circle cx="50" cy="106" r="95.6" fill="none" stroke="#000" strokeOpacity=".32" strokeWidth="1.2" />
            <circle cx="50" cy="106" r="99.6" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="1.1" />
            <circle cx="50" cy="106" r="97.7" fill="none" stroke="#000" strokeOpacity=".28" strokeWidth="5.4" strokeDasharray="0.5 4.1" />
            <circle cx="50" cy="106" r="97.7" fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth="5.4" strokeDasharray="0.5 4.1" strokeDashoffset="-0.6" />
            {/* home-run line: a yellow rail with a shaded underside and a glint on top */}
            <circle cx="50" cy="106" r="100.15" fill="none" stroke="#7c4a03" strokeOpacity=".7" strokeWidth="0.7" />
            <circle cx="50" cy="106" r="100.75" fill="none" stroke="#facc15" strokeWidth="1.3" />
            <circle cx="50" cy="106" r="101.2" fill="none" stroke="#fff7c2" strokeOpacity=".8" strokeWidth="0.35" />
          </g>
          {/* ── infield clay: grass lip, clay, raked texture, drag arcs, shaded edge ── */}
          <path d="M50,106 L80.76,75.24 A28,28 0 1 0 19.24,75.24 Z" fill="none" stroke="#0f3a1b" strokeOpacity=".6" strokeWidth="1" strokeLinejoin="round" />
          <path d="M50,106 L80.76,75.24 A28,28 0 1 0 19.24,75.24 Z" fill="url(#dirtGrad)" />
          <g clipPath="url(#fvDirtClip)">
            <rect x="15" y="42" width="70" height="68" filter="url(#fvClay)" opacity="0.42" />
            {[28.2, 25.4, 22.6, 19.8].map((r, i) => <circle key={r} cx="50" cy="75.24" r={r} fill="none" stroke={i % 2 ? "#5b3716" : "#fff3df"} strokeOpacity={i % 2 ? 0.1 : 0.09} strokeWidth="1.3" />)}
            <path d="M50,106 L80.76,75.24 A28,28 0 1 0 19.24,75.24 Z" fill="none" stroke="#4a2a10" strokeOpacity=".38" strokeWidth="2.4" strokeLinejoin="round" />
          </g>
          {/* foul lines in chalk, laid over the clay */}
          <line x1="50" y1="106" x2="120" y2="36" stroke="#fff" strokeWidth="0.55" strokeOpacity="0.85" />
          <line x1="50" y1="106" x2="-20" y2="36" stroke="#fff" strokeWidth="0.55" strokeOpacity="0.85" />
          {/* ── infield grass: its own lip, finer mowing stripes, grain ── */}
          <polygon points="50,101.5 68.5,82 50,62.5 31.5,82" fill="url(#fvInGrass)" />
          <g clipPath="url(#fvInGrassClip)">
            <rect x="30" y="61" width="40" height="42" fill="url(#fvMowIn)" />
            <rect x="30" y="61" width="40" height="42" filter="url(#fvGrain)" opacity="0.22" />
          </g>
          <polygon points="50,101.5 68.5,82 50,62.5 31.5,82" fill="none" stroke="#0f3a1b" strokeOpacity=".55" strokeWidth="0.7" strokeLinejoin="round" />
          {/* base cut-outs, home-plate circle, mound (with a little height) */}
          {[[74, 82], [50, 58], [26, 82]].map(([bx, by], i) => <circle key={i} cx={bx} cy={by} r="4.4" fill="#cb9259" stroke="#6b421c" strokeOpacity=".3" strokeWidth="0.4" />)}
          <circle cx="50" cy="106" r="9.5" fill="#cb9259" stroke="#6b421c" strokeOpacity=".3" strokeWidth="0.5" />
          <ellipse cx="50.5" cy="83" rx="4.5" ry="4.2" fill="#000" fillOpacity="0.2" />
          <circle cx="50" cy="82" r="4" fill="url(#fvMound)" stroke="#8a5a30" strokeWidth="0.45" />
          <ellipse cx="50" cy="81.4" rx="1.1" ry="0.45" fill="#fff" fillOpacity="0.95" />
          <rect x="44.4" y="102.2" width="3.2" height="6.2" fill="none" stroke="#fff" strokeWidth="0.4" strokeOpacity="0.75" />
          <rect x="52.4" y="102.2" width="3.2" height="6.2" fill="none" stroke="#fff" strokeWidth="0.4" strokeOpacity="0.75" />
          {/* bases - drawn LAST so they sit on top of the dirt (with a small shadow), and fielders are offset off them */}
          {[[74, 82], [50, 58], [26, 82]].map(([bx, by], i) => (
            <g key={i}>
              <rect x={bx - 1.4} y={by - 1.2} width="3.4" height="3.4" fill="#000" fillOpacity=".28" transform={"rotate(45 " + bx + " " + by + ")"} />
              <rect x={bx - 1.7} y={by - 1.7} width="3.4" height="3.4" fill="#fff" stroke="#000" strokeOpacity=".2" strokeWidth="0.3" transform={"rotate(45 " + bx + " " + by + ")"} />
            </g>
          ))}
          <polygon points="48.6,104.6 51.4,104.6 51.4,106.2 50,107.5 48.6,106.2" fill="#fff" />
          <rect x="-10" y="-10" width="120" height="150" fill="url(#vig)" />
        </svg>
        {/* home ballpark + its HR rank: top 10 green, middle amber, bottom 10 red */}
        {(() => {
          const park = TEAM_PARK[abbr], rank = park ? parkRankFor(park) : null;
          if (!rank) return null;
          const tone = rank <= 10 ? "bg-emerald-500" : rank <= 20 ? "bg-amber-400 text-slate-900" : "bg-rose-600";
          return (
            <span className="absolute bottom-2 right-2 z-10 rounded-xl bg-slate-900/80 backdrop-blur-sm shadow px-2 py-1.5 text-right">
              <span className="block text-[8px] font-bold text-white/90 max-w-[96px] truncate leading-tight">{park}</span>
              <span className="flex items-center justify-end gap-1.5 mt-1">
                <span className="text-[7px] font-bold uppercase tracking-widest text-white/60">HR Rank</span>
                <span className={"rounded-md px-1.5 py-0.5 text-[12px] leading-none font-black tabular-nums text-white " + tone}>{ordinal(rank)}</span>
              </span>
            </span>
          );
        })()}
        {/* lineup badge — bottom-left, in the empty foul ground (the ballpark rank balances it on the right) */}
        <span className="absolute bottom-2 left-2 z-10"><LineupBadge lineup={lineup} onField /></span>
        {SPOTS.map((sp, i) => {
          const p = assigned[i];
          return (
            <button key={i} disabled={!p || p._virtual} onClick={p && !p._virtual ? () => onSelectPlayer(p) : undefined}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: sp.x + "%", top: (sp.y / FIELD_H * 100) + "%" }}>
              <span className="relative">
                {p ? (
                  <span className={"block w-11 h-11 rounded-full overflow-hidden shadow-md bg-white border-2 " + (tagOf(p) ? TAG_RING[tagOf(p).kind] : "border-white/80")}>
                    {p._virtual ? <span className="w-full h-full flex items-center justify-center text-[10px] font-extrabold text-slate-600">{sp.lbl}</span> : <Avatar p={p} />}
                  </span>
                ) : (
                  <span className="w-11 h-11 rounded-full flex items-center justify-center text-[10px] font-extrabold bg-white/25 text-white/80 border-2 border-dashed border-white/50 shadow-md">{sp.lbl}</span>
                )}
                {p && cleanNo(p.no) && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 rounded-full text-[8px] font-extrabold tabular-nums shadow bg-slate-900/85 text-white">#{cleanNo(p.no)}</span>
                )}
                {p && injTag(p) && (
                  <span className={"absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded-full text-[7px] font-extrabold text-white shadow ring-2 ring-white/80 " + TAG_SOLID[tagOf(p).kind] + (tagOf(p).kind === "il" ? " animate-pulse" : "")}>{injTag(p)}</span>
                )}
              </span>
              <span className={"mt-1.5 font-bold text-white/95 whitespace-nowrap drop-shadow " + (p && lastNameOf(p.name).length > 9 ? "text-[7px]" : "text-[8px]")}>{p ? lastNameOf(p.name) : ""}</span>
            </button>
          );
        })}
      </div>

      {/* ── BENCH: grouped, wrapping grid, no sideways scroll ── */}
      {benchGroups.length > 0 && (
        <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-3 space-y-3">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Bench</div>
          {benchGroups.map((g) => (
            <div key={g.name}>
              <div className="text-[10px] font-extrabold uppercase tracking-wider mb-1.5 pl-2 border-l-2 text-[color:var(--tc)] dark:text-white" style={{ "--tc": tc, borderColor: tc }}>
                {g.name} ({g.list.length})
              </div>
              <div className="grid grid-cols-5 gap-y-3 gap-x-1">
                {g.list.map((pl) => <PlayerBubble key={pl.id} pl={pl} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── COACHING STAFF (MLB API) ── */}
      <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3 grid grid-cols-2 gap-y-2.5 gap-x-3">
        {[["Manager", coaches && coaches.manager], ["Bench Coach", coaches && coaches.bench], ["Pitching Coach", coaches && coaches.pitching], ["Hitting Coach", coaches && coaches.hitting]].map(([lbl, v]) => (
          <span key={lbl} className="min-w-0">
            <span className="block text-[8px] font-extrabold uppercase tracking-widest text-slate-400">{lbl}</span>
            <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate">{v || (coaches ? "—" : "…")}</span>
            {v && coaches && coaches.seasons && coaches.seasons[lbl === "Manager" ? "manager" : lbl === "Bench Coach" ? "bench" : lbl === "Pitching Coach" ? "pitching" : "hitting"] != null && (
              <span className="block text-[10px] font-medium text-slate-400">({(() => { const n = coaches.seasons[lbl === "Manager" ? "manager" : lbl === "Bench Coach" ? "bench" : lbl === "Pitching Coach" ? "pitching" : "hitting"]; return ordinal(n) + " season"; })()})</span>
            )}
          </span>
        ))}
      </div>
      <div className="text-[9px] text-slate-400 mt-2 px-1">Red tag = injured list · amber = day-to-day · the only pitcher shown is today's starter (the staff is under Pitching Rotation) · minor leaguers sit at the bottom of the roster · green badge = today's confirmed lineup, refreshes automatically · tap for profile</div>
    </div>
  );
}

let MLB_TEAMID_MAP = null;
function TeamFormChart({ teamName }) {
  const [games, setGames] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!MLB_TEAMID_MAP) {
          const d = await (await mlbFetch("v1/teams?sportId=1")).json();
          MLB_TEAMID_MAP = {};
          for (const t of d.teams || []) MLB_TEAMID_MAP[String(t.name).toLowerCase()] = t.id;
        }
        const tid = MLB_TEAMID_MAP[String(teamName).toLowerCase()];
        if (!tid) { if (alive) setGames([]); return; }
        const dayStr = (off) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() - off * 86400000));
        const sched = await (await mlbFetch(`v1/schedule?sportId=1&teamId=${tid}&startDate=${dayStr(30)}&endDate=${dayStr(0)}`)).json();
        const gs = (sched.dates || []).flatMap((d) => d.games || [])
          .filter((g) => g.status && g.status.abstractGameState === "Final")
          .map((g) => {
            const home = g.teams.home.team.id === tid;
            const us = home ? g.teams.home : g.teams.away;
            const them = home ? g.teams.away : g.teams.home;
            return { runs: us.score ?? 0, won: (us.score ?? 0) > (them.score ?? 0), date: g.officialDate || g.gameDate };
          })
          .slice(-20);
        if (alive) setGames(gs);
      } catch { if (alive) setGames([]); }
    })();
    return () => { alive = false; };
  }, [teamName]);
  if (games == null) return <SkeletonCards cards={1} rows={4} />;
  if (!games.length) return <div className="text-center text-xs text-slate-400 py-10">No recent completed games found.</div>;
  const wins = games.filter((g) => g.won).length;
  const runs = games.reduce((a, g) => a + g.runs, 0);
  const max = Math.max(6, ...games.map((g) => g.runs));
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3 mt-3">
      <div className="flex items-end gap-[3px] h-24">
        {games.map((g, i) => (
          <span key={i}
            className={"flex-1 rounded-t " + (g.won ? "bg-emerald-400 dark:bg-emerald-500" : "bg-rose-300 dark:bg-rose-500/70")}
            style={{ height: Math.max(6, (g.runs / max) * 100) + "%" }}
            title={g.date + ": " + g.runs + " runs"} />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[8px] font-bold text-slate-400">
        <span>{String(games[0].date).slice(5)}</span><span>{String(games[games.length - 1].date).slice(5)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        {[["Last " + games.length, wins + "-" + (games.length - wins)], ["Runs/Gm", (runs / games.length).toFixed(1)], ["Total Runs", runs]].map(([lbl, v]) => (
          <span key={lbl}>
            <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
            <span className="block text-sm font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v}</span>
          </span>
        ))}
      </div>
      <div className="text-[9px] text-slate-400 mt-2">Bar height = runs scored that game · green = win, red = loss · last 20 games</div>
    </div>
  );
}

// ═══════════════ TEAM PAGE PIECES (football-app layout) ══════════
const TEAM_ABBR_BY_ID = { 108: "LAA", 109: "ARI", 110: "BAL", 111: "BOS", 112: "CHC", 113: "CIN", 114: "CLE", 115: "COL", 116: "DET", 117: "HOU", 118: "KC", 119: "LAD", 120: "WSH", 121: "NYM", 133: "ATH", 134: "PIT", 135: "SD", 136: "SEA", 137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 142: "MIN", 143: "PHI", 144: "ATL", 145: "CWS", 146: "MIA", 147: "NYY", 158: "MIL" };
const MLB_TEAM_ID = { LAA: 108, ARI: 109, BAL: 110, BOS: 111, CHC: 112, CIN: 113, CLE: 114, COL: 115, DET: 116, HOU: 117, KC: 118, LAD: 119, WSH: 120, NYM: 121, ATH: 133, PIT: 134,
  SD: 135, SEA: 136, SF: 137, STL: 138, TB: 139, TEX: 140, TOR: 141, MIN: 142, PHI: 143, ATL: 144, CWS: 145, MIA: 146, NYY: 147, MIL: 158 };

// League season stats + standings, loaded once and shared with the Stats tab (same cache).
let LEAGUE_JOB = null;
function loadLeagueData() {
  if (LEADERS_CACHE.stats && Date.now() - LEADERS_CACHE.at < 15 * 60000) return Promise.resolve();
  if (!LEAGUE_JOB) {
    const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    LEAGUE_JOB = Promise.all([get("/api/season-stats"), get("/api/standings")]).then(([s, t]) => {
      if (s && s.players) { LEADERS_CACHE.stats = s; LEADERS_CACHE.at = Date.now(); }
      if (t && t.teams) LEADERS_CACHE.teams = t;
    }).finally(() => { LEAGUE_JOB = null; });
  }
  return LEAGUE_JOB;
}
function useLeagueData() {
  const [, tick] = useState(0);
  useEffect(() => { let alive = true; loadLeagueData().then(() => { if (alive) tick((n) => n + 1); }); return () => { alive = false; }; }, []);
  return LEADERS_CACHE;
}
// A roster player's live season line (name + team first, so shared names stay apart)
const seasonLineFor = (stats, p, abbr) => {
  if (!stats || !stats.byName) return null;
  const k = hrbNrm(p.name);
  const id = stats.byName[k + "|" + abbr] ?? stats.byName[k];
  return id != null ? stats.players[id] || null : null;
};
const isPitcherP = (p) => catOf(p) === "__P__" || ["pitching", "bullpen"].includes(String(p.role || "").trim().toLowerCase());
// Surname for labels and sorting: drops Jr. / Sr. / II / III so "Acuna Jr." reads "Acuna"
const lastNameOf = (n) => { const w = String(n || "").trim().split(/\s+/).filter((x) => !/^(jr|sr|ii|iii|iv|v)\.?$/i.test(x)); return w[w.length - 1] || ""; };
const lastNameSort = (a, b) => { const l = lastNameOf; return l(a.name).localeCompare(l(b.name)) || String(a.name).localeCompare(String(b.name)); };
const fmt3 = (v) => (v == null ? "—" : Number(v).toFixed(3).replace(/^0/, ""));
const fmt2 = (v) => (v == null ? "—" : Number(v).toFixed(2));
const rankCls = (r) => (r == null ? "text-slate-400" : r <= 10 ? "text-green-600 dark:text-green-400" : r <= 20 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400");

// Who starts when: MLB's announced probables for the next week → { normalizedName: "Today vs BOS" }
function useNextStarts(abbr, on) {
  const [starts, setStarts] = useState({});
  useEffect(() => {
    const tid = MLB_TEAM_ID[abbr];
    if (!on || !tid) return;
    let alive = true;
    (async () => {
      try {
        const day = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() + n * 86400000));
        const d = await (await mlbFetch(`v1/schedule?sportId=1&teamId=${tid}&startDate=${day(0)}&endDate=${day(7)}&hydrate=probablePitcher,team`)).json();
        const out = {};
        for (const dt of d.dates || []) for (const g of dt.games || []) {
          const home = g.teams.home.team.id === tid;
          const me = g.teams[home ? "home" : "away"], opp = g.teams[home ? "away" : "home"];
          const pp = me.probablePitcher;
          if (!pp || (g.status && g.status.abstractGameState === "Final")) continue;
          const k = hrbNrm(pp.fullName);
          if (out[k]) continue;
          const oppAbbr = toAbbr(opp.team.name) || opp.team.abbreviation || "";
          const when = dt.date === day(0) ? "Today" : new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(dt.date + "T12:00:00Z"));
          out[k] = { today: dt.date === day(0), text: `${when} ${home ? "vs" : "@"} ${oppAbbr}` };
        }
        if (alive) setStarts(out);
      } catch {}
    })();
    return () => { alive = false; };
  }, [abbr, on]);
  return starts;
}

// Bats / throws for everyone on the 40-man, from MLB: { normalizedName: { bats: "R"|"L"|"S", throws: "R"|"L" } }
const HANDS_CACHE = {};
function useTeamHands(abbr, on = true) {
  const [hands, setHands] = useState(HANDS_CACHE[abbr] || null);
  useEffect(() => {
    const tid = MLB_TEAM_ID[abbr];
    if (!on || !tid || HANDS_CACHE[abbr]) return;
    let alive = true;
    (async () => {
      try {
        const d = await (await mlbFetch(`v1/teams/${tid}/roster?rosterType=40Man&hydrate=person`)).json();
        const out = {};
        for (const r of d.roster || []) {
          const per = r.person || {};
          if (!per.fullName) continue;
          out[hrbNrm(per.fullName)] = { bats: (per.batSide || {}).code || null, throws: (per.pitchHand || {}).code || null };
          if (per.id) MLB_ID_CACHE[String(per.fullName).toLowerCase() + "|" + abbr] = per.id;     // exact photos for the whole 40-man
        }
        HANDS_CACHE[abbr] = out;
        if (alive) setHands(out);
      } catch {}
    })();
    return () => { alive = false; };
  }, [abbr, on]);
  return hands || {};
}

// Header tile, football style: tinted border, team-colour label, big number, coloured rank line.
function RankTile({ label, value, sub, subCls, tc, valueCls, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={"bg-white dark:bg-slate-900 rounded-2xl border-2 px-1.5 py-3.5 text-center shadow-sm w-full " + (onClick ? "active:scale-[0.97] transition-transform" : "")} style={{ borderColor: tc ? tc + "55" : undefined }}>
      <div className={"text-[9px] font-bold tracking-widest uppercase " + (tc ? "text-[color:var(--tc)] dark:text-slate-300" : "text-slate-400")} style={tc ? { "--tc": tc } : undefined}>{label}</div>
      <div className={"text-[26px] leading-tight font-black tabular-nums mt-0.5 " + (valueCls || "text-slate-900 dark:text-white")}>{value}</div>
      {sub && <div className={"text-[10px] font-extrabold mt-0.5 " + (subCls || "text-slate-400")}>{sub}{onClick ? " ›" : ""}</div>}
    </Tag>
  );
}

// One roster row, laid out like the football app: [chip] headshot · #no Name / tag (note) · three stat tiles
function RosterRow({ p, abbr, chip, chipCls, chipText = false, nameSuffix, rightChip, tiles, badge, under, onSelect }) {
  useInjuries();
  const tc = teamColor(abbr);
  const live = injFor(p.name, abbr);
  const note = live ? injText(live) : String(p.injuryNotes || "").trim();
  const tag = statusTag(p, abbr);
  return (
    <button onClick={p._virtual ? undefined : () => onSelect(p)} className={"w-full block px-3 py-2.5 text-left " + (p._virtual ? "" : "active:bg-slate-50 dark:active:bg-slate-800")}>
      <span className="flex items-start gap-2.5">
        {chipText
          ? <span className="shrink-0 w-11 text-center self-center text-[15px] font-black tabular-nums leading-none text-[color:var(--tc)] dark:text-white" style={{ "--tc": bannerColor(abbr) }}>{chip}</span>
          : <span className={"shrink-0 w-11 text-center rounded-md py-1 mt-4 text-white tabular-nums " + (chipCls || "text-[11px] font-extrabold")} style={{ backgroundColor: bannerColor(abbr) }}>{chip}</span>}
        <Avatar p={p} size="md" />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-slate-900 dark:text-slate-100 truncate">
            {cleanNo(p.no) && <span className="text-[13px] font-bold text-slate-400">#{cleanNo(p.no)} </span>}{p.name}{nameSuffix && <span className="text-[13px] font-bold text-slate-400"> {nameSuffix}</span>}
          </span>
          <span className="flex gap-1 mt-1 justify-start">
            {tiles.map(([lbl, v]) => (
              <span key={lbl} className={(tiles.length > 3 ? "w-[46px]" : "w-[50px]") + " rounded-lg border-2 bg-white dark:bg-slate-900 text-center overflow-hidden"} style={{ borderColor: tc + "66" }}>
                <span className="block text-[7px] font-extrabold uppercase tracking-wider text-white py-0.5" style={{ backgroundColor: tc }}>{lbl}</span>
                <span className={"block leading-tight font-extrabold tabular-nums tracking-tight whitespace-nowrap text-slate-900 dark:text-white py-1 " + (String(v ?? "").length >= 5 ? "text-[11px]" : "text-[14px]")}>{v ?? "—"}</span>
              </span>
            ))}
          </span>
        </span>
        {rightChip && <span className="shrink-0 w-9 self-center text-center rounded-md py-1 text-[11px] font-extrabold text-white tabular-nums" style={{ backgroundColor: bannerColor(abbr) }}>{rightChip}</span>}
      </span>
      {/* second row lines up with the columns above: tag under the picture, note + return date under the tiles */}
      {(tag || badge || under) && (
        <span className="flex items-start gap-2.5 mt-1.5 pl-[54px]">
          <span className="shrink-0 min-w-[56px] flex justify-center">{tag ? <LiveStatus p={p} /> : badge}</span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-1.5 min-w-0">
              {tag && tag.kind !== "min" && note && <span className="text-[11px] font-semibold text-rose-500 truncate min-w-0">({note})</span>}
              {under && <span className="ml-auto shrink-0 text-[9px] font-medium text-slate-400">({under})</span>}
            </span>
            {tag && tag.kind !== "min" && <ReturnLine r={live} className="mt-0.5" />}
            {tag && badge && <span className="block mt-1">{badge}</span>}
          </span>
        </span>
      )}
    </button>
  );
}

function Section({ title, note, color, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mt-6 mb-2 px-1">
        <span className={"text-[11px] font-bold tracking-widest uppercase " + (color ? "" : "text-slate-400")} style={color ? { color } : undefined}>{title}</span>
        {note && (typeof note === "string" ? <span className="text-[9px] font-semibold text-slate-400">{note}</span> : note)}
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">{children}</div>
    </div>
  );
}

// Roster pill body: landing (Batters / Pitchers, A–Z) or one of the three sub-views.
function TeamRoster({ roster, abbr, teamName, view, onSelectPlayer }) {
  useInjuries();
  const { stats } = useLeagueData();
  const starts = useNextStarts(abbr, view === "pitching");
  const todayLineup = useTodayLineup(abbr, view === "order");
  const hands = useTeamHands(abbr, view === "order" || view === "pitching");
  const batsOf = (p) => (hands[hrbNrm(p.name)] || {}).bats || batterHand(p) || "—";
  const throwsOf = (p) => { const t = (hands[hrbNrm(p.name)] || {}).throws; return t ? t + "HP" : pitcherHand(p) || "P"; };
  const line = (p) => seasonLineFor(stats, p, abbr);
  const at = (p) => latestStats(p) || {};                       // Airtable fallback when MLB has no line yet
  const batTiles = (p) => { const s = line(p), h = s && s.hit, a = at(p); return [["AVG", h ? fmt3(h.avg) : a.avg != null ? fmt3(a.avg) : null], ["HR", h ? h.hr : a.hr != null ? Math.round(a.hr) : null], ["RBI", h ? h.rbi : a.rbi != null ? Math.round(a.rbi) : null], ["OPS", h ? fmt3(h.ops) : a.ops != null ? fmt3(a.ops) : null]]; };
  const pitTiles = (p, mode) => {
    const s = line(p), x = s && s.pit, a = at(p);
    const era = x ? fmt2(x.era) : a.era != null ? fmt2(a.era) : null;
    const whip = x ? fmt2(x.whip) : a.whip != null ? fmt2(a.whip) : null;
    if (mode === "sp") return [["W-L", x ? x.w + "-" + x.l : a.w != null ? Math.round(a.w) + "-" + Math.round(a.l ?? 0) : null], ["ERA", era], ["K", x ? x.so : null], ["WHIP", whip]];
    if (mode === "rp") return [["IP", x ? x.ip : null], ["ERA", era], [x && x.sv > 0 ? "SV" : "HLD", x ? (x.sv > 0 ? x.sv : x.hld) : null]];
    return [["ERA", era], ["WHIP", x ? fmt2(x.whip) : a.whip != null ? fmt2(a.whip) : null], ["K", x ? x.so : null]];
  };
  const big = roster.filter((p) => !isMinors(p, abbr));
  const minors = roster.filter((p) => isMinors(p, abbr)).sort(lastNameSort);
  const batters = big.filter((p) => !isPitcherP(p)), pitchers = big.filter(isPitcherP);
  const empty = (msg) => <div className="text-center text-xs text-slate-400 py-8 px-6">{msg}</div>;

  if (view === "field") return <FieldView roster={roster} abbr={abbr} teamName={teamName} onSelectPlayer={onSelectPlayer} />;

  if (view === "order") {
    const isSlot = (p) => /^\d+$/.test(String(p.sortLabel || "").trim()) && p.sort >= 1 && p.sort <= 9;
    const byNm = {}; for (const p of roster) byNm[hrbNrm(p.name)] = p;
    // MLB's lineup first: all nine hitters even when one isn't in Airtable (he shows as a plain row you can't tap).
    const mlbRows = todayLineup && todayLineup.order && todayLineup.order.length
      ? todayLineup.order.map((o) => {
          const k = String(o.name || "").toLowerCase();
          if (o.id) MLB_ID_CACHE[k + "|" + abbr] = o.id;                                 // headshot without a name search
          return { slot: o.slot, pos: o.pos, p: byNm[hrbNrm(o.name)] || { id: "mlb:" + o.id, name: o.name, pos: o.pos, no: o.no, teamName, teamAbbr: abbr, stats: [], contracts: [], _virtual: true } };
        })
      : null;
    const rows = mlbRows || batters.filter(isSlot).sort((a, b) => a.sort - b.sort).map((p) => ({ slot: p.sort, p }));   // fallback: Airtable order
    const inOrder = new Set(rows.map((r) => hrbNrm(r.p.name)));
    const bench = batters.filter((p) => !inOrder.has(hrbNrm(p.name))).sort((a, b) => statusRank(a) - statusRank(b) || lastNameSort(a, b));
    return (
      <>
        <Section title="Batting Order" note={rows.length ? <LineupBadge lineup={todayLineup} /> : null}>
          {rows.length ? rows.map(({ slot, pos, p }) => <RosterRow key={p.id} p={p} abbr={abbr} chip={String(slot)} chipText nameSuffix={pos || p.gamePos || p.pos || ""} rightChip={batsOf(p)} tiles={batTiles(p)} onSelect={onSelectPlayer} />)
            : empty("No lineup posted yet. It fills in on its own once MLB publishes one.")}
        </Section>
        {bench.length > 0 && <Section title={"Bench (" + bench.length + ")"}>{bench.map((p) => <RosterRow key={p.id} p={p} abbr={abbr} chip={p.pos || "—"} rightChip={batsOf(p)} tiles={batTiles(p)} onSelect={onSelectPlayer} />)}</Section>}
      </>
    );
  }

  if (view === "pitching") {
    const slot = (p) => (p.sort != null && /^\d+(\.\d+)?$/.test(String(p.sortLabel ?? p.sort).trim()) ? Number(p.sort) : null);
    const rotation = pitchers.filter((p) => slot(p) >= 1 && slot(p) <= 5).sort((a, b) => slot(a) - slot(b));
    const closers = pitchers.filter((p) => slot(p) === 6);
    const outs = (p) => { const s = line(p); return s && s.pit ? s.pit.outs : -1; };
    const pen = pitchers.filter((p) => !(slot(p) >= 1 && slot(p) <= 6)).sort((a, b) => outs(b) - outs(a) || lastNameSort(a, b));
    const startBadge = (p) => { const n = starts[hrbNrm(p.name)]; return n ? <span className={"inline-block rounded px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide " + (n.today ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300")}>{n.today ? "Starts " : "Next: "}{n.text}</span> : null; };
    return (
      <>
        <Section title="Starting Rotation" note="Sort Priority 1–5">
          {rotation.length ? rotation.map((p) => <RosterRow key={p.id} p={p} abbr={abbr} chip={throwsOf(p)} tiles={pitTiles(p, "sp")} under={(() => { const s = line(p); return s && s.pit ? s.pit.gs + " start" + (s.pit.gs === 1 ? "" : "s") : null; })()} badge={startBadge(p)} onSelect={onSelectPlayer} />)
            : empty("No rotation set. Give your five starters Sort Priority 1–5 in Airtable.")}
        </Section>
        <Section title={"Bullpen (" + (closers.length + pen.length) + ")"} note="closer first · then most innings">
          {closers.map((p) => <RosterRow key={p.id} p={p} abbr={abbr} chip={throwsOf(p)} tiles={pitTiles(p, "rp")} under={(() => { const s = line(p); return s && s.pit ? s.pit.g + " game" + (s.pit.g === 1 ? "" : "s") : null; })()} badge={<span className="inline-block rounded px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-white" style={{ backgroundColor: bannerColor(abbr) }}>Closer</span>} onSelect={onSelectPlayer} />)}
          {pen.map((p) => <RosterRow key={p.id} p={p} abbr={abbr} chip={throwsOf(p)} tiles={pitTiles(p, "rp")} under={(() => { const s = line(p); return s && s.pit ? s.pit.g + " game" + (s.pit.g === 1 ? "" : "s") : null; })()} badge={startBadge(p)} onSelect={onSelectPlayer} />)}
          {closers.length + pen.length === 0 && empty("No relievers on the roster.")}
        </Section>
      </>
    );
  }

  return (
    <>
      <Section title="Batting">{batters.slice().sort(lastNameSort).map((p) => <RosterRow key={p.id} p={p} abbr={abbr} chip={p.pos || "—"} tiles={batTiles(p)} onSelect={onSelectPlayer} />)}{batters.length === 0 && empty("No batters linked yet.")}</Section>
      <Section title="Pitching">{pitchers.slice().sort(lastNameSort).map((p) => <RosterRow key={p.id} p={p} abbr={abbr} chip={p.pos || "P"} tiles={pitTiles(p)} onSelect={onSelectPlayer} />)}{pitchers.length === 0 && empty("No pitchers linked yet.")}</Section>
      {minors.length > 0 && <Section title={"Minor Leagues (" + minors.length + ")"} color="#ea580c">{minors.map((p) => <RosterRow key={p.id} p={p} abbr={abbr} chip={p.pos || "—"} tiles={isPitcherP(p) ? pitTiles(p) : batTiles(p)} onSelect={onSelectPlayer} />)}</Section>}
    </>
  );
}

// Stats pill body: Hitting · Power · Pitching — three ranked team tiles, then bar-chart leaderboards.
function TeamStatsPanel({ abbr, view, players, onSelectPlayer }) {
  const { stats, teams } = useLeagueData();
  const tc = bannerColor(abbr);
  if (!stats) return <BallLoader label="Loading team stats" full={false} />;
  const yr = stats.season;
  const all = Object.values(stats.players || {}).filter((P) => P.team === abbr);
  const tg = (stats.leaders && stats.leaders.qualifiers && stats.leaders.qualifiers.teamGames) || 0;
  const minPa = Math.max(20, Math.round(tg * 1.5)), minOuts = Math.max(30, tg);           // enough of a sample for a rate stat
  const T = teams && (teams.teams || []).find((t) => t.abbr === abbr);
  const stx = (T && T.stx) || {};
  const tie = (k) => stx[k + "Rank"] != null && (teams.teams || []).filter((t) => t.stx && t.stx[k + "Rank"] === stx[k + "Rank"]).length > 1;
  const tile = (label, k, fmt) => <RankTile key={k} label={label} value={stx[k] != null ? fmt(stx[k]) : "—"} sub={stx[k + "Rank"] != null ? ordinal(stx[k + "Rank"]) + (tie(k) ? " (tie)" : "") : null} subCls={rankCls(stx[k + "Rank"])} />;
  const mine = {}; for (const p of players || []) (mine[hrbNrm(p.name)] = mine[hrbNrm(p.name)] || []).push(p);
  const findP = (P) => { const c = mine[hrbNrm(P.name)] || []; return c.find((p) => teamOfPlayer(p) === abbr) || c[0]; };

  // One leaderboard card. rows: [{P, v, text}]; bar = share of the leader (or inverse when lower is better)
  const board = ({ title, side, keyName, fmt, low = false, min = null, share = false, top = 6, unit = "" }) => {
    let rows = all.filter((P) => P[side] && P[side][keyName] != null && (min == null || (side === "hit" ? P.hit.pa >= min : P.pit.outs >= min)))
      .map((P) => ({ P, v: P[side][keyName] })).filter((r) => low || min != null || r.v > 0)
      .sort((a, b) => (low ? a.v - b.v : b.v - a.v)).slice(0, top);
    if (!rows.length) return null;
    const total = share ? all.reduce((n, P) => n + ((P[side] && P[side][keyName]) || 0), 0) : 0;
    const lead = rows[0].v || 1;
    return (
      <div key={side + keyName}>
        <div className="text-[11px] font-bold tracking-widest uppercase text-slate-400 mt-6 mb-2 px-1">{yr} {title}</div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(({ P, v }) => {
            const p = findP(P);
            const w = share && total ? (v / total) * 100 : low ? (lead / (v || lead)) * 100 : (v / lead) * 100;
            const label = share && total ? Math.round((v / total) * 100) + "% · " + (keyName === "outs" ? P.pit.ip + " IP" : v + unit) : fmt ? fmt(v) + unit : v + unit;
            return (
              <button key={P.id} onClick={p ? () => onSelectPlayer(p) : undefined} className="w-full text-left py-2.5 block">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">{P.name} <span className="text-[11px] font-medium text-slate-400">{mlbPosGroup(P)}</span></span>
                  <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-slate-800 dark:text-slate-100">{label}</span>
                </span>
                <span className="block mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span className="block h-full rounded-full" style={{ width: Math.max(3, Math.min(100, w)) + "%", backgroundColor: tc }} /></span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  const pct1 = (v) => (v * 100).toFixed(1) + "%";
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {view === "hitting" && [tile("Runs / Game", "rpg", fmt2), tile("Batting Avg", "avg", fmt3), tile("OPS", "ops", fmt3)]}
        {view === "power" && [tile("Home Runs", "hr", String), tile("Slugging", "slg", fmt3), tile("Strikeouts", "soBat", String)]}
        {view === "pitching" && [tile("ERA", "era", fmt2), tile("WHIP", "whip", fmt2), tile("HR / 9", "hr9", fmt2)]}
      </div>
      {view === "hitting" && [
        board({ title: "Hits", side: "hit", keyName: "h" }),
        board({ title: "Runs Batted In", side: "hit", keyName: "rbi" }),
        board({ title: "Batting Average · min " + minPa + " PA", side: "hit", keyName: "avg", fmt: fmt3, min: minPa }),
        board({ title: "On-Base + Slugging · min " + minPa + " PA", side: "hit", keyName: "ops", fmt: fmt3, min: minPa }),
        board({ title: "Stolen Bases", side: "hit", keyName: "sb", top: 5 }),
      ]}
      {view === "power" && [
        board({ title: "Home Runs · Share of Team", side: "hit", keyName: "hr", share: true, unit: " HR", top: 8 }),
        board({ title: "HR Rate · HR per PA · min " + minPa + " PA", side: "hit", keyName: "hrPa", fmt: pct1, min: minPa }),
        board({ title: "Isolated Power · min " + minPa + " PA", side: "hit", keyName: "iso", fmt: fmt3, min: minPa }),
        board({ title: "Total Bases", side: "hit", keyName: "tb" }),
      ]}
      {view === "pitching" && [
        board({ title: "Strikeouts", side: "pit", keyName: "so" }),
        board({ title: "ERA · lowest first · min " + Math.round(minOuts / 3) + " IP", side: "pit", keyName: "era", fmt: fmt2, low: true, min: minOuts }),
        board({ title: "Innings · Share of Staff", side: "pit", keyName: "outs", share: true, top: 8 }),
        board({ title: "Saves", side: "pit", keyName: "sv", top: 4 }),
        board({ title: "HR / 9 Allowed · most homer-prone first · min " + Math.round(minOuts / 3) + " IP", side: "pit", keyName: "hr9", fmt: fmt2, min: minOuts }),
      ]}
      <div className="text-[9px] text-slate-400 mt-3 px-1">
        {view === "power" ? "HR share = who carries the power. HR per PA is the cleanest single read on a hitter's home-run threat; ISO (slugging minus average) is raw extra-base pop."
          : view === "pitching" ? "Innings share shows who the staff leans on. HR/9 flags the arms opposing hitters can take deep."
          : "Rate stats need a real sample, so part-timers don't top the list."} Tile ranks are out of 30 teams.
      </div>
    </div>
  );
}

function TeamDetail({ team, teams, players, onBack, onSelectPlayer, onJumpStat }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useBackSwipe(onBack);
  useInjuries();                                   // roster groups re-sort when the live report lands
  const abbr = team.abbr || toAbbr(team.name);
  const [seg, setSeg] = useState("roster");
  const [rosterView, setRosterView] = useState(null);      // null = full roster · order · pitching · field
  const [statView, setStatView] = useState("hitting");     // hitting · power · pitching
  const [chartMode, setChartMode] = useState("form");
  const [capSeason, setCapSeason] = useState(null);
  const roster = players.filter((p) => {
    if (p.teamId && p.teamId === team.id) return true; // exact Airtable link - no naming needed
    const t = teamOfPlayer(p);
    return t && (t === abbr || String(p.teamName).toLowerCase() === String(team.name).toLowerCase());
  });
  const payroll = roster.reduce((a, p) => a + currentSalary(p), 0);

  const numericLabel = (p) => /^\d+$/.test(String(p.sortLabel || "").trim());
  // When a live lineup exists, only tonight's nine stay in Batting Order -
  // everyone else in the batting unit moves to Bench automatically.
  const hasLineup = roster.some((p) => unitOf(p) === "Batting" && numericLabel(p));
  const groups = {};
  for (const p of roster) {
    let role = unitOf(p);
    if (role === "Batting" && hasLineup && !numericLabel(p)) role = "Bench";
    (groups[role] ??= []).push(p);
  }
  const orderedRoles = [...ROLE_ORDER.filter((r) => groups[r]), ...(groups["Roster"] ? ["Roster"] : [])];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24">
      <div className="px-5 pb-6 text-white" style={{ backgroundColor: teamColor(abbr), paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ Teams</button>
        <div className="flex items-center gap-4">
          {team.logo ? (
            <img src={team.logo} alt="" className={"w-20 h-20 object-contain shrink-0 drop-shadow-xl" + logoFx(abbr)} />
          ) : (
            <span className="text-3xl">⚾</span>
          )}
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-tight">{team.name} <span className="text-base font-bold opacity-70 whitespace-nowrap">({(team.wins ?? 0) + "-" + (team.losses ?? 0)})</span></div>
            <div className="text-sm opacity-80 font-medium mt-0.5 truncate">
              {(() => {
                if (!team.division) return [team.conference].filter(Boolean).join(" · ") || "—";
                const rivals = (teams || []).filter((t) => t.division === team.division)
                  .sort((a, b) => winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0));
                const i = rivals.findIndex((t) => t.id === team.id);
                const ord = i >= 0 ? (ORDINALS[i] || `${i + 1}th`) : null;
                return ord ? `${ord} in ${team.division}` : team.division;
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        {(() => {
          // Football-style header tiles. Ranks use per-game numbers so teams with games in hand compare fairly.
          const gp = (t) => (t.wins ?? 0) + (t.losses ?? 0);
          const val = { rs: (t) => (t.ppg != null ? t.ppg : t.rs != null && gp(t) ? t.rs / gp(t) : null), ra: (t) => (t.oppPpg != null ? t.oppPpg : t.ra != null && gp(t) ? t.ra / gp(t) : null),
            diff: (t) => (t.rs != null && t.ra != null && gp(t) ? (t.rs - t.ra) / gp(t) : null) };
          const rk = (k, low) => {
            const mineV = val[k](team); if (mineV == null) return null;
            const vs = (teams || []).map(val[k]).filter((v) => v != null); if (vs.length < 2) return null;
            const r = vs.filter((v) => (low ? v < mineV : v > mineV)).length + 1, tied = vs.filter((v) => v === mineV).length > 1;
            return { text: ordinal(r) + (tied ? " (tie)" : ""), cls: rankCls(r) };
          };
          const diff = team.rs != null && team.ra != null ? team.rs - team.ra : null;
          const rS = rk("rs"), rA = rk("ra", true), rD = rk("diff");
          const tc = bannerColor(abbr);
          return (
            <>
              <div className="grid grid-cols-3 gap-2">
                <RankTile tc={tc} onClick={onJumpStat ? () => onJumpStat("rspg") : undefined} label="Runs Scored" value={team.rs != null ? team.rs : "—"} sub={rS && rS.text} subCls={rS && rS.cls} />
                <RankTile tc={tc} onClick={onJumpStat ? () => onJumpStat("rapg") : undefined} label="Runs Allowed" value={team.ra != null ? team.ra : "—"} sub={rA && rA.text} subCls={rA && rA.cls} />
                <RankTile tc={tc} onClick={onJumpStat ? () => onJumpStat("diffpg") : undefined} label="Run Diff" value={diff != null ? (diff > 0 ? "+" : "") + diff : "—"} valueCls={diff == null ? "" : diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"} sub={rD && rD.text} subCls={rD && rD.cls} />
              </div>
            </>
          );
        })()}

        <div className="flex gap-2 mt-4">
          {[["roster", "Roster"], ["contracts", "Contracts"], ["stats", "Stats"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setSeg(k)}
              className={"flex-1 py-2 rounded-full text-xs font-bold transition-colors " + (seg === k
                ? "text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
              style={seg === k ? { backgroundColor: teamColor(abbr) } : undefined}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Roster sub-pills work like the football app's Offense / Defense: tap to open, tap again for the full roster */}
        {seg === "roster" && (
          <div className="flex gap-2 mt-3">
            {[["order", "Batting Order"], ["pitching", "Pitching Rotation"], ["field", "Fielding"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setRosterView(rosterView === k ? null : k)}
                className={"flex-1 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors " + (rosterView === k
                  ? "text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
                style={rosterView === k ? { backgroundColor: bannerColor(abbr) } : undefined}>
                {lbl}
              </button>
            ))}
          </div>
        )}
        {seg === "roster" && roster.length > 0 && <TeamRoster roster={roster} abbr={abbr} teamName={team.name} view={rosterView} onSelectPlayer={onSelectPlayer} />}
        {seg === "stats" && (
          <div className="flex gap-2 mt-3">
            {[["hitting", "Hitting"], ["power", "Power"], ["pitching", "Pitching"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setStatView(k)}
                className={"flex-1 py-1.5 rounded-full text-[11px] font-bold transition-colors " + (statView === k
                  ? "text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
                style={statView === k ? { backgroundColor: bannerColor(abbr) } : undefined}>
                {lbl}
              </button>
            ))}
          </div>
        )}
        {seg === "stats" && <TeamStatsPanel abbr={abbr} view={statView} players={players} onSelectPlayer={onSelectPlayer} />}
        {seg === "contracts" && (
          <>
            <div className="flex items-baseline justify-between mt-6 mb-2 px-1">
              <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Team Contracts</span>
              <span className="text-[11px] font-bold text-green-600 dark:text-green-400">{fmtM(payroll)} payroll</span>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {roster
                .slice()
                .sort((a, b) => currentSalary(b) - currentSalary(a) || a.name.localeCompare(b.name))
                .map((p) => {
                  const act = activeOf(p);
                  return (
                    <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                      <Avatar p={p} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                        <span className="block text-[11px] text-slate-400 font-medium truncate">
                          {act ? (act.terms || displayLine(act)) : "No contract"}
                        </span>
                        {nextEvent(p) && (
                          <span className="block mt-1"><EventPill ev={nextEvent(p)} /></span>
                        )}
                      </span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 shrink-0">
                        {currentSalary(p) > 0 ? fmtM(currentSalary(p)) : "—"}
                      </span>
                    </button>
                  );
                })}
              {roster.length === 0 && <div className="text-center text-sm text-slate-400 py-10">No players linked yet.</div>}
            </div>
          </>
        )}

        {seg === "charts" && (() => {
          const seasons = seasonsAhead(5);
          return (
            <>
              <div className="flex gap-2 mt-4">
                {[["form", "Form"], ["cap", "Cap Outlook"], ["timeline", "Timeline"], ["trends", "Trends"]].map(([k, lbl]) => (
                  <button key={k} onClick={() => setChartMode(k)}
                    className={"flex-1 py-1.5 rounded-full text-[11px] font-bold " + (chartMode === k
                      ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
                    {lbl}
                  </button>
                ))}
              </div>
              {chartMode === "form" && <TeamFormChart teamName={team.name} />}

              {chartMode === "cap" && (() => {
                const totals = seasons.map((s) => ({
                  season: s,
                  rows: roster
                    .map((p) => ({ p, y: salaryInSeason(p, s) }))
                    .filter((x) => x.y)
                    .sort((a, b) => b.y.salary - a.y.salary),
                }));
                const max = Math.max(...totals.map((t) => t.rows.reduce((a, r) => a + r.y.salary, 0)), 1);
                const selT = totals.find((t) => t.season === capSeason) || null;
                return (
                  <>
                    <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Committed Payroll by Season</div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                      <div className="flex items-end gap-2 h-36">
                        {totals.map((t) => {
                          const sum = t.rows.reduce((a, r) => a + r.y.salary, 0);
                          const active = capSeason === t.season;
                          return (
                            <button key={t.season} onClick={() => setCapSeason(active ? null : t.season)} className="flex-1 flex flex-col items-center justify-end h-full">
                              <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 mb-1 tabular-nums">{sum > 0 ? fmtM(sum) : "—"}</div>
                              <div className={"w-full rounded-t-md " + (active ? "opacity-100" : "opacity-80")}
                                style={{ backgroundColor: active ? "#1d4ed8" : "#2563eb", height: Math.max((sum / max) * 100, sum > 0 ? 6 : 2) + "%" }} />
                              <div className={"text-[10px] font-semibold mt-1 whitespace-nowrap " + (active ? "text-blue-600 dark:text-blue-400" : "text-slate-400")}>{seasonTick({ season: t.season })}</div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-slate-400 text-center mt-2">Tap a season for the breakdown</div>
                    </div>
                    {selT && (
                      <>
                        <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-5 mb-2 px-1">{selT.season} · {selT.rows.length} players</div>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                          {selT.rows.map(({ p, y }) => (
                            <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800">
                              <Avatar p={p} />
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                              </span>
                              {(y.type === "PO" || y.type === "TO") && !y.decision && (
                                <span className={"px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase " + (y.type === "PO" ? EVENT_COLORS.PO : EVENT_COLORS.TO)}>
                                  {y.type === "PO" ? "Player Option" : "Team Option"}
                                </span>
                              )}
                              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 shrink-0 tabular-nums">{fmtM(y.salary)}</span>
                            </button>
                          ))}
                          {selT.rows.length === 0 && <div className="text-center text-sm text-slate-400 py-8">No committed salary.</div>}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}

              {chartMode === "timeline" && (() => {
                const rows = roster
                  .map((p) => ({ p, cells: seasons.map((s) => salaryInSeason(p, s) || (faStatus(p) && faStatus(p).season === s ? { fa: true } : null)) }))
                  .filter((r) => r.cells.some(Boolean))
                  .sort((a, b) => currentSalary(b.p) - currentSalary(a.p));
                return (
                  <>
                    <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">Contract Timeline</div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-20 shrink-0" />
                        {seasons.map((s) => (
                          <span key={s} className="flex-1 text-center text-[9px] font-bold text-slate-400">{"'" + String(s).slice(2, 4)}</span>
                        ))}
                      </div>
                      {rows.map(({ p, cells }) => (
                        <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-2 py-1.5 text-left">
                          <span className="w-20 shrink-0 text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                          {cells.map((c, i) => (
                            <span key={i} className="flex-1 h-3 rounded-sm" style={{
                              backgroundColor: !c ? "transparent"
                                : c.fa ? "#94a3b8"
                                : BAR_COLORS[c.type] || BAR_COLORS.G,
                              opacity: c && c.fa ? 0.35 : 1,
                              border: !c ? "1px dashed rgba(148,163,184,0.25)" : "none",
                            }} />
                          ))}
                        </button>
                      ))}
                      {rows.length === 0 && <div className="text-center text-sm text-slate-400 py-8">No contract years entered.</div>}
                      <div className="flex flex-wrap gap-3 mt-3 text-[9px] font-bold text-slate-400 uppercase">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BAR_COLORS.G }} /> Guaranteed</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BAR_COLORS.PO }} /> Player Opt</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BAR_COLORS.TO }} /> Team Opt</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400/40" /> Free Agent</span>
                      </div>
                    </div>
                  </>
                );
              })()}

              {chartMode === "trends" && (() => {
                const withTrend = roster
                  .map((p) => ({ p, pts: (p.stats || []).filter((s) => s.hr != null).sort((a, b) => String(a.season).localeCompare(String(b.season))) }))
                  .filter((x) => x.pts.length >= 2)
                  .sort((a, b) => (b.pts[b.pts.length - 1].hr ?? 0) - (a.pts[a.pts.length - 1].hr ?? 0))
                  .slice(0, 5);
                if (withTrend.length === 0) {
                  return <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mt-6 text-center text-sm text-slate-400 py-10 px-6">Trends need at least two seasons of stats per player. Add more seasons in the Stats table and lines appear here.</div>;
                }
                const allSeasons = Array.from(new Set(withTrend.flatMap((x) => x.pts.map((s) => s.season)))).sort();
                const maxPts = Math.max(...withTrend.flatMap((x) => x.pts.map((s) => s.hr)), 10);
                const W = 320, H = 150, PAD = 14;
                const xOf = (season) => PAD + (allSeasons.indexOf(season) / Math.max(allSeasons.length - 1, 1)) * (W - PAD * 2);
                const yOf = (v) => H - PAD - (v / maxPts) * (H - PAD * 2);
                return (
                  <>
                    <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">HR Trends</div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                      <svg viewBox={"0 0 " + W + " " + H} className="w-full">
                        {withTrend.map((x, i) => (
                          <g key={x.p.id}>
                            <polyline
                              fill="none" stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                              points={x.pts.map((s) => xOf(s.season) + "," + yOf(s.hr)).join(" ")} />
                            {x.pts.map((s) => (
                              <circle key={s.season} cx={xOf(s.season)} cy={yOf(s.hr)} r="3" fill={LINE_COLORS[i % LINE_COLORS.length]} />
                            ))}
                          </g>
                        ))}
                        {allSeasons.map((s) => (
                          <text key={s} x={xOf(s)} y={H - 2} textAnchor="middle" className="fill-slate-400" fontSize="8" fontWeight="600">{"'" + String(s).slice(2, 4)}</text>
                        ))}
                      </svg>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {withTrend.map((x, i) => (
                          <button key={x.p.id} onClick={() => onSelectPlayer(x.p)} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
                            {x.p.name} · {Math.round(x.pts[x.pts.length - 1].hr)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          );
        })()}

        {seg === "roster" && roster.length === 0 && (
          <div className="text-center text-sm text-slate-400 mt-16">
            No players linked to {team.name} yet.
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════ TAB: DRAFT ══════════════════════════════════════

function roundOf(p) {
  if (isUndrafted(p)) return null;
  if (p.draftRound != null) return Number(p.draftRound) || null;
  const t = String(p.draft || "");
  let m = t.match(/(?:round|rnd|rd|r)\s*\.?\s*(\d)/i) || t.match(/(\d)(?:st|nd)\s*round/i);
  if (m) return Number(m[1]);
  // fall back to the pick number: ~30 picks per round
  const pk = pickOf(p);
  if (pk !== 999) return Math.min(20, Math.ceil(pk / 30));
  return null;
}
function isUndrafted(p) {
  return /undrafted/i.test(String(p.draft || ""));
}
function draftedBy(p) {
  const m = String(p.draft || "").match(/\(([A-Za-z]{2,4})\)\s*$/);
  return m ? m[1].toUpperCase() : null;
}
function pickOf(p) {
  if (p.draftPick != null) return p.draftPick;
  const m = String(p.draft || "").match(/pick\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 999;
}


const STAT_CATS = [
  { key: "avg", label: "AVG" },
  { key: "hr", label: "HR" },
  { key: "rbi", label: "RBI" },
  { key: "sb", label: "SB" },
  { key: "w", label: "W" },
  { key: "era", label: "ERA" },
  { key: "so", label: "SO" },
  { key: "sv", label: "SV" },
];
// Rate stats format specially; ERA ranks ascending (lower is better).
const ASC_CATS = ["era"];
function fmtCat(cat, v) {
  if (v == null) return "\u2014";
  if (cat === "avg") return Number(v).toFixed(3).replace(/^0/, "");
  if (cat === "era") return Number(v).toFixed(2);
  return String(Math.round(v * 10) / 10);
}

// ═══════════════ LEADERS (Stats tab) ═════════════════════════════
// Same page as the football app's Leaders: category pills → stat pills →
// (position pills) → ranked rows with team-colour edge, shared-rank ties,
// headshot, team chip, big number and a small context line.
// Data: /api/season-stats (every player's season line) + /api/standings
// (team stats). Rate stats (AVG, OPS, ERA…) list QUALIFIED players only:
// 3.1 PA per team game for hitters, 1 IP per team game for pitchers.
const MLB_LEADER_CATS = [
  { id: "hitting", label: "Hitting", side: "hit", positions: ["C", "1B", "2B", "3B", "SS", "OF", "DH"],
    stats: [["hr", "HR"], ["rbi", "RBI"], ["avg", "AVG"], ["ops", "OPS"], ["h", "Hits"], ["r", "Runs"], ["sb", "SB"]] },
  { id: "power", label: "Power", side: "hit", positions: ["C", "1B", "2B", "3B", "SS", "OF", "DH"],
    stats: [["hrPa", "HR/PA"], ["iso", "ISO"], ["slg", "SLG"], ["tb", "Total Bases"], ["d", "2B"]] },
  { id: "pitching", label: "Pitching", side: "pit", positions: ["SP", "RP"],
    stats: [["era", "ERA"], ["whip", "WHIP"], ["so", "K"], ["w", "Wins"], ["sv", "Saves"], ["k9", "K/9"], ["outs", "IP"]] },
  { id: "hrallowed", label: "HR Allowed", side: "pit", positions: ["SP", "RP"],
    stats: [["hr9", "HR/9"], ["hr", "HR"]] },
  { id: "teams", label: "Teams",
    stats: [["rspg", "Runs/G"], ["rapg", "Runs Allowed/G"], ["diffpg", "Run Diff/G"], ["hr", "HR"], ["ops", "OPS"], ["avg", "AVG"], ["sb", "SB"], ["era", "ERA"], ["whip", "WHIP"], ["hr9", "HR/9 Allowed"]] },
];
const MLB_RATE = new Set(["avg", "obp", "slg", "ops", "iso", "hrPa", "era", "whip", "k9", "hr9"]);   // need a qualified sample
const MLB_LOW_FIRST = { pitching: new Set(["era", "whip"]), teams: new Set(["era", "whip", "hr9", "rapg"]) }; // lower is better
// Team value for a Stats › Teams key: the run tiles come from the standings (per game, so games in hand don't skew ranks), the rest from team stats.
const teamStatVal = (t, key) => {
  const gp = t.games || (t.wins ?? 0) + (t.losses ?? 0);
  if (key === "rspg") return t.rs != null && gp ? t.rs / gp : null;
  if (key === "rapg") return t.ra != null && gp ? t.ra / gp : null;
  if (key === "diffpg") return t.rs != null && t.ra != null && gp ? (t.rs - t.ra) / gp : null;
  return t.stx ? t.stx[key] : null;
};
const mlbFmtStat = (key, v) => {
  if (v == null) return "—";
  if (["avg", "obp", "slg", "ops", "iso"].includes(key)) return Number(v).toFixed(3).replace(/^0/, "");
  if (key === "hrPa") return (Number(v) * 100).toFixed(1) + "%";
  if (["era", "whip", "k9", "hr9", "rpg", "rspg", "rapg"].includes(key)) return Number(v).toFixed(2);
  if (key === "diffpg") return (v > 0 ? "+" : "") + Number(v).toFixed(2);
  if (key === "outs") return Math.floor(v / 3) + "." + (v % 3);
  return String(v);
};
const mlbPosGroup = (P) => {
  const pos = String(P.pos || "").toUpperCase();
  if (["LF", "CF", "RF", "OF"].includes(pos)) return "OF";
  if (P.pit && (pos === "P" || pos === "SP" || pos === "RP" || pos === "TWP")) return P.pit.gs * 2 >= P.pit.g ? "SP" : "RP";
  return pos;
};
const MLB_HEAD = (id) => "https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png,q_auto:best,f_auto/v1/people/" + id + "/headshot/silo/current";
const LEADERS_CACHE = { stats: null, teams: null, at: 0 };   // survives tab switches — the page opens instantly the second time

function StatsTab({ players, onSelect, jump }) {
  // jump = { catId, key, hl } from a team-page tile: open that board and highlight the team's row
  const [catId, setCatId] = useState(jump ? jump.catId : "hitting");
  const [statKey, setStatKey] = useState(jump ? jump.key : null);
  const [hl, setHl] = useState(jump ? jump.hl : null);
  const [posPick, setPosPick] = useState("ALL");
  const [seasonStats, setSeasonStats] = useState(LEADERS_CACHE.stats);
  const [teamStats, setTeamStats] = useState(LEADERS_CACHE.teams);
  useEffect(() => {
    if (!hl) return;
    const el = document.getElementById("team-row-" + hl);
    if (el) el.scrollIntoView({ block: "center" });
    const t = setTimeout(() => setHl(null), 4000);                       // the glow fades after a few seconds
    return () => clearTimeout(t);
  }, [hl, teamStats]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (LEADERS_CACHE.stats && Date.now() - LEADERS_CACHE.at < 15 * 60000) return;
    const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get("/api/season-stats"), get("/api/standings")]).then(([s, t]) => {
      if (!alive) return;
      if (s && s.players) { LEADERS_CACHE.stats = s; LEADERS_CACHE.at = Date.now(); setSeasonStats(s); } else setFailed(true);
      if (t && t.teams) { LEADERS_CACHE.teams = t; setTeamStats(t); }
    });
    return () => { alive = false; };
  }, []);

  const cat = MLB_LEADER_CATS.find((c) => c.id === catId);
  const key = statKey && cat.stats.some(([k]) => k === statKey) ? statKey : cat.stats[0][0];
  const lowFirst = !!(MLB_LOW_FIRST[cat.id] && MLB_LOW_FIRST[cat.id].has(key));
  const isRate = MLB_RATE.has(key);
  const q = (seasonStats && seasonStats.leaders && seasonStats.leaders.qualifiers) || { pa: 0, ip: 0, teamGames: 0 };

  const rows = useMemo(() => {
    if (!seasonStats || cat.id === "teams") return [];
    const side = cat.side;
    const sorted = Object.values(seasonStats.players || {})
      .filter((P) => P[side] && P[side][key] != null)
      .filter((P) => !isRate || (side === "hit" ? P.hit.pa >= q.pa : P.pit.outs >= q.ip * 3))
      .filter((P) => lowFirst || isRate || P[side][key] > 0)
      .filter((P) => posPick === "ALL" || mlbPosGroup(P) === posPick)
      .map((P) => ({ P, v: P[side][key] }))
      .sort((a, b) => (lowFirst ? a.v - b.v : b.v - a.v));
    // ranks are shared: same value, same number, flagged as a tie
    let lastV = null, lastR = 0;
    const counts = {};
    sorted.forEach((row, i) => { if (row.v !== lastV) { lastR = i + 1; lastV = row.v; } row.rank = lastR; counts[row.v] = (counts[row.v] || 0) + 1; });
    for (const row of sorted) row.tie = counts[row.v] > 1;
    return sorted.slice(0, 50);
  }, [seasonStats, catId, key, posPick]);

  const teamRows = useMemo(() => {
    if (cat.id !== "teams" || !teamStats) return [];
    return (teamStats.teams || []).map((t) => ({ abbr: t.abbr, name: t.name, v: teamStatVal(t, key), gp: t.games || (t.wins ?? 0) + (t.losses ?? 0) })).filter((r) => r.v != null)
      .sort((a, b) => (lowFirst ? a.v - b.v : b.v - a.v));
  }, [teamStats, catId, key]);

  // Airtable record for a leaderboard row (so a tap opens his player page); team breaks a shared name
  const mine = useMemo(() => { const m = {}; for (const p of players || []) (m[hrbNrm(p.name)] = m[hrbNrm(p.name)] || []).push(p); return m; }, [players]);
  const findP = (P) => { const c = mine[hrbNrm(P.name)] || []; return c.length > 1 ? c.find((p) => teamOfPlayer(p) === P.team) || c[0] : c[0]; };

  const yr = seasonStats ? seasonStats.season : "";
  const thru = seasonStats && seasonStats.updatedAt ? new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(new Date(seasonStats.updatedAt)) : "";
  const statLabel = (cat.stats.find(([k]) => k === key) || [key, key])[1];
  const perGame = cat.id !== "teams" && !isRate && key !== "outs";
  const subLine = (P, v) => {
    const s = P[cat.side];
    if (perGame) { const pg = s.g ? v / s.g : null; return pg == null ? null : (pg >= 10 ? pg.toFixed(1) : pg.toFixed(2)) + "/g"; }
    return cat.side === "hit" ? s.pa + " PA" : s.ip + " IP";
  };
  const headRight = statLabel + (cat.id === "teams" ? (lowFirst ? " · lowest first" : "") : perGame ? " · per game" : lowFirst ? " · lowest first" : cat.id === "hrallowed" ? " · most first" : " · qualified");

  return (
    <div>
      <div className="bg-blue-600 pb-3 px-4 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-baseline gap-2"><h1 className="text-xl font-extrabold">Leaders</h1><span className="text-[11px] font-semibold text-blue-200">{yr}{thru ? ` · thru ${thru}` : ""}{seasonStats && seasonStats.isCurrent === false ? " · last season" : ""}</span></div>
        <div className="flex gap-1.5 mt-3">
          {MLB_LEADER_CATS.map((c) => (
            <button key={c.id} onClick={() => { setCatId(c.id); setStatKey(null); setPosPick("ALL"); window.scrollTo(0, 0); }}
              className={"flex-1 py-1.5 rounded-full text-[10px] font-extrabold whitespace-nowrap " + (catId === c.id ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100")}>{c.label}</button>
          ))}
        </div>
        <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {cat.stats.map(([k, lbl]) => (
            <button key={k} onClick={() => { setStatKey(k); window.scrollTo(0, 0); }}
              className={"shrink-0 px-3 py-1 rounded-full text-[10px] font-bold " + (key === k ? "bg-white/90 text-blue-700" : "bg-blue-700/50 text-blue-100")}>{lbl}</button>
          ))}
        </div>
        {cat.positions && (
          <div className="flex gap-1.5 mt-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {["ALL", ...cat.positions].map((k) => (
              <button key={k} onClick={() => { setPosPick(k); window.scrollTo(0, 0); }}
                className={"shrink-0 px-3 py-1 rounded-full text-[10px] font-bold " + (posPick === k ? "bg-white/90 text-blue-700" : "bg-blue-700/50 text-blue-100")}>{k === "ALL" ? "All" : k}</button>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 pt-3 pb-28">
        {!seasonStats && !failed && <BallLoader label="Loading leaders" full={false} />}
        {!seasonStats && failed && <div className="text-center text-xs text-slate-400 py-10">Couldn't load season stats. Tap Stats again to retry.</div>}
        {seasonStats && catId === "teams" && (
          teamRows.length === 0 ? <div className="text-center text-xs text-slate-400 py-10">No {yr} team stats yet.</div> : (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">Team</span>
                <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">{headRight}</span>
              </div>
              {teamRows.map((r, i) => {
                const best = teamRows[0].v || 1, worst = teamRows[teamRows.length - 1].v || 0;
                const w = key === "diffpg" ? ((r.v - worst) / ((best - worst) || 1)) * 100 : lowFirst ? (best / (r.v || 1)) * 100 : (r.v / best) * 100;
                return (
                  <div key={r.abbr} id={"team-row-" + r.abbr} className={"px-3 py-2 flex items-center gap-2.5 transition-colors duration-700 " + (hl === r.abbr ? "bg-amber-50 dark:bg-amber-900/30 ring-2 ring-inset ring-amber-400" : "")}>
                    <div className={"w-6 text-center text-[13px] font-black tabular-nums " + (i < 3 ? "text-blue-600" : "text-slate-400")}>{i + 1}</div>
                    {TEAM_LOGOS[r.abbr] && <img src={TEAM_LOGOS[r.abbr]} alt="" className="w-8 h-8 rounded-full object-contain p-0.5 bg-white shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">{r.name || r.abbr}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: Math.max(3, Math.min(100, w)) + "%", backgroundColor: teamColor(r.abbr) }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black tabular-nums text-slate-900 dark:text-white leading-none">{mlbFmtStat(key, r.v)}</div>
                      <div className="text-[9px] font-semibold tabular-nums text-slate-400 mt-0.5">{r.gp} GP</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
        {seasonStats && catId !== "teams" && rows.length === 0 && <div className="text-center text-xs text-slate-400 py-10">No {yr} stats yet for this filter.</div>}
        {rows.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">Player</span>
              <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">{headRight}</span>
            </div>
            {rows.map(({ P, v, rank, tie }) => {
              const p = findP(P);
              const sub = subLine(P, v);
              return (
                <button key={P.id} onClick={p ? () => onSelect(p) : undefined}
                  className="w-full text-left pr-3 py-2 flex items-center gap-2.5 active:bg-slate-50 dark:active:bg-slate-800/60">
                  <div className="self-stretch w-1 rounded-r" style={{ backgroundColor: teamColor(P.team) }} />
                  <div className={"w-8 text-center shrink-0 " + (rank <= 3 ? "text-blue-600" : "text-slate-400")}>
                    <div className="text-[13px] font-black tabular-nums leading-none">{rank}</div>
                    {tie && <div className="text-[7px] font-bold lowercase tracking-wide opacity-70">tie</div>}
                  </div>
                  <img src={MLB_HEAD(P.id)} alt="" loading="lazy" className="w-10 h-10 rounded-full object-cover object-top bg-white shrink-0 ring-2 ring-white dark:ring-slate-800 shadow" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">{P.name} <InjBadge name={P.name} team={P.team} /></div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {TEAM_LOGOS[P.team] && <img src={TEAM_LOGOS[P.team]} alt="" className="w-3.5 h-3.5 rounded-full object-contain bg-white" />}
                      <span className="text-[10px] font-semibold text-slate-400">{[P.team, mlbPosGroup(P)].filter(Boolean).join(" · ")}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black tabular-nums text-slate-900 dark:text-white leading-none">{mlbFmtStat(key, v)}</div>
                    {sub && <div className="text-[9px] font-semibold tabular-nums text-slate-400 mt-0.5">{sub}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="text-[9px] text-slate-400 mt-2 px-1">
          {catId === "teams" ? "Team totals from MLB. HR/9 Allowed = how homer-prone a staff is — the higher it ranks here, the friendlier the matchup for hitters."
            : isRate ? `Qualified only: ${cat.side === "hit" ? q.pa + " PA (3.1 per team game)" : q.ip + " IP (1 per team game)"}.` + (cat.id === "hrallowed" ? " Most homer-prone arms first — the pitchers your HR targets want to face." : "")
            : "Season totals · top 50."}
        </div>
      </div>
    </div>
  );
}

function DraftTab({ players, onSelect }) {
  const byYear = {};
  const noData = [];
  for (const p of players) {
    if (p.draftYear) (byYear[p.draftYear] ??= []).push(p);
    else noData.push(p);
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  const [selYear, setSelYear] = useState(null);
  const yr = selYear && byYear[selYear] ? selYear : years[0]; // default: newest class
  return (
    <div>
      <div className="bg-blue-600 pb-4 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <h1 className="text-3xl font-extrabold text-white mb-3">Draft</h1>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelYear(y)}
              className={
                "shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-colors " +
                (y === yr ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")
              }
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-28 mt-4">
        {[yr].filter((y) => y != null).map((yr) => {
          const cls = byYear[yr];
          const rounds = [
            ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => ["Round " + r, cls.filter((p) => roundOf(p) === r)]),
            ["Later Rounds", cls.filter((p) => !isUndrafted(p) && roundOf(p) != null && roundOf(p) > 10)],
            ["Undrafted", cls.filter((p) => isUndrafted(p))],
            ["Round Unknown", cls.filter((p) => !isUndrafted(p) && roundOf(p) == null)],
          ].filter(([, g]) => g.length > 0);
          return (
            <div key={yr}>
              {rounds.map(([label, group]) => (
                <div key={label}>
                  <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-6 mb-2 px-1">
                    {label}
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {group
                      .sort((a, b) => pickOf(a) - pickOf(b))
                      .map((p) => (
                        <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                          <span className="w-7 text-center text-sm font-extrabold text-slate-400 tabular-nums shrink-0">{pickOf(p) !== 999 ? pickOf(p) : "—"}</span>
                          <Avatar p={p} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                            <span className="block text-[11px] text-slate-400 font-medium truncate">{[p.pos, p.college].filter(Boolean).join(" · ") || "—"}</span>
                          </span>
                          <TeamPill team={draftedBy(p) || teamOfPlayer(p)} />
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {noData.length > 0 && (
          <div className="text-center text-xs text-slate-400 mt-8">
            {noData.length} player{noData.length === 1 ? "" : "s"} without draft data yet
          </div>
        )}
        {years.length === 0 && (
          <div className="text-center text-sm text-slate-400 mt-16">
            No draft data yet. Fill in the Draft Year field in Airtable and classes will appear here.
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════ HR BOARD (betting sheet) ════════════════════════
// Recreates the Google Sheets HR/parlay board inside the app. One card
// per game: each team's starting pitcher (hand, Barrel % against, batted
// balls, HR/9) plus batting spots 1-5 with bat side and Barrel %.
// CONFIRMED (green) when today's lineup is posted; PROJECTED (amber)
// falls back to the team's most recent posted lineup. Tap a card to
// open the full matchup view. Tune every threshold/color rule here:
const HRB = {
  minBBE: 120,   // pitcher sample floor (sheet's "min. 120 batted balls")
  hitGreen: 12,  // hitter Barrel % >= this -> green
  hitAmber: 8,   // hitter Barrel % >= this -> amber (below -> red)
  pitGreen: 9.5, // pitcher Barrel % against >= this -> green (HR-prone target)
  pitRed: 6.5,   // pitcher Barrel % against <= this -> red (avoid)
  hr9Green: 1.2, // pitcher HR/9 >= this -> green
  hr9Red: 0.9,   // pitcher HR/9 <= this -> red
  gbGreen: 38,   // pitcher GB% <= this -> green (fly-ball pitcher = HR-prone)
  gbRed: 48,     // pitcher GB% >= this -> red (ground-ball pitcher = fade)
  // ── Top Targets: MULTIPLICATIVE score, 100 = league-average matchup ──
  // Each factor is a ratio to league average (capped so one freak stat
  // can't dominate), and they MULTIPLY: a stingy pitcher shrinks the
  // whole score instead of just adding less. Missing data = ratio of 1.
  topN: 10,        // how many targets to rank
  maxPerTeam: 2,   // diversity cap: at most this many hitters per team
                   // in Top Targets (spreads picks across games)
  lgHitBrl: 8.5,   // league-average hitter Barrel %
  lgPitBrl: 8.5,   // league-average pitcher Barrel % against
  lgHr9: 1.10,     // league-average HR/9
  capRatio: 2.5,   // max any single ratio can contribute
  eHit: 1.0,       // exponent on the hitter's barrel ratio
  ePitBrl: 0.5,    // exponent on SP Brl%-against ratio
  eHr9: 0.5,       // exponent on SP HR/9 ratio
  parkSwing: 0.12, // park factor range: rank 1 = x1.12 ... rank 30 = x0.88
  // Real plate-appearance curve by lineup spot (ratio to leadoff).
  // 9th hitter sees ~18% fewer PAs than leadoff — measured, not vibes.
  paCurve: [1, 0.978, 0.953, 0.931, 0.908, 0.884, 0.860, 0.839, 0.817],
  assumeBBE: 40,   // players with NO batted-ball data are treated as
                   // having this small a sample (unproven != trustworthy)
  shrinkK: 60,     // sample-size regression: stats behave as if K extra
                   // league-average batted balls were mixed in. Small
                   // samples pull hard toward average; 300+ BBE barely move.
                   // Activates per-player only when Batted Balls has data.
  projMult: 0.9,   // discount applied when the lineup is only projected
  coldMult: 1.0,   // v92: hit streaks are noise for HR purposes - disabled
                   // (set back to 0.9 to restore the old drought discount)
  unknownSP: 0.85, // discount when the opposing SP has NO barrel/HR9 data
  noSavant: 0.8,   // discount when the HITTER has no barrel data (name mismatch)
  calibration: 1.0, // global scale on HR%. Leave at 1.0 until the History
                    // scorecard has 14+ graded days; if it still says "too
                    // bold", set this to (actual homers ÷ expected) - e.g. 0.75.
                   // (a blind matchup shouldn't rank beside a proven one)
  // Weather (applied only when data exists; domes stay neutral):
  wxTempPer: 0.004, // +0.4% per °F above 72 (capped ±8%)
  wxWindPer: 0.012, // ±1.2% per mph blowing out/in (capped ±12%)
  // ── v92 ────────────────────────────────────────────────────────────
  // HITTER = Barrel/PA (process, fixes the strikeout blind spot of Brl%
  // per batted ball) blended with HR/PA (outcome). Exponents sum to 1.
  lgBrlPa: 5.8,    // league-avg Barrel/PA % (Savant "brl_pa"; = 8.5 Brl% x ~68% balls-in-play)
  lgHrPa: 0.032,   // league-avg HR per plate appearance (~3.2%)
  eBrlPa: 0.6,
  eHrPa: 0.4,
  // PITCHER = SP Brl% against + HR/9 (both HR-proneness) + ground-ball
  // rate (independent HR suppressor). Exponents sum to 1.
  eSpBrl: 0.35,
  eSpHr9: 0.35,
  eGb: 0.30,
  lgGb: 43,        // league-avg GB% (Savant scale, balls in play)
  lgGoPct: 52,     // league-avg groundOuts/(groundOuts+airOuts) - the MLB
                   // API fallback runs on an outs-only scale, hence separate
  // BULLPEN: ~35% of a hitter's PAs come vs relievers, not the SP.
  spShare: 0.65,   // SP factor ^ spShare  x  bullpen factor ^ (1 - spShare)
  // v100: SP strikeout adjustment. Brl%-against and GB% are per-batted-ball
  // and blind to how OFTEN the ball gets hit; high-K pitchers (Gausman,
  // Ober types) were inflated. HR/9 already prices Ks, so the exponent
  // covers only the K-blind components (eSpBrl + eGb = 0.65).
  lgK: 22,          // league-avg K% of batters faced
  eContact: 0.65,
  // v100: residual platoon. Split Brl% is regressed hard toward a hitter's
  // overall number, which understates the same-hand penalty for stars.
  platoonLL: 0.90,  // LHB vs LHP
  platoonRR: 0.96,  // RHB vs RHP (righties suffer less)
  // Expected plate appearances by lineup spot (leadoff -> 9th). Turns the
  // score into a real per-game HR probability: 1 - (1 - p_PA) ^ expPA.
  expPA: [4.65, 4.55, 4.45, 4.35, 4.25, 4.15, 4.05, 3.95, 3.85],
  avgPA: 4.25,     // expPA / avgPA replaces the old paCurve multiplier
};

// ── v92 shared scorer ───────────────────────────────────────────────────
// ONE function feeds the live board, the game accordion, and the
// backtester so History always grades the exact formula you bet from.
//   hm   = hitter stats row (Airtable/import): barrel, brlL, brlR, bbe, brlPa, pa, hr
//   hApi = hitter from MLB API: { hr, pa }           (may be {} / undefined)
//   om   = opposing SP stats row: barrel, hr9, bbe, gb
//   pApi = SP from MLB API: { goPct }                (may be {} / undefined)
//   penR = opposing bullpen HR/9 ratio to league (1 = avg / unknown)
// Returns null when the hitter has no usable data at all.
function hrbEval({ hm, hApi, om, pApi, hand, batHand, spot, parkF, wxF, confirmed, penR }) {
  hm = hm || {}; hApi = hApi || {}; om = om || {}; pApi = pApi || {};
  const shrink = (v, lg, n) => (v != null && n != null && n > 0) ? (v * n + lg * HRB.shrinkK) / (n + HRB.shrinkK) : v;
  const capped = (r) => Math.min(Math.max(r, 0.2), HRB.capRatio);
  const pa = hm.pa != null ? hm.pa : hApi.pa;
  const hr = hm.hr != null ? hm.hr : hApi.hr;

  // ── Hitter: vs-hand Barrel% (regressed) -> converted to Barrel/PA ──
  const useBrl = brlVsHand(hm, hand);
  const isSplit = hand === "L" ? hm.brlL != null : hand === "R" ? hm.brlR != null : false;
  const effBbe = hm.bbe == null ? null : isSplit && hand === "L" ? hm.bbe * 0.3 : isSplit && hand === "R" ? hm.bbe * 0.7 : hm.bbe;
  const totAdj = shrink(hm.barrel, HRB.lgHitBrl, hm.bbe != null ? hm.bbe : HRB.assumeBBE);
  const prior = totAdj != null ? totAdj : HRB.lgHitBrl;
  const adjBrl = useBrl == null ? null : isSplit
    ? shrink(useBrl, prior, effBbe != null ? effBbe : HRB.assumeBBE * 0.3)
    : shrink(useBrl, HRB.lgHitBrl, effBbe != null ? effBbe : HRB.assumeBBE);
  // Barrel/PA: prefer the Savant column; else derive Brl% x BBE / PA
  // (contact rate), so strikeout-heavy hitters stop tying contact hitters.
  let brlPa = null;
  if (hm.brlPa != null) {
    // scale the season Barrel/PA by the vs-hand adjustment so the split still counts
    brlPa = hm.brlPa * (adjBrl != null && totAdj != null && totAdj > 0 ? adjBrl / totAdj : 1);
  } else if (adjBrl != null && hm.bbe != null && pa != null && pa > 0) {
    brlPa = adjBrl * (hm.bbe / pa);
  } else if (adjBrl != null) {
    brlPa = adjBrl * (HRB.lgBrlPa / HRB.lgHitBrl); // no contact info: assume league BIP rate
  }
  const hrPaRaw = (hr != null && pa != null && pa > 0) ? hr / pa : null;
  const hrPa = hrPaRaw != null ? (hrPaRaw * pa + HRB.lgHrPa * HRB.shrinkK) / (pa + HRB.shrinkK) : null;
  if (brlPa == null && hrPa == null) return null;
  const noSavant = brlPa == null; // name didn't match the import - fix the name, don't trust the row
  const brlPaR = brlPa != null ? Math.pow(capped(brlPa / HRB.lgBrlPa), HRB.eBrlPa) : 1;
  const hrPaR = hrPa != null ? Math.pow(capped(hrPa / HRB.lgHrPa), HRB.eHrPa) : 1;
  // If only one hitter input exists, give it the full weight.
  const hitR = brlPa != null && hrPa != null ? brlPaR * hrPaR
    : brlPa != null ? Math.pow(capped(brlPa / HRB.lgBrlPa), 1)
    : Math.pow(capped(hrPa / HRB.lgHrPa), 1);

  // ── Starting pitcher ──
  const adjPitBrl = shrink(om.barrel, HRB.lgPitBrl, om.bbe != null ? om.bbe : HRB.assumeBBE);
  const adjHr9 = shrink(om.hr9, HRB.lgHr9, om.bbe != null ? om.bbe : HRB.assumeBBE);
  const spBrlR = adjPitBrl != null ? Math.pow(capped(adjPitBrl / HRB.lgPitBrl), HRB.eSpBrl) : 1;
  const spHr9R = adjHr9 != null ? Math.pow(capped(adjHr9 / HRB.lgHr9), HRB.eSpHr9) : 1;
  // Ground-ball rate: MORE grounders = FEWER homers, so the ratio is inverted.
  // Regressed by BBE exactly like Brl% and HR/9 - a 10-batted-ball rookie
  // with a 10% GB rate is treated as roughly league average, not as a
  // fly-ball machine.
  let gbR = 1;
  const adjGb = om.gb != null ? shrink(om.gb, HRB.lgGb, om.bbe != null ? om.bbe : HRB.assumeBBE) : null;
  if (adjGb != null) gbR = Math.pow(capped(HRB.lgGb / Math.max(adjGb, 1)), HRB.eGb);
  else if (pApi.goPct != null) gbR = Math.pow(capped(HRB.lgGoPct / Math.max(pApi.goPct, 1)), HRB.eGb);
  const spKnown = om.barrel != null || om.hr9 != null;
  // Contact rate: how often this SP lets the ball get hit at all,
  // regressed by batters faced like every other pitcher input.
  let contactR = 1;
  if (pApi.kPct != null) {
    const adjK = (pApi.kPct * (pApi.bf || 0) + HRB.lgK * HRB.shrinkK) / ((pApi.bf || 0) + HRB.shrinkK);
    contactR = Math.pow(capped((100 - adjK) / (100 - HRB.lgK)), HRB.eContact);
  }
  const spR = spBrlR * spHr9R * gbR * contactR;
  // ── Bullpen blend ──
  const pitR = Math.pow(spR, HRB.spShare) * Math.pow(penR != null ? capped(penR) : 1, 1 - HRB.spShare);

  // ── Assemble ──
  let pPA = HRB.lgHrPa * hitR * pitR * (parkF || 1) * (wxF || 1) * HRB.calibration;
  if (batHand === "L" && hand === "L") pPA *= HRB.platoonLL;
  else if (batHand === "R" && hand === "R") pPA *= HRB.platoonRR;
  if (!spKnown) pPA *= HRB.unknownSP;
  if (noSavant) pPA *= HRB.noSavant;
  if (confirmed === false) pPA *= HRB.projMult;
  const ePA = HRB.expPA[Math.min(Math.max(spot || 0, 0), 8)];
  const prob = 1 - Math.pow(1 - Math.min(pPA, 0.5), ePA);
  const score = 100 * (pPA / HRB.lgHrPa) * (ePA / HRB.avgPA);
  return { score, prob, hitR, pitR, brlPa, hrPa, adjBrl, adjPitBrl, adjHr9, adjGb, gbR, contactR, penR, spKnown, noSavant };
}
// GB% is INVERTED: low ground-ball rate = more balls in the air = target.
function hrbGbClass(v) {
  if (v == null) return CHIP.none;
  if (v <= HRB.gbGreen) return CHIP.good;
  if (v >= HRB.gbRed) return CHIP.bad;
  return CHIP.warn;
}
function hrbHitClass(v) {
  if (v == null) return CHIP.none;
  if (v >= HRB.hitGreen) return CHIP.good;
  if (v >= HRB.hitAmber) return CHIP.warn;
  return CHIP.bad;
}
function hrbPitBrlClass(v) {
  if (v == null) return CHIP.none;
  if (v >= HRB.pitGreen) return CHIP.good;
  if (v <= HRB.pitRed) return CHIP.bad;
  return CHIP.warn;
}
function hrbHr9Class(v) {
  if (v == null) return CHIP.none;
  if (v >= HRB.hr9Green) return CHIP.good;
  if (v <= HRB.hr9Red) return CHIP.bad;
  return CHIP.warn;
}
// ═══ Bouncing baseball splash (centered, fills the screen) ═══
// Realistic leather + figure-8 seams, drawn in SVG so it paints instantly.
function BallLoader({ label = "Loading", full = true }) {
  const ball = (
    <div className="flex flex-col items-center select-none">
      <style>{`
        @keyframes mlbBounce {
          0%,100% { transform: translateY(-30px) scaleX(1) scaleY(1); animation-timing-function: cubic-bezier(.35,0,.6,1); }
          46%     { transform: translateY(0) scaleX(1.09) scaleY(.91); animation-timing-function: cubic-bezier(.35,0,.6,1); }
          54%     { transform: translateY(0) scaleX(1.09) scaleY(.91); animation-timing-function: cubic-bezier(.4,0,.5,1); }
        }
        @keyframes mlbSpin { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes mlbShadow { 0%,100% { transform: scaleX(.5); opacity:.14; } 50% { transform: scaleX(1); opacity:.28; } }
        .mlb-bounce { animation: mlbBounce .68s infinite; }
        .mlb-spin { animation: mlbSpin 1.6s linear infinite; }
        .mlb-shadow { animation: mlbShadow .68s infinite; }
      `}</style>
      <div className="h-20 flex items-end">
        <span className="mlb-bounce block">
          <svg viewBox="0 0 100 100" className="mlb-spin w-16 h-16">
            <defs>
              <radialGradient id="mlbLeather" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="62%" stopColor="#f7f4ef" />
                <stop offset="100%" stopColor="#d8d2c8" />
              </radialGradient>
              <radialGradient id="mlbShine" cx="32%" cy="26%" r="34%">
                <stop offset="0%" stopColor="#fff" stopOpacity=".95" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#mlbLeather)" />
            <circle cx="50" cy="50" r="46" fill="url(#mlbShine)" />
            <path d="M22 12 C 36 30, 36 70, 22 88" fill="none" stroke="#c81e1e" strokeWidth="2" strokeLinecap="round" />
            <path d="M78 12 C 64 30, 64 70, 78 88" fill="none" stroke="#c81e1e" strokeWidth="2" strokeLinecap="round" />
            <g stroke="#c81e1e" strokeWidth="1.7" strokeLinecap="round">
              {[[26,21,32.5,17],[29.5,29,36,25.5],[31.5,38,38,35.5],[32.3,47,39,46],[32.3,56,39,57],[31.5,65,38,67.5],[29.5,74,36,77.5],[26,82,32.5,86],
                [74,21,67.5,17],[70.5,29,64,25.5],[68.5,38,62,35.5],[67.7,47,61,46],[67.7,56,61,57],[68.5,65,62,67.5],[70.5,74,64,77.5],[74,82,67.5,86]]
                .map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
            </g>
            <circle cx="50" cy="50" r="46" fill="none" stroke="#000" strokeOpacity=".1" strokeWidth="1.2" />
          </svg>
        </span>
      </div>
      <span className="mlb-shadow block w-12 h-1.5 rounded-full bg-slate-900 dark:bg-black mt-1.5" />
      <span className="mt-5 text-[11px] font-extrabold tracking-[0.2em] uppercase text-slate-400">{label}</span>
    </div>
  );
  // The ball ALWAYS sits dead-centre of the screen so it never jumps between
  // loads. full = cold start (covers the page); otherwise it floats over the
  // page, see-through and untouchable, so the header and tab bar stay usable.
  return full
    ? <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-50 dark:bg-slate-950">{ball}</div>
    : <div className="fixed inset-0 z-[5] flex items-center justify-center pointer-events-none">{ball}</div>;
}

// ═══ Skeleton loading cards (football-app polish) ═══
// Grey pulsing placeholders shaped like the real content, so the app
// feels loaded before the data lands - no bare "Loading…" text.
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
      <span className="flex-1 space-y-1.5">
        <span className="block h-3 w-2/5 rounded bg-slate-200 dark:bg-slate-800" />
        <span className="block h-2 w-1/4 rounded bg-slate-100 dark:bg-slate-800/60" />
      </span>
      <span className="w-11 h-5 rounded bg-slate-100 dark:bg-slate-800/60 shrink-0" />
    </div>
  );
}
function SkeletonCards({ cards = 3, rows = 3 }) {
  return (
    <div className="space-y-3 animate-pulse mt-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-4 pt-3 pb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800" />
            <span className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <span className="ml-auto h-4 w-20 rounded-full bg-slate-100 dark:bg-slate-800/60" />
          </div>
          {Array.from({ length: rows }).map((_, j) => <SkeletonRow key={j} />)}
        </div>
      ))}
    </div>
  );
}
const HRB_VERSION = "v135";
// Crash reporter that survives React unmounting: writes straight to the DOM.
if (typeof window !== "undefined" && !window.__hrbTrap) {
  window.__hrbTrap = true;
  const show = (msg) => {
    try {
      let el = document.getElementById("hrb-crash");
      if (!el) {
        el = document.createElement("div");
        el.id = "hrb-crash";
        el.style.cssText = "position:fixed;top:env(safe-area-inset-top,8px);left:8px;right:8px;z-index:99999;background:#dc2626;color:#fff;font:700 11px -apple-system,sans-serif;padding:10px 12px;border-radius:12px;word-break:break-word;box-shadow:0 4px 16px rgba(0,0,0,.3)";
        el.onclick = () => el.remove();
        document.body.appendChild(el);
      }
      el.textContent = "⚠️ " + msg + " (tap to dismiss)";
    } catch {}
  };
  window.addEventListener("error", (e) => {
    const err = e.error || {};
    const parts = [err.name, err.message || e.message, e.filename ? "@" + String(e.filename).split("/").pop() + ":" + e.lineno + ":" + e.colno : ""];
    show(parts.filter(Boolean).join(" ") || String(e));
  });
  window.addEventListener("unhandledrejection", (e) => show("async: " + String((e.reason && e.reason.message) || e.reason)));
}
// Accents, periods, and Jr./Sr./II/III suffixes all dropped so
// "Luis García Jr." (MLB) matches "Luis Garcia" (Savant/Airtable).
const hrbNrm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[\u0131\u0130]/g, "i").replace(/\u00f8/g, "o").replace(/\u0142/g, "l") // dotless ı, ø, ł
  .replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
const ABBR_TO_NAME = Object.fromEntries(Object.entries(NAME_TO_ABBR).map(([n, a]) => [a, n]));
// Matchup-aware barrel: use the hitter's split vs the opposing SP's hand
// when it exists in Airtable, otherwise fall back to overall Barrel %.
const brlVsHand = (hm, hand) =>
  hand === "L" ? (hm.brlL != null ? hm.brlL : hm.barrel)
  : hand === "R" ? (hm.brlR != null ? hm.brlR : hm.barrel)
  : hm.barrel;

// Weather multiplier (temp above/below 72°F, wind blowing out/in); domes = 1.
function hrbWxFactor(w) {
  if (!w || w.temp == null) return 1;
  let f = 1 + Math.max(-0.08, Math.min(0.08, (Number(w.temp) - 72) * HRB.wxTempPer));
  const wind = String(w.wind || "").toLowerCase();
  const mph = parseFloat(wind) || 0;
  if (wind.includes("out")) f += Math.min(0.12, mph * HRB.wxWindPer);
  else if (wind.includes("in")) f -= Math.min(0.12, mph * HRB.wxWindPer);
  return Math.max(0.8, Math.min(1.25, f));
}
// v92: batched people lookup - bat/pitch hands PLUS season hitting (HR, PA)
// and pitching (HR allowed, W-L, ground-out share) in one hydrate.
async function hrbPeopleStats(idList) {
  const out = {};
  const ipToNum = (ip) => { const [w, f] = String(ip || "0").split("."); return Number(w) + (Number(f || 0) / 3); };
  for (let i = 0; i < idList.length; i += 90) {
    const chunk = idList.slice(i, i + 90);
    try {
      const ppl = await (await mlbFetch(`v1/people?personIds=${chunk.join(",")}&hydrate=stats(group=[hitting,pitching],type=[season])`)).json();
      for (const person of ppl.people || []) {
        const grp = (name) => {
          const st = (person.stats || []).find((x) => x.group && String(x.group.displayName).toLowerCase() === name);
          return st && st.splits && st.splits[0] && st.splits[0].stat;
        };
        const hit = grp("hitting");
        const pit = grp("pitching");
        const go = pit && pit.groundOuts != null ? Number(pit.groundOuts) : null;
        const ao = pit && pit.airOuts != null ? Number(pit.airOuts) : null;
        out[person.id] = {
          bat: person.batSide && person.batSide.code,
          pitch: person.pitchHand && person.pitchHand.code,
          hr: hit && hit.homeRuns != null ? Number(hit.homeRuns) : null,
          pa: hit && hit.plateAppearances != null ? Number(hit.plateAppearances) : null,
          hra: pit && pit.homeRuns != null ? Number(pit.homeRuns) : null,
          rec: pit && pit.wins != null ? Math.round(pit.wins) + "-" + Math.round(pit.losses ?? 0) : null,
          era: pit && pit.era != null ? String(pit.era) : null,
          ip: pit ? ipToNum(pit.inningsPitched) : null,
          goPct: go != null && ao != null && go + ao > 0 ? (go / (go + ao)) * 100 : null,
          bf: pit && pit.battersFaced != null ? Number(pit.battersFaced) : null,
          kPct: pit && pit.strikeOuts != null && pit.battersFaced > 0 ? (Number(pit.strikeOuts) / Number(pit.battersFaced)) * 100 : null,
        };
      }
    } catch {}
  }
  return out;
}
// v92: team bullpen HR/9 (relievers-only split; falls back to the team's
// overall HR/9; null if the API says nothing - scorer then treats it as avg).
const hrbPenCache = {};
async function hrbBullpenHr9(teamIds, season) {
  const ipToNum = (ip) => { const [w, f] = String(ip || "0").split("."); return Number(w) + (Number(f || 0) / 3); };
  const out = {};
  await Promise.all(teamIds.map(async (tid) => {
    const key = tid + ":" + season;
    if (hrbPenCache[key] !== undefined) { out[tid] = hrbPenCache[key]; return; }
    let val = null;
    const pick = (j) => {
      const st = j && j.stats && j.stats[0] && j.stats[0].splits && j.stats[0].splits[0] && j.stats[0].splits[0].stat;
      if (!st || st.homeRuns == null) return null;
      const ip = ipToNum(st.inningsPitched);
      return ip > 0 ? (Number(st.homeRuns) / ip) * 9 : null;
    };
    try { val = pick(await (await mlbFetch(`v1/teams/${tid}/stats?stats=statSplits&group=pitching&sitCodes=rp&season=${season}`)).json()); } catch {}
    if (val == null) {
      try { val = pick(await (await mlbFetch(`v1/teams/${tid}/stats?stats=season&group=pitching&season=${season}`)).json()); } catch {}
    }
    hrbPenCache[key] = val;
    out[tid] = val;
  }));
  return out;
}

// ═══════════════ POSTSEASON PICTURE ══════════════════════════════
// Before October: the bracket as it stands today, projected from the standings
// (3 division winners + 3 wild cards per league; seeds 1–2 skip the Wild Card
// round; WC: 3 v 6 and 4 v 5 → DS: 1 v winner of 4/5, 2 v winner of 3/6), plus
// who's still in the hunt for the last wild card. Once playoff games are on
// the schedule, real series results take over round by round.
const SERIES_LEN = { F: 3, D: 5, L: 7, W: 7 };
const ROUND_NAME = { F: "Wild Card Series", D: "Division Series", L: "League Championship", W: "World Series" };
function PostseasonTab({ onSelectTeam }) {
  const { teams } = useLeagueData();
  const [po, setPo] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const yr = parseInt(String(CURRENT_SEASON).slice(0, 4), 10);
        const d = await (await mlbFetch(`v1/schedule?sportId=1&season=${yr}&gameTypes=F,D,L,W&hydrate=team,linescore`)).json();
        const games = (d.dates || []).flatMap((x) => x.games || []);
        const series = {};
        for (const g of games) {
          const a = g.teams.away.team.id, h = g.teams.home.team.id;
          const key = g.gameType + ":" + [a, h].sort((x, y) => x - y).join("-");
          const s = (series[key] = series[key] || { type: g.gameType, ids: [a, h], wins: {}, played: 0, next: null, desc: g.seriesDescription || ROUND_NAME[g.gameType] });
          const st = g.status && g.status.abstractGameState;
          if (st === "Final" && !/postpon|cancel/i.test((g.status && g.status.detailedState) || "")) {
            s.played++;
            const w = (g.teams.away.score ?? 0) > (g.teams.home.score ?? 0) ? a : h;
            s.wins[w] = (s.wins[w] || 0) + 1;
          } else if (!s.next) s.next = { date: g.gameDate, live: st === "Live", away: a, home: h, aScore: g.teams.away.score, hScore: g.teams.home.score, inning: g.linescore && g.linescore.currentInning, half: g.linescore && g.linescore.inningHalf };
        }
        if (alive) setPo(Object.values(series));
      } catch { if (alive) setPo([]); }
    })();
    return () => { alive = false; };
  }, []);

  const all = (teams && teams.teams) || [];
  const byId = Object.fromEntries(all.map((t) => [t.id, t]));
  const cmp = (a, b) => (b.pct ?? 0) - (a.pct ?? 0) || (b.diff ?? 0) - (a.diff ?? 0);
  const field = (lg) => {
    const ts = all.filter((t) => t.league === lg);
    const divWinners = ts.filter((t) => t.divRank === 1).sort(cmp);
    const rest = ts.filter((t) => t.divRank !== 1).sort(cmp);
    const wc = rest.slice(0, 3);
    const seeds = [...divWinners, ...wc].map((t, i) => ({ ...t, seed: i + 1, wc: i >= 3 }));
    const hunt = rest.slice(3, 8).map((t) => ({ ...t, back: t.wcGb }));
    return { seeds, hunt, cut: wc[2] };
  };
  const Logo = ({ t, size = "w-8 h-8" }) => (t && TEAM_LOGOS[t.abbr] ? <img src={TEAM_LOGOS[t.abbr]} alt={t.abbr} className={size + " object-contain shrink-0" + (WHITE_LOGOS.has(t.abbr) ? " dark:brightness-0 dark:invert" : "")} /> : <span className={size + " rounded-full shrink-0"} style={{ backgroundColor: t ? teamColor(t.abbr) : "#94a3b8" }} />);
  const TeamLine = ({ t, seed, right, dim }) => (
    <button onClick={t && onSelectTeam ? () => onSelectTeam(t) : undefined} className={"w-full flex items-center gap-2 py-1.5 text-left " + (dim ? "opacity-50" : "")}>
      <span className="w-4 text-[10px] font-extrabold text-slate-400 tabular-nums text-center">{seed ?? ""}</span>
      <Logo t={t} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold text-slate-900 dark:text-slate-100 truncate">{t ? t.abbr : "TBD"}{t && t.clinched ? <span className="ml-1.5 text-[8px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Clinched</span> : null}</span>
        {t && <span className="block text-[10px] font-semibold text-slate-400">{t.wins}-{t.losses}{t.wc ? " · WC" : t.division ? " · " + t.division.replace(/^(AL|NL) /, "") : ""}</span>}
      </span>
      {right != null && <span className="text-[15px] font-black tabular-nums text-slate-900 dark:text-white shrink-0">{right}</span>}
    </button>
  );
  const Series = ({ label, a, b, live, byeNote }) => {
    // real series first, else the projected pairing
    const real = a && b && po ? po.find((s) => s.ids.includes(a.id) && s.ids.includes(b.id)) : null;
    const wa = real ? real.wins[a.id] || 0 : null, wb = real ? real.wins[b.id] || 0 : null;
    const need = real ? Math.ceil(SERIES_LEN[real.type] / 2) : null;
    const over = real && (wa >= need || wb >= need);
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400">{label}</span>
          {real && <span className={"text-[9px] font-extrabold uppercase tracking-wide " + (over ? "text-emerald-600" : real.next && real.next.live ? "text-rose-500" : "text-slate-400")}>{over ? "Final" : real.next && real.next.live ? "Live" : "Best of " + SERIES_LEN[real.type]}</span>}
          {byeNote && <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{byeNote}</span>}
        </div>
        <TeamLine t={a} seed={a && a.seed} right={wa} dim={over && wa < wb} />
        <div className="border-t border-slate-100 dark:border-slate-800" />
        <TeamLine t={b} seed={b && b.seed} right={wb} dim={over && wb < wa} />
        {real && real.next && !over && (
          <div className="text-[10px] font-semibold text-slate-400 mt-1">{real.next.live ? `Now: ${(byId[real.next.away] || {}).abbr} ${real.next.aScore ?? 0}, ${(byId[real.next.home] || {}).abbr} ${real.next.hScore ?? 0} · ${real.next.half || ""} ${real.next.inning || ""}` : "Next: " + new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(real.next.date)) + " ET"}</div>
        )}
      </div>
    );
  };
  const League = ({ lg }) => {
    const { seeds, hunt, cut } = field(lg);
    const S = (n) => seeds.find((t) => t.seed === n) || null;
    // real round winners feed the next round when a series is decided
    const winnerOf = (a, b) => { const real = a && b && po ? po.find((s) => s.ids.includes(a.id) && s.ids.includes(b.id)) : null; if (!real) return null; const need = Math.ceil(SERIES_LEN[real.type] / 2); const w = real.ids.find((id) => (real.wins[id] || 0) >= need); return w ? { ...(byId[w] || {}), seed: (a.id === w ? a : b).seed } : null; };
    const wc45 = winnerOf(S(4), S(5)), wc36 = winnerOf(S(3), S(6));
    const ds1 = winnerOf(S(1), wc45), ds2 = winnerOf(S(2), wc36);
    const tc = lg === "AL" ? "#c8102e" : "#0c2340";
    return (
      <div className="mt-5">
        <div className="text-[11px] font-extrabold tracking-widest uppercase mb-2 px-1" style={{ color: tc }}>{lg === "AL" ? "American League" : "National League"}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Series label="Wild Card" a={S(3)} b={S(6)} />
            <Series label="Wild Card" a={S(4)} b={S(5)} />
          </div>
          <div className="space-y-2">
            <Series label="Division Series" a={S(2)} b={wc36} byeNote={!wc36 ? "2 seed · bye" : null} />
            <Series label="Division Series" a={S(1)} b={wc45} byeNote={!wc45 ? "1 seed · bye" : null} />
          </div>
        </div>
        <div className="mt-2"><Series label={lg + " Championship Series"} a={ds1} b={ds2} /></div>
        {hunt.length > 0 && (
          <div className="mt-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2">
            <div className="text-[9px] font-bold tracking-widest uppercase text-slate-400 mb-1">In the hunt · games back of WC3{cut ? " (" + cut.abbr + ")" : ""}</div>
            {hunt.map((t) => (
              <button key={t.id} onClick={onSelectTeam ? () => onSelectTeam(t) : undefined} className="w-full flex items-center gap-2 py-1 text-left">
                <Logo t={t} size="w-6 h-6" />
                <span className={"text-[12px] font-bold flex-1 truncate " + (t.eliminated ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100")}>{t.abbr} <span className="text-[10px] font-semibold text-slate-400">{t.wins}-{t.losses}</span></span>
                <span className={"text-[12px] font-black tabular-nums " + (t.eliminated ? "text-slate-400" : "text-rose-500")}>{t.eliminated ? "Out" : t.back != null ? t.back + " GB" : ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };
  const wsA = po && po.find((s) => s.type === "W");
  const ws = wsA ? [byId[wsA.ids[0]], byId[wsA.ids[1]]] : null;
  const real = po && po.length > 0;
  if (!teams) return <BallLoader label="Loading the postseason picture" full={false} />;
  return (
    <div className="pb-4">
      <div className="text-[11px] font-semibold text-slate-400 mt-3 px-1">{real ? "Live series results from MLB · seeds from the final standings" : "Projected from today's standings · 3 division winners + 3 wild cards per league · seeds 1–2 skip the Wild Card round"}</div>
      {ws && <div className="mt-4"><div className="text-[11px] font-extrabold tracking-widest uppercase mb-2 px-1 text-amber-600">World Series</div><Series label="World Series" a={ws[0]} b={ws[1]} /></div>}
      <League lg="AL" />
      <League lg="NL" />
    </div>
  );
}

function HRBoardTab({ players, onSelectPlayer, resetSignal, onSelectTeam }) {
  const [data, setData] = useState(null);
  const [selGame, setSelGame] = useState(null);
  const [view, setView] = useState("matchups"); // matchups | bets | history
  const [bet, setBet] = useState("top");          // bets: top (ranked HR targets) | games (HR% by game)
  // Bottom "Matchups" button pressed → close any open game and go back to the main list.
  useEffect(() => { if (resetSignal) { setSelGame(null); setView("matchups"); window.scrollTo(0, 0); } }, [resetSignal]);
  const [history, setHistory] = useState(null);
  const [openPks, setOpenPks] = useState({});   // matchup accordion state
  const [streaks, setStreaks] = useState({});   // hitter id -> current hit streak
  const myByName = useMemo(() => {
    const m = {};
    // Keep ALL records sharing a name (e.g. both Max Muncys); meta()
    // resolves by team. Imports first so rostered records win ties.
    const add = (p) => { const k = hrbNrm(p.name); (m[k] = m[k] || []).push(p); };
    for (const p of window.__imports || []) add(p);
    for (const p of players || []) add(p);
    return m;
  }, [players]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const dayStr = (off) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() - off * 86400000));
        const [sched, standings] = await Promise.all([
          (await mlbFetch(`v1/schedule?sportId=1&date=${dayStr(0)}&hydrate=team,linescore,probablePitcher,decisions,venue`)).json(),
          mlbFetch("v1/standings?leagueId=103,104").then((r) => r.json()).catch(() => ({})),
        ]);
        const teamRec = {};
        for (const rec of standings.records || []) for (const tr of rec.teamRecords || []) {
          teamRec[tr.team.id] = {
            rec: (tr.wins ?? "") + "-" + (tr.losses ?? ""),
            streak: (tr.streak && tr.streak.streakCode) || "",
          };
        }
        const gs = ((sched.dates && sched.dates[0] && sched.dates[0].games) || [])
          .slice().sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
        // Today's boxscores (posted lineups) + weather in parallel
        const boxes = {};
        const wxByPk = {};
        await Promise.all(gs.flatMap((g) => [
          (async () => {
            try { boxes[g.gamePk] = await (await mlbFetch(`v1/game/${g.gamePk}/boxscore`)).json(); } catch {}
          })(),
          (async () => {
            try {
              const f = await (await mlbFetch(`v1.1/game/${g.gamePk}/feed/live?fields=gameData,weather,condition,temp,wind`)).json();
              if (f && f.gameData && f.gameData.weather && f.gameData.weather.temp) wxByPk[g.gamePk] = f.gameData.weather;
            } catch {}
          })(),
        ]));
        // Teams with no lineup yet -> most recent posted lineup (last 3 days)
        const need = new Set();
        for (const g of gs) for (const k of ["away", "home"]) {
          const b = boxes[g.gamePk];
          const order = b && b.teams && b.teams[k] && b.teams[k].battingOrder;
          if (!order || !order.length) need.add(g.teams[k].team && g.teams[k].team.id);
        }
        const prevByTeam = {};
        if (need.size) {
          try {
            const past = await (await mlbFetch(`v1/schedule?sportId=1&startDate=${dayStr(3)}&endDate=${dayStr(1)}`)).json();
            for (const d of past.dates || []) for (const pg of d.games || []) {
              for (const k of ["away", "home"]) {
                const tid = pg.teams[k].team && pg.teams[k].team.id;
                if (!need.has(tid)) continue;
                const cur = prevByTeam[tid];
                if (!cur || new Date(pg.gameDate) > new Date(cur.date)) prevByTeam[tid] = { pk: pg.gamePk, side: k, date: pg.gameDate };
              }
            }
            const pks = [...new Set(Object.values(prevByTeam).map((x) => x.pk))];
            const prevBoxes = {};
            await Promise.all(pks.map(async (pk) => {
              try { prevBoxes[pk] = await (await mlbFetch(`v1/game/${pk}/boxscore`)).json(); } catch {}
            }));
            for (const tid of Object.keys(prevByTeam)) prevByTeam[tid].box = prevBoxes[prevByTeam[tid].pk];
          } catch {}
        }
        // Assemble both sides of every game, collecting ids for one
        // batched people call (bat sides + pitch hands)
        const ids = new Set();
        const rows = gs.map((g) => {
          const sides = {};
          for (const k of ["away", "home"]) {
            const t = g.teams[k];
            const nm = (t.team && t.team.name) || "";
            const ab = NAME_TO_ABBR[nm.toLowerCase()] || toAbbr(nm) || "";
            const todayBox = boxes[g.gamePk];
            let order = (todayBox && todayBox.teams && todayBox.teams[k] && todayBox.teams[k].battingOrder) || [];
            let pmap = (todayBox && todayBox.teams && todayBox.teams[k] && todayBox.teams[k].players) || {};
            // Pin to the STARTING nine even mid-game: per-player battingOrder
            // codes ending in 00 are starters ("300"), subs are "301"+ — bets
            // are placed pregame, so the board must not drift with subs.
            if (order.length) {
              const starters = Object.values(pmap)
                .filter((pl) => pl.battingOrder != null && Number(pl.battingOrder) % 100 === 0)
                .sort((x, y) => Number(x.battingOrder) - Number(y.battingOrder))
                .map((pl) => pl.person && pl.person.id)
                .filter(Boolean);
              if (starters.length >= 9) order = starters;
            }
            const confirmed = order.length > 0;
            if (!confirmed) {
              const prev = prevByTeam[t.team && t.team.id];
              if (prev && prev.box && prev.box.teams && prev.box.teams[prev.side]) {
                order = prev.box.teams[prev.side].battingOrder || [];
                pmap = prev.box.teams[prev.side].players || {};
              }
            }
            const hitters = order.slice(0, 9).map((pid) => {
              ids.add(pid);
              const pd = pmap["ID" + pid] || {};
              return { id: pid, name: (pd.person && pd.person.fullName) || "" };
            });
            const pp = t.probablePitcher || null;
            if (pp && pp.id) ids.add(pp.id);
            const tr = teamRec[t.team && t.team.id] || {};
            sides[k] = { name: nm, abbr: ab, confirmed, hitters, rec: tr.rec || "", streak: tr.streak || "", pitcher: pp ? { id: pp.id, name: pp.fullName } : null };
          }
          return { g, sides, wx: wxByPk[g.gamePk] || null };
        });
        const all = [...ids];
        const hands = await hrbPeopleStats(all);
        // v92: opposing BULLPEN HR/9 per team (one call per team, cached)
        const teamIds = [...new Set(rows.flatMap((r) => ["away", "home"].map((k) => r.g.teams[k].team && r.g.teams[k].team.id).filter(Boolean)))];
        const penByTeam = await hrbBullpenHr9(teamIds, dayStr(0).slice(0, 4));
        for (const row of rows) for (const k of ["away", "home"]) {
          const s = row.sides[k];
          if (s.pitcher && hands[s.pitcher.id]) {
            s.pitcher.hand = hands[s.pitcher.id].pitch;
            s.pitcher.hra = hands[s.pitcher.id].hra;
            s.pitcher.rec = hands[s.pitcher.id].rec;
            s.pitcher.goPct = hands[s.pitcher.id].goPct;
            s.pitcher.era = hands[s.pitcher.id].era;
            s.pitcher.kPct = hands[s.pitcher.id].kPct;
            s.pitcher.bf = hands[s.pitcher.id].bf;
          }
          s.penHr9 = penByTeam[row.g.teams[k].team && row.g.teams[k].team.id] ?? null;
          for (const h of s.hitters) if (hands[h.id]) { h.bats = hands[h.id].bat; h.hr = hands[h.id].hr; h.pa = hands[h.id].pa; }
        }
        if (alive) setData(rows);
      } catch {
        if (alive) setData([]);
      }
    })();
    return () => { alive = false; };
  }, []);
  const todayLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit" }).format(new Date());
  // want = "hit" | "pit": with duplicate names (three Luis Garcias) only
  // consider records that carry that kind of stat, so a hitter can never
  // silently pick up a pitcher's Brl%-against.
  const meta = (name, abbr, want) => {
    let list = myByName[hrbNrm(name)];
    if (!list || !list.length) return {};
    if (list.length > 1 && want) {
      const isPit = (r) => r.hr9 != null || r.gb != null;
      const isHit = (r) => r.brlL != null || r.brlR != null || r.brlPa != null || (r.barrel != null && !isPit(r));
      const f = list.filter(want === "pit" ? isPit : isHit);
      if (f.length) list = f;
    }
    if (list.length > 1 && abbr) {
      const a = String(abbr).toLowerCase();
      const full = (ABBR_TO_NAME[abbr] || "").toLowerCase();
      for (let idx = list.length - 1; idx >= 0; idx--) {
        const t = String(list[idx].team || list[idx].teamName || "").toLowerCase();
        if (t && (t === a || (full && (t === full || t.includes(full) || full.includes(t))))) return list[idx];
      }
    }
    return list[list.length - 1];
  };
  // Rank every hitter on the slate: own Brl% + opposing SP's HR-proneness
  // + park, discounted if the lineup is only projected.
  const targets = [];
  const capped = (r) => Math.min(Math.max(r, 0.2), HRB.capRatio);
  for (const row of data || []) {
    const rank = row.g.venue && row.g.venue.name ? parkRankFor(row.g.venue.name) : null;
    const parkF = rank != null ? 1 + ((15.5 - rank) / 14.5) * HRB.parkSwing : 1;
    const wxF = hrbWxFactor(row.wx);
    for (const k of ["away", "home"]) {
      const s = row.sides[k];
      const oppSide = row.sides[k === "away" ? "home" : "away"];
      const opp = oppSide.pitcher;
      const om = opp ? meta(opp.name, oppSide.abbr, "pit") : {};
      const penR = oppSide.penHr9 != null ? oppSide.penHr9 / HRB.lgHr9 : null;
      for (let i = 0; i < s.hitters.length; i++) {
        const h = s.hitters[i];
        const hm = meta(h.name, s.abbr, "hit");
        // Hand-specific park: Rice (L) at Yankee Stadium gets the short
        // porch, a righty in the same game doesn't. Falls back to the
        // old rank-based factor when the venue isn't in the table.
        const plr = parkFactorLR(row.g.venue && row.g.venue.name, h.bats, opp && opp.hand);
        const ev = hrbEval({ hm, hApi: { hr: h.hr, pa: h.pa }, om, pApi: { goPct: opp && opp.goPct, kPct: opp && opp.kPct, bf: opp && opp.bf }, hand: opp && opp.hand, batHand: h.bats, spot: i, parkF: plr ? plr.f : parkF, wxF, confirmed: s.confirmed, penR });
        if (!ev) continue;
        let score = ev.score, prob = ev.prob;
        const stk = streaks[h.id];
        if (stk != null && stk <= -5) { score *= HRB.coldMult; prob *= HRB.coldMult; }
        targets.push({ h, spot: i, side: s, opp, oppAbbr: oppSide.abbr, oppHand: opp && opp.hand, brl: ev.adjBrl, brlPa: ev.brlPa, hrPa: ev.hrPa, oppBrl: ev.adjPitBrl, oppHr9: ev.adjHr9, oppGb: ev.adjGb, gbR: ev.gbR, penHr9: oppSide.penHr9, park: rank, parkLR: plr, score, prob, g: row.g, wx: row.wx, oppBbe: om.bbe, confirmed: s.confirmed });
      }
    }
  }
  targets.sort((a, b) => b.score - a.score);
  const top = [];
  const perTeam = {};
  for (const t of targets) {
    if ((perTeam[t.side.abbr] || 0) >= HRB.maxPerTeam) continue;
    perTeam[t.side.abbr] = (perTeam[t.side.abbr] || 0) + 1;
    top.push(t);
    if (top.length >= HRB.topN) break;
  }
  // Hide the BBE column entirely until batted-ball data exists in Airtable
  const [valProg, setValProg] = useState(null);
  const [valResult, setValResult] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hrbValidation") || "null"); } catch { return null; }
  });
  const [valWin, setValWin] = useState("recent");   // recent | prior
  const [valPA, setValPA] = useState(true);          // PA curve on/off
  const [showAdv, setShowAdv] = useState(false);     // history: show backtest tools
  const runValidation = async (days = 14) => {
    if (valProg && valProg !== "done") return;
    const dayStr = (off) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(Date.now() - off * 86400000));
    const agg = { all: [0, 0], p1: [0, 0], t5: [0, 0], t610: [0, 0], days: 0 };
    const bAgg = { all: [0, 0], p1: [0, 0], t5: [0, 0], t610: [0, 0] };
    const off0 = valWin === "prior" ? days : 0;
    // Data health: catches silent import corruption at a glance
    const snap = HRB_META_SNAPSHOT();
    const bat = Object.values(snap).filter((m) => m.barrel != null);
    const sps = Object.values(snap).filter((m) => m.hr9 != null);
    // Lineup match rate: of TODAY's loaded starters, how many resolve to a
    // stats row? Low rate = names in the stats table don't match lineups
    // (flipped "Last, First" imports, duplicates) => model runs blind.
    let luTot = 0, luHit = 0;
    const luMiss = [];
    for (const { sides } of data || []) for (const k of ["away", "home"]) for (const h of sides[k].hitters || []) {
      luTot++;
      if (myByName[hrbNrm(h.name)]) luHit++;
      else if (luMiss.length < 6) luMiss.push(h.name);
    }
    const dupes = Object.values(myByName).filter((l) => Array.isArray(l) && l.length > 1).length;
    const health = {
      nB: bat.length,
      avgBrl: bat.length ? (bat.reduce((a, m) => a + m.barrel, 0) / bat.length) : null,
      nP: sps.length,
      avgHr9: sps.length ? (sps.reduce((a, m) => a + m.hr9, 0) / sps.length) : null,
      luTot, luHit, luMiss, dupes,
    };
    for (let d = 1 + off0; d <= days + off0; d++) {
      setValProg(`${d - off0}/${days}`);
      try {
        const day = dayStr(d);
        const sched = await (await mlbFetch(`v1/schedule?sportId=1&date=${day}&hydrate=team,probablePitcher,venue`)).json();
        // Rank the FULL slate exactly like the live board does; the
        // evening-bettable distinction is applied at GRADING time below.
        const wkd = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date(day + "T12:00:00-04:00"));
        const wknd = wkd === "Sat" || wkd === "Sun";
        const hrET = (g) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(g.gameDate)));
        const gs = ((sched.dates && sched.dates[0] && sched.dates[0].games) || [])
          .filter((g) => g.status && g.status.abstractGameState === "Final");
        if (!gs.length) continue;
        const boxes = {};
        const wxV = {};
        await Promise.all(gs.flatMap((g) => [
          (async () => { try { boxes[g.gamePk] = await (await mlbFetch(`v1/game/${g.gamePk}/boxscore`)).json(); } catch {} })(),
          (async () => {
            try {
              const f = await (await mlbFetch(`v1.1/game/${g.gamePk}/feed/live?fields=gameData,weather,condition,temp,wind`)).json();
              if (f && f.gameData && f.gameData.weather && f.gameData.weather.temp) wxV[g.gamePk] = f.gameData.weather;
            } catch {}
          })(),
        ]));
        // v92: people stats for SPs AND every starter (HR/PA, hands, GO%)
        const pidSet = new Set(gs.flatMap((g) => ["away", "home"].map((k) => g.teams[k].probablePitcher && g.teams[k].probablePitcher.id).filter(Boolean)));
        for (const g of gs) { const b = boxes[g.gamePk]; if (!b || !b.teams) continue; for (const k of ["away", "home"]) for (const pl of Object.values((b.teams[k] && b.teams[k].players) || {})) if (pl.battingOrder != null && Number(pl.battingOrder) % 100 === 0 && pl.person) pidSet.add(pl.person.id); }
        const ppl = await hrbPeopleStats([...pidSet]);
        const hand = {};
        for (const id of Object.keys(ppl)) hand[id] = ppl[id].pitch;
        const tIds = [...new Set(gs.flatMap((g) => ["away", "home"].map((k) => g.teams[k].team && g.teams[k].team.id).filter(Boolean)))];
        const penV = await hrbBullpenHr9(tIds, day.slice(0, 4));
        const cands = [];
        for (const g of gs) {
          const box = boxes[g.gamePk];
          if (!box || !box.teams) continue;
          const rank = g.venue && g.venue.name ? parkRankFor(g.venue.name) : null;
          const parkF = rank != null ? 1 + ((15.5 - rank) / 14.5) * HRB.parkSwing : 1;
          const wxF = hrbWxFactor(wxV[g.gamePk]);
          for (const k of ["away", "home"]) {
            const t = g.teams[k];
            const ab = NAME_TO_ABBR[((t.team && t.team.name) || "").toLowerCase()] || "";
            const oppT = g.teams[k === "away" ? "home" : "away"];
            const oppAb = NAME_TO_ABBR[((oppT.team && oppT.team.name) || "").toLowerCase()] || "";
            const opp = oppT.probablePitcher || null;
            const om = opp ? meta(opp.fullName, oppAb, "pit") : {};
            const oh = opp ? hand[opp.id] : null;
            const pmap = (box.teams[k] && box.teams[k].players) || {};
            const starters = Object.values(pmap)
              .filter((pl) => pl.battingOrder != null && Number(pl.battingOrder) % 100 === 0)
              .sort((x, y) => Number(x.battingOrder) - Number(y.battingOrder));
            const penR = penV[oppT.team && oppT.team.id] != null ? penV[oppT.team.id] / HRB.lgHr9 : null;
            const pApi = opp && ppl[opp.id] ? { goPct: ppl[opp.id].goPct, kPct: ppl[opp.id].kPct, bf: ppl[opp.id].bf } : {};
            starters.forEach((pl, i) => {
              const nm = pl.person && pl.person.fullName;
              if (!nm) return;
              const hm = meta(nm, ab, "hit");
              const hApi = ppl[pl.person.id] || {};
              const plr = parkFactorLR(g.venue && g.venue.name, hApi.bat, oh);
              const ev = hrbEval({ hm, hApi: { hr: hApi.hr, pa: hApi.pa }, om, pApi, hand: oh, batHand: hApi.bat, spot: valPA ? i : 4, parkF: plr ? plr.f : parkF, wxF, confirmed: true, penR });
              if (!ev) return;
              const score = ev.score;
              const st = pl.stats && pl.stats.batting;
              cands.push({ team: ab, score, prob: ev.prob, hr: (st && st.homeRuns) || 0, bett: wknd || hrET(g) >= 16 });
            });
          }
        }
        cands.sort((a, b) => b.score - a.score);
        const picked = [];
        const perT = {};
        for (const c of cands) {
          if ((perT[c.team] || 0) >= HRB.maxPerTeam) continue;
          perT[c.team] = (perT[c.team] || 0) + 1;
          picked.push(c);
          if (picked.length >= HRB.topN) break;
        }
        if (picked.length < HRB.topN) continue;
        agg.days++;
        picked.forEach((c, i) => {
          const hit = c.hr > 0 ? 1 : 0;
          agg.all[0] += hit; agg.all[1]++;
          if (i === 0) { agg.p1[0] += hit; agg.p1[1]++; }
          if (i < 5) { agg.t5[0] += hit; agg.t5[1]++; } else { agg.t610[0] += hit; agg.t610[1]++; }
          if (c.bett) {
            bAgg.all[0] += hit; bAgg.all[1]++;
            if (i === 0) { bAgg.p1[0] += hit; bAgg.p1[1]++; }
            if (i < 5) { bAgg.t5[0] += hit; bAgg.t5[1]++; } else { bAgg.t610[0] += hit; bAgg.t610[1]++; }
          }
        });
      } catch {}
    }
    const out = { ver: HRB_VERSION + (valPA ? "" : " (linear spot)"), win: valWin, when: new Date().toISOString().slice(0, 10), health, ...agg, bett: bAgg };
    try { localStorage.setItem("hrbValidation", JSON.stringify(out)); } catch {}
    setValResult(out);
    setValProg("done");
  };
  const HRB_META_SNAPSHOT = () => {
    const out = {};
    for (const [k, list] of Object.entries(myByName)) {
      const m = Array.isArray(list) ? list[0] : list;
      if (m) out[k] = m;
    }
    return out;
  };
  const topIdsKey = targets.slice(0, 25).map((t) => t.h.id).join(",");
  useEffect(() => {
    if (!topIdsKey) return;
    let alive = true;
    (async () => {
      const ids = topIdsKey.split(",").filter((id) => streaks[id] == null);
      const out = {};
      await Promise.all(ids.map(async (pid) => {
        try {
          const gl = await (await mlbFetch(`v1/people/${pid}/stats?stats=gameLog&group=hitting`)).json();
          const splits = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
          const todayET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
          let n = 0;
          for (let j = splits.length - 1; j >= 0; j--) {
            if (splits[j].date === todayET) continue; // streak = entering today
            const st = splits[j].stat || {};
            if ((st.atBats ?? 0) === 0) continue; // skip games without an AB
            if ((st.hits ?? 0) > 0) { if (n < 0) break; n++; }
            else { if (n > 0) break; n--; }
          }
          out[pid] = n;
        } catch { out[pid] = 0; }
      }));
      if (alive && Object.keys(out).length) setStreaks((s) => ({ ...s, ...out }));
    })();
    return () => { alive = false; };
  }, [topIdsKey]);
  // Snapshot today's ranked list so History can grade it later
  useEffect(() => {
    if (!top.length) return;
    try {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
      const hist = JSON.parse(localStorage.getItem("hrbHistory") || "{}");
      // Freeze the day's board once first pitch happens anywhere: the graded
      // slate must match the PREGAME board bets were placed from.
      const games = data || [];
      const isStarted = ({ g }) => {
        const st = g.status && g.status.abstractGameState;
        return st === "Live" || st === "Final";
      };
      const startedN = games.filter(isStarted).length;
      const wkday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date());
      const isWeekend = wkday === "Sat" || wkday === "Sun";
      const hourET = (g) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(g.gameDate)));
      // Weekdays: a couple of matinees don't lock the board — freeze only
      // when the first afternoon/evening (4pm+ ET) game starts, or when
      // everything has started. Weekends (early games all day): majority.
      const shouldLock = games.length > 0 && (isWeekend
        ? startedN > games.length / 2
        : games.some((x) => isStarted(x) && hourET(x.g) >= 16) || startedN === games.length);
      if (hist[day] && shouldLock) return;
      hist[day] = { ver: HRB_VERSION, entries: top.map((t) => ({ id: t.h.id, name: t.h.name, team: t.side.abbr, score: Math.round(t.score), prob: t.prob != null ? Math.round(t.prob * 1000) / 10 : null, pk: t.g.gamePk, st: streaks[t.h.id] ?? null })), results: (hist[day] && hist[day].results) || null };
      localStorage.setItem("hrbHistory", JSON.stringify(hist));
    } catch {}
  }, [topIdsKey, streaks]);
  // Grade past days (which of the 15 homered) the first time History opens
  useEffect(() => {
    if (view !== "history") return;
    let alive = true;
    (async () => {
      let hist = {};
      try { hist = JSON.parse(localStorage.getItem("hrbHistory") || "{}"); } catch {}
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
      const boxCache = {};
      for (const day of Object.keys(hist)) {
        const h = hist[day];
        if (day >= today || h.results) continue;
        const results = {};
        for (const e of h.entries || []) {
          try {
            if (!boxCache[e.pk]) boxCache[e.pk] = await (await mlbFetch(`v1/game/${e.pk}/boxscore`)).json();
            const b = boxCache[e.pk];
            // -1 = didn't play (scratched / benched / postponed): excluded
            // from hit-rate and expected sums instead of counting as a miss.
            let hr = -1;
            for (const k of ["away", "home"]) {
              const pl = b.teams && b.teams[k] && b.teams[k].players && b.teams[k].players["ID" + e.id];
              const st = pl && pl.stats && pl.stats.batting;
              if (!st) continue;
              const pa = st.plateAppearances != null ? st.plateAppearances
                : (st.atBats || 0) + (st.baseOnBalls || 0) + (st.hitByPitch || 0) + (st.sacFlies || 0) + (st.sacBunts || 0);
              if (pa > 0) hr = st.homeRuns || 0;
            }
            results[e.id] = hr;
          } catch { results[e.id] = null; }
        }
        h.results = results;
      }
      try { localStorage.setItem("hrbHistory", JSON.stringify(hist)); } catch {}
      if (alive) setHistory(hist);
    })();
    return () => { alive = false; };
  }, [view]);
  const hasBbe = (data || []).some(({ sides }) =>
    ["away", "home"].some((k) => {
      const s = sides[k];
      const pm = s.pitcher ? meta(s.pitcher.name, s.abbr, "pit") : {};
      return pm.bbe != null;
    })
  );
  if (selGame) {
    const pri = (x) => { const st = x.status && x.status.abstractGameState; return st === "Live" ? 0 : st === "Final" ? 2 : 1; };
    const order = [...(data || [])].map((row) => row.g).sort((a, b) => pri(a) - pri(b) || new Date(a.gameDate) - new Date(b.gameDate));
    const i = order.findIndex((x) => x.gamePk === selGame.gamePk);
    const cur = i >= 0 ? order[i] : selGame;               // freshest copy of this game
    return (
      <HRBoundary key={"b" + cur.gamePk} onBack={() => setSelGame(null)}>
        <GameDetail key={cur.gamePk} g={cur} players={players} onSelectPlayer={onSelectPlayer} onBack={() => setSelGame(null)}
          index={i >= 0 ? i : 0} total={order.length || 1}
          onPrev={i > 0 ? () => { setSelGame(order[i - 1]); window.scrollTo(0, 0); } : null}
          onNext={i >= 0 && i < order.length - 1 ? () => { setSelGame(order[i + 1]); window.scrollTo(0, 0); } : null} />
      </HRBoundary>
    );
  }
  // ── Broadcast game card (one per game) ──
  const renderGameCard = ({ g, sides, wx }, mode = "open") => {
            const state = g.status && g.status.abstractGameState;
            const aScore = g.teams.away.score, hScore = g.teams.home.score;
            const scoreStr = aScore != null && hScore != null ? aScore + "-" + hScore : "";
            const inn = g.linescore && g.linescore.currentInning
              ? ((g.linescore.inningHalf || (g.linescore.isTopInning ? "Top" : "Bot")).toLowerCase().startsWith("top") ? "TOP " : "BOT ") + g.linescore.currentInning
              : "";
            const timeLabel = state === "Final" ? "Final " + scoreStr
              : state === "Live" ? "LIVE " + scoreStr + (inn ? " · " + inn : "")
              : new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(g.gameDate));
            const rank = g.venue && g.venue.name ? parkRankFor(g.venue.name) : null;
            const isOpen = mode === "bets" && !!openPks[g.gamePk];
            const streakBadge = (s) => {
              const m = /^([WL])(\d+)$/.exec(s.streak || "");
              if (!m || Number(m[2]) < 5) return null;
              return m[1] === "W"
                ? <span className="ml-1 text-[9px] font-extrabold text-white">W{m[2]}🔥</span>
                : <span className="ml-1 text-[9px] font-extrabold text-white/80">L{m[2]}❄️</span>;
            };
            return (
              <div key={g.gamePk}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-black/20 dark:border-white/10 shadow-sm overflow-hidden">
                <button onClick={() => {
                    if (mode === "open") { setSelGame(g); window.scrollTo(0, 0); return; }
                    // (bets mode falls through to the accordion below)
                    const opening = !openPks[g.gamePk];
                    setOpenPks((o) => ({ ...o, [g.gamePk]: !o[g.gamePk] }));
                    if (opening) {
                      const need = ["away", "home"].flatMap((kk) => sides[kk].hitters.map((h2) => h2.id)).filter((pid) => streaks[pid] == null);
                      Promise.all(need.map(async (pid) => {
                        try {
                          const gl = await (await mlbFetch(`v1/people/${pid}/stats?stats=gameLog&group=hitting`)).json();
                          const sp2 = (gl.stats && gl.stats[0] && gl.stats[0].splits) || [];
                          const todayET2 = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
                          let n2 = 0;
                          for (let j2 = sp2.length - 1; j2 >= 0; j2--) {
                            if (sp2[j2].date === todayET2) continue;
                            const st2 = sp2[j2].stat || {};
                            if ((st2.atBats ?? 0) === 0) continue;
                            if ((st2.hits ?? 0) > 0) { if (n2 < 0) break; n2++; }
                            else { if (n2 > 0) break; n2--; }
                          }
                          return [pid, n2];
                        } catch { return [pid, 0]; }
                      })).then((pairs) => setStreaks((s2) => ({ ...s2, ...Object.fromEntries(pairs) })));
                    }
                  }}
                  style={{ backgroundImage: mode === "open" ? undefined
                    : `linear-gradient(100deg, ${bannerColor(sides.away.abbr)} 0%, ${bannerColor(sides.away.abbr)} 38%, ${shade(bannerColor(sides.away.abbr), -12)} 47%, ${shade(bannerColor(sides.home.abbr), -12)} 53%, ${bannerColor(sides.home.abbr)} 62%, ${bannerColor(sides.home.abbr)} 100%)` }}
                  className={"relative w-full text-left px-4 py-3 " + (mode === "open" ? "bg-white dark:bg-slate-900 active:bg-slate-50 dark:active:bg-slate-800" : "active:opacity-90")}>
<span className="block">
                    {mode === "open" ? <MatchCard pk={g.gamePk} g={g} sides={sides} state={state} /> : (<>
                    {/* ── Broadcast row: logo · score · center status · score · logo ──
                        Football-style banner: away colour on the left, home on the right. */}
                    <span className="relative flex items-center gap-1">
                      {["away", "home"].map((kk, idx) => {
                        const sd = sides[kk];
                        const sc = kk === "away" ? aScore : hScore;
                        const other = kk === "away" ? hScore : aScore;
                        const lost = state === "Final" && sc != null && other != null && sc < other;
                        const batting = state === "Live" && g.linescore && g.linescore.currentInning != null &&
                          ((String(g.linescore.inningHalf || (g.linescore.isTopInning ? "Top" : "Bot")).toLowerCase().startsWith("top") ? "away" : "home") === kk);
                        const logo = (
                          <span key="lg" className="relative shrink-0">
                            {TEAM_LOGOS[sd.abbr]
                              ? <img src={TEAM_LOGOS[sd.abbr]} alt="" className={"w-[68px] h-[68px] object-contain drop-shadow-lg " + (lost ? "opacity-50" : "") + logoFx(sd.abbr)} />
                              : <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-extrabold" style={{ color: teamColor(sd.abbr) }}>{sd.abbr}</span>}
                            
                          </span>
                        );
                        const score = sc != null && state !== "Preview" ? (
                          <span key="sc" className={"text-[28px] leading-none font-black tabular-nums drop-shadow " + (lost ? "text-white/55" : "text-white")}>{sc}</span>
                        ) : <span key="sc" />;
                        return (
                          <span key={kk} className={"flex-1 min-w-0 flex items-center gap-2 " + (idx === 0 ? "" : "flex-row-reverse")}>
                            {logo}
                            {score}
                          </span>
                        );
                      })}
                      {/* center status pill */}
                      <span className="absolute left-1/2 -translate-x-1/2 shrink-0 text-center pointer-events-none">
                        {state === "Live" ? (
                          <span className="block rounded-lg bg-black/45 backdrop-blur-sm px-2.5 py-1">
                            <span className="block text-[13px] font-extrabold text-white tabular-nums leading-tight">
                              {g.linescore && g.linescore.currentInning != null ? g.linescore.currentInning : ""}
                              <span className="ml-0.5">{g.linescore && String(g.linescore.inningHalf || (g.linescore.isTopInning ? "Top" : "Bot")).toLowerCase().startsWith("top") ? "▲" : "▼"}</span>
                            </span>
                            <span className="block text-[8px] font-extrabold uppercase tracking-wider text-white/75">
                              {g.linescore && g.linescore.outs != null ? g.linescore.outs + " OUT" + (g.linescore.outs === 1 ? "" : "S") : "LIVE"}
                            </span>
                          </span>
                        ) : state === "Final" ? (
                          <span className="block rounded-lg bg-black/40 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/90">Final</span>
                        ) : (
                          <span className="block text-[13px] font-extrabold text-white tabular-nums drop-shadow">{timeLabel}</span>
                        )}
                      </span>
                    </span>
                    {/* ── abbr · record · probable, under each logo ── */}
                    <span className="flex items-start gap-3 mt-1.5">
                      {["away", "home"].map((kk, idx) => {
                        const sd = sides[kk];
                        const era = sd.pitcher && sd.pitcher.era != null && sd.pitcher.era !== "" && !/^-/.test(String(sd.pitcher.era)) ? String(sd.pitcher.era) : null;
                        return (
                          <span key={kk} className={"flex-1 min-w-0 " + (idx === 0 ? "text-left" : "text-right")}>
                            <span className="block text-[13px] font-extrabold leading-tight text-white drop-shadow-sm">
                              {sd.abbr} <span className="text-[10px] font-semibold text-white/70 tabular-nums">{sd.rec}</span>{streakBadge(sd)}
                            </span>
                            {state === "Final" && g.decisions && (g.decisions.winner || g.decisions.loser)
                              ? (() => {
                                  const won = (g.teams[kk].score ?? 0) > (g.teams[kk === "away" ? "home" : "away"].score ?? 0);
                                  const d = g.decisions;
                                  return (
                                    <>
                                      {won && d.winner && <span className="block text-[10px] font-bold text-white/90 truncate leading-tight mt-0.5"><span className="text-emerald-300 font-black">W</span> {d.winner.fullName}</span>}
                                      {!won && d.loser && <span className="block text-[10px] font-bold text-white/90 truncate leading-tight mt-0.5"><span className="text-rose-300 font-black">L</span> {d.loser.fullName}</span>}
                                      {won && d.save && <span className="block text-[10px] font-bold text-white/80 truncate leading-tight"><span className="text-sky-200 font-black">SV</span> {d.save.fullName}</span>}
                                    </>
                                  );
                                })()
                              : sd.pitcher
                              ? <>
                                  <span className="block text-[10px] font-bold text-white/85 truncate leading-tight mt-0.5">{sd.pitcher.name}{sd.pitcher.rec ? " (" + sd.pitcher.rec + ")" : ""}</span>
                                  <span className="block text-[10px] font-extrabold tabular-nums leading-tight text-white">{era ? era + " ERA" : "— ERA"}</span>
                                </>
                              : <span className="block text-[10px] font-semibold text-white/65 leading-tight mt-0.5">Pitcher TBD</span>}
                          </span>
                        );
                      })}
                    </span>
                    {state === "Live" && mode === "bets" && <LiveStrip pk={g.gamePk} />}
                    </>)}
                    {mode === "bets" && <span className="flex justify-center">
                      <span className={"text-white/60 text-[9px] transition-transform inline-block " + (isOpen ? "rotate-90" : "")}>▶</span>
                    </span>}
                  </span>
                </button>
                {isOpen && <div>
                {(g.venue && g.venue.name) || wx ? (
                  <div className="flex items-center justify-between gap-2 px-4 py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 truncate">
                      {(g.venue && g.venue.name) || ""}
                      {rank != null && <span className={"font-extrabold " + parkRankColor(rank)}> ({ordinalize(rank)})</span>}
                    </span>
                    {wx && (
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                        {wxEmoji(wx.condition)} {wx.temp}°{wx.wind ? " · 💨 " + wx.wind : ""}
                      </span>
                    )}
                  </div>
                ) : null}
                {["away", "home"].map((k) => {
                  const s = sides[k];
                  const logo = TEAM_LOGOS[s.abbr];
                  const pm = s.pitcher ? meta(s.pitcher.name, s.abbr, "pit") : {};
                  const oppSP = sides[k === "away" ? "home" : "away"].pitcher;
                  const oppHand = oppSP && oppSP.hand;
                  return (
                    <div key={k} className={"px-4 py-3 " + (k === "home" ? "border-t border-slate-100 dark:border-slate-800" : "")}>
                      <div className="flex items-center gap-2">
                        {logo ? (
                          <img src={logo} alt="" className="w-6 h-6 rounded-full object-contain bg-white shrink-0" />
                        ) : (
                          <span className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: teamColor(s.abbr) }} />
                        )}
                        <span className="text-sm font-extrabold" style={{ color: teamColor(s.abbr) }}>{s.abbr}</span>
                        <span className={"ml-auto text-[9px] font-extrabold px-2 py-0.5 rounded-full " + (s.confirmed ? "bg-emerald-500 text-white" : s.hitters.length ? "bg-amber-400 text-slate-900" : CHIP.none)}>
                          {s.confirmed ? "LINEUP CONFIRMED" : s.hitters.length ? "PROJECTED LINEUP" : "NO LINEUP"}
                        </span>
                      </div>
                      <div className="flex items-end gap-2 mt-2">
                        <span className="flex items-center gap-2 flex-1 min-w-0 pb-0.5">
                          <span className="w-9 text-center text-[10px] font-extrabold text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded px-1 py-0.5 shrink-0">
                            {s.pitcher && s.pitcher.hand ? s.pitcher.hand + "HP" : "SP"}
                          </span>
                          <span className="min-w-0 text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {s.pitcher ? s.pitcher.name : "TBD"}
                            {s.pitcher && s.pitcher.era != null && (
                              <span className="ml-1.5 text-[10px] font-bold text-slate-400 tabular-nums">{s.pitcher.era} ERA</span>
                            )}
                          </span>
                        </span>
                        <span className="w-11 text-center shrink-0">
                          <span className="block text-[7px] font-extrabold text-slate-400 uppercase tracking-wide">Brl%</span>
                          <span className={"block text-[10px] font-extrabold rounded px-1 py-0.5 tabular-nums " + hrbPitBrlClass(pm.barrel)}>
                            {pm.barrel != null ? Number(pm.barrel).toFixed(1) + "%" : "—"}
                          </span>
                        </span>
                        <span className="w-11 text-center shrink-0">
                          <span className="block text-[7px] font-extrabold text-slate-400 uppercase tracking-wide">GB%</span>
                          <span className={"block text-[10px] font-extrabold rounded px-1 py-0.5 tabular-nums " + hrbGbClass(pm.gb)}>
                            {pm.gb != null ? Number(pm.gb).toFixed(0) + "%" : "—"}
                          </span>
                        </span>
                        <span className="w-11 text-center shrink-0">
                          <span className="block text-[7px] font-extrabold text-slate-400 uppercase tracking-wide">HR/9</span>
                          <span className={"block text-[10px] font-extrabold rounded px-1 py-0.5 tabular-nums " + hrbHr9Class(pm.hr9)}>
                            {pm.hr9 != null ? Number(pm.hr9).toFixed(2) : "—"}
                          </span>
                        </span>
                      </div>
                      {(s.penHr9 != null || pm.bbe != null) && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="flex-1 min-w-0 flex items-center justify-between pl-11">
                            <span className={"text-[9px] font-bold tabular-nums " + (pm.bbe != null && pm.bbe < 60 ? "text-rose-500" : "text-slate-400")}>
                              {pm.bbe != null ? Math.round(pm.bbe) + " BBE" : ""}
                            </span>
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">{s.penHr9 != null ? "Bullpen" : ""}</span>
                          </span>
                          <span className="w-11 shrink-0" />
                          <span className="w-11 shrink-0" />
                          <span className="w-11 text-center shrink-0">
                            {s.penHr9 != null && (
                              <span className={"block text-[10px] font-extrabold rounded px-1 py-0.5 tabular-nums " + hrbHr9Class(Number(s.penHr9))}>
                                {Number(s.penHr9).toFixed(2)}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 space-y-1">
                        {s.hitters.map((h, i) => {
                          const hm = meta(h.name, s.abbr, "hit");
                          const hb = brlVsHand(hm, oppHand);
                          return (
                            <div key={h.id} className="flex items-center gap-2">
                              <span className="w-4 text-center text-[10px] font-extrabold text-slate-300 dark:text-slate-600 tabular-nums shrink-0">{i + 1}</span>
                              <span className="w-4 text-center text-[10px] font-extrabold text-slate-500 dark:text-slate-200 shrink-0">{h.bats || ""}</span>
                              <span className="flex-1 min-w-0 text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{h.name} <InjBadge name={h.name} team={s.abbr} /></span>
                              <span className={"w-11 text-center text-[10px] font-extrabold rounded px-1 py-0.5 tabular-nums shrink-0 " + hrbHitClass(hb)}>
                                {hb != null ? Number(hb).toFixed(1) + "%" : "—"}
                              </span>
                              <span className="w-11 shrink-0" />
                              <span className={"w-11 shrink-0 text-center text-[11px] font-extrabold " + (streaks[h.id] <= -5 ? "text-sky-400" : "text-orange-500")}>
                                {streaks[h.id] >= 5 ? streaks[h.id] + "🔥" : streaks[h.id] <= -5 ? (-streaks[h.id]) + "❄️" : ""}
                              </span>
                            </div>
                          );
                        })}
                        {s.hitters.length === 0 && (
                          <div className="text-[11px] text-slate-400 pl-6">No recent lineup found.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => setSelGame(g)}
                  className="w-full text-center text-[11px] font-extrabold text-blue-600 dark:text-blue-400 py-2.5 border-t border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800">
                  Full breakdown ›
                </button>
                </div>}
              </div>
            );
  };

  // Live → Upcoming → Final, same grouping on Matchups and on Bets › By game.
  const renderGameList = (mode) => {
            // Broadcast grouping: live games first under a pulsing LIVE
            // header, then upcoming, then finals - same shape as the
            // football app's day groups.
            const pri = (g) => { const st = g.status && g.status.abstractGameState; return st === "Live" ? 0 : st === "Final" ? 2 : 1; };
            const sorted = [...data].sort((a, b) => pri(a.g) - pri(b.g) || new Date(a.g.gameDate) - new Date(b.g.gameDate));
            let lastBucket = null;
            return sorted.map((row) => {
              const bucket = pri(row.g);
              const showHead = bucket !== lastBucket;
              lastBucket = bucket;
              return (
                <React.Fragment key={"grp" + row.g.gamePk}>
                  {showHead && (
                    <div className={"flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase px-1 " + (bucket === 0 ? "text-rose-500" : "text-slate-400") + (lastBucket != null ? " pt-1" : "")}>
                      {bucket === 0
                        ? <span className="rounded px-2 py-0.5 text-[10px] font-black tracking-widest uppercase text-white bg-rose-600 shadow animate-pulse">Live</span>
                        : bucket === 1 ? "Upcoming" : "Final"}
                    </div>
                  )}
                  {renderGameCard(row, mode)}
                </React.Fragment>
              );
            });
  };

  return (
    <div>
      <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
        <div className="text-2xl font-extrabold tracking-tight">{view === "bets" ? "Bets" : view === "history" ? "History" : view === "playoffs" ? "Postseason" : "Matchups"} ({todayLabel}) <span role="button" onClick={() => window.__hrbRefetch && window.__hrbRefetch()}
              className="text-[10px] font-bold text-white/50 align-middle">
              {HRB_VERSION}{typeof window !== "undefined" && window.__hrbApiVer ? " · api " + window.__hrbApiVer : ""}{typeof window !== "undefined" && window.__hrbDataAt ? " · data " + window.__hrbDataAt + " ↻" : ""}
            </span></div>
      </div>
      <div className="px-4 pb-28">
        <div className="flex gap-2 mt-3">
          {[["matchups", "Matchups"], ["playoffs", "Postseason"], ["bets", "Bets"], ["history", "History"]].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)}
              className={"flex-1 py-2 rounded-full text-[10px] font-extrabold whitespace-nowrap " + (view === id
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-800")}>
              {label}
            </button>
          ))}
        </div>
        {view === "bets" && (
          <div className="flex gap-2 mt-3">
            {[["top", "HR Targets"], ["games", "HR% by Game"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setBet(k)}
                className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold " + (bet === k ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
                {lbl}
              </button>
            ))}
          </div>
        )}
        {view === "bets" && data == null && <BallLoader label="Loading today's board" full={false} />}
        {view === "bets" && data && data.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No MLB games today.</div>}
        {view === "bets" && bet === "top" && data && data.length > 0 && top.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No HR targets yet — lineups and probables aren't posted.</div>}
        {view === "bets" && bet === "games" && data && data.length > 0 && (
          <>
            <div className="text-[10px] text-slate-400 mt-3 mb-2 px-1">Tap a game for each side's HR% list.</div>
            <div className="space-y-3">{renderGameList("bets")}</div>
          </>
        )}
        {view === "bets" && bet === "top" && top.length > 0 && (
          <>
            <div className="text-[11px] font-bold tracking-widest uppercase mt-4 mb-2 px-1 text-slate-500 dark:text-slate-400">🎯 HR Targets</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {top.map((t, i) => (
                <button key={t.h.id + "-" + t.g.gamePk} onClick={() => setSelGame(t.g)}
                  className="w-full text-left px-3 py-1.5 active:bg-slate-50 dark:active:bg-slate-800">
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-center text-[11px] font-extrabold text-slate-400 tabular-nums shrink-0">{i + 1}</span>
                    <img src={"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png,q_auto:best,f_auto/v1/people/" + t.h.id + "/headshot/silo/current"}
                      alt="" className="w-8 h-8 rounded-full object-cover object-top shrink-0"
                      style={{ backgroundColor: teamColor(t.side.abbr) + "26" }} loading="lazy" />
                    {TEAM_LOGOS[t.side.abbr] && <img src={TEAM_LOGOS[t.side.abbr]} alt={t.side.abbr} className="w-4 h-4 rounded-full object-contain bg-white shrink-0" />}
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
                      {t.h.bats ? t.h.bats + " " : ""}{t.h.name} <InjBadge name={t.h.name} team={t.side.abbr} />
                    </span>
                    {!t.confirmed && <span className="text-[8px] font-extrabold text-amber-500 uppercase shrink-0">proj</span>}
                    <span className="ml-auto min-w-0 flex items-center justify-end gap-1">
                      {TEAM_LOGOS[t.oppAbbr] && <img src={TEAM_LOGOS[t.oppAbbr]} alt={t.oppAbbr} className="w-3.5 h-3.5 rounded-full object-contain bg-white shrink-0" />}
                      <span className="min-w-0 text-[10px] font-semibold text-slate-400 truncate">
                        vs {t.oppHand ? t.oppHand + "HP " : ""}{t.opp ? t.opp.name : "TBD"}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 mt-0.5 pl-7">
                    <span className="w-8 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">Bat</span>
                      <span className="block text-[10px] font-extrabold text-slate-700 dark:text-slate-100 tabular-nums">{ordinalize(t.spot + 1)}</span>
                    </span>
                    <span className="w-11 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">Brl%</span>
                      <span className={"block text-[10px] font-extrabold rounded px-0.5 tabular-nums " + (t.brl != null ? hrbHitClass(t.brl) : "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300")}>
                        {t.brl != null ? Number(t.brl).toFixed(1) + "%" : "no data"}
                      </span>
                    </span>
                    <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0" />
                    <span className="w-11 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">SP Brl</span>
                      <span className={"block text-[10px] font-extrabold rounded px-0.5 tabular-nums " + hrbPitBrlClass(t.oppBrl)}>
                        {t.oppBrl != null ? Number(t.oppBrl).toFixed(1) + "%" : "—"}
                      </span>
                    </span>
                    <span className="w-11 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">SP HR9</span>
                      <span className={"block text-[10px] font-extrabold rounded px-0.5 tabular-nums " + hrbHr9Class(t.oppHr9)}>
                        {t.oppHr9 != null ? Number(t.oppHr9).toFixed(2) : "—"}
                      </span>
                    </span>
                    <span className="w-11 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">SP GB%</span>
                      <span className={"block text-[10px] font-extrabold rounded px-0.5 tabular-nums " + hrbGbClass(t.oppGb)}>
                        {t.oppGb != null ? Number(t.oppGb).toFixed(0) + "%" : "—"}
                      </span>
                    </span>
                    <span className="ml-auto w-12 text-center shrink-0">
                      <span className="block text-[7px] font-bold text-slate-400 uppercase">HR%</span>
                      <span className={"block text-[13px] font-extrabold " + HR_ACCENT + " tabular-nums"}>{t.prob != null ? (t.prob * 100).toFixed(0) + "%" : "—"}</span>
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2 mt-0.5 pl-7">
                    <span className="text-[9px] font-semibold text-slate-400 truncate">
                      {(t.g.venue && t.g.venue.name) || ""}
                      {t.parkLR != null
                        ? <span className={"font-extrabold " + (t.parkLR.shown >= 105 ? "text-emerald-500" : t.parkLR.shown <= 95 ? "text-rose-500" : "text-amber-500")}> ({t.parkLR.shown} vs {t.parkLR.hand})</span>
                        : t.park != null && <span className={"font-extrabold " + parkRankColor(t.park)}> ({ordinalize(t.park)})</span>}
                    </span>
                    {t.wx && (
                      <span className="text-[9px] font-semibold text-slate-400 shrink-0">
                        {wxEmoji(t.wx.condition)} {t.wx.temp}°{t.wx.wind ? " · 💨 " + t.wx.wind : ""}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="text-[9px] text-slate-400 mt-1.5 px-1">v100 · HR% = chance of at least one HR today. SP K% discounts the per-contact stats · same-hand platoon ×0.90 L/L, ×0.96 R/R · Hitter = Barrel/PA^{HRB.eBrlPa} × HR/PA^{HRB.eHrPa} · SP = Brl%^{HRB.eSpBrl} × HR/9^{HRB.eSpHr9} × GB%⁻¹^{HRB.eGb}, blended {Math.round(HRB.spShare * 100)}/{Math.round((1 - HRB.spShare) * 100)} with opposing bullpen HR/9 · × park × weather&nbsp;· park is hand-specific (100 = avg, damped) · expected PAs by lineup spot · projected ×{HRB.projMult}</div>
          </>
        )}
        {view === "matchups" && (<>
        <div className="text-[11px] font-bold tracking-widest uppercase mt-5 mb-2 px-1 text-slate-500 dark:text-slate-400">Matchups</div>
        <div className="space-y-3">
          {data == null && <BallLoader label="Loading today's games" full={false} />}
          {data && data.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No MLB games today.</div>}
          {data && renderGameList("open")}
        </div>
        </>)}
        {view === "playoffs" && <PostseasonTab onSelectTeam={onSelectTeam} />}
        {view === "history" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 px-4 py-2.5 text-[10px] font-semibold text-slate-500 dark:text-slate-300 leading-relaxed">
              Every day the Top 10 is frozen the first time the board loads, stamped with the formula version that made it. After the games end, each pick is graded from the box score: ✅ homered · — played but didn't · DNP scratched (doesn't count for or against). The scorecard shows whether HR% is telling the truth over time.
            </div>
            {showAdv && <div className="flex gap-2">
              {[["recent", "Last 14"], ["prior", "Prior 14"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setValWin(k)}
                  className={"flex-1 py-1.5 rounded-full text-[10px] font-extrabold " + (valWin === k ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 dark:text-slate-300")}>{lbl}</button>
              ))}
              <button onClick={() => setValPA((v) => !v)}
                className={"flex-1 py-1.5 rounded-full text-[10px] font-extrabold " + (valPA ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-800 dark:text-slate-300")}>
                {valPA ? "PA curve ON" : "PA curve OFF"}
              </button>
            </div>}
            {showAdv && <button onClick={() => runValidation(14)}
              disabled={valProg != null && valProg !== "done"}
              className="w-full text-center text-[11px] font-extrabold text-blue-600 dark:text-blue-400 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              {valProg == null ? "Validate current scoring (14-day backtest)" : valProg === "done" ? "Validation complete ✓ — re-run" : "Validating… " + valProg}
            </button>}
            {showAdv && valResult && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-blue-200 dark:border-blue-900 shadow-sm px-4 py-3">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500 mb-2">Validation · {valResult.ver} · {valResult.win === "prior" ? "prior" : "last"} 14 days · run {valResult.when}</div>
                {valResult.health && (
                  <div className="text-[9px] font-bold text-slate-400 mb-2">
                    <span className="block">Data health: {valResult.health.nB} batters, avg Brl {valResult.health.avgBrl != null ? valResult.health.avgBrl.toFixed(1) : "—"}% · {valResult.health.nP} SPs, avg HR/9 {valResult.health.avgHr9 != null ? valResult.health.avgHr9.toFixed(2) : "—"} · {valResult.health.dupes} duplicate names</span>
                    {valResult.health.luTot > 0 && (
                      <span className={"block " + ((valResult.health.luHit / valResult.health.luTot) < 0.8 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400")}>
                        Lineup match: {valResult.health.luHit}/{valResult.health.luTot} of today's starters found ({Math.round((valResult.health.luHit / valResult.health.luTot) * 100)}%)
                        {valResult.health.luMiss.length > 0 && " · missing: " + valResult.health.luMiss.join(", ")}
                      </span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[["All", valResult.all], ["#1 pick", valResult.p1], ["Top 5", valResult.t5], ["6-10", valResult.t610]].map(([lbl, [h, t]]) => (
                    <span key={lbl}>
                      <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                      <span className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{t ? `${h}/${t} (${Math.round((h / t) * 100)}%)` : "—"}</span>
                    </span>
                  ))}
                </div>
                {valResult.bett && (
                  <>
                    <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mt-3 mb-1">Bettable picks only (evening / weekend games)</div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[["All", valResult.bett.all], ["#1 pick", valResult.bett.p1], ["Top 5", valResult.bett.t5], ["6-10", valResult.bett.t610]].map(([lbl, [h, t]]) => (
                        <span key={"b" + lbl}>
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                          <span className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{t ? `${h}/${t} (${Math.round((h / t) * 100)}%)` : "—"}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {history == null && <div className="text-center text-sm text-slate-400 py-12">Grading past boards…</div>}
            {history != null && Object.keys(history).length === 0 && (
              <div className="text-center text-sm text-slate-400 py-12">No history yet — each day's Top {HRB.topN} is saved automatically from this device.</div>
            )}
            {history != null && (() => {
              // ═══ THE SCORECARD ═══ One question: is HR% telling the truth?
              // played  = graded picks that actually got in the game (DNP = -1 excluded)
              // homered = how many of those homered
              // expected= what HR% promised, summed over the same picks
              // Verdict: expected ÷ actual - near 1.0 = honest, >1.25 = too
              // bold (scale HRB.calibration down), <0.8 = too timid.
              const days = Object.values(history).filter((h) => h.results);
              if (!days.length) return null;
              let played = 0, homered = 0, exp = 0, dnp = 0;
              const bucket = (lo, hi) => {
                let hit = 0, tot = 0;
                for (const h of days) (h.entries || []).forEach((e, i) => {
                  if (i < lo || i > hi || h.results[e.id] === -1) return;
                  tot++; if ((h.results[e.id] || 0) > 0) hit++;
                });
                return tot ? `${hit}/${tot} (${Math.round((hit / tot) * 100)}%)` : "—";
              };
              for (const h of days) for (const e of h.entries || []) {
                if (h.results[e.id] === -1) { dnp++; continue; }
                played++;
                if ((h.results[e.id] || 0) > 0) homered++;
                if (e.prob != null) exp += e.prob / 100;
              }
              const ratio = homered > 0 ? exp / homered : null;
              return (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Scorecard · {days.length} graded day{days.length > 1 ? "s" : ""}</span>
                    {ratio != null && (
                      <span className={"text-[10px] font-extrabold " + (ratio > 1.25 ? "text-rose-500" : ratio < 0.8 ? "text-sky-500" : "text-emerald-500")}>
                        {ratio > 1.25 ? "HR% too bold" : ratio < 0.8 ? "HR% too timid" : "HR% honest"}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 tabular-nums mb-2">
                    {homered} of {played} picks homered ({played ? Math.round((100 * homered) / played) : 0}%) · HR% promised {exp.toFixed(1)}{dnp > 0 ? ` · ${dnp} DNP excluded` : ""}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[["#1 pick", bucket(0, 0)], ["Top 5", bucket(0, 4)], ["6-10", bucket(5, 14)]].map(([lbl, v]) => (
                      <span key={lbl}>
                        <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                        <span className="block text-[11px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            {history != null && Object.keys(history).sort().reverse().map((day) => {
              const h = history[day] || {};
              const entries = h.entries || [];
              const graded = h.results != null;
              const hits = graded ? entries.filter((e) => (h.results[e.id] || 0) > 0).length : null;
              const dnps = graded ? entries.filter((e) => h.results[e.id] === -1).length : 0;
              return (
                <div key={day} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-300">{day}{h.ver && <span className="ml-1 font-bold text-slate-400 dark:text-slate-500">· {h.ver}</span>}</span>
                    <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-300">
                      {(() => {
                        if (!graded) return "Pending — grades after games end";
                        const live = entries.filter((e) => h.results[e.id] !== -1);
                        const probs = live.map((e) => e.prob).filter((x) => x != null);
                        const exp = probs.length ? probs.reduce((a, b) => a + b, 0) / 100 : null;
                        return `${hits}/${live.length} homered` + (exp != null ? ` · expected ${exp.toFixed(1)}` : "") + (dnps ? ` · ${dnps} DNP` : "");
                      })()}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {entries.map((e, i) => {
                      const hr = graded ? h.results[e.id] : null;
                      return (
                        <div key={e.id + "-" + i} className="flex items-center gap-2 px-4 py-1.5">
                          <span className="w-4 text-center text-[10px] font-extrabold text-slate-400 tabular-nums shrink-0">{i + 1}</span>
                          {TEAM_LOGOS[e.team] && <img src={TEAM_LOGOS[e.team]} alt="" className="w-4 h-4 rounded-full object-contain bg-white shrink-0" />}
                          <span className="flex-1 min-w-0 text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{e.name}</span>
                          {e.prob != null && <span className={"text-[10px] font-bold " + HR_ACCENT + " tabular-nums shrink-0"}>{Math.round(e.prob)}%</span>}
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">{e.score}</span>
                          <span className="w-12 text-right text-[11px] font-extrabold shrink-0">
                            {hr == null && !graded ? <span className="text-slate-300 dark:text-slate-600">·</span>
                              : hr === -1 ? <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600">DNP</span>
                              : hr == null ? <span className="text-slate-300 dark:text-slate-600">—</span>
                              : hr > 0 ? <span className="text-emerald-500">✅{hr > 1 ? " ×" + hr : ""}</span>
                              : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button onClick={() => setShowAdv((v) => !v)}
              className="w-full text-center text-[10px] font-bold text-slate-400 py-1">
              {showAdv ? "Hide advanced tools" : "Advanced: 14-day backtest"}
            </button>
            {history != null && Object.keys(history).length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm("Erase ALL saved history? This cannot be undone.")) {
                    try { localStorage.removeItem("hrbHistory"); } catch {}
                    setHistory({});
                  }
                }}
                className="w-full text-center text-[10px] font-bold text-slate-400 py-3">
                Reset history
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════ PLACEHOLDER TABS ════════════════════════════════
function ComingSoon({ icon, title, blurb }) {
  return (
    <div>
      <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
        <div className="text-2xl font-extrabold tracking-tight">{title}</div>
      </div>
      <div className="px-8 pt-24 pb-28 text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <div className="text-lg font-extrabold text-slate-700 dark:text-slate-200">{title} is coming soon</div>
        <div className="text-sm text-slate-400 mt-2 leading-relaxed">{blurb}</div>
      </div>
    </div>
  );
}

// ═══════════════ APP SHELL ═══════════════════════════════════════
const TABS = [
  { id: "hrboard", label: "Matchups", icon: "🎯" },
  { id: "teams", label: "Teams", icon: "⚾" },
  { id: "players", label: "Players", icon: "👤" },
  { id: "stats", label: "Stats", icon: "📊" },
];

export default function App() {
  useGlobalBackSwipe();
  const [tab, setTab] = useState("hrboard");
  const [navTap, setNavTap] = useState(0);   // bumps on every tab-bar press so the tab can return to its main page
  const [statsJump, setStatsJump] = useState(null);   // team-page tile → Stats › Teams with that team highlighted
  useEffect(() => {                          // live injury report: now, every 10 min, and when the app is reopened
    loadInjuries();
    const id = setInterval(loadInjuries, 10 * 60000);
    const onVis = () => { if (document.visibilityState === "visible") loadInjuries(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  const backY = useRef(0);                   // where the list was scrolled when a player page opened
  const openPlayer = (pl) => { backY.current = window.scrollY || 0; setSel(pl); window.scrollTo(0, 0); };
  const closePlayer = () => { const y = backY.current; setSel(null); requestAnimationFrame(() => window.scrollTo(0, y)); };
  const [sel, setSel] = useState(null);
  const [players, setPlayers] = useState(null);
  const [fatal, setFatal] = useState(null);
  useEffect(() => {
    const onErr = (e) => setFatal(String((e.error && e.error.message) || e.message || e.reason || e));
    const onRej = (e) => setFatal("async: " + String((e.reason && e.reason.message) || e.reason));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);
  const [teams, setTeams] = useState([]);
  const [selTeam, setSelTeam] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = (bust) => fetch("/api/contracts" + (bust ? "?t=" + Date.now() : ""))
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else {
        for (const t of d.teams || []) { const a = t.abbr || toAbbr(t.name); if (a && t.logo) TEAM_LOGOS[a] = t.logo; }
        // Different data sources abbreviate some teams differently
        for (const [x, y] of [["CWS","CHW"],["ARI","AZ"],["WSH","WSN"],["SF","SFG"],["SD","SDP"],["TB","TBR"],["KC","KCR"],["OAK","ATH"]]) {
          if (TEAM_LOGOS[x] && !TEAM_LOGOS[y]) TEAM_LOGOS[y] = TEAM_LOGOS[x];
          if (TEAM_LOGOS[y] && !TEAM_LOGOS[x]) TEAM_LOGOS[x] = TEAM_LOGOS[y];
        }
        setPlayers(d.players); setTeams(d.teams || []); window.__imports = d.imports || []; window.__hrbApiVer = d.apiVersion || "";
        window.__hrbDataAt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date());
      } })
      .catch((e) => setError(String(e)));
    load(false);
    window.__hrbRefetch = () => load(true);
  }, []);

  // The tab bar is ALWAYS on screen — player pages used to replace the whole app
  // (no way out but the back link). The tab underneath stays alive while a
  // player page is open, so backing out returns you to the same game / list.
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {sel && (
        <div className="pb-24">
          <PlayerDetail
            p={sel}
            onBack={closePlayer}
            backLabel={tab === "hrboard" ? "Matchups" : tab === "stats" ? "Leaders" : tab === "teams" ? (selTeam ? selTeam.name : "Teams") : "Players"}
            mode="full"
          />
        </div>
      )}
      <div style={sel ? { display: "none" } : undefined}>
      {error && (
        <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl px-4 py-3">
          Couldn't load data: {error}
        </div>
      )}
      {!players && !error && <BallLoader />}

      {players && tab === "teams" && !selTeam && (
        <TeamsTab teams={teams} players={players} onSelect={setSelTeam} onSelectPlayer={openPlayer} />
      )}
      {players && tab === "teams" && selTeam && (
        <TeamDetail
          team={selTeam} teams={teams}
          players={players}
          onBack={() => setSelTeam(null)}
          onSelectPlayer={openPlayer}
          onJumpStat={(key) => { setStatsJump({ catId: "teams", key, hl: selTeam.abbr || toAbbr(selTeam.name) }); setSel(null); setSelTeam(null); setTab("stats"); setNavTap((n) => n + 1); window.scrollTo(0, 0); }}
        />
      )}
      {fatal && (
        <div className="fixed inset-x-2 top-2 z-50 bg-red-600 text-white text-[11px] font-bold rounded-xl p-3 break-words shadow-lg" style={{ marginTop: "env(safe-area-inset-top)" }}>
          ⚠️ {fatal}
          <button className="block mt-1 underline" onClick={() => setFatal(null)}>dismiss</button>
        </div>
      )}
      {players && tab === "hrboard" && <HRBoardTab players={players} onSelectPlayer={openPlayer} resetSignal={navTap} onSelectTeam={(t) => { const tm = (teams || []).find((x) => (x.abbr || toAbbr(x.name)) === t.abbr); if (tm) { setTab("teams"); setSelTeam(tm); window.scrollTo(0, 0); } }} />}
      {players && tab === "players" && <PlayersTab players={players} onSelect={openPlayer} />}
      {players && tab === "stats" && <StatsTab players={players} onSelect={openPlayer} jump={statsJump} key={"st" + navTap} />}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex pb-[env(safe-area-inset-bottom)] z-20">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSel(null); setSelTeam(null); setStatsJump(null); setNavTap((n) => n + 1); window.scrollTo(0, 0); }}
            className={"flex-1 py-2.5 text-center " + (tab === t.id ? "text-blue-600" : "text-slate-400")}
          >
            <div className="text-lg leading-none">{t.icon}</div>
            <div className="text-[10px] font-bold mt-1">{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
