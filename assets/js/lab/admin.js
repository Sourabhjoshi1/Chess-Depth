// ChessDepth Chess Lab - admin page: academy enrollment numbers, and Lab access for students.
import { initLab, onChange, signIn, state, adminListStudents, adminSetAccess, adminListEnrollments, adminAddEnrollments, adminSetEnrollment, adminReleaseEnrollment, normalizeEnrollment, adminListReviews, adminUpdateReview, adminListQuizLinks, adminSetQuizLink } from "./lab-core.js";
import { esc } from "./shell.js";
import { showReport } from "../lichess-report.js";

const box = document.getElementById("admin-app");
async function render() {
  const st = state();
  if (st.mode !== "firebase") { box.innerHTML = `<p class="pd-empty">The admin page works once Firebase is connected (student accounts are live).</p>`; return; }
  if (!st.user) { box.innerHTML = `<button type="button" class="lab-btn" id="admin-signin">Sign in with Google</button>`; document.getElementById("admin-signin").onclick = () => signIn(); return; }
  if (!st.admin) { box.innerHTML = `<p class="pd-empty">Signed in as ${esc(st.user.email)}. This account is not an admin.</p>`; return; }
  box.innerHTML = `<p class="pd-small">Loading…</p>`;
  let rows = [], enr = [], revs = [];
  try { [rows, enr] = await Promise.all([adminListStudents(), adminListEnrollments()]); revs = await adminListReviews().catch(() => null); }
  let qlinks = null; try { qlinks = await adminListQuizLinks(); } catch (e) { qlinks = null; }
  let quizLevels = []; try { quizLevels = JSON.parse(document.getElementById("quiz-list").textContent || "[]"); } catch (e) { quizLevels = []; }
  catch (e) { box.innerHTML = `<p class="pd-empty">Couldn't load data (${esc(e.code || e.message)}). Check that the latest rules from <code>firebase/firestore.rules</code> are published in Firebase.</p>`; return; }
  rows.sort((a, b) => (b.lab === true) - (a.lab === true) || String(a.name).localeCompare(String(b.name)));
  enr.sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
  const linked = enr.filter((x) => x.claimedBy).length;
  const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
  const label = (t) => t === "academy" ? "The academy" : t === "lab" ? "Chess Lab" : t.replace(":", ": ").replace(/-/g, " ");
  if (revs) revs.sort((a, b) => ms(b.created) - ms(a.created));
  const hiddenN = revs ? revs.filter((r) => r.hidden).length : 0;
  const lic = rows.filter((r) => r.lichess && r.lichess.username);
  box.innerHTML = `
  <section class="admin-block">
    <h2 class="pd-h2"><i class="fas fa-clipboard-check"></i> Quiz links</h2>
    ${qlinks === null ? `<p class="pd-empty">Couldn't load quiz links. Publish the latest rules from <code>firebase/firestore.rules</code> (they include the quiz links section).</p>` : `
    <p class="pd-small">Paste each quiz's Google Form link (Send &gt; link). Only academy students with a linked enrollment number can see these links in the Student Area. Leave a box empty to show "Coming soon".</p>
    <table class="admin-table"><thead><tr><th>Quiz</th><th>Google Form link</th><th></th></tr></thead><tbody id="ql-body">
    ${quizLevels.map((lv) => (lv.quizzes || []).map((q) => `<tr data-id="${esc(q.id)}"><td><b>${esc(q.title)}</b><br><small>${esc(lv.level)}</small></td>
      <td><input type="url" class="admin-search" style="margin:0;width:100%" value="${esc(qlinks[q.id] || "")}" placeholder="https://docs.google.com/forms/d/e/.../viewform"></td>
      <td><button type="button" class="lab-btn lab-btn-sm">Save</button> <span class="admin-msg"></span></td></tr>`).join("")).join("")}
    </tbody></table>`}
  </section>
  <section class="admin-block">
    <h2 class="pd-h2"><i class="fas fa-star"></i> Reviews</h2>
    ${revs === null ? `<p class="pd-empty">Couldn't load reviews. Publish the latest rules from <code>firebase/firestore.rules</code> (they include the reviews section).</p>` : `
    <p class="pd-small">Reviews go live as soon as they're posted. Hide only abuse, spam, advertising or personal details, never a review just because it's negative. A public reply is the fair way to answer criticism. ${revs.length} reviews · ${hiddenN} hidden.</p>
    <input type="search" id="rev-q" placeholder="Search name, item or words" class="admin-search">
    <table class="admin-table"><thead><tr><th>Review</th><th>Your public reply</th><th>Shown</th></tr></thead><tbody id="rev-body">
    ${revs.map((r) => `<tr data-id="${esc(r.id)}" data-q="${esc((r.name + " " + r.target + " " + r.text).toLowerCase())}">
      <td style="max-width:28rem"><b>${esc(label(r.target))}</b> · ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}<br><small>${esc(r.name)}${r.verified ? " · Verified student" : ""} · ${ms(r.created) ? new Date(ms(r.created)).toLocaleDateString("en-IN") : ""}</small><p style="white-space:pre-line;margin-top:.3rem">${esc(r.text)}</p></td>
      <td><textarea class="admin-text" rows="3" data-reply placeholder="Optional reply, shown under the review">${esc(r.reply || "")}</textarea><button type="button" class="lab-btn lab-btn-sm" data-save-reply>Save reply</button></td>
      <td><label class="admin-switch"><input type="checkbox" data-shown ${r.hidden ? "" : "checked"}> <span>${r.hidden ? "Hidden" : "Shown"}</span></label> <span class="admin-msg"></span></td></tr>`).join("") || `<tr><td colspan="3"><p class="pd-empty">No reviews yet.</p></td></tr>`}
    </tbody></table>`}
  </section>
  <section class="admin-block">
    <h2 class="pd-h2"><i class="fas fa-chess-knight"></i> Students' Lichess accounts</h2>
    <p class="pd-small">Students link their Lichess username in the Student Area. Open a report to see their strengths and weak spots before a class. ${lic.length} linked.</p>
    ${lic.length ? `<table class="admin-table"><thead><tr><th>Student</th><th>Lichess</th><th>Blitz</th><th>Rapid</th><th>Classical</th><th>Puzzles</th><th></th></tr></thead><tbody id="lic-body">
    ${lic.map((r) => `<tr data-lichess="${esc(r.lichess.username)}"><td><b>${esc(r.name || "(no name)")}</b>${r.enrollment ? `<br><small>${esc(r.enrollment)}</small>` : ""}</td>
      <td><a href="https://lichess.org/@/${encodeURIComponent(r.lichess.username)}" target="_blank" rel="noopener">${esc(r.lichess.username)}</a></td>
      <td data-p="blitz">…</td><td data-p="rapid">…</td><td data-p="classical">…</td><td data-p="puzzle">…</td>
      <td><button type="button" class="lab-btn lab-btn-sm" data-report>Report</button></td></tr>`).join("")}
    </tbody></table>` : `<p class="pd-empty">No students have linked a Lichess account yet.</p>`}
  </section>
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
  document.querySelectorAll("#ql-body tr[data-id]").forEach((tr) => {
    const msg = tr.querySelector(".admin-msg"), input = tr.querySelector("input");
    tr.querySelector("button").onclick = async () => {
      const url = input.value.trim();
      if (url && !/^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/.test(url)) { msg.textContent = "Paste a Google Forms link"; return; }
      msg.textContent = "Saving…";
      try { await adminSetQuizLink(tr.dataset.id, url); msg.textContent = url ? "Saved" : "Removed"; } catch (e) { msg.textContent = "Failed: " + (e.code || e.message); }
    };
  });
  document.querySelectorAll("#rev-body tr[data-id]").forEach((tr) => {
    const msg = tr.querySelector(".admin-msg"), cb = tr.querySelector("[data-shown]");
    cb.onchange = async () => { cb.nextElementSibling.textContent = cb.checked ? "Shown" : "Hidden"; msg.textContent = "Saving…";
      try { await adminUpdateReview(tr.dataset.id, { hidden: !cb.checked }); msg.textContent = "Saved"; } catch (e) { msg.textContent = "Failed: " + (e.code || e.message); } };
    tr.querySelector("[data-save-reply]").onclick = async () => { msg.textContent = "Saving…";
      try { await adminUpdateReview(tr.dataset.id, { reply: tr.querySelector("[data-reply]").value.trim().slice(0, 1500) }); msg.textContent = "Reply saved"; } catch (e) { msg.textContent = "Failed: " + (e.code || e.message); } };
  });
  if (lic.length) {
    // current ratings for everyone in one request (Lichess allows up to 300 names)
    fetch("https://lichess.org/api/users", { method: "POST", body: lic.map((r) => r.lichess.username).join(",") })
      .then((r) => r.json()).then((users) => {
        const by = {}; users.forEach((u) => { by[u.id] = u; });
        document.querySelectorAll("#lic-body tr").forEach((tr) => {
          const u = by[tr.dataset.lichess.toLowerCase()];
          tr.querySelectorAll("[data-p]").forEach((td) => { const p = u && u.perfs && u.perfs[td.dataset.p]; td.textContent = p && p.games ? p.rating + (p.prov ? "?" : "") : "–"; });
        });
      }).catch(() => document.querySelectorAll("#lic-body [data-p]").forEach((td) => { td.textContent = "–"; }));
    document.querySelectorAll("#lic-body [data-report]").forEach((btn) => {
      btn.onclick = () => {
        const name = btn.closest("tr").dataset.lichess, who = btn.closest("tr").querySelector("b").textContent;
        let dlg = document.getElementById("lr-dialog");
        if (!dlg) {
          dlg = document.createElement("dialog"); dlg.id = "lr-dialog"; dlg.className = "lr-dialog";
          dlg.innerHTML = `<div class="lr-dialog-head"><h3></h3><button type="button" class="lr-x" aria-label="Close"><i class="fas fa-times"></i></button></div><div class="lr-dialog-body"></div>`;
          document.body.appendChild(dlg); dlg.querySelector(".lr-x").onclick = () => dlg.close();
          dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
        }
        dlg.querySelector("h3").textContent = `${who} · Lichess: ${name}`;
        dlg.showModal(); showReport(dlg.querySelector(".lr-dialog-body"), name);
      };
    });
  }
  const filter = (inputId, bodyId) => { document.getElementById(inputId).oninput = (e) => { const q = e.target.value.toLowerCase(); document.querySelectorAll(`#${bodyId} tr[data-q]`).forEach((tr) => { tr.style.display = tr.dataset.q.includes(q) ? "" : "none"; }); }; };
  filter("enr-q", "enr-body"); filter("admin-q", "stu-body"); if (revs) filter("rev-q", "rev-body");
}
(async () => { await initLab(); onChange(render); render(); })();
