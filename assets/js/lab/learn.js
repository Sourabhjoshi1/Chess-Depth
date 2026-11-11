// ChessDepth Chess Lab - lesson player: read the idea, see it on the board, then answer a quiz or play the move.
// Courses live in /assets/lab/lessons.json. Progress: prog.lessons[courseId] = { done: [lesson indexes], finished, last }.
import { startLabPage, toast, esc } from "./shell.js";
import { award, saveProgress, track } from "./lab-core.js";
import { makeBoard } from "./board.js";

startLabPage({ toolName: "the Lab lessons", ready: run });

async function run(st, prog) {
  const $ = (id) => document.getElementById(id);
  const data = await fetch("/assets/lab/lessons.json").then((r) => r.json());
  const id = new URLSearchParams(location.search).get("c") || decodeURIComponent(location.hash.slice(1));
  const course = data.courses.find((c) => c.id === id);
  if (!course) { location.replace("/lab/courses/"); return; }
  document.title = `${course.title} | ChessDepth Chess Lab`;
  const ui = { course: $("ln-course"), dots: $("ln-dots"), title: $("ln-title"), text: $("ln-text"), task: $("ln-task"), fb: $("ln-feedback"), prev: $("ln-prev"), next: $("ln-next"), hint: $("ln-hint"), reset: $("ln-reset") };
  const L = course.lessons, N = L.length;
  prog.lessons = prog.lessons || {};
  const rec = (prog.lessons[course.id] = prog.lessons[course.id] || { done: [], finished: false });
  let i = Math.min(N - 1, L.findIndex((_, k) => !rec.done.includes(k)) < 0 ? 0 : L.findIndex((_, k) => !rec.done.includes(k)));
  let step = 0, solved = false, busy = false, token = 0;
  const board = await makeBoard($("ln-board"), { onUserMove, canDrag: () => !!L[i].move && !solved && !busy });

  const shapes = (l) => l.arrows.map((a) => ({ from: a.slice(0, 2), to: a.slice(2, 4), c: "g" })).concat(l.marks.map((m) => ({ from: m, to: m, c: "g" })));
  function feedback(html, kind) { ui.fb.className = "op-status " + (kind || ""); ui.fb.innerHTML = html; ui.fb.classList.toggle("hidden", !html); }
  function renderDots() {
    ui.dots.innerHTML = L.map((l, k) => `<button type="button" role="tab" aria-selected="${k === i}" aria-label="Lesson ${k + 1}: ${esc(l.t)}" class="ln-dot${k === i ? " is-cur" : ""}${rec.done.includes(k) ? " is-done" : ""}" data-k="${k}">${rec.done.includes(k) ? '<i class="fas fa-check"></i>' : k + 1}</button>`).join("");
  }
  function complete() {
    solved = true;
    if (!rec.done.includes(i)) {
      rec.done.push(i); rec.last = Date.now();
      let pts = 3, msg = `Lesson ${i + 1}: ${course.title}`;
      if (rec.done.length === N && !rec.finished) { rec.finished = true; pts += 20; msg = `Course completed: ${course.title}`; toast(`<b>🎓 Course completed!</b> ${esc(course.title)}`); track("lab_course_complete", { course: course.id }); }
      award(pts, msg);
    } else saveProgress();
    renderDots(); renderNext();
  }
  function renderNext() {
    const last = i === N - 1, l = L[i], needs = (l.move || l.quiz) && !solved && !rec.done.includes(i);
    ui.next.disabled = needs;
    ui.next.innerHTML = last ? (rec.finished || rec.done.length === N ? `Back to courses <i class="fas fa-check"></i>` : `Finish <i class="fas fa-check"></i>`) : `Next <i class="fas fa-arrow-right"></i>`;
    ui.prev.disabled = i === 0;
  }
  function show(k) {
    i = k; token++; step = 0; solved = false; busy = false;
    const l = L[i];
    ui.course.innerHTML = `${esc(course.title)} · <span>Lesson ${i + 1} of ${N}</span>`;
    ui.title.textContent = l.t; ui.text.textContent = l.text; feedback("");
    board.load(l.fen); board.orient(board.game.turn());
    // In a move task, only marks and the opponent's arrows show at first; your own arrows would give the answer away.
    const turn = board.game.turn();
    board.draw.show(l.move ? shapes(l).filter((x) => x.from === x.to || (board.game.get(x.from) && board.game.get(x.from).color !== turn)) : shapes(l));
    ui.hint.classList.toggle("hidden", !l.move); ui.reset.classList.toggle("hidden", !l.move); ui.hint.disabled = false;
    if (l.quiz) {
      ui.task.innerHTML = `<p class="ln-q">${esc(l.quiz.q)}</p><div class="ln-opts">${l.quiz.options.map((o, k) => `<button type="button" class="ln-opt" data-o="${k}">${esc(o)}</button>`).join("")}</div>`;
    } else if (l.move) {
      ui.task.innerHTML = `<p class="ln-q"><i class="fas fa-hand-pointer"></i> ${esc(l.move.prompt)}</p>`;
    } else ui.task.innerHTML = "";
    renderDots(); renderNext();
    history.replaceState(null, "", `?c=${course.id}#${i + 1}`);
    track("lab_lesson_view", { course: course.id, lesson: i + 1 });
  }
  function onUserMove(mv) {
    const l = L[i]; if (!l.move || solved || busy) return false;
    const m = l.move, g = board.game, exp = m.line[step];
    let ok = mv.uci === exp, alt = false;
    if (!ok && step === 0 && m.accept.includes(mv.uci)) { ok = true; alt = true; }
    if (!ok && m.anyMate) { const t = g.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); if (t && g.isCheckmate()) { ok = true; alt = true; } if (t) g.undo(); }
    if (!ok) { feedback("Not that one. Read the idea again and have another go, or ask for a hint.", "bad"); return false; }
    g.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); step++;
    if (alt || step >= m.line.length) { board.draw.show(shapes(l)); feedback(`<b>Correct!</b> ${esc(m.done)}`, "ok"); complete(); return true; }
    busy = true; const t = token; feedback("Good. Keep going…", "ok");
    setTimeout(() => { if (t !== token) return; board.play(m.line[step]); step++; busy = false; if (step >= m.line.length) { board.draw.show(shapes(l)); feedback(`<b>Correct!</b> ${esc(m.done)}`, "ok"); complete(); } }, 450);
    return true;
  }
  ui.task.addEventListener("click", (e) => {
    const b = e.target.closest("[data-o]"); const l = L[i]; if (!b || !l.quiz || solved) return;
    const k = Number(b.dataset.o);
    if (k === l.quiz.answer) {
      b.classList.add("is-right"); ui.task.querySelectorAll(".ln-opt").forEach((x) => (x.disabled = true));
      feedback(`<b>Correct!</b> ${esc(l.quiz.why)}`, "ok"); complete();
    } else { b.classList.add("is-wrong"); b.disabled = true; feedback("Not quite. Look at the board again and try another answer.", "bad"); }
  });
  ui.hint.addEventListener("click", () => {
    const l = L[i]; if (!l.move || solved || busy) return;
    const u = l.move.line[step];
    board.draw.show([{ from: u.slice(0, 2), to: u.slice(2, 4), c: "g" }]); feedback("The arrow shows the move.", "");
  });
  ui.reset.addEventListener("click", () => show(i));
  ui.prev.addEventListener("click", () => i > 0 && show(i - 1));
  ui.next.addEventListener("click", () => {
    const l = L[i];
    if (!l.move && !l.quiz && !rec.done.includes(i)) complete();
    if (i < N - 1) show(i + 1); else location.href = "/lab/courses/?cat=" + course.cat;
  });
  ui.dots.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) show(Number(b.dataset.k)); });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, select, textarea") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowRight" && !ui.next.disabled) ui.next.click();
    if (e.key === "ArrowLeft" && !ui.prev.disabled) ui.prev.click();
  });
  const fromHash = Number(location.hash.slice(1));
  show(fromHash >= 1 && fromHash <= N ? fromHash - 1 : i);
}
