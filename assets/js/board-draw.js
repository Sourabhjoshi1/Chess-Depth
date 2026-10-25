// ChessDepth - draw arrows and circles on any <chess-board>, like on Lichess.
//   Mouse: right-click a square to circle it; right-click and drag to draw an arrow. Left-click clears.
//          Hold Shift for red, Alt (Option) for blue, Shift+Alt for yellow. Green otherwise.
//   Touch: tap the pencil button under the board, then tap a square (circle) or drag (arrow).
const FILES = "abcdefgh";
const COLORS = { g: "#15803d", r: "#dc2626", b: "#2563eb", y: "#ca8a04" };

export function enableDrawing(el, { onClear } = {}) {
  if (el.__cdDraw) return el.__cdDraw;
  const uid = "b" + Math.random().toString(36).slice(2, 8);
  const host = el.parentElement;
  if (host && getComputedStyle(host).position === "static") host.style.position = "relative";
  el.classList.add("cd-drawable");

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "cd-draw-layer"); svg.setAttribute("viewBox", "0 0 8 8"); svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;pointer-events:none;z-index:3;overflow:visible;";
  svg.innerHTML = `<defs>${Object.entries(COLORS).map(([k, c]) => `<marker id="cd-ah-${k}-${uid}" markerWidth="4" markerHeight="4" refX="2.05" refY="2" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L4,2 L0,4 Z" fill="${c}"/></marker>`).join("")}</defs><g class="cd-draw-shapes"></g><g class="cd-draw-preview"></g>`;
  el.insertAdjacentElement("afterend", svg);
  const shapesG = svg.querySelector(".cd-draw-shapes"), previewG = svg.querySelector(".cd-draw-preview");

  let shapes = [];           // { from, to, c }  (to === from for a circle)
  let drawing = null;        // { from, c, pointerId }
  let penMode = false;

  const flipped = () => el.orientation === "black";
  function squareAt(x, y) {
    const r = el.getBoundingClientRect(), s = r.width / 8;
    let col = Math.floor((x - r.left) / s), row = Math.floor((y - r.top) / s);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    if (flipped()) { col = 7 - col; row = 7 - row; }
    return FILES[col] + (8 - row);
  }
  function center(sq) {
    let col = FILES.indexOf(sq[0]), row = 8 - Number(sq[1]);
    if (flipped()) { col = 7 - col; row = 7 - row; }
    return [col + 0.5, row + 0.5];
  }
  function place() {
    svg.style.left = el.offsetLeft + "px"; svg.style.top = el.offsetTop + "px";
    svg.style.width = el.offsetWidth + "px"; svg.style.height = el.offsetWidth + "px";
  }
  function shapeSvg(s, preview) {
    const col = COLORS[s.c] || COLORS.g, op = preview ? 0.5 : 0.8;
    if (s.from === s.to) {
      const [x, y] = center(s.from);
      return `<circle cx="${x}" cy="${y}" r="0.44" fill="none" stroke="${col}" stroke-width="0.075" opacity="${op}"/>`;
    }
    const [x1, y1] = center(s.from), [x2, y2] = center(s.to);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), k = (len - 0.42) / len; // stop short so the head sits in the square
    return `<line x1="${x1}" y1="${y1}" x2="${x1 + dx * k}" y2="${y1 + dy * k}" stroke="${col}" stroke-width="0.16" stroke-linecap="round" opacity="${op}" marker-end="url(#cd-ah-${s.c}-${uid})"/>`;
  }
  function render() { place(); shapesG.innerHTML = shapes.map((s) => shapeSvg(s)).join(""); }
  function colorFor(e) { return e.shiftKey && e.altKey ? "y" : e.shiftKey ? "r" : e.altKey || e.metaKey ? "b" : "g"; }
  function toggle(s) {
    const i = shapes.findIndex((x) => x.from === s.from && x.to === s.to);
    if (i >= 0) { const same = shapes[i].c === s.c; shapes.splice(i, 1); if (same) return; }
    shapes.push(s);
  }
  function clear() { if (!shapes.length) return; shapes = []; render(); onClear && onClear(); }

  // Capture phase on the board: stop right-clicks (and pen-mode touches) reaching the pieces.
  const isDrawStart = (e) => e.button === 2 || (penMode && e.pointerType !== "mouse");
  el.addEventListener("pointerdown", (e) => {
    if (isDrawStart(e)) {
      e.preventDefault(); e.stopPropagation();
      const sq = squareAt(e.clientX, e.clientY); if (!sq) return;
      drawing = { from: sq, c: colorFor(e), pointerId: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      previewG.innerHTML = "";
    } else if (e.button === 0) {
      clear();
    }
  }, true);
  el.addEventListener("pointermove", (e) => {
    if (!drawing || e.pointerId !== drawing.pointerId) return;
    e.preventDefault(); e.stopPropagation();
    const sq = squareAt(e.clientX, e.clientY);
    previewG.innerHTML = sq ? shapeSvg({ from: drawing.from, to: sq, c: drawing.c }, true) : "";
  }, true);
  const finish = (e) => {
    if (!drawing || e.pointerId !== drawing.pointerId) return;
    e.preventDefault(); e.stopPropagation();
    const sq = squareAt(e.clientX, e.clientY);
    if (sq) toggle({ from: drawing.from, to: sq, c: drawing.c });
    drawing = null; previewG.innerHTML = ""; render();
  };
  el.addEventListener("pointerup", finish, true);
  el.addEventListener("pointercancel", () => { drawing = null; previewG.innerHTML = ""; }, true);
  // Pieces in chessboard-element also listen to mouse and touch events: block those while drawing.
  ["mousedown", "touchstart"].forEach((t) => el.addEventListener(t, (e) => {
    if (t === "mousedown" && e.button === 2) { e.stopPropagation(); }
    if (t === "touchstart" && penMode) { e.stopPropagation(); e.preventDefault(); }
  }, { capture: true, passive: false }));
  el.addEventListener("contextmenu", (e) => e.preventDefault());

  // Touch devices: a small pencil toggle under the board.
  let penBtn = null;
  if (window.matchMedia && matchMedia("(pointer: coarse)").matches) {
    penBtn = document.createElement("button");
    penBtn.type = "button"; penBtn.className = "cd-pen-btn";
    penBtn.innerHTML = `<i class="fas fa-pen"></i> <span>Draw arrows</span>`;
    penBtn.setAttribute("aria-pressed", "false");
    penBtn.addEventListener("click", () => {
      penMode = !penMode; penBtn.setAttribute("aria-pressed", String(penMode)); el.classList.toggle("cd-pen-on", penMode);
      penBtn.querySelector("span").textContent = penMode ? "Done drawing" : "Draw arrows";
      penBtn.querySelector("i").className = penMode ? "fas fa-check" : "fas fa-pen";
      if (!penMode) { /* keep drawings until the next move */ }
    });
    const clr = document.createElement("button");
    clr.type = "button"; clr.className = "cd-pen-btn cd-pen-clear"; clr.innerHTML = `<i class="fas fa-eraser"></i><span class="sr-only">Clear drawings</span>`;
    clr.addEventListener("click", clear);
    const bar = document.createElement("div"); bar.className = "cd-pen-bar"; bar.append(penBtn, clr);
    svg.insertAdjacentElement("afterend", bar);
  }

  window.addEventListener("resize", render);
  if ("ResizeObserver" in window) new ResizeObserver(render).observe(el);
  // Redraw when the board is flipped.
  new MutationObserver(render).observe(el, { attributes: true, attributeFilter: ["orientation"] });
  render();
  const api = { clear, render, get shapes() { return shapes.slice(); } };
  el.__cdDraw = api;
  return api;
}
