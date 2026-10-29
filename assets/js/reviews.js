// ChessDepth Academy - live reviews for coaches, courses, the Chess Lab, free PDFs and the academy.
//
// Anyone signed in with Google can leave one review per item (and edit or delete it later).
// Reviews appear for everyone straight away. Reviews by academy students who have linked their
// enrollment number in the Chess Lab show a "Verified student" badge. ChessDepth can reply
// publicly, and can hide only reviews that break the guidelines (from /lab/admin/).
//
// Markup (see _includes/reviews.html):
//   <div data-rv="coach:daniel-gormally" data-rv-title="GM Daniel Gormally"></div>   full widget
//   <div data-rv-summary="course:endgame-mastery" data-rv-title="..."></div>          stars + count, opens the widget in a pop-up
//   <div data-rv-latest="academy" data-rv-count="3"></div>                             newest reviews (home page)
import { firebaseConfig } from "./firebase-config.js";

const V = "10.12.2";
const VER = new URL(import.meta.url).search;
const CFG = window.CD_RV || {};
const ROLES = { student: "Student", parent: "Parent", other: "Chess player" };
const MIN = 10, MAX = 1500;

let fb = null, user = null, verified = false, failed = false, loaded = false;
let all = [];          // public reviews (live)
let own = {};          // this user's reviews by target, including hidden ones
const widgets = new Map();   // element -> { target, title, sort, shown, open }
let started = null;

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stars = (r, cls = "") => `<span class="rv-stars ${cls}" role="img" aria-label="${r ? (Math.round(r * 10) / 10) + " out of 5 stars" : "No rating yet"}">${[1, 2, 3, 4, 5].map((i) => `<i class="${r >= i - 0.25 ? "fas fa-star" : r >= i - 0.75 ? "fas fa-star-half-alt" : "far fa-star"}"></i>`).join("")}</span>`;
const ms = (t) => (t && t.toMillis ? t.toMillis() : t && t.seconds ? t.seconds * 1000 : Date.now());
const when = (t) => new Date(ms(t)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
function shortName(full) { const p = String(full || "").trim().split(/\s+/).filter(Boolean); if (!p.length) return ""; return p.length > 1 ? `${p[0]} ${p[p.length - 1][0].toUpperCase()}.` : p[0]; }
function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) { /* ignore */ } }

function forTarget(target) {
  const list = all.filter((r) => r.target === target);
  const mine = own[target];
  // Show the user's own review even if it's hidden or not yet in the live list.
  if (mine && !list.some((r) => r.id === mine.id)) list.push(mine);
  else if (mine) { const i = list.findIndex((r) => r.id === mine.id); list[i] = { ...list[i], ...mine }; }
  return list;
}
function statsFor(target) {
  const pub = all.filter((r) => r.target === target);
  const n = pub.length, avg = n ? pub.reduce((s, r) => s + r.rating, 0) / n : 0;
  const dist = [5, 4, 3, 2, 1].map((s) => pub.filter((r) => r.rating === s).length);
  return { n, avg, dist };
}

const acct = (u) => { try { if (window.cdAccount) window.cdAccount.set(u); } catch (e) { /* header only */ } };
// ---------- Firebase ----------
function loadCss() {
  return new Promise((res) => {
    if (document.getElementById("cd-rv-css")) return res();
    const l = document.createElement("link"); l.id = "cd-rv-css"; l.rel = "stylesheet"; l.href = "/assets/css/reviews.css" + VER;
    l.onload = res; l.onerror = res; document.head.appendChild(l);
  });
}
async function start() {
  if (started) return started;
  started = (async () => {
    await loadCss();
    renderAll();
    const configured = firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("PASTE");
    if (!configured) { failed = true; loaded = true; renderAll(); return; }
    try {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
        import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
      ]);
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
      fb = { ...authMod, ...fsMod, auth: authMod.getAuth(app), db: fsMod.getFirestore(app) };
    } catch (e) { console.warn("Reviews could not load:", e); failed = true; loaded = true; renderAll(); return; }
    fb.getRedirectResult(fb.auth).catch(() => {});
    fb.onSnapshot(fb.query(fb.collection(fb.db, "reviews"), fb.where("hidden", "==", false), fb.limit(2000)), (snap) => {
      const rows = []; snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      all = rows; loaded = true; failed = false; renderAll(false);
    }, (e) => { console.warn("Reviews unavailable:", e.code || e); failed = true; loaded = true; renderAll(false); });
    fb.onAuthStateChanged(fb.auth, async (u) => {
      user = u ? { uid: u.uid, name: u.displayName || "", email: u.email || "" } : null;
      acct(u);
      [verified, own] = user ? await Promise.all([checkVerified(), loadOwn()]) : [false, {}];
      renderAll(true);
    });
  })();
  return started;
}
// Same test as academyStudent() in firestore.rules: an enrollment number claimed by this account.
async function checkVerified() {
  try {
    const s = await fb.getDoc(fb.doc(fb.db, "students", user.uid));
    const no = s.exists() ? s.data().enrollment : "";
    if (!no) return false;
    const e = await fb.getDoc(fb.doc(fb.db, "enrollments", no));
    return e.exists() && e.data().claimedBy === user.uid && e.data().active !== false;
  } catch (e) { return false; }
}
async function loadOwn() {
  try {
    const snap = await fb.getDocs(fb.query(fb.collection(fb.db, "reviews"), fb.where("uid", "==", user.uid)));
    const o = {}; snap.forEach((d) => { o[d.data().target] = { id: d.id, ...d.data() }; }); return o;
  } catch (e) { return {}; }
}
async function signIn() {
  const p = new fb.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
  try { await fb.signInWithPopup(fb.auth, p); return true; }
  catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") { await fb.signInWithRedirect(fb.auth, p); return false; }
    if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") throw e;
    return false;
  }
}
async function save(target, data) {
  const id = target + "__" + user.uid, ref = fb.doc(fb.db, "reviews", id);
  const body = { name: data.name, rating: data.rating, text: data.text, role: data.role, verified, updated: fb.serverTimestamp() };
  if (own[target]) await fb.updateDoc(ref, body);
  else await fb.setDoc(ref, { target, uid: user.uid, ...body, created: fb.serverTimestamp(), hidden: false });
  own[target] = { ...(own[target] || { id, target, uid: user.uid, created: { toMillis: () => Date.now() }, hidden: false }), ...body, updated: { toMillis: () => Date.now() } };
  track(own[target] && data.isEdit ? "review_edited" : "review_posted", { target, rating: data.rating });
}
async function remove(target) {
  await fb.deleteDoc(fb.doc(fb.db, "reviews", target + "__" + user.uid));
  delete own[target]; all = all.filter((r) => r.id !== target + "__" + user.uid);
  track("review_deleted", { target });
}

// ---------- rendering ----------
function renderAll(compose = true) {
  document.querySelectorAll("[data-rv-summary]").forEach(renderSummary);
  document.querySelectorAll("[data-rv-latest]").forEach(renderLatest);
  widgets.forEach((w, el) => { if (el.isConnected) renderWidget(el, compose); else widgets.delete(el); });
}

function renderSummary(el) {
  const target = el.dataset.rvSummary;
  if (failed && loaded) { el.innerHTML = ""; return; }
  if (!loaded) { el.innerHTML = `<span class="rv-sum rv-sum-loading">${stars(0)}</span>`; return; }
  const s = statsFor(target);
  el.innerHTML = `<button type="button" class="rv-sum" data-open>${stars(s.avg)}<span class="rv-sum-txt">${s.n ? `<b>${s.avg.toFixed(1)}</b> · ${s.n} review${s.n === 1 ? "" : "s"}` : "No reviews yet · Be the first"}</span></button>`;
  el.querySelector("[data-open]").onclick = () => openDialog(target, el.dataset.rvTitle || "");
}

function renderLatest(el) {
  const target = el.dataset.rvLatest, count = +el.dataset.rvCount || 3;
  const sec = el.closest("[data-rv-section]");
  const list = all.filter((r) => r.target === target && r.text).sort((a, b) => ms(b.created) - ms(a.created)).slice(0, count);
  if (sec) sec.hidden = !list.length;
  const s = statsFor(target);
  const head = document.querySelector(`[data-rv-latest-stats="${target}"]`);
  if (head) head.innerHTML = s.n ? `${stars(s.avg)} <b>${s.avg.toFixed(1)}</b> out of 5 from ${s.n} review${s.n === 1 ? "" : "s"}` : "";
  el.innerHTML = list.map((r) => card(r, true)).join("");
}

function card(r, compact = false) {
  const mine = user && r.uid === user.uid;
  const text = compact && r.text.length > 280 ? r.text.slice(0, 270).trim() + "…" : r.text;
  return `<article class="rv-card${mine ? " rv-mine" : ""}${r.hidden ? " rv-hidden" : ""}">
    <header class="rv-card-head">
      <span class="rv-avatar" aria-hidden="true">${esc((r.name || "?").trim()[0] || "?").toUpperCase()}</span>
      <div class="rv-who"><b>${esc(r.name)}</b>${r.verified ? ` <span class="rv-badge" title="Linked a ChessDepth Academy enrollment number"><i class="fas fa-check-circle"></i> Verified student</span>` : ""}
        <span class="rv-meta">${esc(ROLES[r.role] || "")}${ROLES[r.role] ? " · " : ""}${when(r.created)}${r.updated && ms(r.updated) - ms(r.created) > 60000 ? " · edited" : ""}${mine ? " · <b>Your review</b>" : ""}</span></div>
      ${stars(r.rating, "rv-stars-sm")}
    </header>
    ${r.hidden ? `<p class="rv-hidden-note"><i class="fas fa-eye-slash"></i> Only you can see this review. It was hidden because it breaks our review guidelines. You can edit it, or message us if you think this is a mistake.</p>` : ""}
    <p class="rv-text">${esc(text)}</p>
    ${r.reply ? `<div class="rv-reply"><p class="rv-reply-h"><i class="fas fa-reply"></i> Reply from ChessDepth Academy</p><p>${esc(r.reply)}</p></div>` : ""}
    ${!compact && !mine && CFG.wa ? `<a class="rv-report" href="https://wa.me/${esc(CFG.wa)}?text=${encodeURIComponent("Hi, please check this review on chessdepth.in (it may break the guidelines): " + r.id)}" target="_blank" rel="noopener noreferrer">Report</a>` : ""}
  </article>`;
}

function mount(el) {
  if (widgets.has(el)) return;
  widgets.set(el, { target: el.dataset.rv, title: el.dataset.rvTitle || "", sort: "new", shown: +el.dataset.rvLimit || 5, open: false });
  el.classList.add("rv");
  el.innerHTML = `<div class="rv-head"></div><div class="rv-compose"></div><div class="rv-list" aria-live="polite"></div><p class="rv-fine">Reviews are posted by people signed in with Google and appear straight away. We never remove a review for being negative: we hide only abuse, spam, advertising or personal details, and we may reply publicly. <a href="/privacy/">Privacy</a></p>`;
  renderWidget(el, true);
}

function renderWidget(el, compose) {
  const w = widgets.get(el); if (!w) return;
  const head = el.querySelector(".rv-head"), list = el.querySelector(".rv-list"), comp = el.querySelector(".rv-compose");
  if (!loaded) { head.innerHTML = `<p class="rv-loading">Loading reviews…</p>`; return; }
  if (failed) { head.innerHTML = `<p class="rv-loading">Reviews can't be loaded right now. Please try again later.</p>`; comp.innerHTML = ""; list.innerHTML = ""; return; }
  const s = statsFor(w.target);
  head.innerHTML = s.n ? `<div class="rv-score"><span class="rv-big">${s.avg.toFixed(1)}</span><div>${stars(s.avg)}<p>${s.n} review${s.n === 1 ? "" : "s"}</p></div></div>
    <div class="rv-dist">${s.dist.map((c, i) => `<div class="rv-bar"><span>${5 - i} <i class="fas fa-star"></i></span><span class="rv-track"><span style="width:${s.n ? (c / s.n) * 100 : 0}%"></span></span><span class="rv-c">${c}</span></div>`).join("")}</div>`
    : `<p class="rv-empty"><i class="far fa-comment-dots"></i> No reviews yet${w.title ? ` for ${esc(w.title)}` : ""}. Be the first to share your experience.</p>`;
  let items = forTarget(w.target);
  const order = { new: (a, b) => ms(b.created) - ms(a.created), high: (a, b) => b.rating - a.rating || ms(b.created) - ms(a.created), low: (a, b) => a.rating - b.rating || ms(b.created) - ms(a.created) }[w.sort];
  items.sort(order);
  if (user) { const i = items.findIndex((r) => r.uid === user.uid); if (i > 0) items.unshift(items.splice(i, 1)[0]); }
  const more = items.length - w.shown;
  list.innerHTML = (items.length > 1 ? `<div class="rv-sort"><label>Sort <select data-sort><option value="new"${w.sort === "new" ? " selected" : ""}>Newest</option><option value="high"${w.sort === "high" ? " selected" : ""}>Highest rated</option><option value="low"${w.sort === "low" ? " selected" : ""}>Lowest rated</option></select></label></div>` : "")
    + items.slice(0, w.shown).map((r) => card(r)).join("")
    + (more > 0 ? `<button type="button" class="rv-more" data-more>Show ${Math.min(more, 10)} more</button>` : "");
  const sel = list.querySelector("[data-sort]"); if (sel) sel.onchange = () => { w.sort = sel.value; renderWidget(el, false); };
  const mb = list.querySelector("[data-more]"); if (mb) mb.onclick = () => { w.shown += 10; renderWidget(el, false); };
  if (compose && !(w.open && comp.querySelector("form") && comp.dataset.dirty === "1")) renderCompose(el);
}

function renderCompose(el) {
  const w = widgets.get(el), comp = el.querySelector(".rv-compose"), mine = user && own[w.target];
  comp.dataset.dirty = "";
  if (!user) {
    comp.innerHTML = `<button type="button" class="rv-btn" data-write><i class="fas fa-pen"></i> Write a review</button><span class="rv-note">Sign in with Google to post. One review per person.</span>`;
    comp.querySelector("[data-write]").onclick = async () => {
      try { const ok = await signIn(); if (ok) { w.open = true; if (user) renderCompose(el); } } catch (e) { comp.querySelector(".rv-note").textContent = "Sign-in didn't work. Please try again."; }
    };
    return;
  }
  if (!w.open) {
    comp.innerHTML = mine
      ? `<span class="rv-note"><i class="fas fa-check"></i> You reviewed this on ${when(mine.created)}.</span> <button type="button" class="rv-link" data-edit>Edit</button> <button type="button" class="rv-link rv-danger" data-del>Delete</button>`
      : `<button type="button" class="rv-btn" data-write><i class="fas fa-pen"></i> Write a review</button><span class="rv-note">Signed in as ${esc(user.email)} · <button type="button" class="rv-link" data-out>Sign out</button></span>`;
    const open = comp.querySelector("[data-write]") || comp.querySelector("[data-edit]");
    open.onclick = () => { w.open = true; renderCompose(el); };
    const del = comp.querySelector("[data-del]");
    if (del) del.onclick = async () => {
      if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "Tap again to delete"; return; }
      del.disabled = true; try { await remove(w.target); renderAll(true); } catch (e) { del.textContent = "Couldn't delete. Try again"; del.disabled = false; del.dataset.sure = ""; }
    };
    const out = comp.querySelector("[data-out]"); if (out) out.onclick = () => fb.signOut(fb.auth);
    return;
  }
  const r = mine || {};
  const uid = Math.random().toString(36).slice(2, 8);
  comp.innerHTML = `<form class="rv-form" novalidate>
    <p class="rv-form-h">${mine ? "Edit your review" : "Your review"}${w.title ? ` of ${esc(w.title)}` : ""}</p>
    <fieldset class="rv-pick"><legend>Your rating</legend><span class="rv-pick-stars">
      ${[5, 4, 3, 2, 1].map((n) => `<input type="radio" name="rating" value="${n}" id="rv-${uid}-${n}"${r.rating === n ? " checked" : ""}><label for="rv-${uid}-${n}" title="${n} star${n > 1 ? "s" : ""}"><i class="fas fa-star"></i><span class="sr-only">${n} star${n > 1 ? "s" : ""}</span></label>`).join("")}
    </span></fieldset>
    <div class="rv-row">
      <label>Name shown<input name="name" maxlength="40" value="${esc(r.name || shortName(user.name))}" required></label>
      <label>I am a<select name="role">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}"${(r.role || "student") === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
    </div>
    <label>Your experience<textarea name="text" rows="5" maxlength="${MAX}" placeholder="What did you like? What could be better? Be honest and specific.">${esc(r.text || "")}</textarea></label>
    <p class="rv-count"><span data-count>${(r.text || "").length}</span> / ${MAX}</p>
    <p class="rv-note">${verified ? '<i class="fas fa-check-circle"></i> Your review will show a <b>Verified student</b> badge.' : 'Academy student? <a href="/lab/">Link your enrollment number in the Chess Lab</a> to get a Verified student badge.'}</p>
    <p class="rv-err" role="alert"></p>
    <div class="rv-actions"><button type="submit" class="rv-btn">${mine ? "Save changes" : "Post review"}</button><button type="button" class="rv-link" data-cancel>Cancel</button></div>
  </form>`;
  const f = comp.querySelector("form"), err = f.querySelector(".rv-err");
  f.oninput = () => { comp.dataset.dirty = "1"; f.querySelector("[data-count]").textContent = f.elements.text.value.length; };
  f.querySelector("[data-cancel]").onclick = () => { w.open = false; renderCompose(el); };
  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = "";
    const rating = +((f.querySelector("input[name=rating]:checked") || {}).value || 0);
    const name = f.elements.name.value.replace(/\s+/g, " ").trim(), text = f.elements.text.value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim(), role = f.elements.role.value;
    if (!rating) return (err.textContent = "Please choose a star rating.");
    if (!name) return (err.textContent = "Please enter the name to show.");
    if (text.length < MIN) return (err.textContent = `Please write at least ${MIN} characters.`);
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Posting…";
    try {
      await save(w.target, { rating, name, text, role, isEdit: !!mine });
      w.open = false; comp.dataset.dirty = ""; renderAll(true);
      const ok = el.querySelector(".rv-compose .rv-note"); if (ok) ok.innerHTML = `<i class="fas fa-check"></i> Thank you! Your review is live.`;
    } catch (e2) {
      console.warn("Review not saved:", e2.code || e2);
      err.textContent = "Sorry, your review couldn't be posted. Please try again in a moment."; btn.disabled = false; btn.textContent = mine ? "Save changes" : "Post review";
    }
  };
}

// ---------- pop-up for summaries ----------
let dlg = null;
function openDialog(target, title) {
  if (!dlg) {
    dlg = document.createElement("dialog"); dlg.className = "rv-dialog";
    dlg.innerHTML = `<div class="rv-dialog-head"><h2 class="rv-dialog-title"></h2><button type="button" class="rv-x" aria-label="Close"><i class="fas fa-times"></i></button></div><div class="rv-dialog-body"></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector(".rv-x").onclick = () => dlg.close();
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  }
  dlg.querySelector(".rv-dialog-title").textContent = "Reviews" + (title ? ": " + title : "");
  const body = dlg.querySelector(".rv-dialog-body");
  widgets.forEach((w, el) => { if (body.contains(el)) widgets.delete(el); });
  body.innerHTML = ""; const el = document.createElement("div"); el.dataset.rv = target; el.dataset.rvTitle = title; body.appendChild(el);
  mount(el);
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  track("reviews_opened", { target });
}

// ---------- start when reviews come near the screen ----------
function boot() {
  const els = document.querySelectorAll("[data-rv], [data-rv-summary], [data-rv-latest]");
  if (!els.length) return;
  document.querySelectorAll("[data-rv]").forEach(mount);
  const go = () => start();
  if (!("IntersectionObserver" in window)) return go();
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "600px 0px" });
  els.forEach((el) => { const sec = el.closest("[data-rv-section]"); if (!sec || !sec.hidden) io.observe(el); });
  // Also load once the page has settled: a section kept hidden until it has reviews can't be "seen",
  // and some embedded browsers never report visibility.
  const later = () => setTimeout(go, document.querySelector("[data-rv-section][hidden]") ? 1200 : 2500);
  if (document.readyState === "complete") later(); else window.addEventListener("load", later, { once: true });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
