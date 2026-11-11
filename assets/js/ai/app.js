// ChessDepth AI - turn a screenshot or diagram into a board and a FEN, entirely in the browser.
import { loadModel, classify, CLASSES } from "./model.js";
import { toGray, findBoard } from "./detect.js";
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js";

const $ = (id) => document.getElementById(id);
const ui = {
  drop: $("ai-drop"), file: $("ai-file"), work: $("ai-work"), src: $("ai-src"), status: $("ai-status"),
  board: $("ai-board"), fen: $("ai-fen"), copy: $("ai-copy"), lichess: $("ai-lichess"), editor: $("ai-editor"),
  flip: $("ai-flip"), turnW: $("ai-turn-w"), turnB: $("ai-turn-b"), adjust: $("ai-adjust"), unsure: $("ai-unsure"),
  again: $("ai-again"), good: $("ai-good"), bad: $("ai-bad"), fb: $("ai-feedback"),
  issue: $("ai-issue"), best: $("ai-best"), bestOut: $("ai-best-out"), link: $("ai-link"), cam: $("ai-cam"),
  send: $("ai-send"), sendBtn: $("ai-send-btn"), sendMsg: $("ai-send-msg"), srcCol: $("ai-src-col"),
};
const VERSION = "v0.3";
const tick = () => new Promise((r) => setTimeout(r, 0));
const track = (n, p) => { try { if (typeof window.gtag === "function") window.gtag("event", n, p || {}); } catch (e) { /* ignore */ } };
let img = null, box = null, turn = "w", whiteBottom = true, edited = false, scaleShown = 1, drawing = null;
let lastCrops = null, lastRead = "", runId = 0;
const modelReady = loadModel().catch((e) => { console.error(e); return null; });

// ---------- input: upload, drop, paste, examples ----------
ui.file.addEventListener("change", () => { if (ui.file.files[0]) readFile(ui.file.files[0], "upload"); ui.file.value = ""; });
if (ui.cam) ui.cam.addEventListener("change", () => { if (ui.cam.files[0]) readFile(ui.cam.files[0], "camera"); ui.cam.value = ""; });
["dragenter", "dragover"].forEach((t) => ui.drop.addEventListener(t, (e) => { e.preventDefault(); ui.drop.classList.add("is-over"); }));
["dragleave", "drop"].forEach((t) => ui.drop.addEventListener(t, (e) => { e.preventDefault(); ui.drop.classList.remove("is-over"); }));
ui.drop.addEventListener("drop", (e) => { const f = [...(e.dataTransfer.files || [])].find((x) => x.type.startsWith("image/")); if (f) readFile(f, "drop"); });
document.addEventListener("paste", (e) => {
  const it = [...(e.clipboardData ? e.clipboardData.items : [])].find((x) => x.type.startsWith("image/"));
  if (it) { e.preventDefault(); readFile(it.getAsFile(), "paste"); }
});
document.querySelectorAll("[data-example]").forEach((b) => b.addEventListener("click", () => loadUrl(b.dataset.example, "example")));
ui.again.addEventListener("click", () => { runId++; history.replaceState(null, "", location.pathname); ui.work.classList.add("hidden"); ui.drop.classList.remove("hidden"); ui.drop.scrollIntoView({ block: "center", behavior: "smooth" }); });

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
  const id = ++runId;
  ui.drop.classList.add("hidden"); ui.work.classList.remove("hidden"); ui.srcCol.classList.remove("hidden"); edited = false; ui.fb.classList.remove("hidden");
  ui.good.disabled = false; ui.bad.disabled = false; ui.fb.querySelector("span").textContent = "Did it read the position correctly?";
  ui.send.classList.add("hidden"); ui.bestOut.textContent = ""; clearMarks();
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
  let big = drawBoard(box), probs = readSquares(big);
  // 1) Line the grid up exactly: nudge and resize the box while the model gets more sure of what it sees.
  say("Lining up the squares…"); await tick();
  const fit = await refine(box, probs, !!manualBox, id);
  if (id !== runId) return;
  if (fit.changed) { box = fit.box; big = drawBoard(box); probs = readSquares(big); drawSource(); }
  // 2) Second look at any square the model is unsure about, from four slightly shifted views.
  probs.forEach((p, i) => {
    if (Math.max(...p) >= 0.95) return;
    const L = p.map((v) => Math.log(v + 1e-6));
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) readSquares(big, [i], dx, dy)[0].forEach((v, k) => { L[k] += Math.log(v + 1e-6); });
    const e = L.map((v) => Math.exp(v / 5)), sum = e.reduce((a, c) => a + c, 0);
    probs[i] = e.map((v) => v / sum);
  });
  lastCrops = cropBytes(big);
  const res = decide(probs);
  lastRead = res.pick.map((v) => CLASSES[v]).join("");
  whiteBottom = res.whiteBottom; turn = "w";
  showResult(res);
  const ms = Math.round(performance.now() - t0);
  track("ai_result", { pieces: res.count, unsure: res.unsure.length, ms, refined: fit.changed, version: VERSION });
  say(res.count ? `Done! ${res.count} pieces found${res.unsure.length ? `. Please check the highlighted squares.` : "."} Drag pieces on the board to fix anything.` : "No pieces found. Try drawing a box around the board.", res.count ? "ok" : "bad");
}

// the board area of the image, straightened to 512 x 512 (64 px per square)
function drawBoard(b) {
  const big = document.createElement("canvas"); big.width = big.height = 512;
  const bctx = big.getContext("2d", { willReadFrequently: true }); bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = "high";
  bctx.fillStyle = "#888"; bctx.fillRect(0, 0, 512, 512);
  bctx.drawImage(img, b.x, b.y, b.size, b.size, 0, 0, 512, 512);
  return big;
}
const sqCanvas = document.createElement("canvas"); sqCanvas.width = sqCanvas.height = 32;
const sqCtx = sqCanvas.getContext("2d", { willReadFrequently: true });
function grayCrop(big, i, dx = 0, dy = 0) {
  const r = i >> 3, c = i & 7;
  sqCtx.imageSmoothingEnabled = true; sqCtx.imageSmoothingQuality = "high";
  sqCtx.fillStyle = "#888"; sqCtx.fillRect(0, 0, 32, 32); sqCtx.drawImage(big, c * 64 + dx, r * 64 + dy, 64, 64, 0, 0, 32, 32);
  const d = sqCtx.getImageData(0, 0, 32, 32).data, px = new Float32Array(1024);
  for (let k = 0, j = 0; k < 1024; k++, j += 4) px[k] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
  return px;
}
// probabilities for the listed squares (all 64 by default), each downscaled the same way
function readSquares(big, list, dx, dy) {
  const idx = list || Array.from({ length: 64 }, (_, i) => i);
  return idx.map((i) => classify(grayCrop(big, i, dx, dy)));
}
function cropBytes(big) {
  const out = new Uint8Array(64 * 1024);
  for (let i = 0; i < 64; i++) { const px = grayCrop(big, i); for (let k = 0; k < 1024; k++) out[i * 1024 + k] = Math.round(px[k]); }
  return out;
}
// Fine-tune the box. A grid that is a few pixels off cuts pieces in half and confuses the model, so we try
// small shifts and size changes and keep any that make the model more confident (measured on the occupied
// squares plus a few empty ones). On our test screenshots this roughly doubles the number of perfect reads
// when the box starts 4% off.
async function refine(b0, P, manual, id) {
  const occ = [], emp = [];
  P.forEach((p, i) => { let b = 0; p.forEach((v, k) => { if (v > p[b]) b = k; }); (b ? occ : emp).push(i); });
  if (occ.length < 2) return { box: b0, changed: false };
  const spread = (a, n) => (a.length <= n ? a : Array.from({ length: n }, (_, k) => a[Math.floor((k * a.length) / n)]));
  const sub = spread(occ, 16).concat(spread(emp, 6));
  const score = (Q) => Q.reduce((s, p) => s + Math.log(Math.max(...p) + 1e-6), 0);
  let best = b0, bc = score(sub.map((i) => P[i])), changed = false;
  for (const step of manual ? [0.06, 0.03, 0.015] : [0.03, 0.015]) {
    for (let pass = 0; pass < 2; pass++) {
      const { x, y, size: s } = best; let got = false;
      const cands = [{ x: x + step * s, y, size: s }, { x: x - step * s, y, size: s }, { x, y: y + step * s, size: s }, { x, y: y - step * s, size: s }];
      for (const ds of [-step, step]) { const s1 = s * (1 + ds); cands.push({ x: x - (s1 - s) / 2, y: y - (s1 - s) / 2, size: s1 }); }
      for (const cd of cands) {
        const q = score(readSquares(drawBoard(cd), sub));
        if (q > bc + 0.05) { bc = q; best = cd; got = true; changed = true; }
        await tick(); if (id !== runId) return { box: b0, changed: false };
      }
      if (!got) break;
    }
  }
  return { box: best, changed };
}

// choose a piece for every square, apply simple chess sense, and work out which side is at the bottom
function decide(P) {
  const pick = P.map((p) => { let b = 0; p.forEach((v, i) => { if (v > p[b]) b = i; }); return b; });
  // pawns can't stand on the first or last rank (checked before the king rule so it can't add a king)
  pick.forEach((v, i) => { const r = Math.floor(i / 8); if ((v === 1 || v === 7) && (r === 0 || r === 7)) pick[i] = second(P[i], [1, 6, 7, 12]); });
  // at most eight pawns a side: turn the least certain extras into the model's second choice
  for (const pw of [1, 7]) {
    const idx = pick.map((v, i) => (v === pw ? i : -1)).filter((i) => i >= 0);
    if (idx.length > 8) { idx.sort((a, b) => P[b][pw] - P[a][pw]); idx.slice(8).forEach((i) => { pick[i] = second(P[i], [pw]); }); }
  }
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
  updateFen();
  highlightUnsure(res.unsure.map((i) => SQ(i, res.whiteBottom)));
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
  const problem = issueWith(fen, pos); const ok = !problem;
  ui.issue.textContent = problem; ui.issue.classList.toggle("hidden", ok);
  ui.best.disabled = !ok; ui.bestOut.textContent = ""; clearMarks();
  ui.lichess.href = "https://lichess.org/analysis/standard/" + fen.replace(/ /g, "_");
  ui.editor.href = "https://lichess.org/editor/" + fen.replace(/ /g, "_");
  ui.lichess.classList.toggle("is-disabled", !ok);
  ui.lichess.title = ok ? "" : problem;
  ui.turnW.setAttribute("aria-pressed", String(turn === "w")); ui.turnB.setAttribute("aria-pressed", String(turn === "b"));
}
// Why the position can't be analysed yet, in plain words ("" when it is fine).
function issueWith(fen, pos) {
  const n = (p) => Object.values(pos).filter((x) => x === p).length;
  if (n("wK") !== 1 || n("bK") !== 1) return "A legal position needs exactly one white king and one black king.";
  if (Object.entries(pos).some(([sq, p]) => p[1] === "P" && (sq[1] === "1" || sq[1] === "8"))) return "Pawns can't stand on the first or last rank.";
  try {
    const other = new Chess(fen.replace(/ [wb] /, turn === "w" ? " b " : " w ").replace(/ [KQkq-]+ /, " - "));
    if (other.isCheck()) return `${turn === "w" ? "Black" : "White"}'s king is in check, so it must be ${turn === "w" ? "Black" : "White"} to move. Switch "To move" above.`;
    new Chess(fen);
  } catch (e) { return "This position isn't legal yet. Check the kings and pawns."; }
  return "";
}
function markSquares(list, colour) {
  const sr = ui.board.shadowRoot; if (!sr) return;
  sr.querySelectorAll("[data-square]").forEach((el) => { if (list.includes(el.dataset.square)) el.style.boxShadow = `inset 0 0 0 4px ${colour}`; });
}
function clearMarks() { const sr = ui.board.shadowRoot; if (sr) sr.querySelectorAll("[data-square]").forEach((el) => { el.style.boxShadow = ""; }); }
// Best move from Stockfish (runs in the browser, loaded only when asked for).
ui.best.addEventListener("click", async () => {
  if (ui.best.disabled) return;
  const fen = ui.fen.value; ui.best.disabled = true; ui.bestOut.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Stockfish is thinking…';
  try {
    const { bestMove } = await import("../lab/engine.js");
    const r = await bestMove(fen, 1500);
    if (fen !== ui.fen.value) return;
    if (!r.move || r.move === "(none)") { ui.bestOut.textContent = new Chess(fen).isCheckmate() ? "It's checkmate: there is no move to find." : "No legal moves: stalemate."; return; }
    const g = new Chess(fen), mv = g.move({ from: r.move.slice(0, 2), to: r.move.slice(2, 4), promotion: r.move[4] });
    const sc = r.score || {}, sign = turn === "w" ? 1 : -1; let verdict;
    if (sc.mate != null) verdict = `${(sc.mate > 0) === (turn === "w") ? "White" : "Black"} mates in ${Math.abs(sc.mate)}`;
    else { const cp = (sc.cp || 0) * sign, a = Math.abs(cp), who = cp > 0 ? "White" : "Black";
      verdict = (a < 30 ? "The position is equal" : a < 100 ? `${who} is slightly better` : a < 300 ? `${who} is clearly better` : `${who} is winning`) + (a < 5 ? " (0.0)" : ` (${cp > 0 ? "+" : ""}${(cp / 100).toFixed(1)})`); }
    ui.bestOut.innerHTML = `Best move: <b>${mv.san}</b> · ${verdict}`;
    clearMarks(); markSquares([mv.from, mv.to], "rgba(22,163,74,.9)");
    track("ai_best_move", {});
  } catch (e) { ui.bestOut.textContent = "Stockfish couldn't start in this browser. Use the Lichess button instead."; }
  finally { ui.best.disabled = !!issueWith(ui.fen.value, ui.board.position || {}); }
});
ui.link.addEventListener("click", async () => {
  const url = location.origin + "/ai/?fen=" + encodeURIComponent(ui.fen.value);
  try { await navigator.clipboard.writeText(url); ui.link.innerHTML = '<i class="fas fa-check"></i> Link copied'; } catch (e) { ui.fen.value = url; ui.fen.select(); ui.link.innerHTML = "Link is in the box: copy it"; return; }
  setTimeout(() => { ui.link.innerHTML = '<i class="fas fa-link"></i> Copy link'; }, 1500); track("ai_copy_link", {});
});
// Open a shared position: /ai/?fen=...
(async () => {
  const f = new URLSearchParams(location.search).get("fen"); if (!f) return;
  try { new Chess(f); } catch (e) { return; }
  await customElements.whenDefined("chess-board");
  ui.drop.classList.add("hidden"); ui.work.classList.remove("hidden"); ui.srcCol.classList.add("hidden"); ui.fb.classList.add("hidden");
  turn = f.split(" ")[1] === "b" ? "b" : "w"; ui.board.orientation = turn === "b" ? "black" : "white";
  quiet = true; ui.board.setPosition(f.split(" ")[0], false); setTimeout(() => { quiet = false; updateFen(); }, 0);
  say("Shared position. Drag pieces to edit it, or upload your own image with \"New image\".", "ok");
})();

// Opt-in training example: the 64 small grey squares cut from the board plus the corrected position.
// Nothing is sent unless the visitor presses the button.
ui.sendBtn.addEventListener("click", async () => {
  if (!lastCrops) return;
  ui.sendBtn.disabled = true; ui.sendMsg.textContent = "Sending…";
  try {
    const pos = ui.board.position || {}, wb = ui.board.orientation === "white"; let fixed = "";
    for (let i = 0; i < 64; i++) { const p = pos[SQ(i, wb)]; fixed += p ? (p[0] === "w" ? p[1] : p[1].toLowerCase()) : "."; }
    let bin = ""; for (let i = 0; i < lastCrops.length; i += 8192) bin += String.fromCharCode.apply(null, lastCrops.subarray(i, i + 8192));
    const V = "10.12.2";
    const [{ firebaseConfig }, appMod, fs] = await Promise.all([import("../firebase-config.js"),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`), import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
    await fs.addDoc(fs.collection(fs.getFirestore(app), "aiExamples"), { v: VERSION, px: btoa(bin), read: lastRead, fixed, wb, at: fs.serverTimestamp() });
    ui.sendMsg.textContent = "Sent. Thank you! This example will be used to train the next version."; track("ai_example_sent", { changed: fixed !== lastRead });
  } catch (e) { ui.sendBtn.disabled = false; ui.sendMsg.textContent = "That couldn't be sent just now. You can send the image on WhatsApp instead (button at the bottom of the page)."; }
});

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
ui.bad.addEventListener("click", () => {
  track("ai_feedback", { correct: false, edited }); ui.good.disabled = ui.bad.disabled = true; ui.fb.querySelector("span").textContent = "Thanks for telling us.";
  if (lastCrops) { ui.send.classList.remove("hidden"); ui.sendBtn.disabled = false; ui.sendMsg.textContent = ""; }
});

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
