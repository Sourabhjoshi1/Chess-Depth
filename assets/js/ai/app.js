// ChessDepth AI - turn a screenshot or diagram into a board and a FEN, entirely in the browser.
import { loadModel, classify, CLASSES } from "./model.js";
import { toGray, findBoard } from "./detect.js";

const $ = (id) => document.getElementById(id);
const ui = {
  drop: $("ai-drop"), file: $("ai-file"), work: $("ai-work"), src: $("ai-src"), status: $("ai-status"),
  board: $("ai-board"), fen: $("ai-fen"), copy: $("ai-copy"), lichess: $("ai-lichess"), editor: $("ai-editor"),
  flip: $("ai-flip"), turnW: $("ai-turn-w"), turnB: $("ai-turn-b"), adjust: $("ai-adjust"), unsure: $("ai-unsure"),
  again: $("ai-again"), good: $("ai-good"), bad: $("ai-bad"), fb: $("ai-feedback"),
};
const track = (n, p) => { try { if (typeof window.gtag === "function") window.gtag("event", n, p || {}); } catch (e) { /* ignore */ } };
let img = null, box = null, turn = "w", whiteBottom = true, edited = false, scaleShown = 1, drawing = null;
const modelReady = loadModel().catch((e) => { console.error(e); return null; });

// ---------- input: upload, drop, paste, examples ----------
ui.file.addEventListener("change", () => { if (ui.file.files[0]) readFile(ui.file.files[0], "upload"); ui.file.value = ""; });
["dragenter", "dragover"].forEach((t) => ui.drop.addEventListener(t, (e) => { e.preventDefault(); ui.drop.classList.add("is-over"); }));
["dragleave", "drop"].forEach((t) => ui.drop.addEventListener(t, (e) => { e.preventDefault(); ui.drop.classList.remove("is-over"); }));
ui.drop.addEventListener("drop", (e) => { const f = [...(e.dataTransfer.files || [])].find((x) => x.type.startsWith("image/")); if (f) readFile(f, "drop"); });
document.addEventListener("paste", (e) => {
  const it = [...(e.clipboardData ? e.clipboardData.items : [])].find((x) => x.type.startsWith("image/"));
  if (it) { e.preventDefault(); readFile(it.getAsFile(), "paste"); }
});
document.querySelectorAll("[data-example]").forEach((b) => b.addEventListener("click", () => loadUrl(b.dataset.example, "example")));
ui.again.addEventListener("click", () => { ui.work.classList.add("hidden"); ui.drop.classList.remove("hidden"); ui.drop.scrollIntoView({ block: "center", behavior: "smooth" }); });

function readFile(f, how) {
  if (!f || !f.type.startsWith("image/")) return say("Please choose an image file (PNG, JPG or WebP).", "bad");
  const url = URL.createObjectURL(f); loadUrl(url, how);
}
function loadUrl(url, how) {
  const im = new Image();
  im.onload = () => { img = im; track("ai_image", { how }); run(); };
  im.onerror = () => say("That image couldn't be opened. Try a PNG or JPG screenshot.", "bad");
  im.src = url;
}
function say(t, kind) { ui.status.textContent = t; ui.status.className = "ai-status-line " + (kind || ""); }

// ---------- pipeline ----------
async function run(manualBox) {
  ui.drop.classList.add("hidden"); ui.work.classList.remove("hidden"); edited = false; ui.fb.classList.remove("hidden");
  ui.good.disabled = false; ui.bad.disabled = false;
  say("Finding the board…");
  await new Promise((r) => setTimeout(r, 20));
  // work on a copy at most 900px wide for detection
  const sc = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  const cw = Math.round(img.naturalWidth * sc), ch = Math.round(img.naturalHeight * sc);
  const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d", { willReadFrequently: true }); ctx.drawImage(img, 0, 0, cw, ch);
  if (manualBox) box = manualBox;
  else {
    const found = findBoard(toGray(ctx, cw, ch), cw, ch);
    box = found ? { x: found.x / sc, y: found.y / sc, size: found.size / sc } : null;
    if (!box) {   // fall back: assume the image is (mostly) the board
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      box = { x: (img.naturalWidth - s) / 2, y: (img.naturalHeight - s) / 2, size: s };
    }
  }
  drawSource();
  const model = await modelReady;
  if (!model) return say("The recognition model couldn't load. Please refresh the page and try again.", "bad");
  say("Reading the pieces…"); await new Promise((r) => setTimeout(r, 20));
  const t0 = performance.now();
  const probs = readSquares();
  const res = decide(probs);
  whiteBottom = res.whiteBottom; turn = "w";
  showResult(res);
  const ms = Math.round(performance.now() - t0);
  track("ai_result", { pieces: res.count, unsure: res.unsure.length, ms });
  say(res.count ? `Done! ${res.count} pieces found${res.unsure.length ? `. Please check the highlighted squares.` : "."} Drag pieces on the board to fix anything.` : "No pieces found. Try drawing a box around the board.", res.count ? "ok" : "bad");
}

function readSquares() {
  const cv = document.createElement("canvas"); cv.width = 32; cv.height = 32;
  const ctx = cv.getContext("2d", { willReadFrequently: true }); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  // draw the board once at 8*64 px so every square is downscaled the same way
  const big = document.createElement("canvas"); big.width = big.height = 512;
  const bctx = big.getContext("2d"); bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = "high";
  bctx.fillStyle = "#888"; bctx.fillRect(0, 0, 512, 512);
  bctx.drawImage(img, box.x, box.y, box.size, box.size, 0, 0, 512, 512);
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    ctx.clearRect(0, 0, 32, 32); ctx.drawImage(big, c * 64, r * 64, 64, 64, 0, 0, 32, 32);
    const d = ctx.getImageData(0, 0, 32, 32).data, px = new Float32Array(1024);
    for (let i = 0, j = 0; i < 1024; i++, j += 4) px[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    out.push(classify(px));
  }
  return out;
}

// choose a piece for every square, apply simple chess sense, and work out which side is at the bottom
function decide(P) {
  const pick = P.map((p) => { let b = 0; p.forEach((v, i) => { if (v > p[b]) b = i; }); return b; });
  // pawns can't stand on the first or last rank (checked before the king rule so it can't add a king)
  pick.forEach((v, i) => { const r = Math.floor(i / 8); if ((v === 1 || v === 7) && (r === 0 || r === 7)) pick[i] = second(P[i], [1, 6, 7, 12]); });
  // exactly one king of each colour: keep the most confident; if none was read, take the likeliest occupied square
  for (const k of [6, 12]) {
    const idx = pick.map((v, i) => (v === k ? i : -1)).filter((i) => i >= 0);
    if (idx.length > 1) { idx.sort((a, b) => P[b][k] - P[a][k]); idx.slice(1).forEach((i) => { pick[i] = second(P[i], [k, 6, 12]); }); }
    if (!idx.length) {
      let bi = -1; pick.forEach((v, i) => { if (v && v !== 6 && v !== 12 && (bi < 0 || P[i][k] > P[bi][k])) bi = i; });
      if (bi >= 0 && P[bi][k] > 0.02) pick[bi] = k;
    }
  }
  // which side is at the bottom? white pawns and king usually sit lower when White is at the bottom
  let score = 0;
  pick.forEach((v, i) => { const r = Math.floor(i / 8); const w = r - 3.5; if (v === 1) score += w; else if (v === 7) score -= w; else if (v === 6) score += 0.5 * w; else if (v === 12) score -= 0.5 * w; });
  const whiteBottom = score > -3; // most diagrams are from White's side: only flip on clear evidence
  const unsure = []; let count = 0;
  pick.forEach((v, i) => { if (v) count++; if (P[i][v] < 0.75) unsure.push(i); });
  return { pick, P, whiteBottom, unsure, count };
}
function second(p, exclude) { let b = -1; p.forEach((v, i) => { if (!exclude.includes(i) && (b < 0 || v > p[b])) b = i; }); return b; }

// ---------- output ----------
const SQ = (i, wb) => { const r = Math.floor(i / 8), c = i % 8; return wb ? "abcdefgh"[c] + (8 - r) : "abcdefgh"[7 - c] + (r + 1); };
function showResult(res) {
  const pos = {};
  res.pick.forEach((v, i) => { if (v) { const ch = CLASSES[v]; pos[SQ(i, res.whiteBottom)] = (ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase(); } });
  ui.board.orientation = res.whiteBottom ? "white" : "black";
  quiet = true; ui.board.setPosition(pos, false); setTimeout(() => { quiet = false; }, 0);
  ui.unsure.innerHTML = res.unsure.length ? `<i class="fas fa-search"></i> Please check: ${res.unsure.map((i) => `<b>${SQ(i, res.whiteBottom)}</b>`).join(", ")}` : "";
  highlightUnsure(res.unsure.map((i) => SQ(i, res.whiteBottom)));
  updateFen();
}
function highlightUnsure(squares) {
  const sr = ui.board.shadowRoot; if (!sr) return;
  sr.querySelectorAll("[data-square]").forEach((el) => { el.style.boxShadow = squares.includes(el.dataset.square) ? "inset 0 0 0 3px rgba(234,88,12,.9)" : ""; });
}
function castling(pos) {
  let s = "";
  if (pos.e1 === "wK" && pos.h1 === "wR") s += "K"; if (pos.e1 === "wK" && pos.a1 === "wR") s += "Q";
  if (pos.e8 === "bK" && pos.h8 === "bR") s += "k"; if (pos.e8 === "bK" && pos.a8 === "bR") s += "q";
  return s || "-";
}
function updateFen() {
  const pos = ui.board.position || {};
  const placement = ui.board.fen ? ui.board.fen() : "";
  const fen = `${placement} ${turn} ${castling(pos)} - 0 1`;
  ui.fen.value = fen;
  const kings = Object.values(pos).filter((p) => p === "wK").length + "," + Object.values(pos).filter((p) => p === "bK").length;
  const ok = kings === "1,1";
  ui.lichess.href = "https://lichess.org/analysis/standard/" + fen.replace(/ /g, "_");
  ui.editor.href = "https://lichess.org/editor/" + fen.replace(/ /g, "_");
  ui.lichess.classList.toggle("is-disabled", !ok);
  ui.lichess.title = ok ? "" : "A legal position needs exactly one king of each colour";
  ui.turnW.setAttribute("aria-pressed", String(turn === "w")); ui.turnB.setAttribute("aria-pressed", String(turn === "b"));
}
let quiet = false; // setPosition from the model also fires "change"; only user edits count
ui.board.addEventListener("change", () => { if (quiet) return; edited = true; setTimeout(() => { updateFen(); highlightUnsure([]); ui.unsure.textContent = ""; }, 0); });
ui.turnW.addEventListener("click", () => { turn = "w"; updateFen(); });
ui.turnB.addEventListener("click", () => { turn = "b"; updateFen(); });
ui.flip.addEventListener("click", () => { // the picture was the other way round: mirror the whole position
  const pos = ui.board.position || {}, np = {};
  for (const [sq, p] of Object.entries(pos)) np["abcdefgh"[7 - "abcdefgh".indexOf(sq[0])] + (9 - Number(sq[1]))] = p;
  ui.board.orientation = ui.board.orientation === "white" ? "black" : "white";
  ui.board.setPosition(np, false); edited = true; updateFen(); highlightUnsure([]); ui.unsure.textContent = "";
});
ui.copy.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(ui.fen.value); ui.copy.innerHTML = '<i class="fas fa-check"></i> Copied'; }
  catch (e) { ui.fen.select(); document.execCommand && document.execCommand("copy"); ui.copy.innerHTML = '<i class="fas fa-check"></i> Copied'; }
  setTimeout(() => { ui.copy.innerHTML = '<i class="far fa-copy"></i> Copy FEN'; }, 1500);
  track("ai_copy_fen", {});
});
ui.lichess.addEventListener("click", (e) => { if (ui.lichess.classList.contains("is-disabled")) { e.preventDefault(); say("Add exactly one white king and one black king first.", "bad"); } else track("ai_open_lichess", { edited }); });
ui.good.addEventListener("click", () => { track("ai_feedback", { correct: true, edited }); ui.good.disabled = ui.bad.disabled = true; ui.fb.querySelector("span").textContent = "Thanks for the feedback!"; });
ui.bad.addEventListener("click", () => { track("ai_feedback", { correct: false, edited }); ui.good.disabled = ui.bad.disabled = true; ui.fb.querySelector("span").textContent = "Thanks! Every report helps us improve the model."; });

// ---------- source image with the board box; draw a new box by dragging ----------
function drawSource() {
  const maxW = ui.src.parentElement.clientWidth || 480;
  scaleShown = Math.min(1, maxW / img.naturalWidth, 520 / img.naturalHeight);
  ui.src.width = Math.round(img.naturalWidth * scaleShown); ui.src.height = Math.round(img.naturalHeight * scaleShown);
  const ctx = ui.src.getContext("2d"); ctx.drawImage(img, 0, 0, ui.src.width, ui.src.height);
  if (box) {
    ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 3;
    ctx.strokeRect(box.x * scaleShown, box.y * scaleShown, box.size * scaleShown, box.size * scaleShown);
    ctx.lineWidth = 1; ctx.strokeStyle = "rgba(22,163,74,.6)";
    for (let k = 1; k < 8; k++) {
      const s = box.size * scaleShown / 8;
      ctx.beginPath(); ctx.moveTo(box.x * scaleShown + k * s, box.y * scaleShown); ctx.lineTo(box.x * scaleShown + k * s, (box.y + box.size) * scaleShown); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(box.x * scaleShown, box.y * scaleShown + k * s); ctx.lineTo((box.x + box.size) * scaleShown, box.y * scaleShown + k * s); ctx.stroke();
    }
  }
}
ui.adjust.addEventListener("click", () => { ui.src.classList.add("is-drawing"); say("Drag a square around the board, from one corner to the opposite corner.", ""); });
ui.src.addEventListener("pointerdown", (e) => {
  if (!ui.src.classList.contains("is-drawing")) return;
  const r = ui.src.getBoundingClientRect(); drawing = { x: e.clientX - r.left, y: e.clientY - r.top }; ui.src.setPointerCapture(e.pointerId);
});
ui.src.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  const r = ui.src.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const s = Math.max(Math.abs(x - drawing.x), Math.abs(y - drawing.y));
  const bx = { x: Math.min(drawing.x, drawing.x + Math.sign(x - drawing.x) * s), y: Math.min(drawing.y, drawing.y + Math.sign(y - drawing.y) * s), size: s };
  box = { x: bx.x / scaleShown, y: bx.y / scaleShown, size: bx.size / scaleShown }; drawSource();
});
ui.src.addEventListener("pointerup", () => {
  if (!drawing) return; drawing = null; ui.src.classList.remove("is-drawing");
  if (box && box.size * scaleShown > 40) { track("ai_manual_box", {}); run(box); }
});
window.addEventListener("resize", () => { if (img && !ui.work.classList.contains("hidden")) drawSource(); });
