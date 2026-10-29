// ChessDepth - board helper used by every board on the site (Daily Puzzle, Chess Lab tactics, Streak, Openings):
// chessboard-element (display, drag & drop) + chess.js (rules) + tap-to-move, move hints and last-move highlights.
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js";
export { Chess };
import { enableDrawing } from "../board-draw.js";

const FILES = "abcdefgh";

// Wrap a <chess-board> element. onUserMove({from,to,promotion,san,uci}) must return true to accept the move.
export async function makeBoard(el, { onUserMove, canDrag }) {
  await customElements.whenDefined("chess-board");
  const game = new Chess();
  let selected = null, lastMove = null;

  // ---- Overlay for highlights (selected square, legal targets, last move). Never blocks clicks.
  const host = el.parentElement;
  if (host && getComputedStyle(host).position === "static") host.style.position = "relative";
  const overlay = document.createElement("div");
  overlay.className = "cd-board-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = "position:absolute;pointer-events:none;z-index:2;";
  el.insertAdjacentElement("afterend", overlay);
  // Arrows and circles (right-click, or the pencil button on phones). Cleared after every move.
  const draw = enableDrawing(el);

  const flipped = () => el.orientation === "black";
  function boardRect() { return el.getBoundingClientRect(); }
  function squareAt(clientX, clientY) {
    const r = boardRect(), s = r.width / 8;
    let col = Math.floor((clientX - r.left) / s), row = Math.floor((clientY - r.top) / s);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    if (flipped()) { col = 7 - col; row = 7 - row; }
    return FILES[col] + (8 - row);
  }
  function placeOverlay() {
    overlay.style.left = el.offsetLeft + "px"; overlay.style.top = el.offsetTop + "px";
    overlay.style.width = el.offsetWidth + "px"; overlay.style.height = el.offsetWidth + "px";
  }
  function cell(sq, cls) {
    const f = FILES.indexOf(sq[0]), r = 8 - Number(sq[1]);
    const col = flipped() ? 7 - f : f, row = flipped() ? 7 - r : r;
    const d = document.createElement("div");
    d.className = "cd-sq " + cls;
    d.style.cssText = `position:absolute;left:${col * 12.5}%;top:${row * 12.5}%;width:12.5%;height:12.5%;`;
    return d;
  }
  function render() {
    placeOverlay(); overlay.textContent = "";
    if (lastMove) { overlay.append(cell(lastMove.from, "cd-sq-last"), cell(lastMove.to, "cd-sq-last")); }
    if (selected) {
      overlay.append(cell(selected, "cd-sq-sel"));
      game.moves({ square: selected, verbose: true }).forEach((m) => overlay.append(cell(m.to, game.get(m.to) ? "cd-sq-cap" : "cd-sq-dot")));
    }
  }
  window.addEventListener("resize", render);
  if ("ResizeObserver" in window) new ResizeObserver(render).observe(el);

  function ownPiece(sq) { const p = sq && game.get(sq); return p && p.color === game.turn(); }
  // Try a move from either input method. Returns true if accepted.
  function attempt(source, target) {
    const piece = game.get(source);
    const promo = piece && piece.type === "p" && (target[1] === "8" || target[1] === "1") ? "q" : undefined;
    const legal = game.moves({ square: source, verbose: true }).find((m) => m.to === target && (!promo || m.promotion === promo));
    if (!legal) return false;
    const ok = onUserMove({ from: source, to: target, promotion: legal.promotion, san: legal.san, uci: source + target + (legal.promotion || "") });
    if (ok) { lastMove = { from: source, to: target }; draw.clear(); }
    return ok;
  }

  // ---- Drag and drop
  el.addEventListener("drag-start", (e) => {
    const { piece } = e.detail;
    if (!canDrag() || game.isGameOver() || piece[0] !== game.turn()) e.preventDefault();
  });
  el.addEventListener("drop", (e) => {
    const { source, target, setAction } = e.detail;
    if (source === target || target === "offboard") { setAction("snapback"); return; } // a tap: handled below
    selected = null;
    if (!attempt(source, target)) { setAction("snapback"); render(); return; }
    render();
  });
  el.addEventListener("snap-end", () => el.setPosition(game.fen().split(" ")[0], false));

  // ---- Tap / click to move: tap a piece, then tap a square
  let down = null;
  el.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  el.addEventListener("pointerup", (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 8) return;                         // that was a drag, not a tap
    if (!canDrag() || game.isGameOver()) { selected = null; render(); return; }
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (selected && sq !== selected && !ownPiece(sq)) {
      const from = selected; selected = null;
      if (attempt(from, sq)) el.setPosition(game.fen().split(" ")[0], true);
      render(); return;
    }
    selected = ownPiece(sq) && sq !== selected ? sq : null;
    render();
  });

  return {
    game,
    load(fen) { game.load(fen); selected = null; lastMove = null; draw.clear(); el.setPosition(game.fen().split(" ")[0], false); render(); },
    orient(color) { el.orientation = color === "b" ? "black" : "white"; render(); draw.render(); },
    play(uciOrSan) {
      const mv = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uciOrSan) ? { from: uciOrSan.slice(0, 2), to: uciOrSan.slice(2, 4), promotion: uciOrSan[4] } : uciOrSan;
      const m = game.move(mv); selected = null; if (m) lastMove = { from: m.from, to: m.to };
      draw.render();
      el.setPosition(game.fen().split(" ")[0], true); render(); return m;
    },
    sync() { selected = null; el.setPosition(game.fen().split(" ")[0], false); render(); },
    draw,
    undo() { game.undo(); selected = null; lastMove = null; draw.clear(); el.setPosition(game.fen().split(" ")[0], true); render(); },
  };
}

// Convert a UCI move to SAN in the given position (without changing it).
export function uciToSan(fen, uci) {
  const g = new Chess(fen);
  const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return m ? m.san : uci;
}
export const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
