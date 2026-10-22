// ChessDepth Chess Lab - admin page: switch Lab access on or off for students.
import { initLab, onChange, signIn, state, adminListStudents, adminSetAccess } from "./lab-core.js";
import { esc } from "./shell.js";

const box = document.getElementById("admin-app");
async function render() {
  const st = state();
  if (st.mode !== "firebase") { box.innerHTML = `<p class="pd-empty">The admin page works once Firebase is connected (student accounts are live).</p>`; return; }
  if (!st.user) { box.innerHTML = `<button type="button" class="lab-btn" id="admin-signin">Sign in with Google</button>`; document.getElementById("admin-signin").onclick = () => signIn(); return; }
  if (!st.admin) { box.innerHTML = `<p class="pd-empty">Signed in as ${esc(st.user.email)}. This account is not an admin.</p>`; return; }
  box.innerHTML = `<p class="pd-small">Loading students…</p>`;
  let rows = [];
  try { rows = await adminListStudents(); } catch (e) { box.innerHTML = `<p class="pd-empty">Couldn't load students (${esc(e.code || e.message)}). Check that the Firestore rules from <code>firebase/firestore.rules</code> are published.</p>`; return; }
  rows.sort((a, b) => (b.lab === true) - (a.lab === true) || String(a.name).localeCompare(String(b.name)));
  box.innerHTML = `<input type="search" id="admin-q" placeholder="Search name or email" class="admin-search">
    <table class="admin-table"><thead><tr><th>Student</th><th>Lab access</th><th>Until (optional)</th><th></th></tr></thead><tbody>
    ${rows.map((r) => { const until = r.labUntil && r.labUntil.toDate ? r.labUntil.toDate().toISOString().slice(0, 10) : "";
      return `<tr data-uid="${esc(r.uid)}" data-q="${esc((r.name + " " + r.email).toLowerCase())}"><td><b>${esc(r.name || "(no name)")}</b><br><small>${esc(r.email || "")}</small></td>
      <td><label class="admin-switch"><input type="checkbox" ${r.lab === true ? "checked" : ""}> <span>${r.lab === true ? "On" : "Off"}</span></label></td>
      <td><input type="date" value="${until}"></td><td><button type="button" class="lab-btn lab-btn-sm">Save</button> <span class="admin-msg"></span></td></tr>`; }).join("")}
    </tbody></table>`;
  box.querySelectorAll("tbody tr").forEach((tr) => {
    const cb = tr.querySelector("input[type=checkbox]"), date = tr.querySelector("input[type=date]"), msg = tr.querySelector(".admin-msg");
    cb.onchange = () => { cb.nextElementSibling.textContent = cb.checked ? "On" : "Off"; };
    tr.querySelector("button").onclick = async () => {
      msg.textContent = "Saving…";
      try { await adminSetAccess(tr.dataset.uid, cb.checked, date.value ? new Date(date.value + "T23:59:59") : null); msg.textContent = "Saved"; }
      catch (e) { msg.textContent = "Failed: " + (e.code || e.message); }
    };
  });
  document.getElementById("admin-q").oninput = (e) => { const q = e.target.value.toLowerCase(); box.querySelectorAll("tbody tr").forEach((tr) => { tr.style.display = tr.dataset.q.includes(q) ? "" : "none"; }); };
}
(async () => { await initLab(); onChange(render); render(); })();
