// ChessDepth - Blindfold Training (/resources/blindfold/).
// Five drills: square colours, knight routes, remember the position, follow the moves, blindfold puzzles.
// Everything runs in the browser; best scores are kept in localStorage on this device.
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js";
import { nearestShards, loadShard } from "./lab/puzzles.js";

const $ = (id) => document.getElementById(id);
const FILES = "abcdefgh";
const NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const COLOUR = { w: "white", b: "black" };
const rnd = (n) => Math.floor(Math.random() * n);
const pickOne = (a) => a[rnd(a.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const pieceLabel = (p) => (p ? cap(`${COLOUR[p.color]} ${NAMES[p.type]}`) : "Empty");

let level = "easy", drill = "colours";
const store = {
  get(k, d = 0) { try { const v = localStorage.getItem("cd-bf-" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("cd-bf-" + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};
function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) { /* ignore */ } }

// ---------- read aloud ----------
const voiceBox = $("bf-voice");
voiceBox.checked = store.get("voice", false);
if (!("speechSynthesis" in window)) voiceBox.parentElement.classList.add("hidden");
voiceBox.addEventListener("change", () => { store.set("voice", voiceBox.checked); if (!voiceBox.checked) try { speechSynthesis.cancel(); } catch (e) { /* */ } });
function speak(text) {
  if (!voiceBox.checked || !("speechSynthesis" in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "en-GB"; u.rate = 0.95; speechSynthesis.speak(u); } catch (e) { /* */ }
}
// "Nxe5+" -> "Knight takes e5, check"
function sanWords(san) {
  if (san.startsWith("O-O-O")) return "castles queenside" + (san.includes("#") ? ", checkmate" : san.includes("+") ? ", check" : "");
  if (san.startsWith("O-O")) return "castles kingside" + (san.includes("#") ? ", checkmate" : san.includes("+") ? ", check" : "");
  const m = san.match(/^([NBRQK])?([a-h])?([1-8])?(x)?([a-h][1-8])(=([NBRQ]))?([+#])?/);
  if (!m) return san;
  const P = { N: "Knight", B: "Bishop", R: "Rook", Q: "Queen", K: "King" };
  let s = m[1] ? P[m[1]] : (m[4] ? m[2] : "");
  if (m[1] && (m[2] || m[3])) s += " " + (m[2] || "") + (m[3] || "");
  s += (m[4] ? " takes " : " ") + m[5];
  if (m[7]) s += ", promotes to " + P[m[7]].toLowerCase();
  if (m[8] === "+") s += ", check"; if (m[8] === "#") s += ", checkmate";
  return s.trim();
}

// ---------- drill + level switching ----------
const stoppers = {};   // each drill registers a stop() so switching away cancels timers
document.querySelectorAll(".bf-pick").forEach((b) => b.addEventListener("click", () => showDrill(b.dataset.drill, true)));
document.querySelectorAll(".bf-levels button").forEach((b) => b.addEventListener("click", () => {
  level = b.dataset.level; store.set("level", level);
  document.querySelectorAll(".bf-levels button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  Object.values(stoppers).forEach((s) => s()); refreshBests();
}));
function showDrill(d, scroll) {
  drill = d; Object.values(stoppers).forEach((s) => s());
  document.querySelectorAll(".bf-pick").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.drill === d)));
  document.querySelectorAll(".bf-drill").forEach((el) => el.classList.toggle("hidden", el.dataset.drill !== d));
  try { history.replaceState(null, "", "#" + d); } catch (e) { /* */ }
  if (scroll) $("bf-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}
function refreshBests() {
  $("col-best").textContent = store.get(`colours-${level}`);
  $("kn-best").textContent = store.get(`knight-${level}`);
  $("mem-best").textContent = store.get(`memory-${level}`);
  $("mv-best").textContent = store.get(`moves-${level}`);
  $("pz-best").textContent = store.get(`puzzles-${level}`);
}
function saveBest(key, value) { const k = `${key}-${level}`; if (value > store.get(k)) { store.set(k, value); refreshBests(); sync(); return true; } return false; }
// every finished round is counted, so the Student Area (and coaches) can see how much a student trains
function roundDone(d) { store.set(`rounds-${d}`, store.get(`rounds-${d}`) + 1); store.set("last", Date.now()); sync(); }

// ---------- save to the student's account (Student Area), when signed in ----------
const DRILLS = ["colours", "knight", "memory", "moves", "puzzles"], LEVELS = ["easy", "medium", "hard"];
let cloud = null, syncT = null;
function snapshot() {
  const o = {}; DRILLS.forEach((d) => { LEVELS.forEach((l) => { o[`${d}-${l}`] = store.get(`${d}-${l}`); }); o[`rounds-${d}`] = store.get(`rounds-${d}`); });
  o.last = store.get("last", 0); return o;
}
function sync() { if (!cloud) return; clearTimeout(syncT); syncT = setTimeout(() => cloud(snapshot()), 1200); }
(async () => {
  const acctEl = $("bf-acct");
  try {
    const { firebaseConfig } = await import("./firebase-config.js");
    const V = "10.12.2";
    const [{ initializeApp }, { getAuth, onAuthStateChanged }, { getFirestore, doc, getDoc, setDoc, serverTimestamp }] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`), import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`), import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)]);
    const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
    onAuthStateChanged(auth, async (user) => {
      try { if (window.cdAccount) window.cdAccount.set(user); } catch (e) { /* header chip only */ }
      if (!user) { cloud = null; acctEl.innerHTML = `<i class="fas fa-user-circle"></i> <a href="/student/">Sign in</a> to save your scores to your Student Area`; return; }
      const ref = doc(db, "students", user.uid);
      try {   // take the better of this device and the account, so scores follow the student between devices
        const snap = await getDoc(ref); const remote = (snap.exists() && snap.data().blindfold) || {};
        Object.entries(remote).forEach(([k, v]) => { if (typeof v === "number" && v > store.get(k)) store.set(k, v); });
        refreshBests();
      } catch (e) { /* offline: keep local scores */ }
      cloud = (o) => setDoc(ref, { blindfold: { ...o, updatedAt: serverTimestamp() } }, { merge: true }).catch(() => {});
      sync();
      acctEl.innerHTML = `<i class="fas fa-check-circle"></i> Saving to <a href="/student/#blindfold">${(user.displayName || "your").split(" ")[0]}'s Student Area</a>`;
    });
  } catch (e) { acctEl.textContent = ""; }
})();

// ---------- board helpers ----------
const sqName = (f, r) => FILES[f] + (r + 1);
function squareFromEvent(el, e) {
  const r = el.getBoundingClientRect(), s = r.width / 8;
  let c = Math.floor((e.clientX - r.left) / s), row = Math.floor((e.clientY - r.top) / s);
  if (c < 0 || c > 7 || row < 0 || row > 7) return null;
  if (el.orientation === "black") { c = 7 - c; row = 7 - row; }
  return FILES[c] + (8 - row);
}
function mark(el, marks) { // marks: {square: "sel"|"good"|"bad"|"last"}
  const sr = el.shadowRoot; if (!sr) return;
  const col = { sel: "inset 0 0 0 4px rgba(79,70,229,.95)", good: "inset 0 0 0 4px rgba(22,163,74,.95)", bad: "inset 0 0 0 4px rgba(220,38,38,.95)", last: "inset 0 0 0 100px rgba(250,204,21,.35)" };
  sr.querySelectorAll("[data-square]").forEach((sq) => { sq.style.boxShadow = marks[sq.dataset.square] ? col[marks[sq.dataset.square]] : ""; });
}
const posObj = (game) => { const o = {}; game.board().flat().forEach((p) => { if (p) o[p.square] = p.color + p.type.toUpperCase(); }); return o; };

// attacked squares from the piece on `sq` (ignores pins; enough for "does it attack / defend" questions)
function attacksFrom(game, sq) {
  const p = game.get(sq); if (!p) return [];
  const f = FILES.indexOf(sq[0]), r = Number(sq[1]) - 1, out = [];
  const add = (df, dr, slide) => { let x = f + df, y = r + dr; while (x >= 0 && x < 8 && y >= 0 && y < 8) { const s = sqName(x, y); out.push(s); if (!slide || game.get(s)) break; x += df; y += dr; } };
  const D = [[1, 1], [1, -1], [-1, 1], [-1, -1]], O = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (p.type === "p") { const d = p.color === "w" ? 1 : -1; add(1, d, false); add(-1, d, false); }
  if (p.type === "n") [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([a, b]) => add(a, b, false));
  if (p.type === "b" || p.type === "q") D.forEach(([a, b]) => add(a, b, true));
  if (p.type === "r" || p.type === "q") O.forEach(([a, b]) => add(a, b, true));
  if (p.type === "k") [...D, ...O].forEach(([a, b]) => add(a, b, false));
  return out;
}
const pieces = (game) => game.board().flat().filter(Boolean);

// ---------- question generator (drills 3 and 4) ----------
function makeQuestions(game, n) {
  const all = pieces(game), qs = [], used = new Set();
  const kinds = shuffle(["on", "where", "attack", "defended", "on", "count"]).slice(0, n);
  if (!kinds.includes("where")) kinds[0] = "where";   // always one tap-the-board question
  for (const kind of kinds) {
    let q = null;
    for (let tries = 0; tries < 30 && !q; tries++) {
      if (kind === "on") {
        const occupied = Math.random() < 0.75 && all.length;
        let sq;
        if (occupied) sq = pickOne(all).square;
        else { const near = all.flatMap((p) => attacksFrom(game, p.square)).filter((s) => !game.get(s)); sq = near.length ? pickOne(near) : sqName(rnd(8), rnd(8)); }
        if (used.has("on" + sq)) continue;
        const right = pieceLabel(game.get(sq));
        const pool = new Set(["Empty", ...all.map((p) => pieceLabel(p))]);
        ["White pawn", "Black pawn", "White knight", "Black bishop", "White rook", "Black queen"].forEach((x) => pool.add(x));
        pool.delete(right);
        const opts = shuffle([right, ...shuffle([...pool]).slice(0, 3)]);
        q = { type: "choice", text: `What stands on <b>${sq}</b>?`, say: `What stands on ${sq}?`, options: opts, answer: right, key: "on" + sq, show: [sq] };
      } else if (kind === "where") {
        const unique = all.filter((p) => all.filter((x) => x.type === p.type && x.color === p.color).length === 1 && p.type !== "p");
        const p = pickOne(unique.length ? unique : all.filter((x) => x.type === "k"));
        if (used.has("where" + p.square)) continue;
        q = { type: "square", text: `Tap the square of the <b>${COLOUR[p.color]} ${NAMES[p.type]}</b>.`, say: `Where is the ${COLOUR[p.color]} ${NAMES[p.type]}?`, answer: p.square, key: "where" + p.square, show: [p.square] };
      } else if (kind === "attack") {
        const cand = all.filter((p) => p.type !== "k");
        const p = pickOne(cand); if (!p || used.has("att" + p.square)) continue;
        const hits = attacksFrom(game, p.square).filter((s) => { const t = game.get(s); return t && t.color !== p.color; });
        const them = COLOUR[p.color === "w" ? "b" : "w"];
        q = { type: "choice", text: `Does the ${COLOUR[p.color]} ${NAMES[p.type]} on <b>${p.square}</b> attack any ${them} piece?`, say: `Does the ${COLOUR[p.color]} ${NAMES[p.type]} on ${p.square} attack any ${them} piece?`,
          options: ["Yes", "No"], answer: hits.length ? "Yes" : "No", key: "att" + p.square, show: [p.square, ...hits], explain: hits.length ? `It attacks ${hits.map((s) => `${NAMES[game.get(s).type]} on ${s}`).join(", ")}.` : "It doesn't attack anything." };
      } else if (kind === "defended") {
        const cand = all.filter((p) => p.type !== "k");
        const p = pickOne(cand); if (!p || used.has("def" + p.square)) continue;
        const by = all.filter((x) => x.color === p.color && x.square !== p.square && attacksFrom(game, x.square).includes(p.square));
        q = { type: "choice", text: `Is the ${COLOUR[p.color]} ${NAMES[p.type]} on <b>${p.square}</b> defended by another ${COLOUR[p.color]} piece?`, say: `Is the ${COLOUR[p.color]} ${NAMES[p.type]} on ${p.square} defended?`,
          options: ["Yes", "No"], answer: by.length ? "Yes" : "No", key: "def" + p.square, show: [p.square, ...by.map((x) => x.square)], explain: by.length ? `Defended by the ${by.map((x) => `${NAMES[x.type]} on ${x.square}`).join(" and the ")}.` : "Nothing defends it." };
      } else if (kind === "count") {
        const c = pickOne(["w", "b"]), n2 = all.filter((p) => p.color === c).length;
        if (used.has("count" + c)) continue;
        const opts = shuffle([...new Set([n2, n2 + 1, Math.max(1, n2 - 1), n2 + 2])].slice(0, 4)).map(String);
        q = { type: "choice", text: `How many <b>${COLOUR[c]}</b> pieces are on the board, counting the king and pawns?`, say: `How many ${COLOUR[c]} pieces are on the board?`, options: opts, answer: String(n2), key: "count" + c, show: all.filter((p) => p.color === c).map((p) => p.square) };
      }
    }
    if (q) { used.add(q.key); qs.push(q); }
  }
  return qs;
}

// Ask a list of questions; resolves with the number answered correctly. ui = {text, answers, msg, board, game, alive}
function askAll(qs, ui) {
  return new Promise((resolve) => {
    let i = 0, right = 0, waiting = false;
    const next = () => {
      if (!ui.alive()) { ui.board.removeEventListener("click", onBoard); return; }
      if (i >= qs.length) { ui.board.removeEventListener("click", onBoard); resolve(right); return; }
      const q = qs[i]; waiting = true; mark(ui.board, {});
      ui.text.innerHTML = `<span class="bf-qn">Question ${i + 1} of ${qs.length}</span>${q.text}`; speak(q.say);
      ui.answers.innerHTML = q.type === "square" ? `<p class="bf-hint"><i class="fas fa-hand-pointer"></i> Tap a square on the board</p>` : q.options.map((o) => `<button type="button" class="bf-ans" data-ans="${o}">${o}</button>`).join("");
      ui.answers.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => answer(b.dataset.ans, b)));
    };
    const answer = (val, btn) => {
      if (!ui.alive()) { ui.board.removeEventListener("click", onBoard); return; }
      if (!waiting) return; waiting = false;
      const q = qs[i], ok = String(val) === String(q.answer); if (ok) right++;
      ui.answers.querySelectorAll("button").forEach((b) => { b.disabled = true; if (b.dataset.ans === String(q.answer)) b.classList.add("is-right"); });
      if (btn && !ok) btn.classList.add("is-wrong");
      const marks = {}; (q.show || []).forEach((s) => { marks[s] = "good"; });
      if (q.type === "square" && !ok && val) marks[val] = "bad";
      ui.board.setPosition(posObj(ui.game), false); setTimeout(() => mark(ui.board, marks), 30);
      ui.msg.innerHTML = (ok ? `<b class="bf-ok">Correct!</b> ` : `<b class="bf-no">Not quite.</b> `) + [q.type === "square" ? `It's on <b>${q.answer}</b>.` : !["Yes", "No"].includes(q.answer) ? `The answer is <b>${q.answer}</b>.` : "", q.explain || ""].filter(Boolean).join(" ");
      ui.answers.insertAdjacentHTML("beforeend", `<button type="button" class="bf-next">${i + 1 < qs.length ? "Next question" : "See result"} <i class="fas fa-arrow-right"></i></button>`);
      ui.answers.querySelector(".bf-next").addEventListener("click", () => { ui.msg.textContent = ""; ui.board.setPosition({}, false); i++; next(); });
    };
    const onBoard = (e) => { if (!waiting || qs[i].type !== "square") return; const s = squareFromEvent(ui.board, e); if (s) answer(s, null); };
    ui.board.addEventListener("click", onBoard);
    next();
  });
}

// =====================================================================
// 1. Square colours
// =====================================================================
(() => {
  const time = { easy: 60, medium: 45, hard: 30 };
  let timer = null, score = 0, current = null, left = 0, wrong = 0;
  const btns = document.querySelectorAll('[data-drill="colours"] .bf-ans');
  const newSquare = () => { let s; do { s = sqName(rnd(8), rnd(8)); } while (s === current); current = s; $("col-square").textContent = s; speak(s.split("").join(" ")); };
  const isLight = (s) => (FILES.indexOf(s[0]) + Number(s[1])) % 2 === 0;   // a1 (0+1) is dark, h1 (7+1) is light
  function stop() { clearInterval(timer); timer = null; btns.forEach((b) => { b.disabled = true; }); $("col-start").classList.remove("hidden"); }
  stoppers.colours = () => { if (timer) { stop(); $("col-msg").textContent = ""; } };
  function finish() {
    stop(); const best = saveBest("colours", score);
    $("col-square").textContent = "⏱"; $("col-msg").innerHTML = `Time! <b>${score}</b> correct, ${wrong} wrong.` + (best ? ` <b class="bf-ok">New best!</b>` : "");
    $("col-start").innerHTML = '<i class="fas fa-redo"></i> Play again'; roundDone("colours"); track("blindfold_round", { drill: "colours", level, score });
  }
  function answer(a) {
    if (!timer) return;
    const ok = (a === "light") === isLight(current);
    if (ok) score++; else { wrong++; left = Math.max(0, left - 3); }
    $("col-score").textContent = score;
    $("col-msg").innerHTML = ok ? '<b class="bf-ok">✓</b>' : `<b class="bf-no">✗</b> ${current} is ${isLight(current) ? "light" : "dark"} (−3 s)`;
    const sq = $("col-square"); sq.classList.remove("bf-flash-ok", "bf-flash-no"); void sq.offsetWidth; sq.classList.add(ok ? "bf-flash-ok" : "bf-flash-no");
    newSquare();
  }
  btns.forEach((b) => b.addEventListener("click", () => answer(b.dataset.ans)));
  document.addEventListener("keydown", (e) => {
    if (drill !== "colours" || !timer || e.target.matches("input, textarea")) return;
    if (e.key === "l" || e.key === "L" || e.key === "ArrowLeft") { e.preventDefault(); answer("light"); }
    if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") { e.preventDefault(); answer("dark"); }
  });
  $("col-start").addEventListener("click", () => {
    score = 0; wrong = 0; left = time[level]; $("col-score").textContent = 0; $("col-time").textContent = left; $("col-msg").textContent = "";
    btns.forEach((b) => { b.disabled = false; }); $("col-start").classList.add("hidden"); newSquare();
    timer = setInterval(() => { left--; $("col-time").textContent = Math.max(0, left); if (left <= 0) finish(); }, 1000);
  });
  $("col-time").textContent = time[level];
})();

// =====================================================================
// 2. Knight routes
// =====================================================================
(() => {
  const ranges = { easy: [1, 2], medium: [2, 3], hard: [3, 5] };
  let q = 0, score = 0, active = false;
  function route(from, to) { // BFS, returns the squares of one shortest path
    const key = (f, r) => f * 8 + r, prev = new Map([[key(...from), null]]), queue = [from];
    while (queue.length) {
      const [f, r] = queue.shift(); if (f === to[0] && r === to[1]) break;
      for (const [a, b] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
        const x = f + a, y = r + b; if (x < 0 || x > 7 || y < 0 || y > 7 || prev.has(key(x, y))) continue;
        prev.set(key(x, y), [f, r]); queue.push([x, y]);
      }
    }
    const path = []; let cur = to; while (cur) { path.unshift(sqName(...cur)); cur = prev.get(key(...cur)); }
    return path;
  }
  stoppers.knight = () => { if (active) { active = false; $("kn-start").classList.remove("hidden"); $("kn-answers").innerHTML = ""; $("kn-text").textContent = "Press Start."; } };
  function ask() {
    if (q >= 10) {
      active = false; const best = saveBest("knight", score);
      $("kn-text").innerHTML = `Round over: <b>${score}/10</b>` + (best ? ' <b class="bf-ok">New best!</b>' : "");
      $("kn-answers").innerHTML = ""; $("kn-start").innerHTML = '<i class="fas fa-redo"></i> Play again'; $("kn-start").classList.remove("hidden");
      roundDone("knight"); track("blindfold_round", { drill: "knight", level, score }); return;
    }
    const [lo, hi] = ranges[level]; let from, to, path;
    do { from = [rnd(8), rnd(8)]; to = [rnd(8), rnd(8)]; path = route(from, to); } while (path.length - 1 < lo || path.length - 1 > hi);
    q++; $("kn-q").textContent = `${q}/10`;
    const a = sqName(...from), b = sqName(...to), n = path.length - 1;
    $("kn-text").innerHTML = `A knight is on <b>${a}</b>. Fewest moves to reach <b>${b}</b>?`; speak(`Knight on ${a}. How many moves to ${b}?`);
    $("kn-answers").innerHTML = [1, 2, 3, 4, 5, 6].map((k) => `<button type="button" class="bf-ans bf-numans" data-ans="${k}">${k}</button>`).join("");
    $("kn-msg").textContent = "";
    $("kn-answers").querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => {
      const ok = Number(btn.dataset.ans) === n; if (ok) score++; $("kn-score").textContent = score;
      $("kn-answers").querySelectorAll("button").forEach((x) => { x.disabled = true; if (Number(x.dataset.ans) === n) x.classList.add("is-right"); });
      if (!ok) btn.classList.add("is-wrong");
      $("kn-msg").innerHTML = (ok ? '<b class="bf-ok">Correct!</b> ' : `<b class="bf-no">It's ${n}.</b> `) + `One route: ${path.join(" → ")}`;
      $("kn-answers").insertAdjacentHTML("beforeend", `<button type="button" class="bf-next">Next <i class="fas fa-arrow-right"></i></button>`);
      $("kn-answers").querySelector(".bf-next").addEventListener("click", ask);
    }));
  }
  $("kn-start").addEventListener("click", () => { q = 0; score = 0; active = true; $("kn-score").textContent = 0; $("kn-start").classList.add("hidden"); ask(); });
})();

// =====================================================================
// shared: puzzle positions (drills 3 and 5)
// =====================================================================
async function puzzlePool(rating) {
  const list = await nearestShards(rating, 2);
  return (await Promise.all(list.map((s) => loadShard(s.file)))).flat();
}
const seen = new Set(store.get("seen", []));
function remember(id) { seen.add(id); const a = [...seen].slice(-1500); store.set("seen", a); }

// countdown bar: resolves when time is up or `skipBtn` is pressed
function countdown(bar, seconds, skipBtn) {
  return new Promise((resolve) => {
    const t0 = performance.now(); let done = false;
    const end = () => { if (done) return; done = true; bar.style.width = "0%"; skipBtn.classList.add("hidden"); skipBtn.removeEventListener("click", end); resolve(); };
    skipBtn.classList.remove("hidden"); skipBtn.addEventListener("click", end);
    const tick = () => { if (done) return; const f = 1 - (performance.now() - t0) / (seconds * 1000); bar.style.width = Math.max(0, f * 100) + "%"; if (f <= 0) end(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    countdown.cancel = end;
  });
}

// =====================================================================
// 3. Remember the position
// =====================================================================
(() => {
  const cfg = { easy: { pieces: [4, 8], secs: 20, q: 4, rating: 900 }, medium: { pieces: [9, 14], secs: 15, q: 5, rating: 1300 }, hard: { pieces: [15, 24], secs: 10, q: 5, rating: 1700 } };
  const board = $("mem-board"); let run = 0;
  stoppers.memory = () => { run++; if (countdown.cancel) countdown.cancel(); $("mem-start").classList.remove("hidden"); $("mem-ready").classList.add("hidden"); };
  $("mem-start").addEventListener("click", async () => {
    const my = ++run, c = cfg[level];
    $("mem-start").classList.add("hidden"); $("mem-answers").innerHTML = ""; $("mem-msg").textContent = ""; $("mem-score").textContent = "–";
    $("mem-text").textContent = "Loading a position…";
    let pool; try { pool = await puzzlePool(c.rating); } catch (e) { $("mem-text").textContent = "Couldn't load positions. Check your connection and try again."; $("mem-start").classList.remove("hidden"); return; }
    if (my !== run) return;
    let pz, game;
    for (let k = 0; k < 200; k++) {
      pz = pickOne(pool); if (seen.has("m" + pz.id)) continue;
      game = new Chess(pz.fen); try { game.move({ from: pz.moves[0].slice(0, 2), to: pz.moves[0].slice(2, 4), promotion: pz.moves[0][4] }); } catch (e) { continue; }
      const n = pieces(game).length; if (n >= c.pieces[0] && n <= c.pieces[1]) break;
    }
    remember("m" + pz.id);
    board.orientation = "white"; board.setPosition(posObj(game), false); mark(board, {});
    $("mem-text").innerHTML = `Memorise this position. <b>${c.secs} seconds</b>, starting now. Kings first, then queens and rooks, then the rest.`;
    speak("Memorise the position.");
    await countdown($("mem-bar"), c.secs, $("mem-ready"));
    if (my !== run) return;
    board.setPosition({}, false);
    const qs = makeQuestions(game, c.q);
    const right = await askAll(qs, { text: $("mem-text"), answers: $("mem-answers"), msg: $("mem-msg"), board, game, alive: () => my === run });
    if (my !== run) return;
    board.setPosition(posObj(game), false); mark(board, {});
    const perfect = right === qs.length;
    if (perfect) { const n = store.get(`memory-${level}`) + 1; store.set(`memory-${level}`, n); refreshBests(); }
    roundDone("memory");
    $("mem-score").textContent = `${right}/${qs.length}`;
    $("mem-text").innerHTML = perfect ? `<b class="bf-ok">Perfect round!</b> Here's the position again.` : `You got <b>${right} of ${qs.length}</b>. Here's the position again. Have a look at what you missed.`;
    $("mem-answers").innerHTML = ""; $("mem-start").innerHTML = '<i class="fas fa-redo"></i> Next position'; $("mem-start").classList.remove("hidden");
    track("blindfold_round", { drill: "memory", level, score: right });
  });
})();

// =====================================================================
// 4. Follow the moves
// =====================================================================
(() => {
  const cfg = { easy: { plies: [6, 8], pace: 3500, q: 4, board: true, list: "all" }, medium: { plies: [9, 12], pace: 3000, q: 5, board: false, list: "all" }, hard: { plies: [12, 18], pace: 2500, q: 5, board: false, list: "last" } };
  const board = $("mv-board"); let run = 0, lines = null;
  board.setPosition("start", false);
  stoppers.moves = () => { run++; $("mv-start").classList.remove("hidden"); $("mv-next").classList.add("hidden"); $("mv-auto-wrap").classList.add("hidden"); $("mv-cover").classList.add("hidden"); };
  const listHTML = (sans, mode) => {
    if (mode === "last") { const k = sans.length - 1; return k < 0 ? "" : `<span class="bf-last">${Math.floor(k / 2) + 1}.${k % 2 ? ".." : ""} ${sans[k]}</span>`; }
    return sans.map((s, k) => (k % 2 === 0 ? `<b>${k / 2 + 1}.</b> ` : "") + (k === sans.length - 1 ? `<span class="bf-last">${s}</span>` : s)).join(" ");
  };
  $("mv-start").addEventListener("click", async () => {
    const my = ++run, c = cfg[level];
    $("mv-start").classList.add("hidden"); $("mv-answers").innerHTML = ""; $("mv-msg").textContent = ""; $("mv-score").textContent = "–"; $("mv-list").innerHTML = "";
    if (!lines) { try { lines = (await fetch("/assets/lab/openings.json").then((r) => r.json())).courses; } catch (e) { $("mv-text").textContent = "Couldn't load the games. Check your connection and try again."; $("mv-start").classList.remove("hidden"); return; } }
    if (my !== run) return;
    const course = pickOne(lines.filter((l) => l.line.length >= c.plies[0]));
    const n = Math.min(course.line.length, c.plies[0] + rnd(c.plies[1] - c.plies[0] + 1));
    const game = new Chess(), sans = [];
    board.orientation = "white"; board.setPosition("start", false); mark(board, {});
    $("mv-cover").classList.toggle("hidden", c.board);
    if (c.board) board.setPosition({}, false);
    $("mv-text").innerHTML = `From the starting position, follow <b>${n} moves</b>${c.list === "last" ? " (only the latest move is shown)" : ""}.`;
    $("mv-next").classList.remove("hidden"); $("mv-auto-wrap").classList.remove("hidden");
    for (let k = 0; k < n; k++) {
      await new Promise((resolve) => {
        let t = null; const go = () => { clearTimeout(t); $("mv-next").removeEventListener("click", go); $("mv-auto").removeEventListener("change", re); resolve(); };
        const re = () => { clearTimeout(t); if ($("mv-auto").checked) t = setTimeout(go, c.pace); };
        $("mv-next").addEventListener("click", go); $("mv-auto").addEventListener("change", re);
        if (k === 0) t = setTimeout(go, 600); else re();
      });
      if (my !== run) return;
      const mv = game.move({ from: course.line[k].uci.slice(0, 2), to: course.line[k].uci.slice(2, 4), promotion: course.line[k].uci[4] });
      sans.push(mv.san); $("mv-list").innerHTML = listHTML(sans, c.list);
      speak((k % 2 === 0 ? "White: " : "Black: ") + sanWords(mv.san));
    }
    await sleep(c.pace * 0.8); if (my !== run) return;
    $("mv-next").classList.add("hidden"); $("mv-auto-wrap").classList.add("hidden"); $("mv-cover").classList.add("hidden");
    board.setPosition({}, false);
    const qs = makeQuestions(game, c.q);
    const right = await askAll(qs, { text: $("mv-text"), answers: $("mv-answers"), msg: $("mv-msg"), board, game, alive: () => my === run });
    if (my !== run) return;
    board.setPosition(posObj(game), false); mark(board, {});
    $("mv-list").innerHTML = listHTML(sans, "all");
    const perfect = right === qs.length;
    if (perfect) { store.set(`moves-${level}`, store.get(`moves-${level}`) + 1); refreshBests(); }
    roundDone("moves");
    $("mv-score").textContent = `${right}/${qs.length}`;
    $("mv-text").innerHTML = (perfect ? '<b class="bf-ok">Perfect round!</b> ' : `You got <b>${right} of ${qs.length}</b>. `) + `This was the <b>${course.name}</b>.`;
    $("mv-answers").innerHTML = ""; $("mv-start").innerHTML = '<i class="fas fa-redo"></i> Next game'; $("mv-start").classList.remove("hidden");
    track("blindfold_round", { drill: "moves", level, score: right });
  });
})();

// =====================================================================
// 5. Blindfold puzzles
// =====================================================================
(() => {
  const cfg = { easy: { rating: 750, secs: 25, maxPlies: 4 }, medium: { rating: 1150, secs: 18, maxPlies: 4 }, hard: { rating: 1550, secs: 12, maxPlies: 6 } };
  const board = $("pz-board"); let run = 0, streak = 0, points = 0, state = null, sel = null;
  stoppers.puzzles = () => { run++; if (countdown.cancel) countdown.cancel(); state = null; ["pz-ready", "pz-peek", "pz-giveup"].forEach((id) => $(id).classList.add("hidden")); $("pz-form").classList.add("hidden"); $("pz-start").classList.remove("hidden"); streak = 0; points = 0; $("pz-score").textContent = 0; $("pz-points").textContent = 0; };
  const side = (g) => COLOUR[g.turn()];
  function setButtons(playing) {
    ["pz-peek", "pz-giveup"].forEach((id) => $(id).classList.toggle("hidden", !playing));
    $("pz-form").classList.toggle("hidden", !playing); $("pz-start").classList.toggle("hidden", playing);
  }
  async function load() {
    const my = ++run, c = cfg[level];
    $("pz-start").classList.add("hidden"); $("pz-msg").textContent = ""; $("pz-list").innerHTML = ""; $("pz-text").textContent = "Loading a puzzle…";
    let pool; try { pool = await puzzlePool(c.rating); } catch (e) { $("pz-text").textContent = "Couldn't load puzzles. Check your connection and try again."; $("pz-start").classList.remove("hidden"); return; }
    if (my !== run) return;
    let pz; for (let k = 0; k < 300; k++) { pz = pickOne(pool); if (!seen.has("p" + pz.id) && pz.moves.length <= c.maxPlies) break; }
    remember("p" + pz.id);
    const game = new Chess(pz.fen); const first = game.move({ from: pz.moves[0].slice(0, 2), to: pz.moves[0].slice(2, 4), promotion: pz.moves[0][4] });
    state = { pz, game, step: 1, peeks: 0, misses: 0, sans: [] };
    board.orientation = game.turn() === "w" ? "white" : "black"; board.setPosition(posObj(game), false);
    setTimeout(() => mark(board, { [first.from]: "last", [first.to]: "last" }), 30);
    $("pz-text").innerHTML = `<b>${cap(side(game))} to move.</b> ${cap(COLOUR[first.color])} just played <b>${first.san}</b>. Memorise the position: you have <b>${c.secs} seconds</b>.`;
    speak(`${side(game)} to move. ${COLOUR[first.color]} just played ${sanWords(first.san)}.`);
    await countdown($("pz-bar"), c.secs, $("pz-ready"));
    if (my !== run) return;
    board.setPosition({}, false); mark(board, {});
    setButtons(true); $("pz-input").value = "";
    $("pz-text").innerHTML = `The pieces are gone. <b>Find the best move for ${side(game)}.</b> Tap the piece's square, then its destination, or type the move.`;
    speak(`Find the best move for ${side(game)}.`);
    if (matchMedia("(pointer: fine)").matches) $("pz-input").focus();
  }
  function tryMove(input) {
    if (!state) return;
    const { game, pz } = state; const want = pz.moves[state.step];
    let mv = null;
    try {
      if (typeof input === "string") {   // accept "Nf3", "nf3", "0-0"; a lowercase b is tried as a pawn first, then as a bishop
        const t = input.trim().replace(/0/g, "O").replace(/\s+/g, "");
        for (const cand of [t, t[0].toUpperCase() + t.slice(1)]) { try { mv = game.move(cand, { strict: false }); } catch (e) { mv = null; } if (mv) break; }
      }
      else { const promo = want.slice(0, 4) === input.from + input.to ? want[4] : "q"; mv = game.move({ from: input.from, to: input.to, promotion: promo }); }
    } catch (e) { mv = null; }
    if (!mv) { state.misses++; $("pz-msg").innerHTML = `<b class="bf-no">That isn't a legal move here.</b> Picture the position again and try another move.`; return; }
    const ok = mv.from + mv.to + (mv.promotion || "") === want || game.isCheckmate();
    if (!ok) { game.undo(); fail(mv.san); return; }
    state.sans.push(mv.san); state.step++;
    if (state.step >= pz.moves.length || game.isCheckmate()) return solved();
    const reply = game.move({ from: pz.moves[state.step].slice(0, 2), to: pz.moves[state.step].slice(2, 4), promotion: pz.moves[state.step][4] });
    state.sans.push(reply.san); state.step++;
    $("pz-list").innerHTML = state.sans.join(" ");
    $("pz-msg").innerHTML = `<b class="bf-ok">Good!</b> ${cap(COLOUR[reply.color])} replies <b>${reply.san}</b>. Keep going: what's next?`;
    speak(`Good. ${COLOUR[reply.color]} replies ${sanWords(reply.san)}. Your move.`);
    $("pz-input").value = "";
  }
  function end() { setButtons(false); state = null; sel = null; }
  function solved() {
    const { game, peeks } = state; const gain = Math.max(1, 3 - peeks);
    streak++; points += gain; $("pz-score").textContent = streak; $("pz-points").textContent = points;
    const best = saveBest("puzzles", streak);
    board.setPosition(posObj(game), false); $("pz-list").innerHTML = state.sans.join(" ");
    $("pz-text").innerHTML = `<b class="bf-ok">Solved${peeks ? "" : " blindfold"}!</b> +${gain} point${gain > 1 ? "s" : ""}.` + (best ? ' <b class="bf-ok">New best streak!</b>' : "");
    $("pz-msg").textContent = ""; speak("Solved!");
    roundDone("puzzles");
    track("blindfold_puzzle", { level, result: "solved", peeks, rating: state.pz.rating });
    $("pz-start").innerHTML = '<i class="fas fa-forward"></i> Next puzzle'; end();
  }
  function fail(playedSan) {
    const { game, pz } = state;
    const sol = []; const g2 = new Chess(game.fen());
    for (let k = state.step; k < pz.moves.length; k++) { const m = g2.move({ from: pz.moves[k].slice(0, 2), to: pz.moves[k].slice(2, 4), promotion: pz.moves[k][4] }); sol.push(m.san); }
    board.setPosition(posObj(game), false);
    const first = pz.moves[state.step];
    setTimeout(() => mark(board, { [first.slice(0, 2)]: "good", [first.slice(2, 4)]: "good" }), 30);
    $("pz-text").innerHTML = (playedSan ? `<b class="bf-no">${playedSan} isn't it.</b> ` : "") + `The answer was <b>${sol.join(" ")}</b>. Streak reset.`;
    $("pz-msg").innerHTML = `<a href="https://lichess.org/training/${pz.id}" target="_blank" rel="noopener">Open this puzzle on Lichess</a>`;
    speak("Not quite.");
    roundDone("puzzles");
    track("blindfold_puzzle", { level, result: "failed", peeks: state.peeks, rating: pz.rating });
    streak = 0; $("pz-score").textContent = 0; $("pz-start").innerHTML = '<i class="fas fa-forward"></i> Next puzzle'; end();
  }
  board.addEventListener("click", (e) => {
    if (!state || !$("pz-ready").classList.contains("hidden")) return;
    const s = squareFromEvent(board, e); if (!s) return;
    if (!sel) { sel = s; mark(board, { [s]: "sel" }); return; }
    if (s === sel) { sel = null; mark(board, {}); return; }
    const from = sel; sel = null; mark(board, {}); tryMove({ from, to: s });
  });
  $("pz-form").addEventListener("submit", (e) => { e.preventDefault(); const v = $("pz-input").value; if (v.trim()) tryMove(v); });
  $("pz-peek").addEventListener("click", () => {
    if (!state) return; state.peeks++; points = Math.max(0, points - 1); $("pz-points").textContent = points;
    board.setPosition(posObj(state.game), false); $("pz-peek").disabled = true;
    setTimeout(() => { if (state) board.setPosition({}, false); $("pz-peek").disabled = false; }, 1500);
  });
  $("pz-giveup").addEventListener("click", () => { if (state) fail(null); });
  $("pz-start").addEventListener("click", load);
})();

// ---------- start ----------
level = store.get("level", "easy");
document.querySelectorAll(".bf-levels button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.level === level)));
refreshBests();
const fromHash = location.hash.slice(1);
showDrill(["colours", "knight", "memory", "moves", "puzzles"].includes(fromHash) ? fromHash : "colours", false);
