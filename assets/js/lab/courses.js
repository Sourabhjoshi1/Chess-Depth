// ChessDepth Chess Lab - course catalogue: every opening, tactics, endgame and board-vision course,
// with level and status filters, search, list/grid views and the member's progress.
import { startLabPage, esc } from "./shell.js";
import { puzzlesNear } from "./puzzles.js";

const CATS = [
  ["", "fa-star", "All courses"], ["basics", "fa-chess-pawn", "Basics"], ["thinking", "fa-brain", "Chess thinking"], ["openings", "fa-chess-rook", "Openings"],
  ["tactics", "fa-bolt", "Tactics"], ["strategy", "fa-chess-knight", "Strategy"], ["pawns", "fa-chess-board", "Pawn structures"],
  ["endgames", "fa-chess-king", "Endgames"], ["vision", "fa-th", "Board vision"],
];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
// "Recommended" order: a sensible path through the Lab, beginners first.
const CAT_ORDER = { basics: 0, thinking: 1, tactics: 2, strategy: 3, openings: 4, pawns: 5, endgames: 6, vision: 7 };
const TACTICS = [
  ["mateIn1", "Mate in one", "Beginner", "Spot the checkmate in a single move. The first pattern every player should see instantly."],
  ["hangingPiece", "Free pieces", "Beginner", "Find the undefended piece and take it, and learn to notice when your own pieces hang."],
  ["fork", "Forks", "Beginner", "Attack two things at once, most often with a knight, and win one of them."],
  ["pin", "Pins", "Beginner", "Pin a piece to its king or queen so it can't move, then pile up on it."],
  ["skewer", "Skewers", "Beginner", "Attack a big piece so it must move and expose the piece behind it."],
  ["backRankMate", "Back-rank mates", "Beginner", "Mate a king trapped behind its own pawns on the back rank."],
  ["mateIn2", "Mate in two", "Intermediate", "Force checkmate in two moves: find the first move that leaves no defence."],
  ["discoveredAttack", "Discovered attacks", "Intermediate", "Move one piece to unleash an attack from the piece behind it."],
  ["deflection", "Deflection", "Intermediate", "Lure a defender away from the square or piece it guards."],
  ["attraction", "Decoys", "Intermediate", "Force a piece, often the king, onto a square where it gets hit."],
  ["promotion", "Promotion tactics", "Intermediate", "Push a pawn through to a new queen, with tricks to clear the way."],
  ["defensiveMove", "Defensive moves", "Intermediate", "The only move that saves the position: learn to defend accurately."],
  ["mateIn3", "Mate in three", "Advanced", "Longer forcing lines: checks, captures and threats that end in mate."],
  ["sacrifice", "Sacrifices", "Advanced", "Give up material to break open the position or win more back."],
  ["intermezzo", "In-between moves", "Advanced", "The surprise zwischenzug: insert a stronger move before the expected one."],
  ["quietMove", "Quiet moves", "Advanced", "The winning move is not a check or a capture. Harder to find, and worth more."],
];
const GOAL = 20; // puzzles solved cleanly to complete a tactics course

startLabPage({ publicPage: (st, prog) => render(st, prog) });

let state = { cat: "", level: "", status: "", q: "", view: "list", sort: "rec" }, all = null, lastProg = null;
try { const v = localStorage.getItem("cd-cr-view"); if (v === "grid") state.view = "grid"; } catch (e) { /* storage off */ }
try {
  const p = new URLSearchParams(location.search);
  if (CATS.some(([c]) => c && c === p.get("cat"))) state.cat = p.get("cat");
  if (LEVELS.includes(p.get("level"))) state.level = p.get("level");
  if (["new", "progress", "done"].includes(p.get("status"))) state.status = p.get("status");
  if (["rec", "level", "short", "az"].includes(p.get("sort"))) state.sort = p.get("sort");
  if (p.get("q")) state.q = p.get("q").slice(0, 60);
} catch (e) { /* ignore */ }
function syncUrl() {
  const p = new URLSearchParams();
  ["cat", "level", "status", "q"].forEach((k) => state[k] && p.set(k, state[k]));
  if (state.sort !== "rec") p.set("sort", state.sort);
  const qs = p.toString(); history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
}

async function build(prog) {
  const [ops, egs, orig, lessons] = await Promise.all([
    fetch("/assets/lab/openings.json").then((r) => r.json()).then((d) => d.courses),
    fetch("/assets/lab/endgames.json").then((r) => r.json()).then((d) => d.lessons),
    fetch("/assets/lab/originals.json").then((r) => r.json()).then((d) => d.puzzles).catch(() => []),
    fetch("/assets/lab/lessons.json").then((r) => r.json()).then((d) => d.courses),
  ]);
  const list = [];
  // Lesson courses: explanation, board and a question or move in every lesson.
  lessons.forEach((c) => {
    const n = c.lessons.length, first = c.lessons.find((l) => l.move) || c.lessons[0];
    list.push({ id: "ln-" + c.id, cat: c.cat, title: c.title, desc: c.desc, level: c.level, fen: first.fen, flip: first.fen.split(" ")[1] === "b",
      units: n, unitName: "lesson", meta: "Interactive lessons", mins: c.mins, href: `/lab/learn/?c=${c.id}`, isNew: true,
      progress: (p) => { const r = p && p.lessons && p.lessons[c.id]; return r ? Math.min(n, (r.done || []).length) : 0; },
      started: (p) => !!(p && p.lessons && p.lessons[c.id] && (p.lessons[c.id].done || []).length),
      last: (p) => (p && p.lessons && p.lessons[c.id] && p.lessons[c.id].last) || 0 });
  });
  const sideLabel = { white: "As White", black_e4: "As Black vs 1.e4", black_d4: "As Black vs 1.d4" };
  ops.forEach((c) => {
    const n = c.line.length;
    list.push({ id: "op-" + c.id, cat: "openings", title: c.name, desc: c.intro, level: c.level, fen: c.final, flip: c.side === "b",
      units: 3, unitName: "stage", meta: `${sideLabel[c.group] || ""} · ${Math.ceil(n / 2)} moves`, mins: 5 + Math.ceil(n / 3), href: `/lab/openings/#${c.id}`,
      progress: (p) => { const r = p && p.openings[c.id]; return r ? (r.learned ? 1 : 0) + Math.min(2, r.perfect || 0) : 0; },
      started: (p) => !!(p && p.openings[c.id] && (p.openings[c.id].learned || p.openings[c.id].practiced)) });
  });
  const levelMap = { "Beginner": "Beginner", "Advanced beginner": "Beginner", "Intermediate": "Intermediate" };
  egs.forEach((l) => {
    list.push({ id: "eg-" + l.id, cat: "endgames", title: l.name, desc: l.intro, level: levelMap[l.level] || "Intermediate", fen: l.pos[0],
      flip: l.goal === "draw" || l.goal === "hold", units: l.pos.length, unitName: "position", meta: `vs Stockfish · ${l.level}`, mins: l.pos.length * 6, href: `/lab/endgames/#${l.id}`,
      progress: (p) => { const r = p && p.endgames[l.id]; return r ? Object.values(r.stars || {}).filter(Boolean).length : 0; },
      started: (p) => !!(p && p.endgames[l.id]) });
  });
  const origByTheme = {}; orig.forEach(([, fen, , , th]) => th.split(" ").forEach((t) => (origByTheme[t] = origByTheme[t] || fen)));
  TACTICS.forEach(([t, name, level, desc]) => {
    list.push({ id: "tt-" + t, cat: "tactics", title: name, desc, level, fen: origByTheme[t] || null, theme: t, units: GOAL, unitName: "puzzle",
      meta: "Rated puzzles", mins: GOAL * 1, href: `/lab/tactics/?theme=${t}`,
      progress: (p) => { const r = p && p.puzzle.byTheme && p.puzzle.byTheme[t]; return r ? Math.min(GOAL, r.s) : 0; },
      started: (p) => !!(p && p.puzzle.byTheme && p.puzzle.byTheme[t] && p.puzzle.byTheme[t].a) });
  });
  const best = (p, d) => { const b = (p && p.coords && p.coords.best) || {}; return Math.max(b[d + "-w"] || 0, b[d + "-b"] || 0, b[d + "-r"] || 0); };
  list.push({ id: "vi-find", cat: "vision", title: "Learn the board: find the square", desc: "A square's name appears; tap it before the clock runs out. Reach 20 in 30 seconds to complete the course.", level: "Beginner",
    fen: "8/8/8/8/8/8/8/8 w - - 0 1", mark: "e4", units: 20, unitName: "square", meta: "30-second drill", mins: 10, href: "/lab/coordinates/",
    progress: (p) => Math.min(20, best(p, "find")), started: (p) => best(p, "find") > 0 });
  list.push({ id: "vi-name", cat: "vision", title: "Learn the board: name the square", desc: "A square lights up; pick its name. Reach 15 in 30 seconds, from White's and Black's side.", level: "Beginner",
    fen: "8/8/8/8/8/8/8/8 w - - 0 1", mark: "c6", units: 15, unitName: "square", meta: "30-second drill", mins: 10, href: "/lab/coordinates/",
    progress: (p) => Math.min(15, best(p, "name")), started: (p) => best(p, "name") > 0 });
  list.push({ id: "vi-blind", cat: "vision", title: "Blindfold chess training", desc: "Six steps from naming square colours to full blindfold games, with free drills on our Blindfold page.", level: "Intermediate",
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", blind: true, units: 6, unitName: "step", meta: "Free drills", mins: 30, href: "/blindfold/",
    progress: () => 0, started: () => false, external: true });
  // Tactics thumbnails without an Original: borrow a real puzzle position with that theme.
  try {
    const pool = await puzzlesNear(1500, 2);
    list.filter((c) => c.cat === "tactics" && !c.fen).forEach((c) => { const p = pool.find((x) => x.themes.includes(c.theme)); if (p) c.fen = p.fen; });
  } catch (e) { /* thumbnails stay plain */ }
  return list;
}

// Small board picture from a FEN (SVG, unicode pieces).
const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
function thumb(c) {
  const rows = (c.fen || "8/8/8/8/8/8/8/8").split(" ")[0].split("/");
  let sq = "", pcs = "";
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      const x = c.flip ? 7 - f : f, y = c.flip ? 7 - r : r, white = ch === ch.toUpperCase();
      if (!c.blind) pcs += `<text x="${x * 10 + 5}" y="${y * 10 + 8.6}" class="${white ? "w" : "b"}">${GLYPH[ch.toLowerCase()]}</text>`;
      f++;
    }
  }
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) sq += `<rect x="${f * 10}" y="${r * 10}" width="10" height="10" class="${(r + f) % 2 ? "d" : "l"}"/>`;
  let mark = "";
  if (c.mark) { const f = "abcdefgh".indexOf(c.mark[0]), r = 8 - Number(c.mark[1]); mark = `<rect x="${f * 10}" y="${r * 10}" width="10" height="10" class="m"/>`; }
  return `<svg class="cr-thumb" viewBox="0 0 80 80" aria-hidden="true">${sq}${mark}${pcs}${c.blind ? `<text x="40" y="47" class="eye">👁</text>` : ""}</svg>`;
}

function statusOf(c, p) {
  const n = c.progress(p);
  if (n >= c.units) return { key: "done", n };
  if (n > 0 || c.started(p)) return { key: "progress", n };
  return { key: "new", n };
}
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function draw(st, prog) {
  const p = st.user && st.access ? prog : null, member = !!p;
  const counts = {}; all.forEach((c) => (counts[c.cat] = (counts[c.cat] || 0) + 1));
  document.getElementById("cr-cats").innerHTML = CATS.map(([k, ic, name]) =>
    `<button type="button" role="tab" aria-selected="${state.cat === k}" class="cr-cat${state.cat === k ? " is-active" : ""}" data-cat="${k}"><i class="fas ${ic}"></i><b>${name}</b><span>${k ? plural(counts[k] || 0, "course") : all.length + " total"}${member ? ` · ${all.filter((c) => (!k || c.cat === k) && statusOf(c, p).key === "done").length} done` : ""}</span></button>`).join("");
  const q = state.q.trim().toLowerCase();
  const lv = (c) => LEVELS.indexOf(c.level);
  const sorters = {
    rec: (a, b) => lv(a.c) - lv(b.c) || CAT_ORDER[a.c.cat] - CAT_ORDER[b.c.cat],
    level: (a, b) => lv(a.c) - lv(b.c) || a.c.title.localeCompare(b.c.title),
    short: (a, b) => a.c.mins - b.c.mins, az: (a, b) => a.c.title.localeCompare(b.c.title),
  };
  const everything = all.map((c, k) => ({ c, s: statusOf(c, p), k }));
  // Continue learning: courses in progress, the most nearly finished first.
  const cont = document.getElementById("cr-continue");
  const going2 = everything.filter((r) => r.s.key === "progress").sort((a, b) => (b.c.last ? b.c.last(p) : 0) - (a.c.last ? a.c.last(p) : 0) || b.s.n / b.c.units - a.s.n / a.c.units).slice(0, 3);
  const next = !going2.length && member ? everything.filter((r) => r.s.key === "new").sort(sorters.rec)[0] : null;
  cont.classList.toggle("hidden", !(member && (going2.length || next)));
  if (member && (going2.length || next)) {
    const cards = going2.length ? going2 : [next];
    cont.innerHTML = `<h2 class="cr-h2">${going2.length ? "Continue learning" : "Start here"}</h2><div class="cr-cont">${cards.map(({ c, s }) =>
      `<a class="cr-cont-item" href="${c.href}">${thumb(c)}<span class="cr-body"><span class="cr-title">${esc(c.title)}</span><span class="cr-meta"><span class="cr-step">${s.n ? `${c.unitName[0].toUpperCase() + c.unitName.slice(1)} ${Math.min(c.units, s.n + 1)} of ${c.units}` : `${plural(c.units, c.unitName)} · ~${c.mins} min`}</span></span>
        <span class="cr-bar-track" aria-hidden="true"><span style="width:${Math.round((Math.min(s.n, c.units) / c.units) * 100)}%"></span></span></span><span class="cr-resume">${s.n ? "Resume" : "Start"} <i class="fas fa-arrow-right"></i></span></a>`).join("")}</div>`;
  }
  const rows = everything.filter(({ c, s }) =>
    (!state.cat || c.cat === state.cat) && (!state.level || c.level === state.level) && (!state.status || s.key === state.status) &&
    (!q || (c.title + " " + c.desc + " " + c.meta).toLowerCase().includes(q))).sort((a, b) => sorters[state.sort](a, b) || a.k - b.k);
  document.getElementById("cr-count").textContent = `${rows.length} of ${all.length} courses`;
  const done = all.filter((c) => statusOf(c, p).key === "done").length, going = all.filter((c) => statusOf(c, p).key === "progress").length;
  document.getElementById("cr-summary").innerHTML = member
    ? `<i class="fas fa-graduation-cap"></i><span><b>${done} completed</b><small>${going} in progress</small></span>`
    : `<i class="fas fa-lock"></i><span><b>Sign in to track progress</b><small>Free during the launch offer</small></span>`;
  const list = document.getElementById("cr-list");
  list.className = "cr-list" + (state.view === "grid" ? " cr-grid" : "");
  syncUrl();
  if (!rows.length) { list.innerHTML = `<p class="cr-empty">No courses match. <button type="button" class="cr-clear" id="cr-clear">Clear the filters</button></p>`; return; }
  const catName = Object.fromEntries(CATS.map(([k, , n]) => [k, n]));
  list.innerHTML = rows.map(({ c, s }) => {
    const prog = member && s.key === "progress" ? `<span class="cr-step">${c.unitName[0].toUpperCase() + c.unitName.slice(1)} ${Math.min(c.units, s.n + 1)} of ${c.units}</span>` : `<span>${plural(c.units, c.unitName)}</span>`;
    const badge = !member ? (c.external ? `<span class="cr-badge cr-free">Free</span>` : `<span class="cr-badge">Members</span>`)
      : s.key === "done" ? `<span class="cr-badge cr-done"><i class="fas fa-check"></i> Completed</span>` : s.key === "progress" ? `<span class="cr-badge cr-going">In progress</span>` : `<span class="cr-badge cr-start">Start</span>`;
    const bar = member && s.n ? `<span class="cr-bar-track" aria-hidden="true"><span style="width:${Math.round((Math.min(s.n, c.units) / c.units) * 100)}%"></span></span>` : "";
    return `<a class="cr-item" href="${c.href}">${thumb(c)}<span class="cr-body"><span class="cr-title">${esc(c.title)}${c.isNew ? ' <span class="lab-new">New</span>' : ""}</span><span class="cr-desc">${esc(c.desc)}</span>
      <span class="cr-meta"><span class="cr-tag cr-tag-${c.cat}">${catName[c.cat]}</span><span class="cr-tag cr-lv-${c.level.toLowerCase()}">${c.level}</span>${prog}<span>~${c.mins} min</span></span>${bar}</span>
      <span class="cr-end">${badge}<i class="fas fa-chevron-right" aria-hidden="true"></i></span></a>`;
  }).join("");
}

let wired = false;
async function render(st, prog) {
  lastProg = { st, prog };
  if (!all) {
    try { all = await build(prog); } catch (e) { document.getElementById("cr-list").innerHTML = `<p class="cr-empty">Courses couldn't load. Please refresh the page.</p>`; return; }
  }
  if (!wired) {
    wired = true;
    const redraw = () => draw(lastProg.st, lastProg.prog);
    const seg = (id, key) => document.getElementById(id).addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return; state[key] = b.dataset[key === "view" ? "view" : key];
      document.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle("is-active", x === b));
      if (key === "view") try { localStorage.setItem("cd-cr-view", state.view); } catch (e2) { /* storage off */ }
      redraw();
    });
    seg("cr-levels", "level"); seg("cr-status", "status");
    document.querySelector(".cr-view").id = "cr-viewseg"; seg("cr-viewseg", "view");
    document.querySelectorAll("#cr-viewseg button").forEach((x) => x.classList.toggle("is-active", x.dataset.view === state.view));
    document.getElementById("cr-cats").addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (!b) return; state.cat = b.dataset.cat; redraw(); });
    document.getElementById("cr-q").addEventListener("input", (e) => { state.q = e.target.value; redraw(); });
    document.getElementById("cr-q").value = state.q;
    const sortEl = document.getElementById("cr-sort"); sortEl.value = state.sort;
    sortEl.addEventListener("change", () => { state.sort = sortEl.value; redraw(); });
    [["cr-levels", "level"], ["cr-status", "status"]].forEach(([id, key]) => document.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle("is-active", (x.dataset[key] || "") === state[key])));
    document.getElementById("cr-list").addEventListener("click", (e) => {
      if (!e.target.closest("#cr-clear")) return;
      state.level = ""; state.status = ""; state.q = ""; state.cat = ""; document.getElementById("cr-q").value = "";
      [["cr-levels", "level"], ["cr-status", "status"]].forEach(([id, key]) => document.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle("is-active", !x.dataset[key])));
      redraw();
    });
  }
  draw(st, prog);
}
