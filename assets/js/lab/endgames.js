// ChessDepth Chess Lab - Endgame trainer: win or hold the key endgames against Stockfish.
import { startLabPage, toast, esc } from "./shell.js";
import { award, saveProgress, track } from "./lab-core.js";
import { makeBoard, uciToSan } from "./board.js";
import { bestMove, loadEngine, newGame } from "./engine.js";

startLabPage({ toolName: "the Endgame trainer", ready: run });

const GOALS = {
  mate: (l) => `Goal: checkmate within ${l.limit} of your moves.`,
  promote: (l) => `Goal: promote your pawn and keep the new queen, within ${l.limit} moves.`,
  draw: (l) => `Goal: hold the draw. Stop the pawn, or survive ${l.limit} moves.`,
  hold: (l) => `Goal: hold the draw for ${l.limit} moves without letting the pawn through.`,
};

async function run(st, prog) {
  const $ = (id) => document.getElementById(id);
  const data = await fetch("/assets/lab/endgames.json").then((r) => r.json());
  const lessons = data.lessons, E = prog.endgames;
  const ui = { list: $("eg-list"), title: $("eg-title"), intro: $("eg-intro"), positions: $("eg-positions"), goal: $("eg-goal"), status: $("eg-status"), hint: $("eg-hint"), back: $("eg-back"), restart: $("eg-restart"), next: $("eg-next"), tips: $("eg-tips") };
  let L = null, pi = 0, me = "w", moves = 0, helps = 0, over = false, busy = false, badEvals = 0, token = 0;
  const board = await makeBoard($("eg-board"), { onUserMove, canDrag: () => L && !over && !busy && board.game.turn() === me });
  loadEngine().catch(() => {});

  const rec = (id) => (E[id] = E[id] || { stars: {} });
  const starsOf = (l) => { const r = E[l.id]; return r ? l.pos.map((_, i) => r.stars[i] || 0) : l.pos.map(() => 0); };
  const starStr = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  function renderList() {
    ui.list.innerHTML = lessons.map((l) => { const s = starsOf(l), done = s.filter(Boolean).length;
      return `<button type="button" class="op-item${L && L.id === l.id ? " is-active" : ""}" data-id="${l.id}"><span class="op-item-name">${esc(l.name)}</span><span class="op-item-meta">${esc(l.level)} · ${done ? `<span class="op-badge op-learned">${done}/${l.pos.length} done</span>` : `<span class="op-badge">New</span>`}</span></button>`; }).join("");
  }
  function renderPositions() {
    const s = starsOf(L);
    ui.positions.innerHTML = L.pos.map((_, i) => `<button type="button" class="op-mode${i === pi ? " is-active" : ""}" data-pi="${i}">Position ${i + 1} <span class="eg-stars" aria-label="${s[i]} stars">${starStr(s[i])}</span></button>`).join("");
  }
  function setStatus(html, kind) { ui.status.className = "op-status " + (kind || ""); ui.status.innerHTML = html; }
  function counter() { return `Your moves: <b>${moves}</b> / ${L.limit}`; }

  async function open(l, i = 0) {
    L = l; pi = i; token++; over = false; busy = false; moves = 0; helps = 0; badEvals = 0;
    ui.title.textContent = l.name; ui.intro.textContent = l.intro; ui.goal.textContent = GOALS[l.goal](l);
    ui.tips.innerHTML = l.tips.map((t) => `<li>${esc(t)}</li>`).join("");
    ui.next.classList.add("hidden"); ui.hint.disabled = false; ui.back.disabled = false;
    board.load(l.pos[i]);
    // You play the side that is trying to win (mate/promote) or to defend (draw/hold).
    const startTurn = board.game.turn(), pieces = (c) => board.game.board().flat().filter((p) => p && p.color === c).length;
    me = l.goal === "mate" || l.goal === "promote" ? (pieces("w") >= pieces("b") ? "w" : "b") : (pieces("w") <= pieces("b") ? "w" : "b");
    board.orient(me); newGame();
    renderList(); renderPositions();
    setStatus(`${me === "w" ? "White" : "Black"} is you. ${startTurn === me ? "Your move." : "Stockfish moves first…"} · ${counter()}`);
    if (startTurn !== me) await engineMove(token);
  }

  function onUserMove(mv) {
    if (!L || over || busy || board.game.turn() !== me) return false;
    board.game.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); moves++;
    board.draw.clear();
    if (check(true)) return true;
    busy = true; const t = token;
    setTimeout(() => engineMove(t), 120);
    return true;
  }
  async function engineMove(t) {
    busy = true; setStatus(`Stockfish is thinking… · ${counter()}`);
    let res; try { res = await bestMove(board.game.fen(), 450); } catch (e) { setStatus("Stockfish couldn't start on this device. Try another browser.", "bad"); busy = false; return; }
    if (t !== token || over) return;
    if (!res.move || res.move === "(none)") { busy = false; check(false); return; }
    board.play(res.move);
    // Stockfish's own view of the position (after its search, from its side): used to notice a lost draw or a lost win.
    const sc = res.score || {}; const forEngine = sc.mate != null ? (sc.mate > 0 ? 10000 : -10000) : (sc.cp || 0);
    busy = false;
    if (check(false, forEngine)) return;
    setStatus(`Your move · ${counter()}`);
  }
  const has = (color, type) => board.game.board().flat().some((p) => p && p.color === color && p.type === type);
  // Returns true when the exercise is over.
  function check(afterMine, engineScore) {
    const g = board.game, opp = me === "w" ? "b" : "w";
    if (g.isCheckmate()) return g.turn() === opp ? win("Checkmate!") : lose("You were checkmated.");
    const drawn = g.isStalemate() ? "Stalemate" : g.isInsufficientMaterial() ? "Not enough material to mate" : g.isThreefoldRepetition() ? "Draw by repetition" : g.isDraw() ? "Draw" : null;
    if (L.goal === "mate" || L.goal === "promote") {
      if (drawn) return lose(`${drawn}: the win has slipped away.`);
      if (L.goal === "promote" && !afterMine && has(me, "q")) return win("Your pawn has become a queen, and it's safe.");
      if (L.goal === "promote" && !has(me, "p") && !has(me, "q")) return lose("Your pawn is gone.");
      if (engineScore != null && L.goal === "promote") { badEvals = engineScore > -150 ? badEvals + 1 : 0; if (badEvals >= 2) return lose("The position is no longer winning."); }
      if (moves >= L.limit && afterMine) return lose(`You used all ${L.limit} moves.`);
    } else {
      if (drawn) return win(`${drawn}. Well defended!`);
      if (afterMine && has(opp, "q")) return lose("The pawn promoted and the queen is safe.");
      if (engineScore != null) { badEvals = engineScore >= 700 ? badEvals + 1 : 0; if (badEvals >= 2) return lose("Stockfish has found a winning plan: the draw is gone."); }
      if (moves >= L.limit && afterMine) return win(`You held for ${L.limit} moves.`);
    }
    return false;
  }
  function finishCommon() { over = true; ui.hint.disabled = true; ui.back.disabled = false; }
  function win(why) {
    finishCommon(); ui.back.disabled = true;
    const stars = helps === 0 ? 3 : helps <= 2 ? 2 : 1;
    const r = rec(L.id), before = r.stars[pi] || 0;
    let pts = before ? 5 : 25; if (stars === 3 && before < 3) pts += 15;
    r.stars[pi] = Math.max(before, stars); r.last = Date.now();
    const res = award(pts, `Endgame: ${L.name} (${pi + 1})`);
    setStatus(`<b>${esc(why)}</b> ${starStr(stars)} · +${res.added} points`, "ok");
    toast(`<b>${starStr(stars)}</b> ${esc(L.name)}, position ${pi + 1}`);
    if (pi + 1 < L.pos.length) { ui.next.classList.remove("hidden"); ui.next.innerHTML = `Next position <i class="fas fa-arrow-right"></i>`; }
    else { const nl = lessons[lessons.indexOf(L) + 1]; if (nl) { ui.next.classList.remove("hidden"); ui.next.innerHTML = `Next: ${esc(nl.name)} <i class="fas fa-arrow-right"></i>`; } }
    renderList(); renderPositions(); track("lab_endgame", { lesson: L.id, pos: pi, result: "win", stars });
    return true;
  }
  function lose(why) {
    finishCommon(); saveProgress();
    setStatus(`<b>${esc(why)}</b> Take back a move or restart and try again.`, "bad");
    track("lab_endgame", { lesson: L.id, pos: pi, result: "fail" });
    return true;
  }
  ui.hint.addEventListener("click", async () => {
    if (!L || over || busy || board.game.turn() !== me) return;
    helps++; busy = true; const t = token; ui.hint.disabled = true;
    try {
      const r = await bestMove(board.game.fen(), 900); if (t !== token) return;
      board.draw.show([{ from: r.move.slice(0, 2), to: r.move.slice(2, 4), c: "g" }]);
      setStatus(`Hint: <b>${esc(uciToSan(board.game.fen(), r.move))}</b> · ${counter()}`);
    } catch (e) { setStatus("The hint couldn't load.", "bad"); }
    busy = false; ui.hint.disabled = false;
  });
  ui.back.addEventListener("click", () => {
    if (!L || busy) return;
    const g = board.game; if (!g.history().length) return;
    // Undo to the last position where it was your move.
    g.undo(); if (g.turn() !== me && g.history().length) g.undo();
    if (g.turn() !== me) { open(L, pi); return; }
    helps++; moves = Math.max(0, moves - 1); over = false; badEvals = 0; ui.hint.disabled = false; ui.next.classList.add("hidden");
    board.sync(); setStatus(`Taken back. Your move · ${counter()}`);
  });
  ui.restart.addEventListener("click", () => L && open(L, pi));
  ui.next.addEventListener("click", () => { if (pi + 1 < L.pos.length) open(L, pi + 1); else { const nl = lessons[lessons.indexOf(L) + 1]; if (nl) open(nl, 0); } });
  ui.positions.addEventListener("click", (e) => { const b = e.target.closest("[data-pi]"); if (b) open(L, Number(b.dataset.pi)); });
  ui.list.addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) open(lessons.find((l) => l.id === b.dataset.id), 0); });
  renderList();
  const fromHash = lessons.find((l) => l.id === decodeURIComponent(location.hash.slice(1)));
  open(fromHash || lessons[0], 0);
}
