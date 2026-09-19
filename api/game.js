// /api/game?pk=<gamePk> — one game's live/final detail from MLB's live feed:
// score + inning, count / outs / runners, current batter vs pitcher, LAST PLAY
// (with exit velo + distance when it was put in play), scoring plays, every
// home run hit, line score, full box score with lineups, weather, decisions.
// The MLB twin of the NFL app's /api/game — one call replaces the four the
// game screen makes today (boxscore + linescore + feed + people).
//
//   /api/game?pk=776543
//   /api/game?pk=776543&raw=boxscore   MLB's untouched boxscore JSON
//   /api/game?pk=776543&raw=linescore  MLB's untouched linescore JSON
//     (raw = same shape the app reads today, for the Step 2 swap)
//
// Cached 15s while live so the screen ticks; 5 min pre-game; 1 hr when final.

const API = "https://statsapi.mlb.com/api";

const TEAM_ABBR = {
  108: "LAA", 109: "ARI", 110: "BAL", 111: "BOS", 112: "CHC", 113: "CIN", 114: "CLE", 115: "COL",
  116: "DET", 117: "HOU", 118: "KC", 119: "LAD", 120: "WSH", 121: "NYM", 133: "ATH", 134: "PIT",
  135: "SD", 136: "SEA", 137: "SF", 138: "STL", 139: "TB", 140: "TEX", 141: "TOR", 142: "MIN",
  143: "PHI", 144: "ATL", 145: "CWS", 146: "MIA", 147: "NYY", 158: "MIL",
};

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

const STATE = { Preview: "pre", Live: "in", Final: "post" };
const CACHE = { pre: "s-maxage=300, stale-while-revalidate=600", in: "s-maxage=15, stale-while-revalidate=30", post: "s-maxage=3600, stale-while-revalidate=7200" };
const num = (v) => { const n = Number(v); return v == null || v === "" || !Number.isFinite(n) ? null : n; };
const person = (p) => (p ? { id: p.id, name: p.fullName || "" } : null);

// Exit velo / launch angle / distance from the ball-in-play event, if any.
function hitData(play) {
  const ev = [...(play.playEvents || [])].reverse().find((e) => e.hitData);
  if (!ev) return null;
  const h = ev.hitData;
  return { ev: num(h.launchSpeed), la: num(h.launchAngle), dist: num(h.totalDistance) };
}

function playOut(play, teams) {
  const about = play.about || {}; const r = play.result || {};
  const half = about.halfInning === "bottom" ? "Bot" : "Top";
  return {
    text: r.description || "",
    event: r.event || null,                       // "Home Run", "Strikeout", "Single"…
    inning: about.inning ?? null,
    half,
    team: half === "Top" ? teams.away.abbr : teams.home.abbr,   // batting team
    batter: person((play.matchup || {}).batter),
    pitcher: person((play.matchup || {}).pitcher),
    rbi: r.rbi ?? 0,
    away: r.awayScore ?? null,
    home: r.homeScore ?? null,
    hit: hitData(play),
  };
}

function boxSide(box, gamePlayers) {
  const players = box.players || {};
  const get = (id) => players["ID" + id] || {};
  const hand = (id) => gamePlayers["ID" + id] || {};
  const batters = (box.batters || []).map((id) => {
    const p = get(id); const b = (p.stats || {}).batting || {}; const sb = (p.seasonStats || {}).batting || {};
    const order = p.battingOrder ? Number(p.battingOrder) : null;   // 100 = leadoff starter, 101 = his sub
    if (order == null) return null;                                   // pitchers listed but never batted
    return {
      id, name: (p.person || {}).fullName || "", pos: (p.position || {}).abbreviation || "",
      slot: Math.floor(order / 100), starter: order % 100 === 0, bats: (hand(id).batSide || {}).code || null,
      ab: b.atBats ?? 0, r: b.runs ?? 0, h: b.hits ?? 0, rbi: b.rbi ?? 0, bb: b.baseOnBalls ?? 0, so: b.strikeOuts ?? 0,
      hr: b.homeRuns ?? 0, d: b.doubles ?? 0, t: b.triples ?? 0, sb: b.stolenBases ?? 0,
      avg: sb.avg || null, ops: sb.ops || null, seasonHr: sb.homeRuns ?? null,
    };
  }).filter(Boolean).sort((a, b) => a.slot - b.slot || (a.starter ? -1 : 1));
  const pitchers = (box.pitchers || []).map((id) => {
    const p = get(id); const s = (p.stats || {}).pitching || {}; const ss = (p.seasonStats || {}).pitching || {};
    return {
      id, name: (p.person || {}).fullName || "", throws: (hand(id).pitchHand || {}).code || null,
      ip: s.inningsPitched || "0.0", h: s.hits ?? 0, r: s.runs ?? 0, er: s.earnedRuns ?? 0, bb: s.baseOnBalls ?? 0,
      so: s.strikeOuts ?? 0, hr: s.homeRuns ?? 0, pitches: s.numberOfPitches ?? s.pitchesThrown ?? null,
      note: s.note || null,                                          // "(W, 12-6)"
      era: ss.era || null,
    };
  });
  // The posted lineup (9 starters in order) — what the HR Board keys off.
  const lineup = (box.battingOrder || []).map((id) => {
    const p = get(id);
    return { id, name: (p.person || {}).fullName || "", pos: (p.position || {}).abbreviation || "", bats: (hand(id).batSide || {}).code || null };
  });
  return { lineup, batters, pitchers };
}

async function probableStats(ids, gamePlayers) {
  const out = {};
  if (!ids.length) return out;
  try {
    const d = await getJson(`${API}/v1/people?personIds=${ids.join(",")}&hydrate=stats(group=[pitching],type=[season])`);
    for (const p of d.people || []) {
      const s = ((((p.stats || [])[0] || {}).splits || [])[0] || {}).stat || {};
      const ip = parseFloat(s.inningsPitched || "0"); const outs = Math.floor(ip) * 3 + Math.round((ip % 1) * 10);
      out[p.id] = {
        throws: (p.pitchHand || {}).code || ((gamePlayers["ID" + p.id] || {}).pitchHand || {}).code || null,
        w: s.wins ?? null, l: s.losses ?? null, era: s.era || null, whip: s.whip || null, ip: s.inningsPitched || null,
        so: s.strikeOuts ?? null, bb: s.baseOnBalls ?? null, hr: s.homeRuns ?? null,
        hr9: outs > 0 && s.homeRuns != null ? +((s.homeRuns * 27) / outs).toFixed(2) : null,
      };
    }
  } catch { /* season line is a nice-to-have; the game still renders */ }
  return out;
}

export default async function handler(req, res) {
  const q = req.query || {};
  const pk = String(q.pk || q.gamePk || q.event || "").replace(/\D/g, "");
  if (!pk) return res.status(400).json({ error: "pk (gamePk) required" });
  try {
    if (q.raw === "boxscore" || q.raw === "linescore") {
      const d = await getJson(`${API}/v1/game/${pk}/${q.raw}`);
      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
      return res.status(200).json(d);
    }

    const d = await getJson(`${API}/v1.1/game/${pk}/feed/live`);
    const gd = d.gameData || {}; const ld = d.liveData || {};
    const ls = ld.linescore || {}; const plays = ld.plays || {}; const all = plays.allPlays || [];
    const st = gd.status || {}; const state = STATE[st.abstractGameState] || "pre";
    const gamePlayers = gd.players || {};

    const side = (ha) => {
      const t = (gd.teams || {})[ha] || {}; const line = (ls.teams || {})[ha] || {};
      return {
        id: t.id ?? null, abbr: TEAM_ABBR[t.id] || String(t.abbreviation || "").toUpperCase(), name: t.name || "", short: t.teamName || "",
        logo: t.id ? `https://www.mlbstatic.com/team-logos/${t.id}.svg` : null,
        score: line.runs ?? (state === "pre" ? null : 0), hits: line.hits ?? null, errors: line.errors ?? null, lob: line.leftOnBase ?? null,
        record: t.record && t.record.wins != null ? `${t.record.wins}-${t.record.losses}` : null,
        linescores: (ls.innings || []).map((i) => ((i[ha] || {}).runs ?? null)),
      };
    };
    const teams = { home: side("home"), away: side("away") };

    // Last play = the most recent COMPLETED play (the current one has no description yet)
    const done = all.filter((p) => (p.about || {}).isComplete && (p.result || {}).description);
    const last = done.length ? playOut(done[done.length - 1], teams) : null;
    const off = ls.offense || {}; const def = ls.defense || {};

    const scoring = (plays.scoringPlays || []).map((i) => all[i]).filter(Boolean).map((p) => playOut(p, teams));
    const homeRuns = done.filter((p) => p.result.event === "Home Run").map((p) => playOut(p, teams));

    const pp = gd.probablePitchers || {};
    const ppIds = [pp.away, pp.home].filter(Boolean).map((p) => p.id);
    const ppStats = state === "post" ? {} : await probableStats(ppIds, gamePlayers);
    const probable = (p) => (p ? { id: p.id, name: p.fullName || "", ...(ppStats[p.id] || { throws: ((gamePlayers["ID" + p.id] || {}).pitchHand || {}).code || null }) } : null);

    const bx = (ld.boxscore || {}).teams || {};
    const dec = ld.decisions || {};
    const w = gd.weather || {};

    res.setHeader("Cache-Control", CACHE[state]);
    return res.status(200).json({
      id: Number(pk), state, detail: st.detailedState || "", completed: state === "post",
      date: (gd.datetime || {}).dateTime || null,
      inning: ls.currentInning ?? null, inningOrdinal: ls.currentInningOrdinal || null, inningHalf: ls.inningHalf || null,
      home: teams.home, away: teams.away,
      venue: gd.venue ? { id: gd.venue.id, name: gd.venue.name } : null,
      weather: w.condition || w.temp ? { condition: w.condition || null, temp: num(w.temp), wind: w.wind || null } : null,
      probables: { away: probable(pp.away), home: probable(pp.home) },
      situation: {
        balls: ls.balls ?? null, strikes: ls.strikes ?? null, outs: ls.outs ?? null,
        runners: { first: person(off.first), second: person(off.second), third: person(off.third) },
        batter: person(off.batter), onDeck: person(off.onDeck), pitcher: person(def.pitcher),
        battingTeam: ls.inningHalf ? (ls.inningHalf === "Top" ? teams.away.abbr : teams.home.abbr) : null,
        lastPlay: last ? last.text : null,
        last,                                                       // full record: event, batter, EV / distance
      },
      scoring, homeRuns,
      box: { away: boxSide(bx.away || {}, gamePlayers), home: boxSide(bx.home || {}, gamePlayers) },
      decisions: { winner: person(dec.winner), loser: person(dec.loser), save: person(dec.save) },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
