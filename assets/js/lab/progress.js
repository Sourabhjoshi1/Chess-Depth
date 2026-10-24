// ChessDepth Chess Lab - Progress dashboard.
import { startLabPage, esc } from "./shell.js";
import { levelFor, LEVELS, leaderboard, weekKey, resetDemoProgress } from "./lab-core.js";

const THEMES = { fork: "Fork", pin: "Pin", skewer: "Skewer", discoveredAttack: "Discovered attack", deflection: "Deflection", attraction: "Decoy", hangingPiece: "Hanging piece", sacrifice: "Sacrifice", mateIn1: "Mate in 1", mateIn2: "Mate in 2", mateIn3: "Mate in 3", backRankMate: "Back-rank mate", promotion: "Promotion", endgame: "Endgame", rookEndgame: "Rook endgame", pawnEndgame: "Pawn endgame", middlegame: "Middlegame", opening: "Opening", defensiveMove: "Defensive move", quietMove: "Quiet move", advancedPawn: "Advanced pawn", kingsideAttack: "Kingside attack", exposedKing: "Exposed king", intermezzo: "Zwischenzug", clearance: "Clearance", doubleCheck: "Double check", trappedPiece: "Trapped piece", capturingDefender: "Capture the defender", interference: "Interference", xRayAttack: "X-ray", smotheredMate: "Smothered mate" };

startLabPage({ toolName: "your Progress dashboard", ready: run });

async function run(st, prog) {
  const P = prog.puzzle, lv = levelFor(prog.points);
  const set = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };

  // Level
  set("pd-level", `<div class="pd-level-icon">${lv.icon}</div><div class="pd-level-body"><p class="pd-label">Level</p><p class="pd-big">${lv.name}</p>
    <div class="pd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lv.pct}"><span style="width:${lv.pct}%"></span></div>
    <p class="pd-small">${lv.next ? `${lv.toNext} points to ${lv.next.icon} ${lv.next.name}` : "Highest level reached!"}</p></div>`);
  set("pd-points", `<p class="pd-label">Total points</p><p class="pd-big">${prog.points}</p><p class="pd-small">${prog.week.points} this week</p>`);
  set("pd-streak", `<p class="pd-label">Day streak</p><p class="pd-big"><i class="fas fa-fire"></i> ${prog.streak.count || 0}</p><p class="pd-small">Best: ${prog.streak.best || 0} days</p>`);
  set("pd-rating", `<p class="pd-label">Puzzle rating</p><p class="pd-big">${Math.round(P.rating)}</p><p class="pd-small">${P.solved} solved of ${P.attempted} tried · best run ${P.bestRun || 0}</p>`);

  const PS = prog.pstreak || { best: 0, runs: 0, last: 0 };
  set("pd-pstreak", `<p class="pd-label">Puzzle Streak best</p><p class="pd-big"><i class="fas fa-fire-alt"></i> ${PS.best}</p><p class="pd-small">${PS.runs ? `${PS.runs} runs · last ${PS.last}` : `<a href="/lab/streak/">Play your first streak</a>`}</p>`);

  // Rating chart
  const H = P.history;
  if (H.length >= 2) {
    const w = 560, h = 160, pad = 26, ys = H.map((x) => x[1]); const lo = Math.min(...ys) - 20, hi = Math.max(...ys) + 20;
    const X = (i) => pad + (i * (w - pad * 2)) / (H.length - 1), Y = (v) => h - pad - ((v - lo) * (h - pad * 2)) / (hi - lo || 1);
    const pts = H.map((p, i) => `${X(i).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
    set("pd-chart", `<svg viewBox="0 0 ${w} ${h}" class="pd-svg" role="img" aria-label="Puzzle rating over your last ${H.length} puzzles, from ${ys[0]} to ${ys[ys.length - 1]}">
      <line x1="${pad}" x2="${w - pad}" y1="${Y(hi - 20)}" y2="${Y(hi - 20)}" class="pd-grid"/><line x1="${pad}" x2="${w - pad}" y1="${Y(lo + 20)}" y2="${Y(lo + 20)}" class="pd-grid"/>
      <text x="${pad - 4}" y="${Y(hi - 20) + 4}" text-anchor="end" class="pd-axis">${hi - 20}</text><text x="${pad - 4}" y="${Y(lo + 20) + 4}" text-anchor="end" class="pd-axis">${lo + 20}</text>
      <polyline points="${pts}" class="pd-line"/><circle cx="${X(H.length - 1)}" cy="${Y(ys[ys.length - 1])}" r="4" class="pd-dot"/></svg>
      <p class="pd-small">Your last ${H.length} puzzles</p>`);
  } else set("pd-chart", `<p class="pd-empty">Solve a few puzzles in the <a href="/lab/tactics/">Tactics trainer</a> to see your rating chart.</p>`);

  // Themes
  const th = Object.entries(P.byTheme).filter(([, r]) => r.a >= 1).map(([t, r]) => ({ t, ...r, pct: Math.round((r.s / r.a) * 100) })).sort((a, b) => b.a - a.a).slice(0, 10);
  set("pd-themes", th.length ? th.map((r) => `<div class="pd-theme"><span class="pd-theme-name">${esc(THEMES[r.t] || r.t)}</span><span class="pd-theme-bar"><span style="width:${r.pct}%" class="${r.pct >= 70 ? "good" : r.pct >= 40 ? "mid" : "low"}"></span></span><span class="pd-theme-pct">${r.pct}% <small>(${r.s}/${r.a})</small></span></div>`).join("")
    + (() => { const weak = th.filter((r) => r.a >= 3).sort((a, b) => a.pct - b.pct)[0]; return weak ? `<p class="pd-tip"><i class="fas fa-lightbulb"></i> Focus next on <b>${esc(THEMES[weak.t] || weak.t)}</b>: choose it as the theme in the Tactics trainer.</p>` : ""; })()
    : `<p class="pd-empty">Your strongest and weakest tactical themes will appear here.</p>`);

  // Openings
  const data = await fetch("/assets/lab/openings.json").then((r) => r.json());
  const rows = data.courses.map((c) => { const r = prog.openings[c.id]; const s = !r ? "Not started" : r.perfect >= 2 ? "Mastered" : r.learned ? "Learned" : "Started"; return { c, r, s }; });
  const counts = { Mastered: 0, Learned: 0, Started: 0 }; rows.forEach((x) => { if (counts[x.s] != null) counts[x.s]++; });
  set("pd-openings", `<p class="pd-small">${counts.Mastered} mastered · ${counts.Learned} learned · ${data.courses.length - counts.Mastered - counts.Learned - counts.Started} not started</p>
    <ul class="pd-list">${rows.map((x) => `<li><span>${esc(x.c.name)}</span><span class="pd-state pd-${x.s.replace(/\s/g, "").toLowerCase()}">${x.s}</span></li>`).join("")}</ul>`);

  // Activity
  set("pd-activity", prog.log.length ? `<ul class="pd-list">${prog.log.slice(0, 10).map((l) => `<li><span>${esc(l.why)}</span><span class="pd-pts">+${l.pts}</span></li>`).join("")}</ul>` : `<p class="pd-empty">Your recent points will appear here.</p>`);

  // Leaderboard
  try {
    const lb = await leaderboard();
    set("pd-leaderboard", `<p class="pd-small">Week ${weekKey().split("-W")[1]} · points earned this week${lb.sample ? " · sample players shown in demo mode" : ""}</p>
      <ol class="pd-lb">${lb.rows.slice(0, 10).map((r, i) => `<li class="${r.me ? "me" : ""}"><span class="pd-rank">${i + 1}</span><span class="pd-lb-name">${esc(r.name)}</span><span class="pd-lb-pts">${r.weeklyPoints}</span></li>`).join("")}</ol>`);
  } catch (e) { set("pd-leaderboard", `<p class="pd-empty">The leaderboard couldn't load right now.</p>`); }

  // Levels legend
  set("pd-levels", LEVELS.map((l) => `<span class="pd-lvl${l.name === lv.name ? " is-current" : ""}">${l.icon} ${l.name} <small>${l.min}+</small></span>`).join(""));

  const reset = document.getElementById("pd-reset");
  if (st.mode === "demo" && reset) { reset.classList.remove("hidden"); reset.addEventListener("click", () => { resetDemoProgress(); location.reload(); }); }
}
