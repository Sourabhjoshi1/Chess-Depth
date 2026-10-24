// ChessDepth Chess Lab - Puzzle Streak: puzzles get harder each time; one mistake ends the run.
import { startLabPage, toast, esc } from "./shell.js";
import { award, recordStreakRun, streakLeaderboard, track } from "./lab-core.js";
import { makeBoard, uciToSan } from "./board.js";

const START = 650, STEP = 50, MAX = 2700;
const BANDS = ["beginner", "intermediate", "advanced", "expert"];

startLabPage({ toolName: "Puzzle Streak", ready: run });

async function run(st, prog) {
  const ui = {
    score: document.getElementById("ps-score"), best: document.getElementById("ps-best"), status: document.getElementById("ps-status"), sub: document.getElementById("ps-sub"),
    start: document.getElementById("ps-start"), skip: document.getElementById("ps-skip"), again: document.getElementById("ps-again"), board: document.getElementById("ps-board"),
    lb: document.getElementById("ps-leaderboard"), recap: document.getElementById("ps-recap"),
  };
  const all = (await Promise.all(BANDS.map((b) => fetch(`/assets/lab/puzzles/${b}.json`).then((r) => r.json()))))
    .flatMap((d) => d.puzzles.map(([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(" "), rating, themes: themes.split(" ") })))
    .sort((a, b) => a.rating - b.rating);

  let running = false, score = 0, skipUsed = false, cur = null, step = 0, busy = false, used = new Set(), solvedRatings = [];
  const board = await makeBoard(ui.board, { onUserMove, canDrag: () => running && cur && !busy });

  function setStatus(t, sub, kind) { ui.status.textContent = t; ui.sub.textContent = sub || ""; ui.status.parentElement.className = "tt-status " + (kind || ""); }
  function renderScore() { ui.score.textContent = score; ui.best.textContent = prog.pstreak.best || 0; }

  function pick() {
    const target = Math.min(MAX, START + score * STEP);
    const near = all.filter((p) => !used.has(p.id) && Math.abs(p.rating - target) <= 60);
    const pool = near.length ? near : all.filter((p) => !used.has(p.id)).sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target)).slice(0, 20);
    if (!pool.length) { used = new Set(); return pick(); }
    const p = pool[Math.floor(Math.random() * pool.length)]; used.add(p.id); return p;
  }

  async function nextPuzzle() {
    busy = true; cur = pick(); step = 0;
    board.load(cur.fen);
    const solver = board.game.turn() === "w" ? "b" : "w";
    board.orient(solver);
    setStatus(`Puzzle ${score + 1}`, `${solver === "w" ? "White" : "Black"} to move. Find the best move.`, "");
    await wait(450); board.play(cur.moves[0]); step = 1; busy = false;
  }

  async function start() {
    running = true; score = 0; skipUsed = false; used = new Set(); solvedRatings = [];
    ui.start.classList.add("hidden"); ui.again.classList.add("hidden"); ui.skip.classList.remove("hidden"); ui.skip.disabled = false; ui.recap.innerHTML = "";
    renderScore(); track("lab_streak_start", {});
    await nextPuzzle();
  }

  function onUserMove(mv) {
    if (!running || !cur || busy) return false;
    const exp = cur.moves[step], g = board.game;
    let ok = mv.uci === exp;
    if (!ok && step === cur.moves.length - 1) { const t = g.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); ok = !!(t && g.isCheckmate()); g.undo(); }
    if (ok) {
      g.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); step++;
      if (step >= cur.moves.length) { solved(); return true; }
      busy = true; setTimeout(() => { board.play(cur.moves[step]); step++; busy = false; setStatus(`Puzzle ${score + 1}`, "Good! Find the next move.", "ok"); }, 400);
      return true;
    }
    setTimeout(() => end(mv), 50);
    return false;
  }

  async function solved() {
    score++; solvedRatings.push(cur.rating); renderScore();
    setStatus(`Solved! Streak: ${score}`, "Next puzzle is a little harder…", "ok");
    if (score === prog.pstreak.best + 1 && prog.pstreak.best > 0) toast(`<b>New personal best!</b> ${score} in a row.`);
    busy = true; await wait(700); busy = false; await nextPuzzle();
  }

  async function end() {
    running = false; busy = true; ui.skip.classList.add("hidden");
    const line = []; while (step < cur.moves.length) { line.push(uciToSan(board.game.fen(), cur.moves[step])); board.play(cur.moves[step]); step++; await wait(500); }
    busy = false;
    let pts = score * 2 + (score >= 10 ? 10 : 0) + (score >= 20 ? 20 : 0) + (score >= 30 ? 30 : 0);
    const { newBest } = recordStreakRun(score);
    const res = pts ? award(pts, `Puzzle Streak: ${score} in a row`) : { added: 0 };
    renderScore();
    setStatus(`Streak over: ${score}`, newBest && score ? "That's a new personal best!" : `Your best is ${prog.pstreak.best}. Go again!`, newBest && score ? "ok" : "bad");
    ui.recap.innerHTML = `<p><b>The answer was:</b> ${esc(line.join(" "))}</p>
      <p><b>Puzzles solved:</b> ${score}${solvedRatings.length ? ` · hardest ${Math.max(...solvedRatings)}` : ""}</p>
      ${res.added ? `<p><b>Points:</b> +${res.added}</p>` : ""}`;
    ui.again.classList.remove("hidden");
    track("lab_streak_end", { score, new_best: newBest });
    loadBoard();
  }

  ui.skip.addEventListener("click", async () => {
    if (!running || busy || skipUsed) return; skipUsed = true; ui.skip.disabled = true;
    toast("Puzzle skipped. That was your one skip for this run.");
    await nextPuzzle();
  });
  ui.start.addEventListener("click", start);
  ui.again.addEventListener("click", start);

  async function loadBoard() {
    try {
      const lb = await streakLeaderboard();
      ui.lb.innerHTML = `<ol class="pd-lb">${lb.rows.slice(0, 15).map((r, i) => `<li class="${r.me ? "me" : ""}"><span class="pd-rank">${i + 1}</span><span class="pd-lb-name">${esc(r.name)}</span><span class="pd-lb-pts">${r.best}</span></li>`).join("")}</ol>
        <p class="pd-small">${lb.sample ? "Sample players shown in demo mode." : "Best streak ever, first names only."}</p>`;
    } catch (e) { ui.lb.innerHTML = `<p class="pd-empty">The leaderboard couldn't load right now.</p>`; }
  }
  renderScore(); loadBoard();
  board.load("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  setStatus("Ready?", "Solve as many puzzles in a row as you can.", "");
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
