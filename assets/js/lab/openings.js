// ChessDepth Chess Lab - Opening courses: Learn (guided) and Practice (from memory), with points.
import { startLabPage, toast, esc } from "./shell.js";
import { award, saveProgress, track } from "./lab-core.js";
import { makeBoard } from "./board.js";

const GROUPS = [["white", "As White"], ["black_e4", "As Black vs 1.e4"], ["black_d4", "As Black vs 1.d4"]];
const DAY = 86400000;

startLabPage({ toolName: "Opening courses", ready: run });

async function run(st, prog) {
  const data = await fetch("/assets/lab/openings.json").then((r) => r.json());
  const courses = data.courses;
  const O = prog.openings;
  const list = document.getElementById("op-list"), title = document.getElementById("op-title"), intro = document.getElementById("op-intro");
  const movesEl = document.getElementById("op-moves"), noteEl = document.getElementById("op-note"), statusEl = document.getElementById("op-status");
  const learnBtn = document.getElementById("op-learn"), practiceBtn = document.getElementById("op-practice"), restartBtn = document.getElementById("op-restart");
  let course = null, mode = "learn", idx = 0, mistakes = 0, tries = 0, busy = false, finished = false;
  const board = await makeBoard(document.getElementById("op-board"), { onUserMove, canDrag: () => course && !busy && !finished && isMine(idx) });

  function rec(id) { return (O[id] = O[id] || { learned: false, practiced: 0, perfect: 0, best: null, last: null }); }
  function badge(c) {
    const r = O[c.id];
    if (!r) return `<span class="op-badge">New</span>`;
    if (r.perfect >= 2) return `<span class="op-badge op-mastered"><i class="fas fa-star"></i> Mastered</span>`;
    if (r.last && Date.now() - r.last > 3 * DAY) return `<span class="op-badge op-due">Review due</span>`;
    if (r.learned) return `<span class="op-badge op-learned"><i class="fas fa-check"></i> Learned</span>`;
    return `<span class="op-badge">Started</span>`;
  }
  function renderList() {
    list.innerHTML = GROUPS.map(([g, label]) => `<p class="op-group">${label}</p>` + courses.filter((c) => c.group === g).map((c) =>
      `<button type="button" class="op-item${course && course.id === c.id ? " is-active" : ""}" data-id="${c.id}"><span class="op-item-name">${esc(c.name)}</span><span class="op-item-meta">${esc(c.level)} · ${badge(c)}</span></button>`).join("")).join("");
  }
  const isMine = (i) => (i % 2 === 0) === (course.side === "w");

  function renderMoves() {
    const L = course.line; let html = "";
    for (let i = 0; i < L.length; i += 2) {
      const cell = (j) => {
        if (j >= L.length) return "<span></span>";
        const shown = j < idx || (mode === "learn");
        const cls = j < idx ? "op-mv done" : j === idx ? "op-mv now" : "op-mv";
        return `<span class="${cls}">${shown ? esc(L[j].san) : "…"}</span>`;
      };
      html += `<span class="op-no">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}`;
    }
    movesEl.innerHTML = html;
  }

  async function startCourse(c, m) {
    course = c; mode = m || mode; idx = 0; mistakes = 0; tries = 0; finished = false; busy = true;
    title.textContent = c.name; intro.textContent = c.intro;
    learnBtn.classList.toggle("is-active", mode === "learn"); practiceBtn.classList.toggle("is-active", mode === "practice");
    board.load("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"); board.orient(c.side);
    noteEl.innerHTML = mode === "learn" ? `<b>Learn mode.</b> Play the highlighted moves for ${c.side === "w" ? "White" : "Black"}; your opponent's replies are played for you.` : `<b>Practice mode.</b> Play the whole line from memory. Mistakes are counted.`;
    renderList(); renderMoves(); busy = false;
    await autoPlay();
    prompt();
  }
  async function autoPlay() {
    while (idx < course.line.length && !isMine(idx)) {
      busy = true; await wait(450); const mv = course.line[idx]; board.play(mv.uci); showNote(idx); idx++; renderMoves();
    }
    busy = false;
    if (idx >= course.line.length) complete();
  }
  function showNote(i) { const n = course.line[i].note; if (n && mode === "learn") noteEl.innerHTML = `<b>${moveLabel(i)}</b> ${esc(n)}`; }
  function moveLabel(i) { return `${Math.floor(i / 2) + 1}${i % 2 === 0 ? "." : "…"}${course.line[i].san}`; }
  function prompt() {
    if (finished || idx >= course.line.length) return;
    statusEl.className = "op-status";
    statusEl.innerHTML = mode === "learn" ? `Your move: <b>${esc(moveLabel(idx))}</b>` : `Your move ${tries ? `(attempt ${tries + 1})` : ""}`;
  }

  function onUserMove(mv) {
    if (!course || finished) return false;
    const exp = course.line[idx];
    if (mv.uci === exp.uci) {
      board.game.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
      showNote(idx); idx++; tries = 0; renderMoves();
      if (mode === "practice") { statusEl.className = "op-status ok"; statusEl.textContent = "Correct"; }
      setTimeout(async () => { await autoPlay(); prompt(); }, 150);
      return true;
    }
    mistakes++; tries++;
    statusEl.className = "op-status bad";
    if (mode === "learn") statusEl.innerHTML = `Not this time. Play <b>${esc(moveLabel(idx))}</b>.`;
    else if (tries >= 3) statusEl.innerHTML = `The move is <b>${esc(moveLabel(idx))}</b>. Play it to continue.`;
    else statusEl.textContent = "Not the book move. Try again.";
    return false;
  }

  function complete() {
    finished = true; const r = rec(course.id); let pts = 0, msg = "";
    if (mode === "learn") {
      if (!r.learned) { pts = 20; r.learned = true; msg = "Course learned! Now try Practice mode to master it."; }
      else { pts = 0; msg = "Nice revision. Practise it from memory to earn more points."; }
    } else {
      r.practiced++;
      const review = r.last && Date.now() - r.last > 3 * DAY;
      if (mistakes === 0) { r.perfect++; pts = review ? 40 : 30; msg = r.perfect >= 2 ? "Perfect! This line is now mastered." : "Perfect run! One more perfect run to master it."; }
      else if (mistakes <= 2) { pts = 15; msg = `Completed with ${mistakes} mistake${mistakes > 1 ? "s" : ""}. Go again for a perfect run.`; }
      else { pts = 5; msg = `Completed with ${mistakes} mistakes. Try Learn mode once more, then practise again.`; }
      r.best = r.best == null ? mistakes : Math.min(r.best, mistakes);
      if (r.perfect === 2 && mistakes === 0) pts += 50;
    }
    r.last = Date.now();
    const res = pts ? award(pts, `${course.name} (${mode})`) : (saveProgress(), { added: 0 });
    statusEl.className = "op-status ok";
    statusEl.innerHTML = `<b>${esc(msg)}</b>${res.added ? ` +${res.added} points` : ""}`;
    renderList(); renderMoves();
    track("lab_opening", { course: course.id, mode, mistakes });
  }

  list.addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (!b) return; startCourse(courses.find((c) => c.id === b.dataset.id)); });
  learnBtn.addEventListener("click", () => course && startCourse(course, "learn"));
  practiceBtn.addEventListener("click", () => course && startCourse(course, "practice"));
  restartBtn.addEventListener("click", () => course && startCourse(course, mode));
  renderList();
  // A link like /lab/openings/#scotch opens that course directly.
  const fromHash = courses.find((c) => c.id === decodeURIComponent(location.hash.slice(1)));
  if (fromHash) setTimeout(() => { const b = list.querySelector(`[data-id="${fromHash.id}"]`); if (b) b.scrollIntoView({ block: "nearest" }); }, 50);
  startCourse(fromHash || courses[0], "learn");
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
