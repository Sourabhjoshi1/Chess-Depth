// ChessDepth Chess Lab - Tactics trainer.
import { startLabPage, toast, esc } from "./shell.js";
import { award, saveProgress, track } from "./lab-core.js";
import { makeBoard, uciToSan, PIECE_NAMES } from "./board.js";

const BANDS = [["beginner", 0, 1000], ["intermediate", 1000, 1500], ["advanced", 1500, 2000], ["expert", 2000, 9999]];
const THEME_LABELS = { fork: "Fork", pin: "Pin", skewer: "Skewer", discoveredAttack: "Discovered attack", doubleCheck: "Double check", deflection: "Deflection", attraction: "Decoy", hangingPiece: "Hanging piece", trappedPiece: "Trapped piece", backRankMate: "Back-rank mate", smotheredMate: "Smothered mate", mateIn1: "Mate in 1", mateIn2: "Mate in 2", mateIn3: "Mate in 3", sacrifice: "Sacrifice", intermezzo: "Zwischenzug", xRayAttack: "X-ray", clearance: "Clearance", interference: "Interference", quietMove: "Quiet move", defensiveMove: "Defensive move", promotion: "Promotion", advancedPawn: "Advanced pawn", endgame: "Endgame", rookEndgame: "Rook endgame", pawnEndgame: "Pawn endgame", opening: "Opening", middlegame: "Middlegame", kingsideAttack: "Kingside attack", capturingDefender: "Capture the defender", exposedKing: "Exposed king" };
const FILTER_THEMES = ["fork", "pin", "skewer", "discoveredAttack", "deflection", "attraction", "hangingPiece", "sacrifice", "mateIn1", "mateIn2", "mateIn3", "backRankMate", "promotion", "rookEndgame", "pawnEndgame", "defensiveMove", "quietMove", "intermezzo"];
export const themeLabel = (t) => THEME_LABELS[t] || t;

const cache = {};
async function loadBand(name) {
  if (!cache[name]) cache[name] = fetch(`/assets/lab/puzzles/${name}.json`).then((r) => r.json()).then((d) => d.puzzles.map(([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(" "), rating, themes: themes.split(" "), opponentFirst: true })));
  return cache[name];
}
async function loadOriginals() {
  if (!cache.originals) cache.originals = fetch("/assets/lab/originals.json").then((r) => r.json()).then((d) => d.puzzles.map(([id, fen, moves, rating, themes, title]) => ({ id, fen, moves: moves.split(" "), rating, themes: themes.split(" "), title, opponentFirst: false })));
  return cache.originals;
}

startLabPage({ toolName: "the Tactics trainer", ready: run });

async function run(st, prog) {
  const P = prog.puzzle;
  const el = document.getElementById("tt-board");
  const ui = {
    status: document.getElementById("tt-status"), sub: document.getElementById("tt-sub"),
    rating: document.getElementById("tt-rating"), solved: document.getElementById("tt-solved"), run: document.getElementById("tt-run"),
    info: document.getElementById("tt-info"), hint: document.getElementById("tt-hint"), show: document.getElementById("tt-show"), next: document.getElementById("tt-next"),
    set: document.getElementById("tt-set"), theme: document.getElementById("tt-theme"), level: document.getElementById("tt-level"),
  };
  ui.theme.innerHTML = `<option value="">All themes</option>` + FILTER_THEMES.map((t) => `<option value="${t}">${themeLabel(t)}</option>`).join("");

  let cur = null, step = 0, mistakes = 0, hinted = false, done = false, busy = false;
  const board = await makeBoard(el, { onUserMove, canDrag: () => cur && !done && !busy });

  function updateStats() {
    ui.rating.textContent = Math.round(P.rating); ui.solved.textContent = P.solved; ui.run.textContent = P.cleanRun || 0;
  }
  function setStatus(text, sub, kind) {
    ui.status.textContent = text; ui.sub.textContent = sub || "";
    ui.status.parentElement.className = "tt-status " + (kind || "");
  }

  async function pickPuzzle() {
    if (ui.set.value === "originals") {
      const pool = await loadOriginals();
      const unseen = pool.filter((p) => !P.seen.includes(p.id));
      return (unseen.length ? unseen : pool)[Math.floor(Math.random() * (unseen.length ? unseen.length : pool.length))];
    }
    let target = P.rating;
    if (ui.level.value) { const b = BANDS.find((x) => x[0] === ui.level.value); target = (b[1] + Math.min(b[2], 2600)) / 2; }
    const band = BANDS.find((b) => target >= b[1] && target < b[2]) || BANDS[0];
    const near = [band[0]];
    const i = BANDS.indexOf(band); if (i > 0) near.push(BANDS[i - 1][0]); if (i < BANDS.length - 1) near.push(BANDS[i + 1][0]);
    let pool = []; for (const n of near) pool = pool.concat(await loadBand(n));
    const theme = ui.theme.value;
    let cand = pool.filter((p) => !P.seen.includes(p.id) && (!theme || p.themes.includes(theme)));
    if (!cand.length) cand = pool.filter((p) => !theme || p.themes.includes(theme));
    const sample = []; for (let k = 0; k < 40 && cand.length; k++) sample.push(cand[Math.floor(Math.random() * cand.length)]);
    sample.sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
    return sample[0];
  }

  async function next() {
    busy = true; done = false; mistakes = 0; hinted = false; step = 0;
    ui.info.innerHTML = ""; ui.next.classList.add("hidden"); ui.hint.disabled = false; ui.show.disabled = false;
    cur = await pickPuzzle();
    if (!cur) { setStatus("No puzzles match these filters", "Try another theme."); busy = false; return; }
    board.load(cur.fen);
    const solverColor = cur.opponentFirst ? (board.game.turn() === "w" ? "b" : "w") : board.game.turn();
    board.orient(solverColor);
    const side = solverColor === "w" ? "White" : "Black";
    setStatus(`${side} to move`, cur.title || "Find the best move.", "");
    if (cur.opponentFirst) {
      await wait(500); board.play(cur.moves[0]); step = 1;
    }
    busy = false;
  }

  function onUserMove(mv) {
    if (!cur || done || busy) return false;
    const expected = cur.moves[step];
    const g = board.game;
    const isExpected = mv.uci === expected || (expected.length === 5 && mv.uci === expected.slice(0, 4) + "q" && expected[4] === "q");
    let alsoMate = false;
    if (!isExpected && step === cur.moves.length - 1) {
      const t = g.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); alsoMate = t && g.isCheckmate(); g.undo();
    }
    if (isExpected || alsoMate) {
      g.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); step++;
      if (step >= cur.moves.length) { finish(true); return true; }
      setStatus("Correct! Keep going", "Your opponent replies…", "ok");
      busy = true;
      setTimeout(() => { board.play(cur.moves[step]); step++; busy = false; setStatus("Your move", "Find the follow-up.", "ok"); }, 450);
      return true;
    }
    mistakes++;
    setStatus("Not the best move", mistakes === 1 ? "Try again, or use a hint." : "Keep looking, or show the solution.", "bad");
    return false;
  }

  function finish(solved) {
    done = true; ui.hint.disabled = true; ui.show.disabled = true; ui.next.classList.remove("hidden");
    const clean = solved && mistakes === 0 && !hinted;
    const score = clean ? 1 : 0;
    const exp = 1 / (1 + Math.pow(10, (cur.rating - P.rating) / 400));
    const k = P.attempted < 20 ? 40 : 24;
    const before = P.rating;
    P.rating = Math.max(400, Math.min(3000, P.rating + k * (score - exp)));
    P.attempted++; if (solved) P.solved++;
    P.cleanRun = clean ? (P.cleanRun || 0) + 1 : 0; P.bestRun = Math.max(P.bestRun || 0, P.cleanRun);
    for (const t of cur.themes) { const r = (P.byTheme[t] = P.byTheme[t] || { s: 0, a: 0 }); r.a++; if (clean) r.s++; }
    P.history.push([Date.now(), Math.round(P.rating)]); P.history = P.history.slice(-120);
    P.seen.push(cur.id); P.seen = P.seen.slice(-600);
    let pts = 0;
    if (clean) pts = 5 + Math.round(cur.rating / 200);
    else if (solved && hinted && mistakes === 0) pts = Math.round((5 + cur.rating / 200) / 2);
    else if (solved) pts = 2;
    if (clean && P.cleanRun > 0 && P.cleanRun % 5 === 0) pts += 10;
    const res = pts ? award(pts, `Puzzle ${clean ? "solved" : "completed"} (${cur.rating})`) : (saveProgress(), { added: 0 });
    const diff = Math.round(P.rating - before);
    setStatus(clean ? "Solved!" : solved ? "Completed" : "Solution shown", clean ? `+${res.added} points` + (P.cleanRun % 5 === 0 ? " (5 in a row bonus!)" : "") : solved ? `+${res.added} points. Solve it without mistakes for full points.` : "No points this time. You'll get the next one!", clean ? "ok" : solved ? "" : "bad");
    ui.info.innerHTML = `<p><b>Puzzle rating:</b> ${cur.rating}</p><p><b>Themes:</b> ${cur.themes.map(themeLabel).map(esc).join(", ")}</p><p><b>Your rating:</b> ${Math.round(P.rating)} <span class="${diff >= 0 ? "tt-up" : "tt-down"}">(${diff >= 0 ? "+" : ""}${diff})</span></p>${cur.opponentFirst ? `<p class="tt-credit">Puzzle from the Lichess database (CC0)</p>` : `<p class="tt-credit">ChessDepth Original</p>`}`;
    updateStats();
    track("lab_puzzle", { result: clean ? "clean" : solved ? "completed" : "shown", rating: cur.rating });
  }

  ui.hint.addEventListener("click", () => {
    if (!cur || done) return; hinted = true;
    const u = cur.moves[step]; const piece = board.game.get(u.slice(0, 2));
    setStatus("Hint", `Move your ${PIECE_NAMES[piece.type]} on ${u.slice(0, 2)}.`, "");
  });
  ui.show.addEventListener("click", async () => {
    if (!cur || done || busy) return; busy = true; mistakes++;
    const line = [];
    while (step < cur.moves.length) { line.push(uciToSan(board.game.fen(), cur.moves[step])); board.play(cur.moves[step]); step++; await wait(550); }
    busy = false; finish(false);
    ui.info.insertAdjacentHTML("afterbegin", `<p><b>Solution:</b> ${esc(line.join(" "))}</p>`);
  });
  ui.next.addEventListener("click", next);
  [ui.set, ui.theme, ui.level].forEach((s) => s.addEventListener("change", () => { document.getElementById("tt-filters-lichess").classList.toggle("hidden", ui.set.value === "originals"); next(); }));
  updateStats();
  next();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
