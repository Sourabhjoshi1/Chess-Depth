// ChessDepth - Puzzle of the Day on the home page. One puzzle per date (India time), from assets/lab/daily.json.
const BOARD_LIB = "https://cdn.jsdelivr.net/npm/chessboard-element@1.2.0/bundled/chessboard-element.bundled.js";
const root = document.getElementById("daily");
const $ = (id) => document.getElementById(id);

const THEMES = {
  mateIn1: ["Mate in one", "One move ends the game. Look at every check and ask: can the king escape, block or capture?"],
  mateIn2: ["Mate in two", "The first move is usually a check or a sacrifice that forces the reply. Mate follows on the next move."],
  mateIn3: ["Mate in three", "A forcing sequence: checks and captures that leave the defender no choice, ending in checkmate."],
  backRankMate: ["Back-rank mate", "The king is trapped behind its own pawns. A rook or queen on the back rank finishes the game."],
  smotheredMate: ["Smothered mate", "The king is surrounded by its own pieces, and a knight delivers mate that nothing can block."],
  doubleCheck: ["Double check", "Two pieces give check at once. The only legal answer is a king move, and often there isn't one."],
  fork: ["Fork", "One piece attacks two targets at the same time. Your opponent can only save one of them."],
  pin: ["Pin", "A piece can't move without exposing something more valuable behind it. Attack it again and it falls."],
  skewer: ["Skewer", "Attack a valuable piece with something behind it on the same line. When it moves, take what's behind."],
  discoveredAttack: ["Discovered attack", "Move one piece out of the way to unleash another. Two threats appear at once."],
  deflection: ["Deflection", "A defender has a job to do. Force it to leave its post, and what it was guarding collapses."],
  attraction: ["Decoy", "Lure an enemy piece, often the king, onto a square where it can be attacked or trapped."],
  capturingDefender: ["Remove the defender", "Take the piece that protects something important, then win what it was guarding."],
  interference: ["Interference", "Put a piece between two enemy pieces so one can no longer defend the other."],
  trappedPiece: ["Trapped piece", "An enemy piece has no safe squares left. Attack it and it's lost."],
  hangingPiece: ["Hanging piece", "Something is left undefended. Spot it before your opponent fixes it."],
  promotion: ["Promotion", "A pawn is close to becoming a queen. Find the way to push it through."],
  advancedPawn: ["Advanced pawn", "A pawn deep in enemy territory changes everything. Use it before it's stopped."],
  sacrifice: ["Sacrifice", "Give up material to get something bigger: a mating attack or more material back."],
  quietMove: ["Quiet move", "No check, no capture, but a move that sets up an unstoppable threat."],
  defensiveMove: ["Defensive move", "Your opponent has a threat. Find the only move that keeps your position together."],
  intermezzo: ["In-between move", "Before recapturing, play a stronger move first: a check or threat your opponent must answer."],
};
const LEVEL = ["Easy", "Easy", "Medium", "Medium", "Tricky", "Hard", "Hard"]; // Monday..Sunday

function istNow() { return new Date(Date.now() + 5.5 * 3600e3); }           // shift so getUTC* gives India time
function todayKey() { return istNow().toISOString().slice(0, 10); }
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
function track(name, params) { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); }

async function start() {
  const key = todayKey();
  const data = await fetch("/assets/lab/daily.json").then((r) => r.json());
  const keys = Object.keys(data.days);
  let row = data.days[key];
  if (!row) { const n = Math.floor(Date.parse(key) / 864e5); row = data.days[keys[n % keys.length]]; } // after the calendar ends, cycle
  const [id, fen0, line, rating, theme] = row;
  const moves = line.split(" ");
  const [y, m, d] = key.split("-").map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const wd = (dateObj.getUTCDay() + 6) % 7; // Monday = 0
  const opt = (o) => dateObj.toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  $("dp-date").textContent = `${opt({ weekday: "long" })}, ${d} ${opt({ month: "long" })} ${y}`; // e.g. "Thursday, 22 October 2026"
  $("dp-level").textContent = LEVEL[wd];
  $("dp-level").dataset.level = LEVEL[wd].toLowerCase();
  $("dp-rating").textContent = "Rating " + rating;

  await import(BOARD_LIB);
  const { makeBoard, Chess } = await import("/assets/js/lab/board.js");
  const el = $("dp-board");
  let step = 1, done = false, busy = false, tries = 0, hinted = 0;
  const board = await makeBoard(el, { onUserMove, canDrag: () => !done && !busy });
  board.load(fen0);
  const solverColor = board.game.turn() === "w" ? "b" : "w";
  const side = solverColor === "w" ? "White" : "Black";
  board.orient(solverColor);
  const mate = /^mateIn(\d)$/.exec(theme) || (["backRankMate", "smotheredMate"].includes(theme) ? [0, String(Math.ceil((moves.length - 1) / 2))] : null);
  $("dp-goal").textContent = mate ? `${side} to move and mate in ${mate[1]}` : `${side} to move. Find the best move.`;
  el.classList.remove("dp-loading");

  // Solution in move-number notation, from the position after the opponent's move
  const g = new Chess(fen0); g.move(uciObj(moves[0]));
  let n = parseInt(g.fen().split(" ")[5], 10), white = g.turn() === "w", sanLine = "";
  moves.slice(1).forEach((u, i) => { const mv = g.move(uciObj(u)); sanLine += (white ? `${n}.` : (i === 0 ? `${n}...` : "")) + mv.san + " "; if (!white) n++; white = !white; });
  sanLine = sanLine.trim();

  const prev = store("cd-daily");
  if (prev && prev.date === key && prev.solved) showSolved(prev.tries, true);
  else setTimeout(() => { board.play(moves[0]); status(`${side} to move`, "Drag or tap a piece to make your move.", ""); }, 600);
  renderStreak();

  function uciObj(u) { return { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }; }
  function status(t, s, kind) { $("dp-status").textContent = t; $("dp-sub").textContent = s; $("dp-status-box").className = "dp-status " + (kind || ""); }
  function onUserMove(mv) {
    if (done || busy) return false;
    const exp = moves[step], game = board.game;
    let good = mv.uci === exp;
    if (!good && step === moves.length - 1) { const t = game.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); good = !!(t && game.isCheckmate()); game.undo(); }
    if (!good) { tries++; status("Not quite. Try again!", tries >= 2 ? "Stuck? Tap Hint for a clue." : "Think about checks, captures and threats.", "bad"); track("daily_puzzle_wrong", { puzzle: id }); return false; }
    game.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); step++;
    if (step >= moves.length) { tries++; finish(); return true; }
    busy = true; status("Good move!", "Now find the next one…", "ok");
    setTimeout(() => { board.play(moves[step]); step++; busy = false; }, 500);
    return true;
  }
  function finish() {
    done = true; const s = store("cd-daily") || {};
    const streak = s.lastSolved === prevKey(key) ? (s.streak || 0) + 1 : (s.lastSolved === key ? s.streak || 1 : 1);
    store("cd-daily", { date: key, solved: true, tries, lastSolved: key, streak, best: Math.max(streak, s.best || 0) });
    showSolved(tries, false); renderStreak();
    track("daily_puzzle_solved", { puzzle: id, tries, hinted });
  }
  function showSolved(t, earlier) {
    done = true;
    if (earlier) { const g2 = new Chess(fen0); moves.forEach((u) => g2.move(uciObj(u))); board.game.load(g2.fen()); board.sync(); }
    status(earlier ? "You've solved today's puzzle" : t <= 1 ? "Solved on your first try!" : `Solved in ${t} tries!`, "Come back tomorrow for a new one.", "ok");
    reveal(true);
    const msg = `I solved today's ChessDepth Puzzle of the Day${t <= 1 && !earlier ? " on my first try" : ""}! Can you? https://www.chessdepth.in/#daily`;
    $("dp-share").href = "https://wa.me/?text=" + encodeURIComponent(msg);
    $("dp-share").classList.remove("hidden");
  }
  function reveal(full) {
    const [name, idea] = THEMES[theme] || ["Tactic", ""];
    $("dp-theme").textContent = name; $("dp-idea").textContent = idea;
    $("dp-explain").classList.remove("hidden");
    if (full) { $("dp-solution").textContent = sanLine; $("dp-solution-row").classList.remove("hidden"); $("dp-hint").disabled = true; $("dp-show").disabled = true; }
  }
  $("dp-hint").addEventListener("click", () => {
    if (done) return; hinted++;
    if (hinted === 1) { reveal(false); status("Hint", `Today's theme is ${(THEMES[theme] || ["a tactic"])[0].toLowerCase()}.`, ""); }
    else { const from = moves[step].slice(0, 2); const p = board.game.get(from); status("Hint", `Move your ${({ p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" })[p.type]} on ${from}.`, ""); $("dp-hint").disabled = true; }
    track("daily_puzzle_hint", { puzzle: id, level: hinted });
  });
  $("dp-show").addEventListener("click", async () => {
    if (done) return; done = true; busy = true;
    while (step < moves.length) { board.play(moves[step]); step++; await new Promise((r) => setTimeout(r, 650)); }
    busy = false; reveal(true); status("Here's the solution", "Try again tomorrow, there's a new puzzle every day.", "");
    track("daily_puzzle_solution", { puzzle: id });
  });
  tick(); setInterval(tick, 30e3);
}
function prevKey(k) { const t = Date.parse(k) - 864e5; return new Date(t).toISOString().slice(0, 10); }
function renderStreak() {
  const s = store("cd-daily"); const box = $("dp-streak");
  if (!s || !s.streak) return;
  const live = s.lastSolved === todayKey() || s.lastSolved === prevKey(todayKey());
  if (!live) return;
  box.innerHTML = `<i class="fas fa-fire"></i> ${s.streak}-day streak` + (s.best > s.streak ? ` <span>· best ${s.best}</span>` : "");
  box.classList.remove("hidden");
}
function tick() {
  const n = istNow(); const left = 86400 - (n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds());
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
  $("dp-next").textContent = `Next puzzle in ${h}h ${m}m`;
}

if (root) {
  const go = () => start().catch((e) => { console.error(e); $("dp-status").textContent = "The puzzle couldn't load right now."; $("dp-sub").textContent = "Please refresh the page."; });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "400px" });
    io.observe(root);
  } else go();
}
