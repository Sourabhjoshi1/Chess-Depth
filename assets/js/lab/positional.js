// ChessDepth Chess Lab - Positional play hub: the positional lesson courses as one learning path, with progress.
import { startLabPage, esc } from "./shell.js";

const STAGES = [
  ["Stage 1 · Read the position", "Know who is better and why, and where each piece belongs.", ["evaluate", "good-bad-pieces", "rooks"]],
  ["Stage 2 · Pawn structure", "Pawns cannot move backwards, so the structure decides the plan.", ["pawn-weaknesses", "passed-pawns", "iqp", "pawn-breaks"]],
  ["Stage 3 · Make a plan", "Stop your opponent's ideas and choose the right exchanges.", ["prophylaxis", "exchanges"]],
];
const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
function thumb(fen) {
  const rows = fen.split(" ")[0].split("/"), flip = fen.split(" ")[1] === "b"; let sq = "", pcs = "";
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) sq += `<rect x="${f * 10}" y="${r * 10}" width="10" height="10" class="${(r + f) % 2 ? "d" : "l"}"/>`;
  for (let r = 0; r < 8; r++) { let f = 0; for (const ch of rows[r]) { if (/\d/.test(ch)) { f += Number(ch); continue; }
    const x = flip ? 7 - f : f, y = flip ? 7 - r : r; pcs += `<text x="${x * 10 + 5}" y="${y * 10 + 8.6}" class="${ch === ch.toUpperCase() ? "w" : "b"}">${GLYPH[ch.toLowerCase()]}</text>`; f++; } }
  return `<svg class="cr-thumb" viewBox="0 0 80 80" aria-hidden="true">${sq}${pcs}</svg>`;
}
let courses = null;
startLabPage({ publicPage: async (st, prog) => {
  const box = document.getElementById("po-path");
  if (!courses) {
    try { courses = (await fetch("/assets/lab/lessons.json").then((r) => r.json())).courses; }
    catch (e) { box.innerHTML = `<p class="cr-empty">The courses couldn't load. Please refresh the page.</p>`; return; }
  }
  const member = !!(st.user && st.access && prog), L = (member && prog.lessons) || {};
  const byId = Object.fromEntries(courses.map((c) => [c.id, c]));
  let total = 0, done = 0, lessons = 0, lessonsDone = 0, next = null, n = 0;
  box.innerHTML = STAGES.map(([title, sub, ids]) => `<div class="po-stage"><h3>${esc(title)}</h3><p>${esc(sub)}</p><div class="cr-list">${ids.map((id) => {
    const c = byId[id]; if (!c) return ""; n++;
    const N = c.lessons.length, d = Math.min(N, ((L[id] && L[id].done) || []).length), fin = d >= N;
    total++; lessons += N; lessonsDone += d; if (fin) done++; else if (!next) next = c;
    const first = c.lessons.find((l) => l.move) || c.lessons[0];
    const badge = !member ? `<span class="cr-badge">Members</span>` : fin ? `<span class="cr-badge cr-done"><i class="fas fa-check"></i> Completed</span>` : d ? `<span class="cr-badge cr-going">In progress</span>` : `<span class="cr-badge cr-start">Start</span>`;
    return `<a class="cr-item" href="/lab/learn/?c=${id}"><span class="po-num${fin ? " is-done" : ""}">${fin ? '<i class="fas fa-check"></i>' : n}</span>${thumb(first.fen)}<span class="cr-body"><span class="cr-title">${esc(c.title)}</span><span class="cr-desc">${esc(c.desc)}</span>
      <span class="cr-meta"><span class="cr-tag cr-lv-${c.level.toLowerCase()}">${c.level}</span>${member && d && !fin ? `<span class="cr-step">Lesson ${d + 1} of ${N}</span>` : `<span>${N} lessons</span>`}<span>~${c.mins} min</span></span>
      ${member && d ? `<span class="cr-bar-track" aria-hidden="true"><span style="width:${Math.round((d / N) * 100)}%"></span></span>` : ""}</span><span class="cr-end">${badge}<i class="fas fa-chevron-right" aria-hidden="true"></i></span></a>`;
  }).join("")}</div></div>`).join("");
  document.getElementById("po-summary").innerHTML = member
    ? `<i class="fas fa-chess-knight"></i><span><b>${done} of ${total} courses completed</b><small>${lessonsDone} of ${lessons} lessons${next ? ` · next: <a href="/lab/learn/?c=${next.id}">${esc(next.title)}</a>` : " · path finished!"}</small></span>`
    : `<i class="fas fa-lock"></i><span><b>Sign in to track progress</b><small>${total} courses, ${lessons} lessons</small></span>`;
} });
