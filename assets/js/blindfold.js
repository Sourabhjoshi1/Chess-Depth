// ChessDepth - Blindfold Training (/resources/blindfold/).
// Ten drills in three stages, a 28-day plan, a daily challenge, medals and ranks.
// Everything runs in the browser; scores are kept in localStorage and, when signed in, in the student's account.
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js";
import { nearestShards, loadShard } from "./lab/puzzles.js";
import { DRILLS, STAGES, LEVELS, MEDAL_NAMES, medals, rankOf, planDay, dayStreak, ymd } from "./blindfold-meta.js";

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
const DRILL_IDS = DRILLS.map((d) => d.id);
document.querySelectorAll(".bf-pick").forEach((b) => b.addEventListener("click", () => showDrill(b.dataset.drill, true)));
document.querySelectorAll(".bf-levels button").forEach((b) => b.addEventListener("click", () => setLevel(b.dataset.level)));
function setLevel(l) {
  level = l; store.set("level", level);
  document.querySelectorAll(".bf-levels button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.level === level)));
  Object.values(stoppers).forEach((s) => s()); refreshBests();
}
function showDrill(d, scroll) {
  drill = d; Object.values(stoppers).forEach((s) => s());
  document.querySelectorAll(".bf-pick").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.drill === d)));
  document.querySelectorAll(".bf-drill").forEach((el) => el.classList.toggle("hidden", el.dataset.drill !== d));
  try { history.replaceState(null, "", "#" + d); } catch (e) { /* */ }
  if (scroll) $("bf-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}
function refreshBests() {
  document.querySelectorAll("[data-best]").forEach((el) => { el.textContent = store.get(`${el.dataset.best}-${level}`); });
  renderPath();
}
function saveBest(key, value) { const k = `${key}-${level}`; if (value > store.get(k)) { const before = medals((x) => store.get(x)).total; store.set(k, value); medalCheck(before); refreshBests(); sync(); return true; } return false; }
function addOne(key) { const before = medals((x) => store.get(x)).total; store.set(`${key}-${level}`, store.get(`${key}-${level}`) + 1); medalCheck(before); refreshBests(); sync(); }
function medalCheck(before) {
  const after = medals((x) => store.get(x)).total; if (after <= before) return;
  const r0 = rankOf(before), r1 = rankOf(after);
  toast(r1.index > r0.index ? `<i class="fas fa-crown"></i> New rank: <b>${r1.title}</b>!` : `<i class="fas fa-medal"></i> Medal earned! ${after} of ${DRILLS.length * 3}`);
}
function toast(html) {
  const t = document.createElement("div"); t.className = "bf-toast"; t.innerHTML = html; document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("is-on")); setTimeout(() => { t.classList.remove("is-on"); setTimeout(() => t.remove(), 400); }, 3200);
}

// every finished round is counted (for coaches), marks the day as trained and ticks off today's plan
function roundDone(d) {
  store.set(`rounds-${d}`, store.get(`rounds-${d}`) + 1); store.set("last", Date.now());
  const today = ymd(new Date()), days = store.get("days", []);
  if (!days.includes(today)) { days.push(today); store.set("days", days.slice(-120)); }
  planSync();
  const plan = planDay(store.get("plan-day", 1)), done = store.get("plan-done", []);
  if (plan.drills.includes(d) && !done.includes(d)) {
    done.push(d); store.set("plan-done", done);
    if (plan.drills.every((x) => done.includes(x))) { store.set("plan-complete", today); toast(`<i class="fas fa-check-circle"></i> Day ${plan.day} of the plan done. See you tomorrow!`); }
  }
  renderPath(); sync();
}
// move the plan on to the next day once a day's session is complete; a new day clears the ticks
function planSync() {
  const today = ymd(new Date()); let day = store.get("plan-day", 1);
  const complete = store.get("plan-complete", "");
  if (complete && complete < today && day < 28) { day++; store.set("plan-day", day); store.set("plan-complete", ""); }
  if (store.get("plan-date", "") !== today) { store.set("plan-date", today); store.set("plan-done", []); }
}

// ---------- save to the student's account (Student Area), when signed in ----------
const SYNC_KEYS = () => [...DRILL_IDS.flatMap((d) => [...LEVELS.map((l) => `${d}-${l}`), `rounds-${d}`]), "last", "days", "daily-days", "plan-day", "plan-done", "plan-date", "plan-complete"];
let cloud = null, syncT = null;
function snapshot() { const o = {}; SYNC_KEYS().forEach((k) => { o[k] = store.get(k, k.endsWith("days") || k === "plan-done" ? [] : k.startsWith("plan-date") || k === "plan-complete" ? "" : k === "plan-day" ? 1 : 0); }); return o; }
function sync() { if (!cloud) return; clearTimeout(syncT); syncT = setTimeout(() => cloud(snapshot()), 1200); }
function mergeRemote(remote) {   // keep the better of this device and the account
  Object.entries(remote).forEach(([k, v]) => {
    if (k === "days" || k === "daily-days") { if (Array.isArray(v)) store.set(k, [...new Set([...store.get(k, []), ...v])].sort().slice(-120)); }
    else if (k.startsWith("plan-")) { /* handled below */ }
    else if (typeof v === "number" && v > store.get(k)) store.set(k, v);
  });
  const rd = remote["plan-day"] || 1, ld = store.get("plan-day", 1);
  if (rd > ld || (rd === ld && (remote["plan-complete"] || "") > store.get("plan-complete", ""))) ["plan-day", "plan-complete", "plan-date", "plan-done"].forEach((k) => { if (remote[k] !== undefined) store.set(k, remote[k]); });
  else if (rd === ld && remote["plan-date"] === store.get("plan-date", "") && Array.isArray(remote["plan-done"])) store.set("plan-done", [...new Set([...store.get("plan-done", []), ...remote["plan-done"]])]);
}
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
      if (!user) { cloud = null; acctEl.innerHTML = `<i class="fas fa-user-circle"></i> <a href="/student/">Sign in</a> to save your progress to your Student Area`; return; }
      const ref = doc(db, "students", user.uid);
      try { const snap = await getDoc(ref); mergeRemote((snap.exists() && snap.data().blindfold) || {}); planSync(); refreshBests(); } catch (e) { /* offline: keep local scores */ }
      cloud = (o) => setDoc(ref, { blindfold: { ...o, updatedAt: serverTimestamp() } }, { merge: true }).catch(() => {});
      sync();
      acctEl.innerHTML = `<i class="fas fa-check-circle"></i> Saving to <a href="/student/#blindfold">${(user.displayName || "your").split(" ")[0]}'s Student Area</a>`;
    });
  } catch (e) { acctEl.textContent = ""; }
})();

// ---------- your path: rank, streak, today's plan, daily challenge, medals ----------
function renderPath() {
  if (!$("bp-rank")) return;
  const m = medals((x) => store.get(x)), r = rankOf(m.total), max = DRILLS.length * 3;
  $("bp-rank").textContent = r.title;
  $("bp-medals").textContent = `${m.total} of ${max} medals`;
  $("bp-bar").style.width = (r.nextAt ? ((m.total - r.prevAt) / (r.nextAt - r.prevAt)) * 100 : 100) + "%";
  $("bp-next").textContent = r.next ? `${r.nextAt - m.total} more to ${r.next}` : "Top rank. Respect!";
  const streak = dayStreak(store.get("days", []));
  $("bp-streak").textContent = streak; $("bp-streak-l").textContent = streak === 1 ? "day in a row" : "days in a row";
  // plan
  const plan = planDay(store.get("plan-day", 1)), done = store.get("plan-done", []), today = ymd(new Date());
  const finished = store.get("plan-day", 1) === 28 && store.get("plan-complete", "");
  $("bp-plan-day").textContent = finished ? "Plan complete!" : `Day ${plan.day} of 28`;
  $("bp-plan-week").textContent = finished ? "You finished all 28 days." : `${plan.weekTitle} · suggested level: ${cap(plan.level)}`;
  $("bp-plan-dots").innerHTML = Array.from({ length: 28 }, (_, i) => `<span class="${i + 1 < plan.day || (i + 1 === plan.day && store.get("plan-complete", "")) ? "is-done" : i + 1 === plan.day ? "is-now" : ""}"></span>`).join("");
  $("bp-plan-list").innerHTML = plan.drills.map((id) => { const d = DRILLS.find((x) => x.id === id), ok = done.includes(id);
    return `<button type="button" class="bp-task${ok ? " is-done" : ""}" data-go="${id}" data-lv="${plan.level}"><i class="fas ${ok ? "fa-check-circle" : d.icon}"></i><span>${d.name}</span></button>`; }).join("");
  $("bp-plan-btn").classList.toggle("hidden", !!store.get("plan-complete", "") || !!finished);
  $("bp-plan-done").classList.toggle("hidden", !store.get("plan-complete", "") || !!finished);
  $("bp-plan-reset").classList.toggle("hidden", !finished);
  // daily challenge
  const dl = store.get("daily-last", null), solved = store.get("daily-days", []);
  const playedToday = dl && dl.date === today;
  $("bp-daily-status").innerHTML = playedToday ? (dl.solved ? `<b class="bf-ok"><i class="fas fa-check-circle"></i> Solved today!</b>` : `<b class="bf-no">Missed today.</b> New puzzle tomorrow.`) : "One blindfold puzzle a day, the same for every student.";
  $("bp-daily-streak").textContent = dailyStreak(solved);
  $("bp-daily-btn").innerHTML = playedToday ? `<i class="fas fa-redo"></i> Replay for practice` : `<i class="fas fa-play"></i> Solve today's puzzle`;
  // medal grid
  $("bp-grid").innerHTML = [1, 2, 3].map((st) => `<div class="bp-stage"><p class="bp-stage-h">Stage ${st} · ${STAGES[st]}</p>${DRILLS.filter((d) => d.stage === st).map((d) =>
    `<button type="button" class="bp-row" data-go="${d.id}"><i class="fas ${d.icon}"></i><span class="bp-name">${d.name}</span><span class="bp-dots">${m.byDrill[d.id].map((ok, k) => `<i class="bp-m bp-m${k}${ok ? " is-on" : ""}" title="${MEDAL_NAMES[k]}: ${d.metric} of ${d.medal}+ on ${cap(LEVELS[k])}"></i>`).join("")}</span></button>`).join("")}</div>`).join("");
}
function dailyStreak(list) { // consecutive solved days ending today or yesterday
  const set = new Set(list); let n = 0; const d = new Date(); if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
  while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); } return n;
}
document.addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]"); if (!go) return;
  if (go.dataset.lv) setLevel(go.dataset.lv);
  showDrill(go.dataset.go, true);
});
if ($("bp-plan-btn")) {
  $("bp-plan-btn").addEventListener("click", () => {
    const plan = planDay(store.get("plan-day", 1)), done = store.get("plan-done", []);
    const next = plan.drills.find((x) => !done.includes(x)) || plan.drills[0];
    setLevel(plan.level); showDrill(next, true);
  });
  $("bp-plan-reset").addEventListener("click", () => { ["plan-day", "plan-complete", "plan-done"].forEach((k) => store.set(k, k === "plan-day" ? 1 : k === "plan-done" ? [] : "")); renderPath(); sync(); });
}

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
    if (perfect) addOne("memory");
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
    if (perfect) addOne("moves");
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
  async function load(daily) {
    daily = daily === true;
    const my = ++run, c = daily ? cfg.medium : cfg[level];
    $("pz-start").classList.add("hidden"); $("pz-msg").textContent = ""; $("pz-list").innerHTML = ""; $("pz-text").textContent = daily ? "Loading today's challenge…" : "Loading a puzzle…";
    let pool; try { pool = daily ? await loadShard((await nearestShards(1200, 1))[0].file) : await puzzlePool(c.rating); } catch (e) { $("pz-text").textContent = "Couldn't load puzzles. Check your connection and try again."; $("pz-start").classList.remove("hidden"); return; }
    if (my !== run) return;
    let pz;
    if (daily) {   // the same puzzle for everyone today: pick by the date
      const list = pool.filter((x) => x.moves.length <= 4).sort((a, b) => (a.id < b.id ? -1 : 1));
      let h = 0; for (const ch of ymd(new Date())) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      pz = list[h % list.length];
    } else { for (let k = 0; k < 300; k++) { pz = pickOne(pool); if (!seen.has("p" + pz.id) && pz.moves.length <= c.maxPlies) break; } remember("p" + pz.id); }
    const game = new Chess(pz.fen); const first = game.move({ from: pz.moves[0].slice(0, 2), to: pz.moves[0].slice(2, 4), promotion: pz.moves[0][4] });
    const dl = store.get("daily-last", null);
    state = { pz, game, step: 1, peeks: 0, misses: 0, sans: [], daily: daily && !(dl && dl.date === ymd(new Date())), dailyAny: daily };
    board.orientation = game.turn() === "w" ? "white" : "black"; board.setPosition(posObj(game), false);
    setTimeout(() => mark(board, { [first.from]: "last", [first.to]: "last" }), 30);
    $("pz-text").innerHTML = (daily ? `<span class="bf-qn">Daily challenge · ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}${state.daily ? "" : " · practice replay"}</span>` : "") + `<b>${cap(side(game))} to move.</b> ${cap(COLOUR[first.color])} just played <b>${first.san}</b>. Memorise the position: you have <b>${c.secs} seconds</b>.`;
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
    if (state.daily) { const t = ymd(new Date()), dd = store.get("daily-days", []); if (!dd.includes(t)) store.set("daily-days", [...dd, t].slice(-120)); store.set("daily-last", { date: t, solved: true }); toast('<i class="fas fa-calendar-check"></i> Daily challenge solved!'); }
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
    if (state.daily) store.set("daily-last", { date: ymd(new Date()), solved: false });
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
  $("pz-start").addEventListener("click", () => load(false));
  if ($("bp-daily-btn")) $("bp-daily-btn").addEventListener("click", () => { showDrill("puzzles", true); load(true); });
})();

// =====================================================================
// shared: typing or tapping moves on an empty board (Blindfold Mates, Play Blindfold)
// =====================================================================
function blindInput(board, form, input, isActive, onMove) {
  let sel = null;
  board.addEventListener("click", (e) => {
    if (!isActive()) return; const s = squareFromEvent(board, e); if (!s) return;
    if (!sel) { sel = s; mark(board, { [s]: "sel" }); return; }
    if (s === sel) { sel = null; mark(board, {}); return; }
    const from = sel; sel = null; mark(board, {}); onMove({ from, to: s });
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); if (isActive() && input.value.trim()) onMove(input.value); });
  return { reset() { sel = null; mark(board, {}); input.value = ""; } };
}
function applyInput(game, inp) { // plays the move on `game` and returns it, or null if it isn't legal
  if (typeof inp === "string") {
    const t = inp.trim().replace(/0/g, "O").replace(/\s+/g, ""); if (!t) return null;
    for (const cand of [t, t[0].toUpperCase() + t.slice(1)]) { try { const m = game.move(cand, { strict: false }); if (m) return m; } catch (e) { /* next */ } }
    return null;
  }
  try { return game.move({ from: inp.from, to: inp.to, promotion: "q" }); } catch (e) { return null; }
}
const centre = (sq) => 3.5 - Math.max(Math.abs(FILES.indexOf(sq[0]) - 3.5), Math.abs(Number(sq[1]) - 4.5));   // 0 (edge) .. 3 (centre)
function lineHTML(sans, startIndex = 0) {   // "1. e4 e5 2. Nf3", the newest move highlighted
  return sans.map((s, k) => { const i = k + startIndex; return (i % 2 === 0 ? `<b>${i / 2 + 1}.</b> ` : k === 0 ? `<b>${Math.floor(i / 2) + 1}…</b> ` : "") + (k === sans.length - 1 ? `<span class="bf-last">${s}</span>` : s); }).join(" ");
}

// =====================================================================
// 6. Find the Square: tap the named square on a board with no letters or numbers
// =====================================================================
(() => {
  const cfg = { easy: { secs: 45, flip: 0 }, medium: { secs: 45, flip: -1 }, hard: { secs: 30, flip: 5 } };
  const board = $("sq-board"); let timer = null, score = 0, left = 0, target = null, n = 0, busy = false;
  board.setPosition({}, false);
  const say = () => { $("sq-side").innerHTML = board.orientation === "black" ? '<i class="fas fa-sync-alt"></i> You are looking from <b>Black’s side</b>' : 'You are looking from <b>White’s side</b>'; };
  function next() { let s; do { s = sqName(rnd(8), rnd(8)); } while (s === target); target = s; $("sq-target").textContent = s; speak(s.split("").join(" ")); }
  function stop() { clearInterval(timer); timer = null; $("sq-start").classList.remove("hidden"); }
  stoppers.squares = () => { if (timer) { stop(); $("sq-msg").textContent = ""; } };
  $("sq-start").addEventListener("click", () => {
    const c = cfg[level]; score = 0; n = 0; left = c.secs; $("sq-score").textContent = 0; $("sq-time").textContent = left; $("sq-msg").textContent = "";
    board.orientation = c.flip === -1 ? pickOne(["white", "black"]) : "white"; say();
    $("sq-start").classList.add("hidden"); next();
    timer = setInterval(() => { left--; $("sq-time").textContent = Math.max(0, left); if (left <= 0) {
      stop(); const best = saveBest("squares", score); mark(board, {});
      $("sq-target").textContent = "⏱"; $("sq-msg").innerHTML = `Time! <b>${score}</b> squares found.` + (best ? ' <b class="bf-ok">New best!</b>' : "");
      $("sq-start").innerHTML = '<i class="fas fa-redo"></i> Play again'; roundDone("squares"); track("blindfold_round", { drill: "squares", level, score });
    } }, 1000);
  });
  board.addEventListener("click", (e) => {
    if (!timer || busy) return; const s = squareFromEvent(board, e); if (!s) return;
    const ok = s === target, c = cfg[level];
    if (ok) score++; else left = Math.max(0, left - 2);
    $("sq-score").textContent = score; n++;
    mark(board, ok ? { [s]: "good" } : { [s]: "bad", [target]: "good" });
    $("sq-msg").innerHTML = ok ? '<b class="bf-ok">✓</b>' : `<b class="bf-no">✗</b> That was ${s}. ${target} is marked in green (−2 s).`;
    busy = true; setTimeout(() => { busy = false; mark(board, {}); if (!timer) return;
      if (c.flip > 0 && n % c.flip === 0) { board.orientation = board.orientation === "white" ? "black" : "white"; say(); }
      next(); }, ok ? 250 : 900);
  });
  say();
})();

// =====================================================================
// 7. Lines & Diagonals: bishop, rook and queen geometry on an empty board
// =====================================================================
(() => {
  const board = $("dg-board"); let q = 0, score = 0, active = false;
  board.setPosition({}, false);
  const xy = (s) => [FILES.indexOf(s[0]), Number(s[1]) - 1];
  const sameDiag = (a, b) => { const [x1, y1] = xy(a), [x2, y2] = xy(b); return a !== b && Math.abs(x1 - x2) === Math.abs(y1 - y2); };
  const sameLine = (a, b) => { const [x1, y1] = xy(a), [x2, y2] = xy(b); return a !== b && (x1 === x2 || y1 === y2); };
  const light = (s) => { const [x, y] = xy(s); return (x + y) % 2 === 1; };
  const between = (a, b) => { const [x1, y1] = xy(a), [x2, y2] = xy(b), dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1), out = [a]; let x = x1, y = y1; while (x !== x2 || y !== y2) { x += dx; y += dy; out.push(sqName(x, y)); } return out; };
  const ray = (s, dx, dy) => { const [x0, y0] = xy(s), out = []; let x = x0 + dx, y = y0 + dy; while (x >= 0 && x < 8 && y >= 0 && y < 8) { out.push(sqName(x, y)); x += dx; y += dy; } return out; };
  const reach = (s, t) => ({ b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]], q: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]] })[t].flatMap(([dx, dy]) => ray(s, dx, dy));
  const ord = (n) => n + (["th", "st", "nd", "rd"][n] || "th");
  const KINDS = { easy: ["same", "bishop", "queen", "same", "bishop"], medium: ["same", "bishop", "queen", "cross", "count"], hard: ["bishop", "cross", "count", "cross", "queen", "count"] };
  function make() {
    const kind = pickOne(KINDS[level]), a = sqName(rnd(8), rnd(8));
    if (kind === "same") {
      const diag = reach(a, "b"), b = Math.random() < 0.5 && diag.length ? pickOne(diag) : (() => { let t; do { t = sqName(rnd(8), rnd(8)); } while (t === a || sameDiag(a, t)); return t; })();
      const yes = sameDiag(a, b);
      return { text: `Are <b>${a}</b> and <b>${b}</b> on the same diagonal?`, say: `Are ${a} and ${b} on the same diagonal?`, options: ["Yes", "No"], answer: yes ? "Yes" : "No", show: yes ? between(a, b) : [a, b], explain: yes ? `Yes: ${between(a, b).join(" → ")}.` : `No. ${light(a) === light(b) ? "They're the same colour, but not on one diagonal." : "They aren't even the same colour."}` };
    }
    if (kind === "bishop") {
      let b; do { b = sqName(rnd(8), rnd(8)); } while (b === a);
      const ans = light(a) !== light(b) ? "Never" : sameDiag(a, b) ? "1" : "2";
      let mid = null; if (ans === "2") mid = reach(a, "b").find((m) => sameDiag(m, b));
      return { text: `A bishop on <b>${a}</b> wants to reach <b>${b}</b>. How many moves does it need on an empty board?`, say: `Bishop from ${a} to ${b}. How many moves?`, options: ["1", "2", "Never"], answer: ans,
        show: ans === "1" ? between(a, b) : ans === "2" ? [...between(a, mid), ...between(mid, b)] : [a, b], explain: ans === "Never" ? `${a} is a ${light(a) ? "light" : "dark"} square and ${b} is ${light(b) ? "light" : "dark"}. A bishop never changes colour.` : ans === "2" ? `For example ${a} → ${mid} → ${b}.` : "" };
    }
    if (kind === "queen") {
      const lines = reach(a, "q"), b = Math.random() < 0.5 ? pickOne(lines) : (() => { let t; do { t = sqName(rnd(8), rnd(8)); } while (t === a || lines.includes(t)); return t; })();
      const yes = lines.includes(b);
      return { text: `Can a queen on <b>${a}</b> reach <b>${b}</b> in one move (empty board)?`, say: `Can a queen on ${a} reach ${b} in one move?`, options: ["Yes", "No"], answer: yes ? "Yes" : "No", show: yes ? between(a, b) : [a, b], explain: yes ? `Yes, along the ${sameLine(a, b) ? (a[0] === b[0] ? "file" : "rank") : "diagonal"}.` : "No: it's not on the same rank, file or diagonal." };
    }
    if (kind === "cross") {
      let start, dir, line; do { start = sqName(rnd(8), 0); dir = pickOne([1, -1]); line = [start, ...ray(start, dir, 1)]; } while (line.length < 5);
      const end = line[line.length - 1], pick = line[1 + rnd(line.length - 2)], rank = Number(pick[1]);
      const pool = shuffle(FILES.split("").map((f) => f + rank).filter((s) => s !== pick)).slice(0, 3);
      return { text: `Picture the diagonal from <b>${start}</b> to <b>${end}</b>. Which square does it cross on the <b>${ord(rank)} rank</b>?`, say: `The diagonal from ${start} to ${end}. Which square on the ${ord(rank)} rank?`, options: shuffle([pick, ...pool]), answer: pick, show: line, explain: `The diagonal runs ${line.join(", ")}.` };
    }
    // count
    const t = pickOne(["b", "r", "q", "n"]), name = NAMES[t];
    const sqs = t === "n" ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].map(([dx, dy]) => { const [x, y] = xy(a); return x + dx >= 0 && x + dx < 8 && y + dy >= 0 && y + dy < 8 ? sqName(x + dx, y + dy) : null; }).filter(Boolean) : reach(a, t);
    const n = sqs.length, opts = shuffle([...new Set([n, n + 2, Math.max(1, n - 2), n + 4, Math.max(1, n - 1)])].slice(0, 4)).map(String);
    if (!opts.includes(String(n))) opts[0] = String(n);
    return { text: `On an empty board, how many squares does a <b>${name} on ${a}</b> attack?`, say: `How many squares does a ${name} on ${a} attack?`, options: shuffle(opts), answer: String(n), show: [a, ...sqs], explain: "" };
  }
  stoppers.diagonals = () => { if (active) { active = false; $("dg-start").classList.remove("hidden"); $("dg-answers").innerHTML = ""; $("dg-text").textContent = "Press Start."; mark(board, {}); } };
  function ask() {
    mark(board, {}); $("dg-msg").textContent = "";
    if (q >= 10) {
      active = false; const best = saveBest("diagonals", score);
      $("dg-text").innerHTML = `Round over: <b>${score}/10</b>` + (best ? ' <b class="bf-ok">New best!</b>' : "");
      $("dg-answers").innerHTML = ""; $("dg-start").innerHTML = '<i class="fas fa-redo"></i> Play again'; $("dg-start").classList.remove("hidden");
      roundDone("diagonals"); track("blindfold_round", { drill: "diagonals", level, score }); return;
    }
    const Q = make(); q++; $("dg-q").textContent = `${q}/10`;
    $("dg-text").innerHTML = Q.text; speak(Q.say);
    $("dg-answers").innerHTML = Q.options.map((o) => `<button type="button" class="bf-ans" data-ans="${o}">${o}</button>`).join("");
    $("dg-answers").querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => {
      const ok = btn.dataset.ans === Q.answer; if (ok) score++; $("dg-score").textContent = score;
      $("dg-answers").querySelectorAll("button").forEach((x) => { x.disabled = true; if (x.dataset.ans === Q.answer) x.classList.add("is-right"); });
      if (!ok) btn.classList.add("is-wrong");
      const marks = {}; Q.show.forEach((s) => { marks[s] = "good"; }); mark(board, marks);
      $("dg-msg").innerHTML = (ok ? '<b class="bf-ok">Correct!</b> ' : `<b class="bf-no">It's ${Q.answer}.</b> `) + Q.explain;
      $("dg-answers").insertAdjacentHTML("beforeend", `<button type="button" class="bf-next">Next <i class="fas fa-arrow-right"></i></button>`);
      $("dg-answers").querySelector(".bf-next").addEventListener("click", ask);
    }));
  }
  $("dg-start").addEventListener("click", () => { q = 0; score = 0; active = true; $("dg-score").textContent = 0; $("dg-start").classList.add("hidden"); ask(); });
})();

// =====================================================================
// 8. Hear the Position: the position is read out piece by piece, never shown
// =====================================================================
(() => {
  const cfg = { easy: { pieces: [3, 6], secs: 0, q: 4 }, medium: { pieces: [6, 10], secs: 30, q: 5 }, hard: { pieces: [9, 16], secs: 20, q: 5 } };
  const board = $("hr-board"); let run = 0;
  board.setPosition({}, false);
  stoppers.hear = () => { run++; if (countdown.cancel) countdown.cancel(); $("hr-start").classList.remove("hidden"); $("hr-ready").classList.add("hidden"); };
  const ORDER = ["k", "q", "r", "b", "n", "p"];
  function dictation(game) {
    const all = pieces(game), side = (c) => {
      const parts = ORDER.map((t) => { const sq = all.filter((p) => p.color === c && p.type === t).map((p) => p.square).sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a < b ? -1 : 1);
        if (!sq.length) return null; const nm = cap(NAMES[t]) + (sq.length > 1 ? "s" : ""); return `${nm} ${sq.length > 1 ? sq.slice(0, -1).join(", ") + " and " + sq[sq.length - 1] : sq[0]}`; }).filter(Boolean);
      return parts.join(", ");
    };
    return { w: side("w"), b: side("b") };
  }
  $("hr-start").addEventListener("click", async () => {
    const my = ++run, c = cfg[level];
    $("hr-start").classList.add("hidden"); $("hr-answers").innerHTML = ""; $("hr-msg").textContent = ""; $("hr-score").textContent = "–"; $("hr-card").classList.add("hidden");
    $("hr-text").textContent = "Loading a position…"; board.setPosition({}, false); mark(board, {});
    let pool; try { pool = await puzzlePool(1100); } catch (e) { $("hr-text").textContent = "Couldn't load positions. Check your connection and try again."; $("hr-start").classList.remove("hidden"); return; }
    if (my !== run) return;
    let pz, game;
    for (let k = 0; k < 400; k++) {
      pz = pickOne(pool); if (seen.has("h" + pz.id)) continue;
      game = new Chess(pz.fen); try { game.move({ from: pz.moves[0].slice(0, 2), to: pz.moves[0].slice(2, 4), promotion: pz.moves[0][4] }); } catch (e) { continue; }
      const n = pieces(game).length; if (n >= c.pieces[0] && n <= c.pieces[1]) break;
    }
    remember("h" + pz.id);
    const d = dictation(game);
    $("hr-card").innerHTML = `<p><b>White:</b> ${d.w}.</p><p><b>Black:</b> ${d.b}.</p>`; $("hr-card").classList.remove("hidden");
    speak(`White: ${d.w}. Black: ${d.b}.`);
    if (c.secs) {
      $("hr-text").innerHTML = `Build this position in your head. The description disappears in <b>${c.secs} seconds</b>. Don't look at the board: it stays empty.`;
      await countdown($("hr-bar"), c.secs, $("hr-ready")); if (my !== run) return;
      $("hr-card").classList.add("hidden");
    } else $("hr-text").innerHTML = "Build this position in your head. On Easy the description stays while you answer.";
    const qs = makeQuestions(game, c.q);
    const right = await askAll(qs, { text: $("hr-text"), answers: $("hr-answers"), msg: $("hr-msg"), board, game, alive: () => my === run });
    if (my !== run) return;
    board.setPosition(posObj(game), false); mark(board, {}); $("hr-card").classList.remove("hidden");
    const perfect = right === qs.length; if (perfect) addOne("hear");
    roundDone("hear");
    $("hr-score").textContent = `${right}/${qs.length}`;
    $("hr-text").innerHTML = perfect ? '<b class="bf-ok">Perfect round!</b> This is the position you built.' : `You got <b>${right} of ${qs.length}</b>. Here is the real position. Compare it with your picture.`;
    $("hr-answers").innerHTML = ""; $("hr-start").innerHTML = '<i class="fas fa-redo"></i> Next position'; $("hr-start").classList.remove("hidden");
    track("blindfold_round", { drill: "hear", level, score: right });
  });
})();

// =====================================================================
// small chess engine (Play Blindfold): material + piece placement, alpha-beta with capture search
// =====================================================================
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
function evalWhite(g) {
  let s = 0; const opening = g.moveNumber() < 25;
  for (const row of g.board()) for (const p of row) {
    if (!p) continue; let v = VAL[p.type]; const c = centre(p.square), rk = Number(p.square[1]);
    if (p.type === "n") v += c * 10; else if (p.type === "b") v += c * 6;
    else if (p.type === "p") v += (p.color === "w" ? rk - 2 : 7 - rk) * (opening ? 4 : 10) + (c >= 2 ? 10 : 0);
    else if (p.type === "k") v += opening ? -c * 12 : c * 8;
    else if (p.type === "q" && opening && g.moveNumber() < 8) v -= c * 4;
    s += p.color === "w" ? v : -v;
  }
  return s;
}
const orderMoves = (ms) => ms.sort((a, b) => ((b.captured ? VAL[b.captured] * 10 - VAL[b.piece] : 0) + (b.promotion ? 800 : 0)) - ((a.captured ? VAL[a.captured] * 10 - VAL[a.piece] : 0) + (a.promotion ? 800 : 0)));
let deadline = Infinity;
const TIMEOUT = {};
function quiesce(g, alpha, beta, d) {
  const stand = (g.turn() === "w" ? 1 : -1) * evalWhite(g); if (stand >= beta) return beta; if (stand > alpha) alpha = stand; if (d === 0) return alpha;
  for (const m of orderMoves(g.moves({ verbose: true }).filter((x) => x.captured))) { g.move(m); const sc = -quiesce(g, -beta, -alpha, d - 1); g.undo(); if (sc >= beta) return beta; if (sc > alpha) alpha = sc; }
  return alpha;
}
function search(g, depth, alpha, beta, ply) {
  if (performance.now() > deadline) throw TIMEOUT;
  const ms = g.moves({ verbose: true });
  if (!ms.length) return g.inCheck() ? -100000 + ply : 0;
  if (depth <= 0) return quiesce(g, alpha, beta, 2);
  for (const m of orderMoves(ms)) { g.move(m); let sc; try { sc = -search(g, depth - 1, -beta, -alpha, ply + 1); } finally { g.undo(); } if (sc >= beta) return beta; if (sc > alpha) alpha = sc; }
  return alpha;
}
// easy: one move ahead with noise (human-like mistakes); medium/hard: deeper search within a time budget
function engineMove(g, lvl) {
  let ms = shuffle(g.moves({ verbose: true }));
  if (lvl === "easy") {
    let best = null, bs = -Infinity;
    for (const m of ms) { g.move(m); const sc = -quiesce(g, -1e9, 1e9, 1) + (Math.random() - 0.5) * 160; g.undo(); if (sc > bs) { bs = sc; best = m; } }
    return best;
  }
  const maxDepth = lvl === "medium" ? 2 : 3; deadline = performance.now() + (lvl === "medium" ? 700 : 1600);
  let best = orderMoves(ms)[0];
  for (let depth = 1; depth <= maxDepth; depth++) {   // iterative deepening: keep the best move of the last finished depth
    let alpha = -1e9, bestHere = null; const scores = new Map();
    try {
      for (const m of ms) { g.move(m); let sc; try { sc = -search(g, depth - 1, -1e9, -alpha, 1); } finally { g.undo(); } scores.set(m, sc); if (sc > alpha || !bestHere) { alpha = sc; bestHere = m; } }
    } catch (e) { if (e !== TIMEOUT) throw e; break; }
    best = bestHere; ms = ms.slice().sort((x, y) => (scores.get(y) ?? -1e9) - (scores.get(x) ?? -1e9));
    if (alpha > 90000) break;   // found a mate
  }
  deadline = Infinity;
  return best;
}

// =====================================================================
// 9. Blindfold Mates: checkmate a lone king with the pieces hidden
// =====================================================================
(() => {
  const cfg = { easy: { set: ["R", "R"], secs: 15, limit: 20, label: "two rooks" }, medium: { set: ["Q"], secs: 12, limit: 20, label: "king and queen" }, hard: { set: ["R"], secs: 10, limit: 32, label: "king and rook" } };
  const board = $("mt-board"); let state = null, run = 0;
  board.setPosition({}, false);
  const input = blindInput(board, $("mt-form"), $("mt-input"), () => state && state.blind && !state.thinking, (inp) => play(inp));
  stoppers.mates = () => { run++; if (countdown.cancel) countdown.cancel(); state = null; ui(false); };
  function ui(playing) { ["mt-peek", "mt-giveup"].forEach((id) => $(id).classList.toggle("hidden", !playing)); $("mt-form").classList.toggle("hidden", !playing); $("mt-start").classList.toggle("hidden", playing); }
  function randomPosition(set) {
    for (let k = 0; k < 500; k++) {
      const g = new Chess(); g.clear();
      const free = () => { let s; do { s = sqName(rnd(8), rnd(8)); } while (g.get(s)); return s; };
      const bk = sqName(2 + rnd(4), 2 + rnd(4)); g.put({ type: "k", color: "b" }, bk);
      let wk; do { wk = free(); } while (Math.max(Math.abs(FILES.indexOf(wk[0]) - FILES.indexOf(bk[0])), Math.abs(wk[1] - bk[1])) < 3);
      g.put({ type: "k", color: "w" }, wk);
      for (const t of set) { let s; do { s = free(); } while (Math.max(Math.abs(FILES.indexOf(s[0]) - FILES.indexOf(bk[0])), Math.abs(s[1] - bk[1])) < 2); g.put({ type: t.toLowerCase(), color: "w" }, s); }
      const fen = g.fen().replace(/ [wb] /, " w ");
      try { const g2 = new Chess(fen); const g3 = new Chess(fen.replace(" w ", " b ")); if (!g3.inCheck() && g2.moves().length) return g2; } catch (e) { /* try again */ }
    }
    return null;
  }
  function defend(g) { // the lone king runs for the centre and the most room
    let best = null, bs = -Infinity;
    for (const m of shuffle(g.moves({ verbose: true }))) {
      g.move(m); let worst = Infinity;
      if (m.captured) worst = 5000;
      else for (const w of g.moves({ verbose: true })) { g.move(w); const n = g.moves().length; worst = Math.min(worst, n === 0 ? (g.inCheck() ? -1000 : 1000) : n * 3 + centre(g.board().flat().find((p) => p && p.type === "k" && p.color === "b").square) * 4); g.undo(); }
      g.undo(); if (worst > bs) { bs = worst; best = m; }
    }
    return best;
  }
  $("mt-start").addEventListener("click", async () => {
    const my = ++run, c = cfg[level]; const g = randomPosition(c.set);
    state = { g, peeks: 0, moves: 0, blind: false, thinking: false, sans: [] }; input.reset();
    $("mt-msg").textContent = ""; $("mt-list").innerHTML = ""; $("mt-start").classList.add("hidden");
    board.orientation = "white"; board.setPosition(posObj(g), false); mark(board, {});
    $("mt-moves").textContent = `0/${c.limit}`;
    $("mt-text").innerHTML = `Checkmate the black king with <b>${c.label}</b> in ${c.limit} moves or fewer. Memorise the position: <b>${c.secs} seconds</b>.`;
    speak(`Checkmate with ${c.label}. Memorise the position.`);
    await countdown($("mt-bar"), c.secs, $("mt-ready")); if (my !== run) return;
    board.setPosition({}, false); state.blind = true; ui(true);
    $("mt-text").innerHTML = "The pieces are gone. <b>Your move.</b> Tap a piece's square and then where it goes, or type the move.";
    if (matchMedia("(pointer: fine)").matches) $("mt-input").focus();
  });
  function play(inp) {
    const { g } = state, c = cfg[level]; const mv = applyInput(g, inp);
    if (!mv) { $("mt-msg").innerHTML = '<b class="bf-no">That isn’t a legal move here.</b> Picture the board and try again.'; return; }
    input.reset(); state.moves++; state.sans.push(mv.san); $("mt-moves").textContent = `${state.moves}/${c.limit}`;
    if (g.isCheckmate()) return finish(true, `Checkmate in ${state.moves} moves${state.peeks ? "" : ", completely blind"}!`);
    if (g.isStalemate()) return finish(false, "Stalemate! The black king has no moves but isn't in check, so it's a draw.");
    const reply = defend(g); g.move(reply); state.sans.push(reply.san);
    if (reply.captured) return finish(false, `The king took your ${NAMES[reply.captured]} on ${reply.to}. Keep your pieces protected or far from the king.`);
    $("mt-list").innerHTML = lineHTML(state.sans);
    if (state.moves >= c.limit) return finish(false, `Out of moves. The king is still free.`);
    $("mt-msg").innerHTML = `${mv.san}${mv.san.includes("+") ? " (check)" : ""}. Black replies <b>${reply.san}</b>.`;
    speak(`Black king ${reply.to.split("").join(" ")}.`);
  }
  function finish(won, text) {
    const { g } = state; board.setPosition(posObj(g), false); state.blind = false; ui(false);
    $("mt-list").innerHTML = lineHTML(state.sans);
    $("mt-text").innerHTML = won ? `<b class="bf-ok">${text}</b>` : `<b class="bf-no">${text}</b>`; $("mt-msg").textContent = "";
    if (won) addOne("mates"); speak(won ? "Checkmate!" : "Not this time.");
    roundDone("mates"); track("blindfold_round", { drill: "mates", level, score: won ? 1 : 0 });
    $("mt-start").innerHTML = '<i class="fas fa-redo"></i> New position'; state = null;
  }
  $("mt-peek").addEventListener("click", () => { if (!state || !state.blind) return; state.peeks++; $("mt-peeks").textContent = state.peeks; board.setPosition(posObj(state.g), false); $("mt-peek").disabled = true; setTimeout(() => { if (state && state.blind) board.setPosition({}, false); $("mt-peek").disabled = false; }, 1500); });
  $("mt-giveup").addEventListener("click", () => { if (state) finish(false, "Here's where everything was."); });
})();

// =====================================================================
// 10. Play Blindfold: a whole game against the computer, without seeing the pieces
// =====================================================================
(() => {
  const board = $("pl-board"); let state = null, colour = "w";
  board.setPosition({}, false);
  const input = blindInput(board, $("pl-form"), $("pl-input"), () => state && !state.thinking && state.g.turn() === state.me, (inp) => mine(inp));
  stoppers.play = () => { if (state) { state.dead = true; state = null; } ui(false); };
  document.querySelectorAll("[data-plcol]").forEach((b) => b.addEventListener("click", () => { colour = b.dataset.plcol; document.querySelectorAll("[data-plcol]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));
  function ui(playing) { ["pl-peek", "pl-resign"].forEach((id) => $(id).classList.toggle("hidden", !playing)); $("pl-form").classList.toggle("hidden", !playing); $("pl-start").classList.toggle("hidden", playing); $("pl-colours").classList.toggle("hidden", playing); }
  const showList = () => { const s = state.sans; $("pl-list").innerHTML = level === "hard" ? (s.length ? `<span class="bf-qn">Only the last move is shown</span>` + lineHTML(s.slice(-1), s.length - 1) : "") : lineHTML(s); };
  $("pl-start").addEventListener("click", () => {
    const g = new Chess(); state = { g, me: colour, peeks: 0, sans: [], thinking: false, dead: false };
    board.orientation = colour === "w" ? "white" : "black"; board.setPosition({}, false); mark(board, {}); input.reset();
    ui(true); $("pl-msg").textContent = ""; $("pl-peeks").textContent = 0; showList();
    $("pl-text").innerHTML = `You play <b>${colour === "w" ? "White" : "Black"}</b> against the computer (${cap(level)}). The board stays empty: keep the game in your head.`;
    speak(`New game. You play ${colour === "w" ? "white" : "black"}.`);
    if (colour === "b") setTimeout(computer, 400); else $("pl-msg").innerHTML = "Your move. Tap a square then its destination, or type the move (e.g. <b>e4</b>, <b>Nf3</b>).";
    track("blindfold_game_start", { level, colour });
  });
  function mine(inp) {
    const g = state.g, mv = applyInput(g, inp);
    if (!mv) { $("pl-msg").innerHTML = '<b class="bf-no">That isn’t a legal move here.</b> Picture the position again.'; return; }
    input.reset(); state.sans.push(mv.san); showList(); speak("You: " + sanWords(mv.san));
    if (over()) return;
    setTimeout(computer, 250);
  }
  function computer() {
    if (!state || state.dead) return; const g = state.g; state.thinking = true; $("pl-msg").innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> The computer is thinking…';
    setTimeout(() => {
      if (!state || state.dead) return;
      const m = engineMove(g, level); const mv = g.move(m); state.sans.push(mv.san); state.thinking = false; showList();
      $("pl-msg").innerHTML = `Computer plays <b>${mv.san}</b>. Your move.`; speak("Computer: " + sanWords(mv.san));
      over();
    }, 60);
  }
  function over() {
    const g = state.g; if (!g.isGameOver()) return false;
    let text, won = false;
    if (g.isCheckmate()) { won = g.turn() !== state.me; text = won ? `Checkmate! You won blindfold${state.peeks ? ` (with ${state.peeks} peek${state.peeks > 1 ? "s" : ""})` : ""}.` : "Checkmate. The computer won this time."; }
    else text = g.isStalemate() ? "Stalemate: a draw." : g.isThreefoldRepetition() ? "Draw by repetition." : g.isInsufficientMaterial() ? "Draw: not enough material to mate." : "Draw.";
    end(won, text); return true;
  }
  function end(won, text) {
    board.setPosition(posObj(state.g), false); ui(false);
    $("pl-text").innerHTML = won ? `<b class="bf-ok">${text}</b>` : `<b>${text}</b>`; $("pl-msg").innerHTML = "";
    $("pl-list").innerHTML = lineHTML(state.sans);
    if (won) addOne("play"); speak(text);
    roundDone("play"); track("blindfold_game_end", { level, won, moves: state.sans.length, peeks: state.peeks });
    $("pl-start").innerHTML = '<i class="fas fa-redo"></i> New game'; state = null;
  }
  $("pl-peek").addEventListener("click", () => { if (!state) return; state.peeks++; $("pl-peeks").textContent = state.peeks; board.setPosition(posObj(state.g), false); $("pl-peek").disabled = true; setTimeout(() => { if (state) board.setPosition({}, false); $("pl-peek").disabled = false; }, 2000); });
  $("pl-resign").addEventListener("click", () => { if (state) end(false, "You resigned. Here's the final position. Try again!"); });
})();

// ---------- start ----------
level = store.get("level", "easy");
document.querySelectorAll(".bf-levels button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.level === level)));
planSync(); refreshBests();
const fromHash = location.hash.slice(1);
showDrill(DRILL_IDS.includes(fromHash) ? fromHash : "colours", false);
if (fromHash === "daily" && $("bp-daily-btn")) $("bp-daily-btn").click();
