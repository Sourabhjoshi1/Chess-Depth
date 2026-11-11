// ChessDepth Chess Lab - Puzzle Rush: as many puzzles as you can in 3 or 5 minutes; three mistakes end the run.
import { startLabPage, toast, esc } from "./shell.js";
import { award, saveProgress, track, postRecord, recordBoard } from "./lab-core.js";
import { makeBoard, uciToSan } from "./board.js";
import { puzzlesNear, loadIndex } from "./puzzles.js";

const START = 600, STEP = 45, MAX = 2600, LIVES = 3;

startLabPage({ toolName: "Puzzle Rush", ready: run });

async function run(st, prog) {
  const $ = (id) => document.getElementById(id);
  const ui = { time: $("pr-time"), score: $("pr-score"), lives: $("pr-lives"), status: $("pr-status"), sub: $("pr-sub"), start: $("pr-start"), stop: $("pr-stop"), recap: $("pr-recap"), lb: $("pr-leaderboard"), lbMode: $("pr-lb-mode") };
  const R = prog.rush;
  let minutes = 3, running = false, score = 0, wrong = 0, cur = null, step = 0, busy = false, endAt = 0, tick = null, used = new Set(), results = [];
  await loadIndex(); puzzlesNear(START, 2);
  const board = await makeBoard($("pr-board"), { onUserMove, canDrag: () => running && cur && !busy });

  function setStatus(t, sub, kind) { ui.status.textContent = t; ui.sub.textContent = sub || ""; ui.status.parentElement.className = "tt-status " + (kind || ""); }
  function renderLives() { ui.lives.innerHTML = Array.from({ length: LIVES }, (_, i) => `<i class="fas fa-times-circle${i < wrong ? " is-lost" : ""}"></i>`).join(""); }
  function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function renderTop() { ui.score.textContent = score; ui.time.textContent = running ? fmt(endAt - Date.now()) : fmt(minutes * 60000); renderLives(); }

  async function pick() {
    const target = Math.min(MAX, START + score * STEP);
    const all = await puzzlesNear(target, 2);
    puzzlesNear(Math.min(MAX, target + 2 * STEP), 2).catch(() => {});
    // Short puzzles keep the rush moving: at most 3 moves for the solver.
    let pool = all.filter((p) => !used.has(p.id) && Math.abs(p.rating - target) <= 70 && p.moves.length <= 6);
    if (!pool.length) pool = all.filter((p) => !used.has(p.id));
    const p = pool[Math.floor(Math.random() * pool.length)]; used.add(p.id); return p;
  }
  async function nextPuzzle() {
    if (!running) return;
    busy = true; cur = await pick(); step = 0;
    board.load(cur.fen);
    const solver = board.game.turn() === "w" ? "b" : "w"; board.orient(solver);
    setStatus(`Puzzle ${score + wrong + 1}`, `${solver === "w" ? "White" : "Black"} to move.`, "");
    await wait(300); if (!running) return;
    board.play(cur.moves[0]); step = 1; busy = false;
  }
  function onUserMove(mv) {
    if (!running || !cur || busy) return false;
    const exp = cur.moves[step], g = board.game;
    let ok = mv.uci === exp;
    if (!ok && step === cur.moves.length - 1) { const t = g.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); ok = !!(t && g.isCheckmate()); g.undo(); }
    if (ok) {
      g.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); step++;
      if (step >= cur.moves.length) { score++; results.push({ p: cur, ok: true }); renderTop(); setStatus("Solved!", "", "ok"); busy = true; setTimeout(() => { busy = false; nextPuzzle(); }, 250); return true; }
      busy = true; setTimeout(() => { if (!running) return; board.play(cur.moves[step]); step++; busy = false; }, 280);
      return true;
    }
    wrong++; results.push({ p: cur, ok: false, fen: g.fen(), answer: uciToSan(g.fen(), exp) }); renderTop();
    setStatus("Not that one", `The move was ${uciToSan(g.fen(), exp)}.`, "bad");
    if (wrong >= LIVES) { setTimeout(() => end("Three mistakes"), 50); return false; }
    busy = true; setTimeout(() => { busy = false; nextPuzzle(); }, 900);
    return false;
  }
  async function start() {
    running = true; score = 0; wrong = 0; used = new Set(); results = []; endAt = Date.now() + minutes * 60000;
    ui.start.classList.add("hidden"); ui.stop.classList.remove("hidden"); ui.recap.innerHTML = "";
    document.querySelectorAll(".pr-modes button").forEach((b) => (b.disabled = true));
    clearInterval(tick); tick = setInterval(() => { renderTop(); if (Date.now() >= endAt) end("Time's up"); }, 200);
    renderTop(); track("lab_rush_start", { minutes }); await nextPuzzle();
  }
  function end(reason) {
    if (!running) return; running = false; busy = true; clearInterval(tick);
    ui.stop.classList.add("hidden"); ui.start.classList.remove("hidden"); ui.start.innerHTML = `<i class="fas fa-redo"></i>Play again`;
    document.querySelectorAll(".pr-modes button").forEach((b) => (b.disabled = false));
    const key = "best" + minutes, newBest = score > (R[key] || 0);
    R.runs = (R.runs || 0) + 1; if (newBest) R[key] = score;
    R.history = (R.history || []).concat([[Date.now(), minutes, score]]).slice(-60);
    if (newBest && score) postRecord("rush" + minutes, score);
    const pts = score * 2 + (score >= 15 ? 10 : 0) + (score >= 25 ? 20 : 0) + (score >= 35 ? 30 : 0);
    const res = pts ? award(pts, `Puzzle Rush ${minutes} min: ${score} solved`) : (saveProgress(), { added: 0 });
    setStatus(`${reason}! ${score} solved`, newBest && score ? "New personal best!" : `Your best (${minutes} min): ${R[key] || 0}`, newBest && score ? "ok" : "");
    if (newBest && score) toast(`<b>New Puzzle Rush best!</b> ${score} in ${minutes} minutes.`);
    const missed = results.filter((r) => !r.ok);
    ui.recap.innerHTML = `${res.added ? `<p><b>Points:</b> +${res.added}</p>` : ""}
      <p><b>Hardest solved:</b> ${results.filter((r) => r.ok).reduce((m, r) => Math.max(m, r.p.rating), 0) || "–"}</p>
      ${missed.length ? `<p><b>Puzzles you missed:</b></p><ul class="pr-missed">${missed.map((r) => `<li>${r.p.rating} · answer <b>${esc(r.answer)}</b> · <a href="https://lichess.org/training/${esc(r.p.id)}" target="_blank" rel="noopener">see it on Lichess</a></li>`).join("")}</ul>` : ""}`;
    track("lab_rush_end", { minutes, score, new_best: newBest });
    busy = false; loadBoard();
  }
  async function loadBoard() {
    ui.lbMode.textContent = minutes + " minutes";
    try {
      const lb = await recordBoard("rush" + minutes, R["best" + minutes], minutes === 3 ? 30 : 40);
      ui.lb.innerHTML = lb.rows.length ? `<ol class="pd-lb">${lb.rows.slice(0, 15).map((r, i) => `<li class="${r.me ? "me" : ""}"><span class="pd-rank">${i + 1}</span><span class="pd-lb-name">${esc(r.name)}</span><span class="pd-lb-pts">${r.best}</span></li>`).join("")}</ol>
        <p class="pd-small">${lb.sample ? "Sample players shown in demo mode." : "Best ever, first names only."} Your best: ${R["best" + minutes] || 0}.</p>` : `<p class="pd-empty">No scores yet. Be the first!</p>`;
    } catch (e) { ui.lb.innerHTML = `<p class="pd-empty">The leaderboard couldn't load right now.</p>`; }
  }
  document.querySelectorAll(".pr-modes button").forEach((b) => b.addEventListener("click", () => {
    if (running) return; minutes = Number(b.dataset.min);
    document.querySelectorAll(".pr-modes button").forEach((x) => x.classList.toggle("is-active", x === b));
    renderTop(); loadBoard();
  }));
  ui.start.addEventListener("click", start);
  ui.stop.addEventListener("click", () => end("Stopped"));
  renderTop(); loadBoard();
  board.load("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  setStatus("Ready?", "Pick 3 or 5 minutes and press Start.", "");
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
