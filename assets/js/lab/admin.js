// ChessDepth Chess Lab - admin page: academy enrollment numbers, and Lab access for students.
import { initLab, onChange, signIn, state, adminListStudents, adminSetAccess, adminListEnrollments, adminAddEnrollments, adminSetEnrollment, adminReleaseEnrollment, normalizeEnrollment } from "./lab-core.js";
import { esc } from "./shell.js";

const box = document.getElementById("admin-app");
async function render() {
  const st = state();
  if (st.mode !== "firebase") { box.innerHTML = `<p class="pd-empty">The admin page works once Firebase is connected (student accounts are live).</p>`; return; }
  if (!st.user) { box.innerHTML = `<button type="button" class="lab-btn" id="admin-signin">Sign in with Google</button>`; document.getElementById("admin-signin").onclick = () => signIn(); return; }
  if (!st.admin) { box.innerHTML = `<p class="pd-empty">Signed in as ${esc(st.user.email)}. This account is not an admin.</p>`; return; }
  box.innerHTML = `<p class="pd-small">Loading…</p>`;
  let rows = [], enr = [];
  try { [rows, enr] = await Promise.all([adminListStudents(), adminListEnrollments()]); }
  catch (e) { box.innerHTML = `<p class="pd-empty">Couldn't load data (${esc(e.code || e.message)}). Check that the latest rules from <code>firebase/firestore.rules</code> are published in Firebase.</p>`; return; }
  rows.sort((a, b) => (b.lab === true) - (a.lab === true) || String(a.name).localeCompare(String(b.name)));
  enr.sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
  const linked = enr.filter((x) => x.claimedBy).length;
  box.innerHTML = `
  <section class="admin-block">
    <h2 class="pd-h2"><i class="fas fa-graduation-cap"></i> Academy enrollment numbers</h2>
    <p class="pd-small">Students who enter one of these numbers get the Chess Lab free, forever. Each number can be linked to one Google account. ${enr.length} numbers · ${linked} linked.</p>
    <form id="enr-add" class="admin-add">
      <label for="enr-text" class="pd-small"><b>Add numbers</b>: one per line, optionally followed by a comma and the student's name (e.g. <code>CDA-014, Riya Sharma</code>).</label>
      <textarea id="enr-text" rows="4" class="admin-text" placeholder="CDA-014, Riya Sharma&#10;CDA-015, Aarav Mehta"></textarea>
      <button type="submit" class="lab-btn lab-btn-sm">Add numbers</button> <span class="admin-msg" id="enr-msg"></span>
    </form>
    <input type="search" id="enr-q" placeholder="Search number, name or email" class="admin-search">
    <table class="admin-table"><thead><tr><th>Number</th><th>Student</th><th>Linked account</th><th>Active</th><th></th></tr></thead><tbody id="enr-body">
    ${enr.map((x) => `<tr data-no="${esc(x.no)}" data-q="${esc((x.no + " " + (x.name || "") + " " + (x.claimedEmail || "")).toLowerCase())}">
      <td><b>${esc(x.no)}</b></td><td>${esc(x.name || "")}</td>
      <td>${x.claimedBy ? esc(x.claimedEmail || "linked") : '<small class="pd-small">Not linked yet</small>'}</td>
      <td><label class="admin-switch"><input type="checkbox" data-active ${x.active !== false ? "checked" : ""}> <span>${x.active !== false ? "On" : "Off"}</span></label></td>
      <td>${x.claimedBy ? '<button type="button" class="lab-btn-o" data-release>Unlink</button>' : ""} <span class="admin-msg"></span></td></tr>`).join("") || `<tr><td colspan="5"><p class="pd-empty">No numbers yet. Add your students' enrollment numbers above.</p></td></tr>`}
    </tbody></table>
  </section>
  <section class="admin-block">
    <h2 class="pd-h2"><i class="fas fa-users"></i> Students who signed in</h2>
    <p class="pd-small">Turn on a paid membership for someone who isn't an academy student. Optional end date.</p>
    <input type="search" id="admin-q" placeholder="Search name or email" class="admin-search">
    <table class="admin-table"><thead><tr><th>Student</th><th>Enrollment</th><th>Paid access</th><th>Until (optional)</th><th></th></tr></thead><tbody id="stu-body">
    ${rows.map((r) => { const until = r.labUntil && r.labUntil.toDate ? r.labUntil.toDate().toISOString().slice(0, 10) : "";
      return `<tr data-uid="${esc(r.uid)}" data-q="${esc(((r.name || "") + " " + (r.email || "")).toLowerCase())}"><td><b>${esc(r.name || "(no name)")}</b><br><small>${esc(r.email || "")}</small></td>
      <td>${esc(r.enrollment || "")}</td>
      <td><label class="admin-switch"><input type="checkbox" ${r.lab === true ? "checked" : ""}> <span>${r.lab === true ? "On" : "Off"}</span></label></td>
      <td><input type="date" value="${until}"></td><td><button type="button" class="lab-btn lab-btn-sm">Save</button> <span class="admin-msg"></span></td></tr>`; }).join("")}
    </tbody></table>
  </section>`;

  document.getElementById("enr-add").onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById("enr-msg");
    const list = document.getElementById("enr-text").value.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => { const [n, ...rest] = l.split(","); return { no: normalizeEnrollment(n), name: rest.join(",").trim() }; });
    const bad = list.filter((x) => !/^[A-Z0-9][A-Z0-9_.-]{1,39}$/.test(x.no));
    if (!list.length) { msg.textContent = "Type at least one number."; return; }
    if (bad.length) { msg.textContent = "Check these: " + bad.map((x) => x.no || "(empty)").join(", ") + ". Use letters, digits and - only."; return; }
    msg.textContent = "Adding…";
    try { for (let i = 0; i < list.length; i += 400) await adminAddEnrollments(list.slice(i, i + 400)); msg.textContent = `Added ${list.length}.`; render(); }
    catch (err) { msg.textContent = "Failed: " + (err.code || err.message); }
  };
  document.querySelectorAll("#enr-body tr[data-no]").forEach((tr) => {
    const msg = tr.querySelector(".admin-msg"), cb = tr.querySelector("[data-active]");
    cb.onchange = async () => { cb.nextElementSibling.textContent = cb.checked ? "On" : "Off"; msg.textContent = "Saving…";
      try { await adminSetEnrollment(tr.dataset.no, { active: cb.checked }); msg.textContent = "Saved"; } catch (e) { msg.textContent = "Failed"; } };
    const rel = tr.querySelector("[data-release]");
    if (rel) rel.onclick = async () => { msg.textContent = "Unlinking…"; try { await adminReleaseEnrollment(tr.dataset.no); render(); } catch (e) { msg.textContent = "Failed"; } };
  });
  document.querySelectorAll("#stu-body tr").forEach((tr) => {
    const cb = tr.querySelector("input[type=checkbox]"), date = tr.querySelector("input[type=date]"), msg = tr.querySelector(".admin-msg");
    cb.onchange = () => { cb.nextElementSibling.textContent = cb.checked ? "On" : "Off"; };
    tr.querySelector("button").onclick = async () => {
      msg.textContent = "Saving…";
      try { await adminSetAccess(tr.dataset.uid, cb.checked, date.value ? new Date(date.value + "T23:59:59") : null); msg.textContent = "Saved"; }
      catch (e) { msg.textContent = "Failed: " + (e.code || e.message); }
    };
  });
  const filter = (inputId, bodyId) => { document.getElementById(inputId).oninput = (e) => { const q = e.target.value.toLowerCase(); document.querySelectorAll(`#${bodyId} tr[data-q]`).forEach((tr) => { tr.style.display = tr.dataset.q.includes(q) ? "" : "none"; }); }; };
  filter("enr-q", "enr-body"); filter("admin-q", "stu-body");
}
(async () => { await initLab(); onChange(render); render(); })();
