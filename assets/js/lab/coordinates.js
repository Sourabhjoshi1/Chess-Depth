// ChessDepth Chess Lab - Coordinates trainer: find or name squares in 30 seconds, from White's or Black's side.
import { startLabPage, toast, esc } from "./shell.js";
import { award, saveProgress, track, postRecord, recordBoard } from "./lab-core.js";

const FILES = "abcdefgh", SECS = 30;
startLabPage({ toolName: "the Coordinates trainer", ready: run });

async function run(st, prog) {
  const $ = (id) => document.getElementById(id);
  const C = prog.coords; C.best = C.best || {};
  const ui = { board: $("co-board"), prompt: $("co-prompt"), answers: $("co-answers"), time: $("co-time"), score: $("co-score"), best: $("co-best"), status: $("co-status"), sub: $("co-sub"), start: $("co-start"), lb: $("co-leaderboard"), lbMode: $("co-lb-mode"), labels: $("co-labels") };
  let drill = "find", side = "w", view = "w", running = false, score = 0, misses = 0, target = null, endAt = 0, tick = null, lock = false;
  try { ui.labels.checked = localStorage.getItem("cd-co-labels") === "1"; } catch (e) { /* storage off */ }

  const key = () => drill + "-" + side;
  function draw() {
    ui.board.innerHTML = "";
    ui.board.classList.toggle("co-labels", ui.labels.checked);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const f = view === "w" ? c : 7 - c, rank = view === "w" ? 8 - r : r + 1, sq = FILES[f] + rank;
      const d = document.createElement("button"); d.type = "button"; d.className = "co-sq " + ((f + rank) % 2 === 1 ? "co-light" : "co-dark"); d.dataset.sq = sq;
      d.setAttribute("aria-label", drill === "find" ? sq : "square");
      if (c === 0) { const s = document.createElement("span"); s.className = "co-rk"; s.textContent = rank; d.appendChild(s); }
      if (r === 7) { const s = document.createElement("span"); s.className = "co-fl"; s.textContent = FILES[f]; d.appendChild(s); }
      ui.board.appendChild(d);
    }
  }
  function randSq() { let s; do { s = FILES[Math.floor(Math.random() * 8)] + (1 + Math.floor(Math.random() * 8)); } while (s === target); return s; }
  function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return "0:" + String(s).padStart(2, "0"); }
  function renderTop() { ui.score.textContent = score; ui.best.textContent = C.best[key()] || 0; ui.time.textContent = running ? fmt(endAt - Date.now()) : fmt(SECS * 1000); }
  function setStatus(t, sub, kind) { ui.status.textContent = t; ui.sub.textContent = sub || ""; ui.status.parentElement.className = "tt-status " + (kind || ""); }

  function nextTarget() {
    if (side === "r") { view = Math.random() < .5 ? "w" : "b"; draw(); }
    target = randSq();
    ui.board.querySelectorAll(".co-target").forEach((x) => x.classList.remove("co-target"));
    if (drill === "find") { ui.prompt.textContent = target; ui.prompt.classList.remove("hidden"); }
    else {
      ui.prompt.classList.add("hidden");
      ui.board.querySelector(`[data-sq="${target}"]`).classList.add("co-target");
      const opts = new Set([target]);
      // Tempting wrong answers: same file or rank, or the mirror square from the other side.
      const mirror = FILES[7 - FILES.indexOf(target[0])] + (9 - Number(target[1]));
      [mirror, target[0] + (1 + ((Number(target[1]) + 1) % 8)), FILES[(FILES.indexOf(target[0]) + 2) % 8] + target[1]].forEach((s) => opts.size < 4 && opts.add(s));
      while (opts.size < 4) opts.add(randSq());
      ui.answers.innerHTML = [...opts].sort(() => Math.random() - .5).map((s) => `<button type="button" class="co-ans" data-ans="${s}">${s}</button>`).join("");
    }
  }
  function flash(el, cls) { if (!el) return; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 260); }
  function answer(sq, el) {
    if (!running || lock) return;
    if (sq === target) { score++; flash(el, "co-ok"); renderTop(); nextTarget(); }
    else {
      misses++; flash(el, "co-bad");
      if (drill === "find") flash(ui.board.querySelector(`[data-sq="${target}"]`), "co-show");
      lock = true; setTimeout(() => { lock = false; }, 250);
    }
  }
  ui.board.addEventListener("pointerdown", (e) => { const b = e.target.closest(".co-sq"); if (!b || drill !== "find") return; e.preventDefault(); answer(b.dataset.sq, b); });
  ui.answers.addEventListener("click", (e) => { const b = e.target.closest("[data-ans]"); if (b) answer(b.dataset.ans, b); });

  function start() {
    running = true; score = 0; misses = 0; endAt = Date.now() + SECS * 1000; view = side === "b" ? "b" : "w"; draw();
    ui.start.disabled = true; ui.answers.classList.toggle("hidden", drill !== "name");
    document.querySelectorAll(".co-modes button, .co-sides button").forEach((b) => (b.disabled = true));
    setStatus("Go!", drill === "find" ? "Tap the square shown on the board." : "Pick the name of the lit square.", "");
    nextTarget(); renderTop();
    clearInterval(tick); tick = setInterval(() => { renderTop(); if (Date.now() >= endAt) end(); }, 100);
    track("lab_coords_start", { drill, side });
  }
  function end() {
    running = false; clearInterval(tick); target = null;
    ui.prompt.classList.add("hidden"); ui.answers.classList.add("hidden"); ui.board.querySelectorAll(".co-target").forEach((x) => x.classList.remove("co-target"));
    ui.start.disabled = false; ui.start.innerHTML = `<i class="fas fa-redo"></i>Go again`;
    document.querySelectorAll(".co-modes button, .co-sides button").forEach((b) => (b.disabled = false));
    const k = key(), newBest = score > (C.best[k] || 0);
    if (newBest) C.best[k] = score;
    C.runs = (C.runs || 0) + 1;
    const field = drill === "find" ? "coordsFind" : "coordsName";
    const overall = Math.max(C.best[drill + "-w"] || 0, C.best[drill + "-b"] || 0, C.best[drill + "-r"] || 0);
    if (newBest && score >= overall) postRecord(field, score);
    const pts = Math.floor(score / 2);
    const res = pts ? award(pts, `Coordinates (${drill === "find" ? "find" : "name"}): ${score} correct`) : (saveProgress(), { added: 0 });
    const acc = score + misses ? Math.round((score / (score + misses)) * 100) : 0;
    setStatus(`Time! ${score} correct`, `${acc}% accuracy${res.added ? ` · +${res.added} points` : ""}${newBest && score ? " · new personal best!" : ""}`, newBest && score ? "ok" : "");
    if (newBest && score) toast(`<b>New best!</b> ${score} squares in 30 seconds.`);
    renderTop(); loadBoard(); track("lab_coords_end", { drill, side, score });
  }
  async function loadBoard() {
    const field = drill === "find" ? "coordsFind" : "coordsName";
    ui.lbMode.textContent = drill === "find" ? "Find the square" : "Name the square";
    const mine = Math.max(C.best[drill + "-w"] || 0, C.best[drill + "-b"] || 0, C.best[drill + "-r"] || 0);
    try {
      const lb = await recordBoard(field, mine, 35);
      ui.lb.innerHTML = lb.rows.length ? `<ol class="pd-lb">${lb.rows.slice(0, 15).map((r, i) => `<li class="${r.me ? "me" : ""}"><span class="pd-rank">${i + 1}</span><span class="pd-lb-name">${esc(r.name)}</span><span class="pd-lb-pts">${r.best}</span></li>`).join("")}</ol>
        <p class="pd-small">${lb.sample ? "Sample players shown in demo mode." : "Most correct in 30 seconds, first names only."}</p>` : `<p class="pd-empty">No scores yet. Be the first!</p>`;
    } catch (e) { ui.lb.innerHTML = `<p class="pd-empty">The leaderboard couldn't load right now.</p>`; }
  }
  function pick(group, attr, val) { document.querySelectorAll(group + " button").forEach((b) => b.classList.toggle("is-active", b.dataset[attr] === val)); }
  document.querySelectorAll(".co-modes button").forEach((b) => b.addEventListener("click", () => { if (running) return; drill = b.dataset.drill; pick(".co-modes", "drill", drill); draw(); renderTop(); loadBoard(); }));
  document.querySelectorAll(".co-sides button").forEach((b) => b.addEventListener("click", () => { if (running) return; side = b.dataset.side; view = side === "b" ? "b" : "w"; pick(".co-sides", "side", side); draw(); renderTop(); }));
  ui.labels.addEventListener("change", () => { try { localStorage.setItem("cd-co-labels", ui.labels.checked ? "1" : "0"); } catch (e) { /* storage off */ } draw(); });
  ui.start.addEventListener("click", start);
  draw(); renderTop(); loadBoard();
  setStatus("Ready?", "Choose a drill and a side, then press Start.", "");
}
