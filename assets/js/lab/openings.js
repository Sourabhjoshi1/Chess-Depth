// ChessDepth Chess Lab - Opening courses: Learn (guided) and Practice (from memory), with points.
// Each course has a main line plus branches (the opponent's common alternatives). "Whole opening" runs
// through every line in turn; in Practice the lines come in random order, so you never know which one is next.
import { startLabPage, toast, esc } from "./shell.js";
import { award, saveProgress, track } from "./lab-core.js";
import { makeBoard } from "./board.js";

const GROUPS = [["white", "As White"], ["black_e4", "As Black vs 1.e4"], ["black_d4", "As Black vs 1.d4"]];
const DAY = 86400000;
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

startLabPage({ toolName: "Opening courses", ready: run });

async function run(st, prog) {
  const data = await fetch("/assets/lab/openings.json").then((r) => r.json());
  const courses = data.courses;
  courses.forEach((c) => { if (!c.variations) c.variations = [{ id: "main", name: "Main line", from: null, line: c.line }]; });
  const O = prog.openings;
  const $ = (id) => document.getElementById(id);
  const list = $("op-list"), title = $("op-title"), intro = $("op-intro"), varsEl = $("op-vars");
  const movesEl = $("op-moves"), noteEl = $("op-note"), statusEl = $("op-status");
  const learnBtn = $("op-learn"), practiceBtn = $("op-practice"), restartBtn = $("op-restart");
  // sel: index of the chosen line, or "all" for the whole opening. queue: lines still to play in this run.
  let fresh = new Set(), course = null, mode = "learn", sel = 0, queue = [], cur = null, idx = 0, mistakes = 0, tries = 0, busy = false, finished = false, runId = 0, done = 0;
  const board = await makeBoard($("op-board"), { onUserMove, canDrag: () => course && cur && !busy && !finished && isMine(idx) });

  function rec(id) { const r = (O[id] = O[id] || { learned: false, practiced: 0, perfect: 0, best: null, last: null }); r.vars = r.vars || {}; return r; }
  // progress of one line: the main line keeps the original fields, branches live in r.vars
  function lineRec(c, v) { const r = rec(c.id); if (v.id === "main") return r; return (r.vars[v.id] = r.vars[v.id] || { learned: false, perfect: 0 }); }
  const lineInfo = (c, v) => { const r = O[c.id]; if (!r) return null; return v.id === "main" ? r : (r.vars || {})[v.id] || null; };
  const branches = (c) => c.variations.length - 1;
  const learnedCount = (c) => c.variations.filter((v) => { const x = lineInfo(c, v); return x && x.learned; }).length;
  function badge(c) {
    const r = O[c.id], n = c.variations.length;
    if (!r) return `<span class="op-badge">New</span>`;
    if (r.whole >= 1 || (n === 1 && r.perfect >= 2)) return `<span class="op-badge op-mastered"><i class="fas fa-star"></i> Mastered</span>`;
    if (r.last && Date.now() - r.last > 3 * DAY) return `<span class="op-badge op-due">Review due</span>`;
    const k = learnedCount(c);
    if (r.perfect >= 2) return `<span class="op-badge op-learned"><i class="fas fa-star"></i> Main line mastered · ${k}/${n} lines</span>`;
    if (n > 1 && k) return `<span class="op-badge op-learned"><i class="fas fa-check"></i> ${k}/${n} lines</span>`;
    if (r.learned) return `<span class="op-badge op-learned"><i class="fas fa-check"></i> Learned</span>`;
    return `<span class="op-badge">Started</span>`;
  }
  const isDue = (c) => { const r = O[c.id]; return r && r.learned && !(r.whole >= 1) && r.perfect < 2 && r.last && Date.now() - r.last > 3 * DAY; };
  function renderList() {
    const due = courses.filter(isDue);
    list.innerHTML = (due.length ? `<p class="op-group op-group-due"><i class="fas fa-bell"></i> Due for review (${due.length})</p>` + due.map((c) =>
      `<button type="button" class="op-item op-item-due" data-id="${c.id}" data-mode="practice"><span class="op-item-name">${esc(c.name)}</span><span class="op-item-meta">Practise from memory for bonus points</span></button>`).join("") : "") + GROUPS.map(([g, label]) => `<p class="op-group">${label}</p>` + courses.filter((c) => c.group === g).map((c) =>
      `<button type="button" class="op-item${course && course.id === c.id ? " is-active" : ""}" data-id="${c.id}"><span class="op-item-name">${esc(c.name)}</span><span class="op-item-meta">${esc(c.level)} · ${c.variations.length} line${c.variations.length > 1 ? "s" : ""} · ${badge(c)}</span></button>`).join("")).join("");
  }
  function renderVars() {
    if (!course || course.variations.length < 2) { varsEl.innerHTML = ""; varsEl.classList.add("hidden"); return; }
    varsEl.classList.remove("hidden");
    const r = O[course.id] || {};
    const chip = (v, i) => {
      const x = lineInfo(course, v), ic = x && x.perfect ? '<i class="fas fa-star" aria-label="practised perfectly"></i>' : x && x.learned ? '<i class="fas fa-check" aria-label="learned"></i>' : "";
      const label = v.id === "main" ? "Main line" : v.name;
      return `<button type="button" class="op-var${sel === i ? " is-active" : ""}" data-var="${i}">${ic}<span>${esc(label)}</span></button>`;
    };
    varsEl.innerHTML = `<p class="op-vars-h">Lines in this course</p><div class="op-var-list">${course.variations.map(chip).join("")}` +
      `<button type="button" class="op-var op-var-all${sel === "all" ? " is-active" : ""}" data-var="all">${r.whole ? '<i class="fas fa-star"></i>' : '<i class="fas fa-sitemap"></i>'}<span>Whole opening · ${course.variations.length} lines</span></button></div>`;
  }
  const isMine = (i) => (i % 2 === 0) === (course.side === "w");

  function renderMoves() {
    if (!cur) { movesEl.innerHTML = ""; return; }
    const L = cur.line; let html = "";
    for (let i = 0; i < L.length; i += 2) {
      const cell = (j) => {
        if (j >= L.length) return "<span></span>";
        const shown = j < idx || mode === "learn";
        let cls = j < idx ? "op-mv done" : j === idx ? "op-mv now" : "op-mv";
        if (cur.from != null && j === cur.from && (shown || j < idx)) cls += " op-branch";
        return `<span class="${cls}">${shown ? esc(L[j].san) : "…"}</span>`;
      };
      html += `<span class="op-no">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}`;
    }
    movesEl.innerHTML = html;
  }
  const moveLabel = (i, line = cur.line) => `${Math.floor(i / 2) + 1}${i % 2 === 0 ? "." : "…"}${line[i].san}`;

  // Start a course (or a different line / mode of the same course).
  async function startCourse(c, m, s) {
    const changed = !course || course.id !== c.id;
    course = c; mode = m || mode; sel = s != null ? s : changed ? 0 : sel;
    if (sel !== "all" && !c.variations[sel]) sel = 0;
    title.textContent = c.name; intro.textContent = c.intro;
    learnBtn.classList.toggle("is-active", mode === "learn"); practiceBtn.classList.toggle("is-active", mode === "practice");
    board.orient(c.side);
    if (sel === "all") {
      queue = c.variations.slice();
      if (mode === "practice") for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
    } else queue = [c.variations[sel]];
    mistakes = 0; done = 0; finished = false; fresh = new Set();
    renderList(); renderVars();
    await startLine();
  }
  async function startLine() {
    const my = ++runId;
    cur = queue.shift(); idx = 0; tries = 0; busy = true;
    board.load(START);
    const side = course.side === "w" ? "White" : "Black", opp = course.side === "w" ? "Black" : "White";
    const total = course.variations.length, part = sel === "all" ? `<b>Line ${done + 1} of ${total}.</b> ` : "";
    if (mode === "learn") {
      const branchTxt = cur.from != null ? ` This branch follows the main line until <b>${esc(moveLabel(cur.from))}</b>, where ${esc(cur.from % 2 === 0 ? "White" : "Black")} plays differently.` : "";
      noteEl.innerHTML = `${part}<b>${esc(cur.id === "main" ? "Main line" : cur.name)}.</b> Play the highlighted moves for ${side}; ${opp}'s replies are played for you.${branchTxt}`;
    } else {
      noteEl.innerHTML = sel === "all" ? `${part}<b>Practice: whole opening.</b> ${opp} picks a different line each time and doesn't tell you which. Answer from memory.` : `<b>Practice mode.</b> Play the whole line from memory. Mistakes are counted.`;
    }
    renderMoves(); busy = false;
    await autoPlay(my);
    if (my === runId) prompt();
  }
  async function autoPlay(my) {
    while (cur && idx < cur.line.length && !isMine(idx)) {
      busy = true; await wait(450); if (my !== runId) return;
      const mv = cur.line[idx]; board.play(mv.uci); showNote(idx); idx++; renderMoves();
    }
    busy = false;
    if (cur && idx >= cur.line.length) lineDone();
  }
  function showNote(i) {
    const n = cur.line[i].note;
    if (mode === "learn" && n) noteEl.innerHTML = `<b>${esc(moveLabel(i))}</b> ${esc(n)}`;
    else if (mode === "practice" && cur.from != null && i === cur.from && !isMine(i)) noteEl.innerHTML = `<b>${esc(moveLabel(i))}</b> A different reply. Do you know this line?`;
  }
  function prompt() {
    if (finished || !cur || idx >= cur.line.length) return;
    statusEl.className = "op-status";
    statusEl.innerHTML = mode === "learn" ? `Your move: <b>${esc(moveLabel(idx))}</b>` : `Your move ${tries ? `(attempt ${tries + 1})` : ""}`;
  }

  function onUserMove(mv) {
    if (!course || !cur || finished) return false;
    const exp = cur.line[idx];
    if (mv.uci === exp.uci) {
      board.game.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
      showNote(idx); idx++; tries = 0; renderMoves();
      if (mode === "practice") { statusEl.className = "op-status ok"; statusEl.textContent = "Correct"; }
      const my = runId;
      setTimeout(async () => { await autoPlay(my); if (my === runId) prompt(); }, 150);
      return true;
    }
    mistakes++; tries++;
    statusEl.className = "op-status bad";
    if (mode === "learn") statusEl.innerHTML = `Not this time. Play <b>${esc(moveLabel(idx))}</b>.`;
    else if (tries >= 3) statusEl.innerHTML = `The move is <b>${esc(moveLabel(idx))}</b>. Play it to continue.`;
    else statusEl.textContent = "Not the book move. Try again.";
    return false;
  }

  // One line finished: in a whole-opening run, go on to the next line; otherwise score it.
  function lineDone() {
    done++;
    const lr = lineRec(course, cur);
    if (mode === "learn") { if (!lr.learned) fresh.add(cur.id); lr.learned = true; }
    if (sel === "all" && queue.length) {
      statusEl.className = "op-status ok";
      statusEl.innerHTML = `<b>Line ${done} done.</b> Next line…`;
      busy = true; setTimeout(() => { if (course && sel === "all") startLine(); }, 1400);
      return;
    }
    complete();
  }

  function complete() {
    finished = true; const r = rec(course.id); let pts = 0, msg = "";
    const whole = sel === "all", lines = course.variations.length;
    if (mode === "learn") {
      const nFresh = fresh.size; fresh = new Set();
      if (whole) {
        pts = nFresh * 10;
        msg = nFresh ? `All ${lines} lines learned! Now practise the whole opening from memory.` : "Nice revision. Practise the whole opening from memory to earn more points.";
      } else if (cur.id === "main") {
        pts = nFresh ? 20 : 0;
        msg = nFresh ? (lines > 1 ? "Main line learned! Now try the branches, or Practice mode." : "Course learned! Now try Practice mode to master it.") : "Nice revision. Practise it from memory to earn more points.";
      } else {
        pts = nFresh ? 10 : 0;
        msg = nFresh ? "Branch learned! Practise it, or try the whole opening." : "Nice revision. Practise it from memory to earn more points.";
      }
    } else {
      r.practiced++;
      const review = r.last && Date.now() - r.last > 3 * DAY;
      if (whole) {
        if (mistakes === 0) { r.whole = (r.whole || 0) + 1; pts = 60 + (review ? 10 : 0); if (r.whole === 1) pts += 50; msg = `Perfect! All ${lines} lines from memory. ${r.whole === 1 ? "This opening is now mastered." : ""}`; course.variations.forEach((v) => { lineRec(course, v).perfect = (lineRec(course, v).perfect || 0) + 1; }); }
        else if (mistakes <= 3) { pts = 25; msg = `All ${lines} lines done with ${mistakes} mistake${mistakes > 1 ? "s" : ""}. Go again for a perfect run.`; }
        else { pts = 10; msg = `All ${lines} lines done with ${mistakes} mistakes. Learn the lines you missed, then try again.`; }
      } else {
        const lr = lineRec(course, cur);
        if (mistakes === 0) {
          lr.perfect = (lr.perfect || 0) + 1;
          if (cur.id === "main") { pts = review ? 40 : 30; msg = r.perfect >= 2 ? (lines > 1 ? "Perfect! Now try the whole opening." : "Perfect! This line is now mastered.") : "Perfect run! One more perfect run to master the main line."; if (r.perfect === 2 && lines === 1) pts += 50; }
          else { pts = 15; msg = "Perfect! Now try the whole opening."; }
        } else if (mistakes <= 2) { pts = cur.id === "main" ? 15 : 8; msg = `Completed with ${mistakes} mistake${mistakes > 1 ? "s" : ""}. Go again for a perfect run.`; }
        else { pts = 5; msg = `Completed with ${mistakes} mistakes. Try Learn mode once more, then practise again.`; }
        if (cur.id === "main") r.best = r.best == null ? mistakes : Math.min(r.best, mistakes);
      }
    }
    r.last = Date.now();
    const what = whole ? "whole opening" : cur.id === "main" ? "main line" : cur.name;
    const res = pts ? award(pts, `${course.name}: ${what} (${mode})`) : (saveProgress(), { added: 0 });
    statusEl.className = "op-status ok";
    statusEl.innerHTML = `<b>${esc(msg)}</b>${res.added ? ` +${res.added} points` : ""}`;
    if (whole && mode === "practice" && mistakes === 0 && r.whole === 1) toast(`<b>Opening mastered!</b> ${esc(course.name)}`);
    renderList(); renderVars(); renderMoves();
    track("lab_opening", { course: course.id, mode, mistakes, line: whole ? "all" : cur.id });
  }

  list.addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (!b) return; startCourse(courses.find((c) => c.id === b.dataset.id), b.dataset.mode, 0); });
  varsEl.addEventListener("click", (e) => { const b = e.target.closest("[data-var]"); if (!b || !course) return; startCourse(course, mode, b.dataset.var === "all" ? "all" : +b.dataset.var); });
  learnBtn.addEventListener("click", () => course && startCourse(course, "learn", sel));
  practiceBtn.addEventListener("click", () => course && startCourse(course, "practice", sel));
  restartBtn.addEventListener("click", () => course && startCourse(course, mode, sel));
  renderList();
  // A link like /lab/openings/#scotch opens that course directly.
  const fromHash = courses.find((c) => c.id === decodeURIComponent(location.hash.slice(1)));
  if (fromHash) setTimeout(() => { const b = list.querySelector(`[data-id="${fromHash.id}"]`); if (b) b.scrollIntoView({ block: "nearest" }); }, 50);
  startCourse(fromHash || courses[0], "learn", 0);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
