// ChessDepth Chess Lab - page shell: access screens (gate), Lab bar (points/level), toasts.
import { CFG, initLab, onChange, signIn, signOut, unlockDemo, exitDemo, loadProgress, levelFor, track } from "./lab-core.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function gateHTML(st, toolName) {
  const tool = esc(toolName || "the Chess Lab");
  const features = `<ul class="lab-gate-list">
      <li><i class="fas fa-bolt"></i>Tactics trainer with thousands of rated puzzles</li>
      <li><i class="fas fa-book-open"></i>Opening courses you learn move by move</li>
      <li><i class="fas fa-chart-line"></i>Progress dashboard, points, levels and streaks</li>
      <li><i class="fas fa-trophy"></i>Weekly leaderboard</li></ul>`;
  if (st.mode === "closed") {
    return `<div class="lab-gate-card"><p class="lab-gate-kicker">Opening soon</p><h2>The Chess Lab is almost ready</h2>
      <p>Student accounts open shortly. Leave your number on WhatsApp and we'll tell you the day it launches.</p>${features}
      <a class="lab-btn" href="${esc(CFG.notifyUrl)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i>Notify me at launch</a></div>`;
  }
  if (!st.user) {
    return `<div class="lab-gate-card"><p class="lab-gate-kicker"><i class="fas fa-lock"></i> Members only</p><h2>Sign in to open ${tool}</h2>
      <p>The Chess Lab is part of your ChessDepth student account. Sign in with Google to continue.</p>
      <button type="button" class="lab-btn lab-google" data-act="signin">${googleIcon()}${st.mode === "demo" ? "Sign in (demo)" : "Sign in with Google"}</button>
      <p class="lab-gate-small" data-msg></p></div>`;
  }
  const price = CFG.price ? `<p class="lab-price">${esc(CFG.price)}</p>` : `<p class="lab-price lab-price-soon">Pricing announced at launch</p>`;
  const pay = st.mode === "demo"
    ? `<button type="button" class="lab-btn" data-act="unlock"><i class="fas fa-unlock"></i>Unlock (demo, no payment)</button>`
    : CFG.paymentLink
      ? `<a class="lab-btn" data-act="pay" href="${esc(CFG.paymentLink)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-crown"></i>Join the Chess Lab</a>`
      : `<a class="lab-btn" data-act="pay" href="${esc(CFG.joinUrl)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i>Ask to join on WhatsApp</a>`;
  return `<div class="lab-gate-card lab-gate-upgrade"><p class="lab-gate-kicker"><i class="fas fa-crown"></i> Chess Lab membership</p>
    <h2>Unlock ${tool}</h2><p>Hi ${esc((st.user.name || "there").split(" ")[0])}! The Chess Lab is a paid membership. It includes:</p>${features}${price}${pay}
    <p class="lab-gate-small">${st.mode === "demo" ? "This is a demo: nothing is charged." : "After you pay, your access is switched on, usually within a few hours. Signed in as " + esc(st.user.email) + "."}</p>
    <button type="button" class="lab-link" data-act="signout">Use a different account</button></div>`;
}
function googleIcon() {
  return `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
}

function renderBar(st, prog) {
  const bar = $("#lab-bar-status"); if (!bar) return;
  if (st.mode === "demo") $("#lab-demo-banner")?.classList.remove("hidden");
  if (!st.user) { bar.innerHTML = ""; return; }
  if (!st.access || !prog) { bar.innerHTML = `<span class="lab-chip">${esc((st.user.name || "").split(" ")[0])}</span>`; return; }
  const lv = levelFor(prog.points);
  bar.innerHTML = `<span class="lab-chip" title="Your level"><span class="lab-lv">${lv.icon}</span>${lv.name}</span>
    <span class="lab-chip lab-chip-pts" title="Total points"><i class="fas fa-star"></i><b data-points>${prog.points}</b></span>
    <span class="lab-chip" title="Day streak"><i class="fas fa-fire"></i>${prog.streak.count || 0}</span>`;
}

export function toast(html, kind) {
  let t = $("#lab-toast"); if (!t) { t = document.createElement("div"); t.id = "lab-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
  t.className = "lab-toast " + (kind || ""); t.innerHTML = html; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

// Start a Lab page. `ready(state, progress)` runs once the visitor has access.
export async function startLabPage({ toolName, ready, publicPage }) {
  const gate = $("#lab-gate"), app = $("#lab-app");
  let st = await initLab(), started = false;
  async function render() {
    let prog = null;
    if (st.user && st.access) { try { prog = await loadProgress(); } catch (e) { console.error(e); } }
    renderBar(st, prog);
    if (publicPage) { publicPage(st, prog); return; }
    if (st.user && st.access && prog) {
      gate.innerHTML = ""; gate.classList.add("hidden"); app.classList.remove("hidden");
      if (!started) { started = true; ready(st, prog); }
    } else {
      app.classList.add("hidden"); gate.classList.remove("hidden");
      gate.innerHTML = gateHTML(st, toolName);
    }
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    if (act === "signin") { e.preventDefault(); track("lab_signin_click", { page_path: location.pathname }); try { await signIn(); } catch (err) { const m = $("[data-msg]"); if (m) m.textContent = "Sign-in didn't work. Please try again."; } }
    if (act === "signout") { e.preventDefault(); await signOut(); }
    if (act === "unlock") { e.preventDefault(); unlockDemo(); }
    if (act === "pay") track("lab_upgrade_click", { page_path: location.pathname, method: CFG.paymentLink ? "payment_link" : "whatsapp" });
    if (act === "exit-demo") { e.preventDefault(); exitDemo(); }
  });
  document.addEventListener("cdlab:points", (e) => {
    const p = e.detail.progress; renderBar(st, p);
    if (e.detail.levelUp) toast(`<b>${e.detail.levelUp.icon} Level up!</b> You're now a ${e.detail.levelUp.name}.`, "lab-toast-level");
  });
  const uidOf = (x) => (x.user ? x.user.uid : null) + ":" + x.access;
  let lastKey = uidOf(st);
  onChange(async (s) => {
    const k = uidOf(s);
    if (started && k !== lastKey) { location.reload(); return; }   // a different account: start fresh
    lastKey = k; st = s; await render();
  });
  await render();
}
export { esc };
