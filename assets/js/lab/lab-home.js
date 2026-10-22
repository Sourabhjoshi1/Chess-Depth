// ChessDepth Chess Lab - public showcase page: show the right call to action for each visitor.
import { startLabPage, esc } from "./shell.js";
import { CFG, levelFor } from "./lab-core.js";

startLabPage({
  publicPage(st, prog) {
    const cta = document.getElementById("lab-hero-cta"), price = document.getElementById("lab-price-line");
    const unlocked = st.user && st.access;
    document.querySelectorAll("[data-lock]").forEach((e) => { e.innerHTML = unlocked ? '<i class="fas fa-unlock"></i> Unlocked' : '<i class="fas fa-lock"></i> Members'; e.classList.toggle("is-open", !!unlocked); });
    price.innerHTML = CFG.price ? `Membership: <b>${esc(CFG.price)}</b>` : "Pricing will be announced at launch.";
    if (st.mode === "closed") {
      cta.innerHTML = `<a class="lab-btn" href="${esc(CFG.notifyUrl)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i>Notify me at launch</a><span class="lab-hero-note">Opening soon</span>`;
    } else if (!st.user) {
      cta.innerHTML = `<button type="button" class="lab-btn" data-act="signin"><i class="fas fa-sign-in-alt"></i>Sign in to get started</button>`;
    } else if (!st.access) {
      cta.innerHTML = `<a class="lab-btn" href="/lab/tactics/"><i class="fas fa-crown"></i>Join the Chess Lab</a><span class="lab-hero-note">Signed in as ${esc(st.user.email)}</span>`;
    } else {
      const lv = levelFor(prog ? prog.points : 0);
      cta.innerHTML = `<a class="lab-btn" href="/lab/tactics/"><i class="fas fa-bolt"></i>Continue training</a><span class="lab-hero-note">${lv.icon} ${lv.name} · ${prog ? prog.points : 0} points</span>`;
    }
  },
});
