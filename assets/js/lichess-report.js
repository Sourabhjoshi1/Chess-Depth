// ChessDepth Academy - Lichess report: ratings, rating graph, openings, results and an automatic
// list of strengths and weaknesses, built from a player's PUBLIC Lichess data (no password needed).
// Used in the Student Area and on the admin page.  Data: https://lichess.org/api (free, CORS-enabled).
const API = "https://lichess.org/api";
const SPEEDS = ["bullet", "blitz", "rapid", "classical"];
const SPEED_NAME = { bullet: "Bullet", blitz: "Blitz", rapid: "Rapid", classical: "Classical", puzzle: "Puzzles" };
const CACHE_HOURS = 3;
const RECENT = 100, ANALYSED = 30;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => Math.round(x * 100);
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or blocked */ } },
};

// Opening families we teach in the Chess Lab (Lichess name prefix -> course id and name).
const COURSES = [
  ["Sicilian Defense: Dragon", "sicilian-dragon", "Sicilian Dragon"], ["Sicilian Defense: Najdorf", "najdorf", "Sicilian Najdorf"],
  ["Sicilian Defense", "sicilian-dragon", "Sicilian Dragon"], ["French Defense", "french-advance", "French Defence: Advance"],
  ["Caro-Kann Defense: Advance", "caro-advance", "Caro-Kann: Advance"], ["Caro-Kann Defense", "caro-classical", "Caro-Kann: Classical"],
  ["Italian Game", "italian-giuoco", "Italian Game"], ["Giuoco Piano", "italian-giuoco", "Italian Game"], ["Ruy Lopez", "ruy-lopez", "Ruy Lopez"],
  ["Scotch Game", "scotch", "Scotch Game"], ["Vienna", "vienna-gambit", "Vienna Gambit"], ["Evans Gambit", "evans-gambit", "Evans Gambit"],
  ["Scandinavian Defense", "scandinavian", "Scandinavian Defence"], ["Petrov", "petrov", "Petrov Defence"], ["Russian Game", "petrov", "Petrov Defence"],
  ["Pirc Defense", "pirc", "Pirc Defence"], ["London System", "london", "London System"], ["Queen's Pawn Game: London", "london", "London System"],
  ["Queen's Gambit Declined", "qgd-black", "Queen's Gambit Declined"], ["Slav Defense", "slav", "Slav Defence"],
  ["King's Indian Defense", "kid", "King's Indian Defence"], ["Nimzo-Indian Defense", "nimzo-indian", "Nimzo-Indian Defence"],
  ["Queen's Indian Defense", "queens-indian", "Queen's Indian Defence"], ["Grünfeld Defense", "grunfeld", "Grünfeld Defence"],
  ["Dutch Defense", "dutch-stonewall", "Dutch Stonewall"], ["English Opening", "english", "English Opening"], ["Catalan Opening", "catalan", "Catalan"],
];
const courseFor = (name) => COURSES.find(([p]) => name.startsWith(p));
const family = (name) => String(name || "Unknown").split(":")[0].trim();

// ---------- fetching ----------
async function getJSON(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (r.status === 404) throw Object.assign(new Error("We couldn't find that Lichess username."), { code: "not-found" });
  if (r.status === 429) throw Object.assign(new Error("Lichess is busy right now. Please try again in a minute."), { code: "busy" });
  if (!r.ok) throw new Error("Lichess didn't respond (" + r.status + "). Please try again later.");
  return r.json();
}
// Stream NDJSON games, reporting progress as each game arrives (Lichess sends about 5 games a second).
async function getGames(username, params, onGame) {
  const r = await fetch(`${API}/games/user/${encodeURIComponent(username)}?${new URLSearchParams(params)}`, { headers: { Accept: "application/x-ndjson" } });
  if (r.status === 429) throw Object.assign(new Error("Lichess is busy right now. Please try again in a minute."), { code: "busy" });
  if (!r.ok) throw new Error("Couldn't load games from Lichess (" + r.status + ").");
  const out = [], parse = (l) => { if (!l.trim()) return; try { out.push(JSON.parse(l)); onGame && onGame(out.length); } catch (e) { /* skip */ } };
  if (!r.body || !r.body.getReader) { (await r.text()).split("\n").forEach(parse); return out; }
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop(); lines.forEach(parse);
  }
  parse(buf);
  return out;
}
// Check a username exists and return its proper spelling (used when a student links an account).
export async function lookupUser(username) {
  const u = String(username || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?lichess\.org\/@\//i, "").replace(/\/.*$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/.test(u)) throw Object.assign(new Error("That doesn't look like a Lichess username."), { code: "bad" });
  const user = await getJSON(`${API}/user/${encodeURIComponent(u)}`);
  if (user.disabled || user.closed) throw Object.assign(new Error("That Lichess account is closed."), { code: "closed" });
  if (user.tosViolation) throw Object.assign(new Error("That Lichess account can't be linked."), { code: "tos" });
  return { username: user.username || u, id: user.id };
}
// Games are kept in this browser in a slim form, so a later visit only downloads games played since.
export async function loadData(username, { fresh = false, onStep, onProfile } = {}) {
  const key = "cd-lichess2-" + username.toLowerCase();
  let cached = LS.get(key);
  if (cached && !fresh && Date.now() - cached.at < CACHE_HOURS * 3600e3) return finish(cached);
  onStep && onStep("Loading profile and ratings…");
  const [user, history] = await Promise.all([getJSON(`${API}/user/${encodeURIComponent(username)}`), getJSON(`${API}/user/${encodeURIComponent(username)}/rating-history`).catch(() => [])]);
  if (cached && cached.user && cached.user.id !== user.id) cached = null;
  onProfile && onProfile({ at: Date.now(), user, history });
  const me = user.id;
  const since = (list) => (list && list.length ? Math.max(...list.map((g) => g.t)) + 1 : null);
  const base = { rated: "true", perfType: SPEEDS.join(","), opening: "true" };
  const sR = cached && since(cached.recent), sA = cached && since(cached.analysed);
  let nR = 0, nA = 0;
  const tell = () => onStep && onStep(cached ? `Checking for new games… ${nR + nA} found` : `Reading your recent games from Lichess… ${nR} of up to ${RECENT}`);
  const [rec, ana] = await Promise.all([
    getGames(username, { ...base, max: RECENT, moves: "true", ...(sR ? { since: sR } : {}) }, (n) => { nR = n; tell(); }),
    getGames(username, { ...base, max: ANALYSED, analysed: "true", evals: "true", accuracy: "true", moves: "false", ...(sA ? { since: sA } : {}) }, (n) => { nA = n; tell(); }).catch(() => []),
  ]);
  const merge = (a, b, cap) => { const seen = new Set(); return a.concat(b).filter((g) => (seen.has(g.id) ? false : seen.add(g.id))).sort((x, y) => y.t - x.t).slice(0, cap); };
  const data = {
    at: Date.now(), user, history,
    recent: merge(rec.map((g) => slimGame(g, me)).filter(Boolean), (cached && cached.recent) || [], RECENT),
    analysed: merge(ana.map((g) => slimAnalysed(g, me)).filter(Boolean), (cached && cached.analysed) || [], ANALYSED),
  };
  LS.set(key, data);
  return finish(data);
  function finish(d) { return { ...d, stats: analyse(d.recent, d.analysed) }; }
}
function sideOf(g, me) { return g.players.white.user && g.players.white.user.id === me ? "white" : "black"; }
export function slimGame(g, me) {
  if (!g.players || (g.variant && g.variant !== "standard")) return null;
  const s = sideOf(g, me);
  return { id: g.id, t: g.createdAt || 0, s, r: !g.winner ? 0.5 : g.winner === s ? 1 : 0, sp: g.speed, o: g.opening ? g.opening.name : "", st: g.status, p: g.moves ? g.moves.split(" ").length : 0 };
}
export function slimAnalysed(g, me) {
  if (!g.players || !g.analysis) return null;
  const s = sideOf(g, me), pa = g.players[s].analysis || {}, st = { early: [0, 0, 0], middle: [0, 0, 0], late: [0, 0, 0] };
  g.analysis.forEach((a, i) => {
    if ((i % 2 === 0) !== (s === "white")) return;
    const x = st[i < 24 ? "early" : i < 60 ? "middle" : "late"]; x[0]++;
    const j = a.judgment && a.judgment.name; if (j === "Blunder") x[1]++; else if (j === "Mistake") x[2]++;
  });
  return { id: g.id, t: g.createdAt || 0, b: pa.blunder || 0, m: pa.mistake || 0, i: pa.inaccuracy || 0, acc: typeof pa.accuracy === "number" ? pa.accuracy : null, st };
}

// ---------- analysis ----------
export function analyse(games, analysedGames) {
  const T = () => ({ n: 0, pts: 0, w: 0, d: 0, l: 0 });
  const add = (t, r) => { t.n++; t.pts += r; if (r === 1) t.w++; else if (r === 0) t.l++; else t.d++; };
  const all = T(), color = { white: T(), black: T() }, speed = {}, openings = {}, lossHow = { time: 0, resign: 0, mate: 0, other: 0 };
  let early = 0;
  for (const g of games) {
    add(all, g.r); add(color[g.s], g.r); add(speed[g.sp] = speed[g.sp] || T(), g.r);
    const fam = family(g.o), key = g.s + "|" + fam;
    add(openings[key] = openings[key] || { side: g.s, name: fam, full: g.o || fam, ...T() }, g.r);
    if (g.r === 0) {
      if (g.st === "outoftime" || g.st === "timeout") lossHow.time++;
      else if (g.st === "resign") lossHow.resign++;
      else if (g.st === "mate") lossHow.mate++;
      else lossHow.other++;
      if (g.p && g.p <= 50) early++;
    }
  }
  // errors by game stage, from games Lichess has analysed (own moves only)
  const stage = { early: { n: 0, b: 0, m: 0 }, middle: { n: 0, b: 0, m: 0 }, late: { n: 0, b: 0, m: 0 } };
  let aGames = 0, acc = 0, accN = 0, blunders = 0, mistakes = 0, inacc = 0;
  for (const a of analysedGames || []) {
    aGames++; blunders += a.b; mistakes += a.m; inacc += a.i;
    if (a.acc != null) { acc += a.acc; accN++; }
    for (const k of ["early", "middle", "late"]) { stage[k].n += a.st[k][0]; stage[k].b += a.st[k][1]; stage[k].m += a.st[k][2]; }
  }
  return {
    all, color, speed, openings: Object.values(openings).filter((o) => o.name !== "Unknown"), lossHow, early, gamesCount: games.length,
    analysed: { games: aGames, blunders, mistakes, inacc, accuracy: accN ? acc / accN : null, stage },
  };
}

// ratings and 90-day trend for each speed
function ratings(user, history) {
  const out = [];
  for (const k of [...SPEEDS, "puzzle"]) {
    const p = user.perfs && user.perfs[k];
    if (!p || !p.games) continue;
    const h = (history || []).find((x) => x.name.toLowerCase() === k);
    let trend = null;
    if (h && h.points.length) {
      const cutoff = Date.now() - 90 * 86400000;
      const pts = h.points.map(([y, m, d, r]) => [new Date(y, m, d).getTime(), r]);
      const before = pts.filter(([t]) => t <= cutoff).pop() || (pts[0][0] > cutoff ? null : pts[0]);
      if (before && pts[pts.length - 1][0] > cutoff) trend = p.rating - before[1];
    }
    out.push({ key: k, name: SPEED_NAME[k], rating: p.rating, games: p.games, prov: !!p.prov, trend });
  }
  return out;
}

// Plain-English strengths and weaknesses, each with something to do about it.
export function insights(d) {
  const s = d.stats, good = [], work = [];
  const score = (t) => (t.n ? t.pts / t.n : 0);
  const L = s.all.l || 0;
  if (s.all.n < 10) return { good, work, few: true };
  // rating trend
  const rs = ratings(d.user, d.history).filter((r) => r.key !== "puzzle" && r.trend != null);
  const up = rs.filter((r) => r.trend >= 30).sort((a, b) => b.trend - a.trend)[0];
  const down = rs.filter((r) => r.trend <= -50).sort((a, b) => a.trend - b.trend)[0];
  if (up) good.push({ icon: "fa-chart-line", title: `On the rise in ${up.name}`, text: `+${up.trend} rating points in the last 90 days. Keep doing what you're doing.` });
  if (down) work.push({ icon: "fa-level-down-alt", title: `${down.name} rating has dropped`, text: `${down.trend} points in the last 90 days. Play fewer games and review each loss before the next one.`, link: ["/blog/how-to-analyse-your-own-games/", "How to analyse your own games"] });
  // colours
  const w = score(s.color.white), b = score(s.color.black);
  if (s.color.white.n >= 10 && s.color.black.n >= 10 && Math.abs(w - b) >= 0.12) {
    const better = w > b ? "White" : "Black", worse = w > b ? "Black" : "White";
    good.push({ icon: "fa-chess-pawn", title: `Strong with ${better}`, text: `You score ${pct(Math.max(w, b))}% with ${better} compared with ${pct(Math.min(w, b))}% with ${worse}.` });
    work.push({ icon: "fa-chess-pawn", title: `Results with ${worse}`, text: `Your ${worse} repertoire needs attention: ${pct(Math.min(w, b))}% score.`, link: ["/lab/openings/", `Opening courses for ${worse}`] });
  }
  // openings
  const ops = s.openings.filter((o) => o.n >= 4).map((o) => ({ ...o, sc: score(o) }));
  const best = ops.filter((o) => o.sc >= 0.6).sort((a, b) => b.sc - a.sc || b.n - a.n)[0];
  const worst = ops.filter((o) => o.sc <= 0.4).sort((a, b) => a.sc - b.sc || b.n - a.n)[0];
  if (best) good.push({ icon: "fa-book-open", title: `${best.name} as ${cap(best.side)}`, text: `${pct(best.sc)}% score in ${best.n} games. This is one of your best openings.` });
  if (worst) {
    const c = courseFor(worst.full) || courseFor(worst.name);
    work.push({ icon: "fa-book-open", title: `${worst.name} as ${cap(worst.side)}`, text: `Only ${pct(worst.sc)}% in ${worst.n} games. Learn the main ideas and typical plans of this opening.`, link: c ? [`/lab/openings/#${c[1]}`, `Chess Lab course: ${c[2]}`] : ["/lab/openings/", "Opening courses"] });
  }
  // how games are lost
  if (L >= 6) {
    const t = s.lossHow.time / L, m = s.lossHow.mate / L, e = s.early / L;
    if (t >= 0.25) work.push({ icon: "fa-stopwatch", title: "Losing on time", text: `${pct(t)}% of your losses are on time. Play more rapid (10+5 or 15+10) and use the increment, and decide faster in simple positions.`, link: ["/blog/tournament-preparation-and-mindset/", "Tournament preparation and mindset"] });
    else if (L >= 10 && t <= 0.08) good.push({ icon: "fa-stopwatch", title: "Good clock management", text: "You rarely lose on time." });
    if (m >= 0.3) work.push({ icon: "fa-chess-king", title: "King safety", text: `${pct(m)}% of your losses end in checkmate. Before each move, check your opponent's checks and threats.`, link: ["/blog/cct-method-checks-captures-threats/", "The CCT method"] });
    if (e >= 0.3) work.push({ icon: "fa-hourglass-start", title: "Early losses", text: `${pct(e)}% of your losses happen within 25 moves. That usually means opening trouble or an early tactical slip.`, link: ["/lab/tactics/", "Tactics trainer"] });
  }
  // analysed games: errors per game and by stage
  const a = s.analysed;
  if (a.games >= 5) {
    const bpg = a.blunders / a.games;
    if (bpg >= 1) work.push({ icon: "fa-exclamation-triangle", title: "Blunders", text: `About ${bpg.toFixed(1)} blunders per game in your analysed games. Do a quick blunder check before every move, and train tactics daily.`, link: ["/lab/tactics/", "Tactics trainer"] });
    else if (bpg <= 0.5) good.push({ icon: "fa-shield-alt", title: "Few blunders", text: `Only ${bpg.toFixed(1)} blunders per game in your analysed games.` });
    if (a.accuracy != null && a.accuracy >= 85) good.push({ icon: "fa-bullseye", title: "Accurate play", text: `Average accuracy ${Math.round(a.accuracy)}% in analysed games.` });
    const rate = (st) => (st.n >= 30 ? (st.b * 2 + st.m) / st.n : null);
    const stages = [["early", "the first 12 moves", "/lab/openings/", "Opening courses"], ["middle", "the middlegame (moves 13–30)", "/lab/tactics/", "Tactics trainer"], ["late", "the later stage (move 31 onwards)", "/blog/rook-endgames-lucena-and-philidor/", "Rook endgames: Lucena and Philidor"]]
      .map(([k, label, href, text]) => ({ k, label, href, text, r: rate(a.stage[k]) })).filter((x) => x.r != null);
    if (stages.length >= 2) {
      stages.sort((x, y) => y.r - x.r);
      if (stages[0].r > stages[stages.length - 1].r * 1.5 && stages[0].r > 0.03) work.push({ icon: "fa-chart-bar", title: `Most mistakes in ${stages[0].label}`, text: `Compared with the rest of the game, you make the most serious mistakes here.`, link: [stages[0].href, stages[0].text] });
    }
  } else {
    work.push({ icon: "fa-microchip", title: "Get your games analysed", text: "Few of your recent games have computer analysis. On Lichess, open a finished game and click \"Request a computer analysis\" for your important games, so we can show where mistakes happen.", soft: true });
  }
  // speeds
  const sp = Object.entries(s.speed).filter(([, t]) => t.n >= 10).map(([k, t]) => ({ k, sc: score(t), n: t.n }));
  if (sp.length >= 2) {
    sp.sort((x, y) => y.sc - x.sc);
    if (sp[0].sc - sp[sp.length - 1].sc >= 0.12) good.push({ icon: "fa-clock", title: `Best at ${SPEED_NAME[sp[0].k]}`, text: `${pct(sp[0].sc)}% score in ${sp[0].n} recent ${SPEED_NAME[sp[0].k].toLowerCase()} games.` });
  }
  return { good, work: work.sort((x, y) => (x.soft ? 1 : 0) - (y.soft ? 1 : 0)) };
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---------- rendering ----------
function graph(history, width) {
  const lines = (history || []).filter((h) => SPEEDS.includes(h.name.toLowerCase()) && h.points.length)
    .map((h) => ({ name: h.name, pts: h.points.map(([y, m, d, r]) => [new Date(y, m, d).getTime(), r]) }));
  const from = Date.now() - 365 * 86400000;
  lines.forEach((l) => { const before = l.pts.filter(([t]) => t < from).pop(); l.pts = (before ? [[from, before[1]]] : []).concat(l.pts.filter(([t]) => t >= from)); });
  const use = lines.filter((l) => l.pts.length >= 2);
  if (!use.length) return "";
  const W = Math.max(300, Math.min(760, Math.round(width || 640))), H = W < 480 ? 170 : 200, P = 34;
  const xs = use.flatMap((l) => l.pts.map((p) => p[0])), ys = use.flatMap((l) => l.pts.map((p) => p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(Date.now(), ...xs), y0 = Math.floor((Math.min(...ys) - 20) / 50) * 50, y1 = Math.ceil((Math.max(...ys) + 20) / 50) * 50;
  const X = (t) => P + ((t - x0) / (x1 - x0 || 1)) * (W - P - 8), Y = (r) => 8 + (1 - (r - y0) / (y1 - y0 || 1)) * (H - 30);
  const COL = { bullet: "#f59e0b", blitz: "#6366f1", rapid: "#10b981", classical: "#ec4899" };
  const ticks = []; for (let r = y0; r <= y1; r += Math.max(50, Math.round((y1 - y0) / 4 / 50) * 50)) ticks.push(r);
  const months = []; const d = new Date(x0); d.setDate(1); d.setMonth(d.getMonth() + 1);
  for (; d.getTime() <= x1; d.setMonth(d.getMonth() + 2)) months.push(new Date(d));
  return `<figure class="lr-graph"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rating graph for the last 12 months">
    ${ticks.map((r) => `<line x1="${P}" x2="${W - 8}" y1="${Y(r)}" y2="${Y(r)}" class="lr-grid"/><text x="${P - 6}" y="${Y(r) + 4}" class="lr-ax" text-anchor="end">${r}</text>`).join("")}
    ${months.map((m) => `<text x="${X(m.getTime())}" y="${H - 6}" class="lr-ax" text-anchor="middle">${m.toLocaleDateString("en-IN", { month: "short" })}</text>`).join("")}
    ${use.map((l) => `<polyline fill="none" stroke="${COL[l.name.toLowerCase()]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${l.pts.map(([t, r]) => X(t).toFixed(1) + "," + Y(r).toFixed(1)).join(" ")}"/>`).join("")}
  </svg><figcaption>${use.map((l) => `<span><i style="background:${COL[l.name.toLowerCase()]}"></i>${esc(l.name)}</span>`).join("")} · last 12 months</figcaption></figure>`;
}
function bar(t) { const n = t.n || 1; return `<span class="lr-bar"><span class="w" style="width:${(t.w / n) * 100}%"></span><span class="d" style="width:${(t.d / n) * 100}%"></span><span class="l" style="width:${(t.l / n) * 100}%"></span></span>`; }
function resultRow(label, t) { return t.n ? `<div class="lr-row"><span class="lr-row-l">${esc(label)}</span>${bar(t)}<span class="lr-row-r">${pct(t.pts / t.n)}% <small>(${t.n})</small></span></div>` : ""; }

export function renderReport(el, data, { username } = {}) {
  const s = data.stats, rs = ratings(data.user, data.history), ins = insights(data);
  const name = data.user.username || username;
  const top = (sideName) => s.openings.filter((o) => o.side === sideName).sort((a, b) => b.n - a.n).slice(0, 5);
  el.innerHTML = `
  <div class="lr">
    <div class="lr-ratings">${ratingCards(rs)}</div>
    ${graph(data.history, el.clientWidth)}
    ${ins.few ? `<p class="lr-note">We need at least 10 recent rated games (bullet, blitz, rapid or classical) to work out strengths and weaknesses. Play a few more and come back!</p>` : `
    <div class="lr-cols">
      <section class="lr-box lr-good"><h4><i class="fas fa-thumbs-up"></i> Strengths</h4>${ins.good.length ? ins.good.map(card).join("") : `<p class="lr-muted">Keep playing: strengths show up after a few more games.</p>`}</section>
      <section class="lr-box lr-work"><h4><i class="fas fa-crosshairs"></i> To work on</h4>${ins.work.length ? ins.work.map(card).join("") : `<p class="lr-muted">No clear weak spots in your recent games. Great work!</p>`}</section>
    </div>`}
    <div class="lr-cols">
      <section class="lr-box"><h4>Results in your last ${s.gamesCount} rated games</h4>
        ${resultRow("Overall", s.all)}${resultRow("With White", s.color.white)}${resultRow("With Black", s.color.black)}
        ${SPEEDS.map((k) => (s.speed[k] ? resultRow(SPEED_NAME[k], s.speed[k]) : "")).join("")}
        <p class="lr-key"><span class="w"></span>Win <span class="d"></span>Draw <span class="l"></span>Loss</p>
        ${s.all.l ? `<p class="lr-small">How you lost: ${s.lossHow.resign} resigned · ${s.lossHow.mate} checkmated · ${s.lossHow.time} on time${s.lossHow.other ? ` · ${s.lossHow.other} other` : ""}</p>` : ""}
      </section>
      <section class="lr-box"><h4>Most played openings</h4>
        ${["white", "black"].map((c) => `<p class="lr-sub">As ${cap(c)}</p>${top(c).map((o) => resultRow(o.name, o)).join("") || `<p class="lr-muted">No games yet.</p>`}`).join("")}
      </section>
    </div>
    ${s.analysed.games ? `<p class="lr-small lr-analysed"><i class="fas fa-microchip"></i> From ${s.analysed.games} games with Lichess computer analysis: ${(s.analysed.blunders / s.analysed.games).toFixed(1)} blunders, ${(s.analysed.mistakes / s.analysed.games).toFixed(1)} mistakes and ${(s.analysed.inacc / s.analysed.games).toFixed(1)} inaccuracies per game${s.analysed.accuracy != null ? `, ${Math.round(s.analysed.accuracy)}% average accuracy` : ""}.</p>` : ""}
    <p class="lr-foot">Data from <a href="https://lichess.org/@/${encodeURIComponent(name)}" target="_blank" rel="noopener">lichess.org/@/${esc(name)}</a> · updated ${new Date(data.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · Thank you, Lichess, for the free and open API.</p>
  </div>`;
}
function ratingCards(rs) {
  return rs.map((r) => `<div class="lr-rating"><span class="lr-rating-name">${r.name}</span><b>${r.rating}${r.prov ? "?" : ""}</b><span class="lr-trend ${r.trend > 0 ? "up" : r.trend < 0 ? "down" : ""}">${r.trend == null ? `${r.games} games` : (r.trend > 0 ? "+" : "") + r.trend + " in 90 days"}</span></div>`).join("") || `<p class="lr-muted">No rated games yet.</p>`;
}
function card(i) { return `<div class="lr-ins"><i class="fas ${i.icon}"></i><div><b>${esc(i.title)}</b><p>${esc(i.text)}</p>${i.link ? `<a href="${esc(i.link[0])}">${esc(i.link[1])} <i class="fas fa-arrow-right"></i></a>` : ""}</div></div>`; }

// Load + render with progress and errors in one call.
export async function showReport(el, username, opts = {}) {
  el.innerHTML = `<p class="lr-loading"><i class="fas fa-circle-notch fa-spin"></i> <span>Loading from Lichess…</span></p>`;
  const step = (t) => { const x = el.querySelector(".lr-loading span"); if (x) x.textContent = t; };
  const profile = (p) => { // show ratings and the graph straight away while games stream in
    el.innerHTML = `<div class="lr"><div class="lr-ratings">${ratingCards(ratings(p.user, p.history))}</div>${graph(p.history, el.clientWidth)}</div><p class="lr-loading"><i class="fas fa-circle-notch fa-spin"></i> <span>Reading your recent games…</span></p>`;
  };
  try {
    const data = await loadData(username, { fresh: !!opts.fresh, onStep: step, onProfile: profile });
    renderReport(el, data, { username });
    return data;
  } catch (e) {
    el.innerHTML = `<p class="lr-error"><i class="fas fa-exclamation-circle"></i> ${esc(e.message || "Couldn't load the report.")}</p>`;
    console.warn("Lichess report:", e);
    return null;
  }
}
