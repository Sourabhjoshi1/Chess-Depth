// ChessDepth Chess Lab - public showcase page: show the right call to action for each visitor.
import { startLabPage, esc } from "./shell.js";
import { CFG, levelFor, promoActive, promoLabel, dayKey, firstName } from "./lab-core.js";

const THEMES = { fork: "Fork", pin: "Pin", skewer: "Skewer", discoveredAttack: "Discovered attack", deflection: "Deflection", attraction: "Decoy", hangingPiece: "Hanging piece", sacrifice: "Sacrifice", mateIn1: "Mate in 1", mateIn2: "Mate in 2", mateIn3: "Mate in 3", backRankMate: "Back-rank mate", promotion: "Promotion", rookEndgame: "Rook endgame", pawnEndgame: "Pawn endgame", defensiveMove: "Defensive move", quietMove: "Quiet move", intermezzo: "Zwischenzug" };
// Members see a "today" panel: daily goal, streak and the most useful next steps.
async function today(st, prog) {
  const box = document.getElementById("lab-today"); if (!box) return;
  if (!(st.user && st.access && prog)) { box.classList.add("hidden"); return; }
  const goal = prog.goal || 50, got = (prog.days || {})[dayKey()] || 0, pct = Math.min(100, Math.round((got / goal) * 100));
  const P = prog.puzzle, missed = (P.missed || []).length;
  const steps = [];
  if (missed) steps.push([`/lab/tactics/?set=missed`, "fa-redo", `Retry ${missed} missed puzzle${missed > 1 ? "s" : ""}`, "Solve them cleanly to clear the list."]);
  try {
    const data = await fetch("/assets/lab/openings.json").then((r) => r.json());
    const due = data.courses.filter((c) => { const r = prog.openings[c.id]; return r && r.learned && r.perfect < 2 && r.last && Date.now() - r.last > 3 * 86400000; });
    if (due.length) steps.push([`/lab/openings/#${due[0].id}`, "fa-bell", `${due.length} opening${due.length > 1 ? "s" : ""} due for review`, `Start with ${due[0].name}.`]);
  } catch (e) { /* openings list unavailable */ }
  const weak = Object.entries(P.byTheme || {}).filter(([t, r]) => r.a >= 4 && THEMES[t]).map(([t, r]) => [t, r.s / r.a]).sort((a, b) => a[1] - b[1])[0];
  if (weak && weak[1] < .6) steps.push([`/lab/tactics/?theme=${weak[0]}`, "fa-crosshairs", `Train your weakest theme: ${THEMES[weak[0]]}`, `${Math.round(weak[1] * 100)}% solved cleanly so far.`]);
  const egDone = Object.values(prog.endgames || {}).reduce((n, r) => n + Object.values(r.stars || {}).filter(Boolean).length, 0);
  if (egDone < 3) steps.push(["/lab/endgames/", "fa-chess-king", "Learn the queen checkmate", "The first lesson in the new Endgame trainer."]);
  if (!(prog.rush && prog.rush.runs)) steps.push(["/lab/rush/", "fa-stopwatch", "Try Puzzle Rush", "How many can you solve in 3 minutes?"]);
  if (!(prog.coords && prog.coords.runs)) steps.push(["/lab/coordinates/", "fa-th", "Learn the board in 30 seconds", "The Coordinates trainer."]);
  steps.push(["/lab/tactics/", "fa-bolt", "Solve rated puzzles", `Your puzzle rating: ${Math.round(P.rating)}.`]);
  box.innerHTML = `<div class="lab-today-head"><div><p class="lab-hero-kicker">Today</p><h2 class="lab-h2">Welcome back, ${esc(firstName(st.user))}</h2></div>
      <div class="lab-today-goal"><div class="lab-ring" style="--p:${pct}"><span>${got}<small>/${goal}</small></span></div><div><b>${got >= goal ? "Daily goal reached!" : "Daily goal"}</b><p>${got >= goal ? "Great work. Anything more is a bonus." : `${goal - got} more points today`} · <i class="fas fa-fire"></i> ${prog.streak.count || 0}-day streak</p></div></div></div>
    <div class="lab-next">${steps.slice(0, 4).map(([href, ic, t, sub]) => `<a class="lab-next-item" href="${href}"><i class="fas ${ic}"></i><span><b>${esc(t)}</b><small>${esc(sub)}</small></span><i class="fas fa-chevron-right lab-next-go"></i></a>`).join("")}</div>`;
  box.classList.remove("hidden");
}

startLabPage({
  publicPage(st, prog) {
    today(st, prog);
    const cta = document.getElementById("lab-hero-cta"), price = document.getElementById("lab-price-line");
    const unlocked = st.user && st.access;
    document.querySelectorAll("[data-lock]").forEach((e) => { e.innerHTML = unlocked ? '<i class="fas fa-unlock"></i> Unlocked' : promoActive() ? '<i class="fas fa-gift"></i> Free now' : '<i class="fas fa-lock"></i> Members'; e.classList.toggle("is-open", !!unlocked || promoActive()); });
    price.innerHTML = (promoActive() ? `<b>Launch offer:</b> every feature is free until ${esc(promoLabel())}, just sign in. ` : "") + `<b>ChessDepth Academy students: free forever</b> with your enrollment number. ` + (CFG.price ? `Membership for everyone else: <b>${esc(CFG.price)}</b>` : "Membership pricing for everyone else will be announced soon.");
    if (st.mode === "closed") {
      cta.innerHTML = `<a class="lab-btn" href="${esc(CFG.notifyUrl)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i>Notify me at launch</a><span class="lab-hero-note">Opening soon</span>`;
    } else if (!st.user) {
      cta.innerHTML = promoActive()
        ? `<button type="button" class="lab-btn" data-act="signin"><i class="fas fa-gift"></i>Sign in free</button><span class="lab-hero-note">Launch offer: everything free until ${esc(promoLabel())}</span>`
        : `<button type="button" class="lab-btn" data-act="signin"><i class="fas fa-sign-in-alt"></i>Sign in to get started</button>`;
    } else if (!st.access) {
      cta.innerHTML = `<a class="lab-btn" href="/lab/tactics/"><i class="fas fa-crown"></i>Join the Chess Lab</a><span class="lab-hero-note">Signed in as ${esc(st.user.email)}</span>`;
    } else {
      const lv = levelFor(prog ? prog.points : 0);
      cta.innerHTML = `<a class="lab-btn" href="/lab/tactics/"><i class="fas fa-bolt"></i>Continue training</a><span class="lab-hero-note">${lv.icon} ${lv.name} · ${prog ? prog.points : 0} points</span>`;
    }
  },
});
