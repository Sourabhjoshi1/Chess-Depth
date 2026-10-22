// ChessDepth Chess Lab - board helper: chessboard-element (display, drag & drop) + chess.js (rules).
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js";
export { Chess };

// Wrap a <chess-board> element. onUserMove({from,to,promotion,san}) must return true to accept the move.
export async function makeBoard(el, { onUserMove, canDrag }) {
  await customElements.whenDefined("chess-board");
  const game = new Chess();
  el.addEventListener("drag-start", (e) => {
    const { piece } = e.detail;
    const turn = game.turn();
    if (!canDrag() || game.isGameOver() || piece[0] !== turn) e.preventDefault();
  });
  el.addEventListener("drop", (e) => {
    const { source, target, setAction } = e.detail;
    if (source === target || target === "offboard") { setAction("snapback"); return; }
    const piece = game.get(source);
    const promo = piece && piece.type === "p" && (target[1] === "8" || target[1] === "1") ? "q" : undefined;
    const legal = game.moves({ square: source, verbose: true }).find((m) => m.to === target && (!promo || m.promotion === promo));
    if (!legal) { setAction("snapback"); return; }
    const ok = onUserMove({ from: source, to: target, promotion: legal.promotion, san: legal.san, uci: source + target + (legal.promotion || "") });
    if (!ok) setAction("snapback");
  });
  el.addEventListener("snap-end", () => el.setPosition(game.fen().split(" ")[0], false));
  return {
    game,
    load(fen) { game.load(fen); el.setPosition(game.fen().split(" ")[0], false); },
    orient(color) { el.orientation = color === "b" ? "black" : "white"; },
    play(uciOrSan) {
      const mv = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uciOrSan) ? { from: uciOrSan.slice(0, 2), to: uciOrSan.slice(2, 4), promotion: uciOrSan[4] } : uciOrSan;
      const m = game.move(mv); el.setPosition(game.fen().split(" ")[0], true); return m;
    },
    sync() { el.setPosition(game.fen().split(" ")[0], false); },
    undo() { game.undo(); el.setPosition(game.fen().split(" ")[0], true); },
  };
}

// Convert a UCI move to SAN in the given position (without changing it).
export function uciToSan(fen, uci) {
  const g = new Chess(fen);
  const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return m ? m.san : uci;
}
export const PIECE_NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
