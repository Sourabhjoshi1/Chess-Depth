// ChessDepth Academy - Student Area (Google sign-in + PDF downloads from Firebase Storage)
import { firebaseConfig, courseNames } from "./firebase-config.js";
import { lookupUser, showReport } from "./lichess-report.js";
import { DRILLS, LEVELS, MEDAL_NAMES, medals, rankOf, planDay, dayStreak } from "./blindfold-meta.js";

const $ = (id) => document.getElementById(id);
const STATES = ["state-loading", "state-setup", "state-signed-out", "state-signed-in"];
function show(state) {
  STATES.forEach((s) => $(s).classList.toggle("hidden", s !== state));
  // Signed-in students get a slim banner so their dashboard starts near the top of the screen.
  const hero = document.querySelector(".cd-hero"); if (hero) hero.classList.toggle("st-hero-min", state === "state-signed-in");
}
const ov = (id, html) => { const e = $(id); if (e) e.innerHTML = html; };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// ---------- Tabs: one section on screen at a time; the address keeps the open tab (/student/#quizzes) ----------
const TABS = ["overview", "material", "quizzes", "blindfold", "lichess"];
function openTab(name, push) {
  if (!TABS.includes(name)) name = "overview";
  document.querySelectorAll(".st-tabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  document.querySelectorAll(".st-panel").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== name));
  if (push) history.replaceState(null, "", name === "overview" ? location.pathname : "#" + name);
  const cur = document.querySelector(`.st-tabs [data-tab="${name}"]`); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "center" });
}
document.querySelectorAll(".st-tabs [data-tab]").forEach((b) => b.addEventListener("click", () => openTab(b.dataset.tab, true)));
document.querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); openTab(a.dataset.go, true); window.scrollTo({ top: Math.max(0, document.querySelector(".st-tabs").getBoundingClientRect().top + window.scrollY - 90), behavior: "smooth" }); }));
window.addEventListener("hashchange", () => openTab(location.hash.slice(1), false));
openTab(location.hash.slice(1), false);

function prettyName(text) {
  const t = text.replace(/\.pdf$/i, "").replace(/_+/g, " ").replace(/(\w)-(?=\w)/g, "$1 ").replace(/\s+/g, " ").trim();
  // Keep the file's own capitals if it has any; otherwise capitalise each word.
  return /[A-Z]/.test(t) ? t : t.replace(/\b\w/g, (c) => c.toUpperCase());
}
function courseTitle(folder) { return courseNames[folder] || prettyName(folder); }
function sizeLabel(bytes) {
  if (!bytes) return "";
  return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("PASTE")) {
  show("state-setup");
} else {
  start().catch((err) => { console.error(err); show("state-setup"); });
}

const acct = (u) => { try { if (window.cdAccount) window.cdAccount.set(u); } catch (e) { /* header only */ } };
async function start() {
  const V = "10.12.2";
  const [{ initializeApp }, authMod, storageMod, fsMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-storage.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } = authMod;
  const { getStorage, ref, listAll, getMetadata, getDownloadURL } = storageMod;
  const { getFirestore, doc, getDoc, setDoc, updateDoc, getDocs, collection, serverTimestamp } = fsMod;

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const storage = getStorage(app);
  storage.maxOperationRetryTime = 8000;   // if the files can't be listed, say so after 8 seconds (the default keeps trying for 2 minutes)
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  getRedirectResult(auth).catch((e) => showSignInError(e));

  $("btn-google").addEventListener("click", async () => {
    $("signin-error").classList.add("hidden");
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, provider);
      } else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
        showSignInError(e);
      }
    }
  });
  $("btn-signout").addEventListener("click", () => signOut(auth));

  onAuthStateChanged(auth, async (user) => {
    acct(user);
    if (!user) { show("state-signed-out"); return; }
    $("user-name").textContent = (user.displayName || "Student").split(" ")[0];
    $("user-email").textContent = user.email || "";
    $("user-initial").textContent = ((user.displayName || user.email || "S")[0] || "S").toUpperCase();
    if (user.photoURL) { const ph = $("user-photo"); ph.onload = () => { ph.classList.remove("hidden"); $("user-initial").classList.add("hidden"); }; ph.src = user.photoURL; }
    show("state-signed-in");
    const saved = await recordStudent(user);
    if (saved && saved.enrollment) { $("user-badge").innerHTML = `<i class="fas fa-graduation-cap"></i> Academy student · ${String(saved.enrollment).replace(/[^\w.-]/g, "")}`; $("user-badge").classList.add("is-academy"); }
    labSummary(user);
    setupLichess(user, saved && saved.lichess ? saved.lichess.username : "");
    setupQuizzes(user);
    setupBlindfold(saved && saved.blindfold);
    loadMaterials();
  });

  // Chess Lab points and streak for the Overview card (members only; silently skipped otherwise).
  async function labSummary(user) {
    try {
      const snap = await getDoc(doc(db, "labProgress", user.uid)); if (!snap.exists()) return;
      const p = snap.data(), d = new Date(), key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const today = (p.days || {})[key] || 0, goal = p.goal || 50, streak = (p.streak && p.streak.count) || 0;
      ov("ov-lab", `<b class="st-num">${(p.points || 0).toLocaleString("en-US")}</b> points · <i class="fas fa-fire st-fire"></i> ${plural(streak, "day")} streak · ${today >= goal ? "daily goal reached" : `${goal - today} points to today's goal`}`);
    } catch (e) { /* not a Lab member yet */ }
  }

  // Keeps a list of students who signed in (Firestore -> "students" collection).
  async function recordStudent(user) {
    try {
      const refDoc = doc(db, "students", user.uid);
      const snap = await getDoc(refDoc);
      const data = { name: user.displayName || "", email: user.email || "", photoURL: user.photoURL || "", lastLogin: serverTimestamp() };
      if (!snap.exists()) data.firstLogin = serverTimestamp();
      await setDoc(refDoc, data, { merge: true });
      return snap.exists() ? snap.data() : {};
    } catch (e) { console.warn("Could not record student sign-in:", e.code || e); return {}; }
  }

  // ---------- Quizzes (academy students only) ----------
  // The Google Form links live in Firestore (quizLinks/{id}); the security rules only let academy
  // students (with a linked enrollment number) and admins read them.
  async function setupQuizzes(user) {
    const cards = document.querySelectorAll("[data-quiz]");
    if (!cards.length) return;
    let links = null;
    try {
      const snap = await getDocs(collection(db, "quizLinks"));
      links = {}; snap.forEach((d) => { if (d.data().url) links[d.id] = d.data().url; });
    } catch (e) { links = null; }
    const gate = $("qz-gate");
    if (links === null) {
      gate.classList.remove("hidden");
      cards.forEach((c) => { c.querySelector("[data-quiz-status]").innerHTML = '<i class="fas fa-lock"></i> Academy students only'; });
      ov("ov-quiz", `<i class="fas fa-lock"></i> For academy students. Enter your enrollment number to unlock ${cards.length} quizzes.`);
      setupEnroll(user);
      return;
    }
    gate.classList.add("hidden");
    cards.forEach((c) => {
      const url = links[c.dataset.quiz], st = c.querySelector("[data-quiz-status]");
      if (url && /^https:\/\/(docs\.google\.com|forms\.gle)\//.test(url)) {
        c.classList.remove("qz-off");
        const a = document.createElement("a"); a.className = "qz-btn"; a.href = url; a.target = "_blank"; a.rel = "noopener";
        a.innerHTML = '<i class="fas fa-play"></i> Start quiz'; st.replaceWith(a);
      } else { st.innerHTML = '<i class="far fa-clock"></i> Coming soon'; }
    });
    document.querySelectorAll(".qz-tab").forEach((t) => {
      const n = document.querySelectorAll(`.qz-panel[data-panel="${t.dataset.level}"] .qz-btn`).length, c = t.querySelector(".qz-count");
      c.textContent = n; c.classList.remove("hidden");
    });
    const ready = document.querySelectorAll(".qz-panel .qz-btn").length;
    ov("ov-quiz", ready ? `<b class="st-num">${ready}</b> ${ready === 1 ? "quiz" : "quizzes"} ready to take, at four levels.` : "New quizzes are coming soon.");
    // Open on the first level that has a quiz ready.
    const firstReady = [...document.querySelectorAll(".qz-tab")].find((t) => document.querySelector(`.qz-panel[data-panel="${t.dataset.level}"] .qz-btn`));
    if (firstReady && firstReady.getAttribute("aria-selected") !== "true") firstReady.click();
  }
  function setupEnroll(user) {
    const form = $("qz-enroll"), msg = $("qz-msg");
    if (form.dataset.ready) return; form.dataset.ready = "1";
    form.onsubmit = async (e) => {
      e.preventDefault();
      const no = String($("qz-no").value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/\//g, "-");
      if (!/^[A-Z0-9][A-Z0-9_.-]{1,39}$/.test(no)) { msg.textContent = "Please enter your enrollment number exactly as the academy gave it to you."; return; }
      const btn = form.querySelector("button"); btn.disabled = true; msg.textContent = "";
      try {
        await updateDoc(doc(db, "enrollments", no), { claimedBy: user.uid, claimedEmail: user.email || "", claimedAt: serverTimestamp() });
        await setDoc(doc(db, "students", user.uid), { enrollment: no }, { merge: true });
        if (typeof window.gtag === "function") window.gtag("event", "quiz_enrollment_linked", {});
        msg.textContent = "";
        await setupQuizzes(user);
        if (!$("qz-gate").classList.contains("hidden")) msg.textContent = "Linked! If the quizzes don't open, please refresh the page.";
      } catch (err) {
        msg.textContent = "We couldn't find that enrollment number, or it's already linked to another account. Check it, or WhatsApp us on +91 98230 29262.";
      } finally { btn.disabled = false; }
    };
  }

  // ---------- My Lichess ----------
  function setupLichess(user, linked) {
    const form = $("lr-form"), input = $("lr-input"), msg = $("lr-msg"), body = $("lr-body"), actions = $("lr-actions"), cancel = $("lr-cancel");
    const saveLink = (username) => setDoc(doc(db, "students", user.uid), { lichess: username ? { username, linkedAt: serverTimestamp() } : null }, { merge: true });
    function showForm(editing) {
      form.classList.remove("hidden"); cancel.classList.toggle("hidden", !editing); actions.innerHTML = "";
      if (!editing) body.innerHTML = ""; msg.textContent = ""; input.value = editing ? linked : ""; if (editing) input.focus();
    }
    function showLinked(fresh) {
      form.classList.add("hidden");
      actions.innerHTML = `<button type="button" class="lr-link" data-refresh><i class="fas fa-sync-alt"></i> Refresh</button><button type="button" class="lr-link" data-change>Change</button><button type="button" class="lr-link lr-danger" data-unlink>Unlink</button>`;
      $("lr-sub").innerHTML = `Linked to <a href="https://lichess.org/@/${encodeURIComponent(linked)}" target="_blank" rel="noopener"><b>${linked.replace(/[^\w-]/g, "")}</b></a>. Strengths and weaknesses come from your latest rated games.`;
      actions.querySelector("[data-refresh]").onclick = () => showReport(body, linked, { fresh: true });
      actions.querySelector("[data-change]").onclick = () => showForm(true);
      const un = actions.querySelector("[data-unlink]");
      un.onclick = async () => {
        if (un.dataset.sure !== "1") { un.dataset.sure = "1"; un.textContent = "Tap again to unlink"; return; }
        try { await saveLink(null); linked = ""; ov("ov-li", "Link your account to see your strengths and what to work on."); $("lr-sub").textContent = "Link your Lichess account to see your ratings, strengths and what to work on, updated from your latest games."; showForm(false); }
        catch (e) { un.textContent = "Couldn't unlink. Try again"; un.dataset.sure = ""; }
      };
      ov("ov-li", `Linked to <b>${linked.replace(/[^\w-]/g, "")}</b>. See your ratings, strengths and what to work on.`);
      showReport(body, linked, { fresh });
    }
    form.onsubmit = async (e) => {
      e.preventDefault(); msg.textContent = "Checking Lichess…";
      const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
      try {
        const u = await lookupUser(input.value);
        await saveLink(u.username);
        linked = u.username; msg.textContent = "";
        if (typeof window.gtag === "function") window.gtag("event", "lichess_linked", {});
        showLinked(true);
      } catch (err) {
        msg.textContent = err.code ? err.message : (err.message && /lichess/i.test(err.message) ? err.message : "Couldn't link the account. Please try again.");
      } finally { btn.disabled = false; }
    };
    cancel.onclick = () => showLinked(false);
    if (linked) showLinked(false); else showForm(false);
  }

  async function loadMaterials() {
    const box = $("materials");
    box.innerHTML = "";
    $("materials-empty").classList.add("hidden");
    $("materials-error").classList.add("hidden");
    for (let k = 0; k < 3; k++) box.appendChild(el("div", "st-skel st-skel-row"));
    try {
      const root = await listAll(ref(storage, "materials"));
      const order = Object.keys(courseNames);
      const folders = root.prefixes.slice().sort((a, b) => {
        const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.name.localeCompare(b.name);
      });
      const loose = root.items.filter((i) => /\.pdf$/i.test(i.name));
      const groups = await Promise.all(folders.map(async (f) => ({ title: courseTitle(f.name), items: (await listAll(f)).items.filter((i) => /\.pdf$/i.test(i.name)) })));
      if (loose.length) groups.push({ title: "General Material", items: loose });
      box.innerHTML = "";
      const nonEmpty = groups.filter((g) => g.items.length);
      if (!nonEmpty.length) { $("materials-empty").classList.remove("hidden"); ov("ov-material", "No material has been uploaded yet. Check back soon."); return; }
      nonEmpty.forEach((g, k) => box.appendChild(renderGroup(g, k === 0 || nonEmpty.length <= 2)));
      const files = nonEmpty.reduce((n, g) => n + g.items.length, 0);
      ov("ov-material", `<b class="st-num">${files}</b> ${files === 1 ? "PDF" : "PDFs"} in ${plural(nonEmpty.length, "course")}, free to download.`);
    } catch (e) {
      box.innerHTML = "";
      // Storage not set up yet (or no files): show a friendly note instead of an error
      $("materials-error").innerHTML = 'Your course PDFs are being uploaded and will appear here soon. Meanwhile, train in the <a href="/lab/" class="underline font-semibold">Chess Lab</a> (free for students right now) or download the free <a href="/shop/tactics-starter/" class="underline font-semibold">Tactics Starter Pack</a>.';
      $("materials-error").classList.remove("hidden");
      ov("ov-material", "Your course PDFs are being uploaded and will appear here soon.");
      console.error(e);
    }
  }

  function renderGroup(group, open) {
    const card = el("details", "st-course cd-course"); card.open = !!open;
    const head = el("summary", "st-course-head");
    head.appendChild(el("h3", "st-course-title", group.title));
    head.appendChild(el("span", "st-course-count", group.items.length + (group.items.length === 1 ? " file" : " files")));
    head.appendChild(el("i", "fas fa-chevron-down st-course-chev"));
    card.appendChild(head);
    const list = el("ul", "st-files");
    group.items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).forEach((item) => {
      const li = el("li", "st-file cd-file");
      li.dataset.search = (group.title + " " + item.name).toLowerCase();
      const left = el("div", "flex items-center gap-3 min-w-0");
      left.appendChild(el("i", "fas fa-file-pdf text-2xl text-red-500 flex-shrink-0"));
      const txt = el("div", "min-w-0");
      txt.appendChild(el("p", "font-medium text-gray-800 truncate", prettyName(item.name)));
      const meta = el("p", "text-xs text-gray-500", "PDF");
      txt.appendChild(meta);
      left.appendChild(txt);
      li.appendChild(left);
      const btn = el("button", "st-dl");
      btn.type = "button";
      btn.innerHTML = '<i class="fas fa-download mr-1"></i>Download';
      btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "Opening…";
        const win = window.open("", "_blank");
        try {
          const url = await getDownloadURL(item);
          if (win) win.location.href = url; else window.location.href = url;
        } catch (e) {
          if (win) win.close();
          alertInline(li, "Download failed. Please try again.");
        } finally {
          btn.disabled = false; btn.innerHTML = '<i class="fas fa-check mr-1"></i>Opened';
          setTimeout(() => { btn.innerHTML = '<i class="fas fa-download mr-1"></i>Download'; }, 2500);
        }
      });
      li.appendChild(btn);
      list.appendChild(li);
      getMetadata(item).then((m) => { meta.textContent = "PDF · " + sizeLabel(m.size); }).catch(() => {});
    });
    card.appendChild(list);
    return card;
  }

  function alertInline(li, text) {
    const p = el("p", "text-xs text-red-600 mt-1", text);
    li.querySelector(".min-w-0 .min-w-0").appendChild(p);
    setTimeout(() => p.remove(), 6000);
  }

  function showSignInError(e) {
    if (!e) return;
    const msg = e.code === "auth/unauthorized-domain"
      ? "Sign-in isn't enabled for this web address yet. Please contact us on WhatsApp."
      : "Sign-in didn't work. Please try again.";
    $("signin-error").textContent = msg;
    $("signin-error").classList.remove("hidden");
    console.error(e);
  }

  // Search box
  $("search").addEventListener("input", (ev) => {
    const q = ev.target.value.trim().toLowerCase(); let total = 0;
    document.querySelectorAll(".cd-course").forEach((card) => {
      let any = false; if (q) card.open = true;
      card.querySelectorAll(".cd-file").forEach((li) => {
        const hit = !q || li.dataset.search.includes(q);
        li.classList.toggle("hidden", !hit); if (hit) { any = true; total++; }
      });
      card.classList.toggle("hidden", !any);
    });
    $("materials-none").classList.toggle("hidden", !q || total > 0);
  });
}

// ---------- Blindfold Training (saved by /blindfold/ to students/{uid}.blindfold) ----------
function setupBlindfold(remote) {
  const box = document.getElementById("blindfold"); if (!box) return;
  remote = remote || {};
  const local = (k) => { try { const v = localStorage.getItem("cd-bf-" + k); return v === null ? null : JSON.parse(v); } catch (e) { return null; } };
  const num = (k) => Math.max(Number(local(k)) || 0, typeof remote[k] === "number" ? remote[k] : 0);
  const days = [...new Set([...(local("days") || []), ...(remote.days || [])])], daily = [...new Set([...(local("daily-days") || []), ...(remote["daily-days"] || [])])];
  const m = medals(num), r = rankOf(m.total), plan = planDay(Math.max(num("plan-day"), 1));
  let rounds = 0; DRILLS.forEach((d) => { rounds += num("rounds-" + d.id); });
  const streak = dayStreak(days), dstreak = dayStreak(daily);
  document.getElementById("bfs-stats").innerHTML = [
    ["fa-crown", r.title, "Rank"], ["fa-medal", `${m.total}/${DRILLS.length * 3}`, "Medals"], ["fa-route", `Day ${plan.day}/28`, "Mastery plan"],
    ["fa-fire", streak, streak === 1 ? "Day in a row" : "Days in a row"], ["fa-calendar-check", dstreak, "Daily challenge streak"],
  ].map(([i, v, l]) => `<div><i class="fas ${i}"></i><b>${v}</b><span>${l}</span></div>`).join("");
  const last = Math.max(Number(local("last")) || 0, remote.last || 0), ago = last ? Math.floor((Date.now() - last) / 86400000) : null;
  document.getElementById("bfs-summary").innerHTML = rounds
    ? `<i class="fas fa-fire"></i> <b>${rounds}</b> round${rounds > 1 ? "s" : ""} played` + (ago === null ? "" : ago === 0 ? " · last trained today" : ago === 1 ? " · last trained yesterday" : ` · last trained ${ago} days ago`) + (r.next ? `. ${r.nextAt - m.total} more medal${r.nextAt - m.total > 1 ? "s" : ""} to reach <b>${r.next}</b>.` : ".")
    : `<i class="fas fa-lightbulb"></i> New! Start the <b>28-day plan</b>: three short drills a day.`;
  ov("ov-bf", rounds ? `Rank <b>${r.title}</b> · <b class="st-num">${m.total}</b>/${DRILLS.length * 3} medals · plan day ${plan.day} of 28` : "Ten drills and a 28-day plan. Start with three short drills today.");
  document.getElementById("bfs-grid").innerHTML = DRILLS.map((d) => {
    const v = LEVELS.map((l) => num(`${d.id}-${l}`)), n = num("rounds-" + d.id);
    return `<a class="bfs-item" href="/blindfold/#${d.id}">
      <span class="bfs-top"><i class="fas ${d.icon}"></i><b>${d.name}</b></span>
      <span class="bfs-metric">${d.metric} · medal at ${d.medal}+</span>
      <span class="bfs-levels">${LEVELS.map((l, k) => `<span class="${m.byDrill[d.id][k] ? "has-medal bfs-m" + k : ""}" title="${MEDAL_NAMES[k]} medal at ${d.medal}+"><em>${l[0].toUpperCase() + l.slice(1)}</em><strong class="${v[k] ? "" : "is-zero"}">${v[k]}</strong></span>`).join("")}</span>
      <span class="bfs-rounds${n ? "" : " is-zero"}">${n ? `${n} round${n > 1 ? "s" : ""} played` : "Not tried yet"}</span></a>`;
  }).join("");
}
