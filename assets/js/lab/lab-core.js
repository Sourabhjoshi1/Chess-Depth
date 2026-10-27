// ChessDepth Chess Lab - accounts, access, points and progress.
// Three modes:
//   "firebase" - real Google sign-in; access = admin-granted membership (students/{uid}.lab),
//                a claimed ChessDepth Academy enrollment number (free forever), or the launch offer.
//   "demo"     - everything stored in this browser; open with ?demo=1 (for testing before launch).
//   "closed"   - Firebase not set up yet and no demo requested: the Lab shows "opening soon".
import { firebaseConfig } from "../firebase-config.js";

export const CFG = window.CD_LAB || {};
export const LEVELS = [
  { name: "Pawn", min: 0, icon: "♙" },
  { name: "Knight", min: 250, icon: "♘" },
  { name: "Bishop", min: 600, icon: "♗" },
  { name: "Rook", min: 1200, icon: "♖" },
  { name: "Queen", min: 2500, icon: "♕" },
  { name: "King", min: 5000, icon: "♔" },
];

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
};

let mode = "closed", user = null, access = false, fb = null, progress = null, saveTimer = null, academy = false, enrollmentNo = null;
const listeners = [];
function emit() { const s = state(); listeners.forEach((f) => { try { f(s); } catch (e) { console.error(e); } }); }
export function onChange(f) { listeners.push(f); }
// Launch offer: every signed-in visitor gets full access until the end of `freeUntil` (YYYY-MM-DD).
export function promoEnd() {
  if (!CFG.freeUntil || !/^\d{4}-\d{2}-\d{2}$/.test(CFG.freeUntil)) return null;
  const [y, m, d] = CFG.freeUntil.split("-").map(Number); return new Date(y, m - 1, d, 23, 59, 59);
}
export function promoActive() { const e = promoEnd(); return !!e && Date.now() <= e.getTime(); }
export function promoLabel() { const e = promoEnd(); return e ? e.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : ""; }
let paid = false;
export function state() { return { mode, user, access, paid, academy, enrollment: enrollmentNo, promo: promoActive(), admin: !!(user && isAdminEmail(user.email)) }; }
function isAdminEmail(email) { return !!email && (CFG.admins || []).map((x) => String(x).toLowerCase()).includes(String(email).toLowerCase()); }
export function firstName(u) { return ((u && u.name) || "Student").trim().split(/\s+/)[0]; }

// ---------- dates ----------
export function dayKey(d = new Date()) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return t.getUTCFullYear() + "-W" + String(Math.ceil(((t - y0) / 86400000 + 1) / 7)).padStart(2, "0");
}

// ---------- levels ----------
export function levelFor(points) {
  let i = 0; while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].min) i++;
  const cur = LEVELS[i], next = LEVELS[i + 1] || null;
  const pct = next ? Math.round(((points - cur.min) / (next.min - cur.min)) * 100) : 100;
  return { ...cur, index: i, next, pct, toNext: next ? next.min - points : 0 };
}

// ---------- progress ----------
function blankProgress() {
  return { v: 1, points: 0, week: { key: weekKey(), points: 0 }, streak: { last: null, count: 0, best: 0 },
    puzzle: { rating: 1000, solved: 0, attempted: 0, cleanRun: 0, bestRun: 0, byTheme: {}, history: [], seen: [] },
    openings: {}, log: [], pstreak: { best: 0, runs: 0, last: 0, total: 0, history: [], seen: [] } };
}
function normalise(p) {
  const b = blankProgress(); p = p || {};
  const out = { ...b, ...p, puzzle: { ...b.puzzle, ...(p.puzzle || {}) }, streak: { ...b.streak, ...(p.streak || {}) }, pstreak: { ...b.pstreak, ...(p.pstreak || {}) }, week: { ...b.week, ...(p.week || {}) }, openings: p.openings || {}, log: p.log || [] };
  if (out.week.key !== weekKey()) out.week = { key: weekKey(), points: 0 };
  return out;
}
export async function loadProgress() {
  if (progress) return progress;
  if (mode === "firebase" && user) {
    const snap = await fb.getDoc(fb.doc(fb.db, "labProgress", user.uid));
    progress = normalise(snap.exists() ? snap.data() : null);
  } else {
    let p = null; try { p = JSON.parse(LS.get("cd-lab-progress-demo") || "null"); } catch (e) { p = null; }
    progress = normalise(p);
  }
  return progress;
}
export function saveProgress() {
  if (!progress) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (mode === "firebase" && user) {
      try {
        await fb.setDoc(fb.doc(fb.db, "labProgress", user.uid), progress);
        await fb.setDoc(fb.doc(fb.db, "leaderboard", user.uid), { name: firstName(user), week: progress.week.key, weeklyPoints: progress.week.points, points: progress.points, level: levelFor(progress.points).name, updated: fb.serverTimestamp() });
      } catch (e) { console.warn("Could not save Lab progress:", e.code || e); }
    } else {
      LS.set("cd-lab-progress-demo", JSON.stringify(progress));
    }
  }, 400);
}

// Add points (and keep the streak and weekly total up to date). Returns what changed.
export function award(points, reason) {
  const p = progress; if (!p) return null;
  const before = levelFor(p.points);
  const today = dayKey(), yesterday = dayKey(new Date(Date.now() - 86400000));
  let streakBonus = 0;
  if (p.streak.last !== today) {
    p.streak.count = p.streak.last === yesterday ? p.streak.count + 1 : 1;
    p.streak.best = Math.max(p.streak.best || 0, p.streak.count);
    p.streak.last = today;
    if (p.streak.count > 1) streakBonus = Math.min(5 * p.streak.count, 25);
  }
  const total = Math.max(0, Math.round(points)) + streakBonus;
  if (p.week.key !== weekKey()) p.week = { key: weekKey(), points: 0 };
  p.points += total; p.week.points += total;
  if (total > 0) { p.log.unshift({ t: Date.now(), pts: total, why: reason + (streakBonus ? " (+" + streakBonus + " streak bonus)" : "") }); p.log = p.log.slice(0, 40); }
  saveProgress();
  const after = levelFor(p.points);
  const res = { added: total, streakBonus, levelUp: after.index > before.index ? after : null };
  document.dispatchEvent(new CustomEvent("cdlab:points", { detail: { progress: p, ...res } }));
  return res;
}

// ---------- Puzzle Streak ----------
export function recordStreakRun(score) {
  const s = progress.pstreak, newBest = score > (s.best || 0);
  s.runs++; s.last = score; s.total += score; if (newBest) s.best = score;
  s.history.push([Date.now(), score]); s.history = s.history.slice(-50);
  saveProgress();
  if (newBest && mode === "firebase" && user) {
    fb.setDoc(fb.doc(fb.db, "streakBoard", user.uid), { name: firstName(user), best: score, updated: fb.serverTimestamp() })
      .catch((e) => console.warn("Could not save best streak:", e.code || e));
  }
  return { newBest };
}
export async function streakLeaderboard() {
  if (mode === "firebase") {
    const snap = await fb.getDocs(fb.query(fb.collection(fb.db, "streakBoard"), fb.orderBy("best", "desc"), fb.limit(20)));
    const rows = []; snap.forEach((d) => rows.push({ uid: d.id, ...d.data(), me: user && d.id === user.uid }));
    return { sample: false, rows: rows.sort((a, b) => b.best - a.best).slice(0, 20) };
  }
  const me = { name: firstName(user) + " (you)", best: progress ? progress.pstreak.best : 0, me: true };
  const sample = [["Kabir", 41], ["Aarav", 33], ["Diya", 27], ["Meera", 19], ["Anaya", 12], ["Vihaan", 8]].map(([n, b]) => ({ name: n, best: b }));
  return { sample: true, rows: sample.concat([me]).sort((a, b) => b.best - a.best) };
}

// ---------- leaderboard ----------
export async function leaderboard() {
  const wk = weekKey();
  if (mode === "firebase") {
    const q = fb.query(fb.collection(fb.db, "leaderboard"), fb.where("week", "==", wk), fb.limit(200));
    const snap = await fb.getDocs(q);
    const rows = []; snap.forEach((d) => rows.push({ uid: d.id, ...d.data(), me: user && d.id === user.uid }));
    return { sample: false, rows: rows.sort((a, b) => b.weeklyPoints - a.weeklyPoints).slice(0, 20) };
  }
  const me = { uid: "me", name: firstName(user) + " (you)", weeklyPoints: progress ? progress.week.points : 0, me: true };
  const sample = [["Aarav", 340], ["Diya", 275], ["Kabir", 210], ["Meera", 160], ["Vihaan", 95], ["Anaya", 40]].map(([n, p]) => ({ name: n, weeklyPoints: p }));
  return { sample: true, rows: sample.concat([me]).sort((a, b) => b.weeklyPoints - a.weeklyPoints) };
}

// ---------- sign in / access ----------
export async function signIn() {
  if (mode === "demo") { user = { uid: "demo", name: "Demo Student", email: "demo@chessdepth.in" }; LS.set("cd-lab-demo-user", JSON.stringify(user)); paid = LS.get("cd-lab-demo-access") === "1"; enrollmentNo = LS.get("cd-lab-demo-enrollment"); academy = !!enrollmentNo; access = paid || academy || promoActive(); progress = null; emit(); return; }
  if (mode !== "firebase") return;
  const provider = new fb.GoogleAuthProvider(); provider.setCustomParameters({ prompt: "select_account" });
  try { await fb.signInWithPopup(fb.auth, provider); }
  catch (e) { if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") await fb.signInWithRedirect(fb.auth, provider); else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") throw e; }
}
export async function signOut() {
  if (mode === "demo") { LS.del("cd-lab-demo-user"); user = null; access = false; paid = false; academy = false; enrollmentNo = null; progress = null; emit(); return; }
  if (mode === "firebase") await fb.signOut(fb.auth);
}
export function unlockDemo() { if (mode !== "demo") return; LS.set("cd-lab-demo-access", "1"); paid = true; access = true; emit(); }
export function exitDemo() { ["cd-lab-demo", "cd-lab-demo-user", "cd-lab-demo-access", "cd-lab-demo-enrollment"].forEach(LS.del); location.href = location.pathname; }
export function resetDemoProgress() { LS.del("cd-lab-progress-demo"); progress = null; }

async function checkAccess(u) {
  try {
    const ref = fb.doc(fb.db, "students", u.uid);
    const snap = await fb.getDoc(ref);
    const d = snap.exists() ? snap.data() : {};
    const base = { name: u.name || "", email: u.email || "", photoURL: u.photoURL || "", lastLogin: fb.serverTimestamp() };
    if (!snap.exists()) base.firstLogin = fb.serverTimestamp();
    fb.setDoc(ref, base, { merge: true }).catch(() => {});
    const until = d.labUntil && d.labUntil.toMillis ? d.labUntil.toMillis() : null;
    const isPaid = d.lab === true && (!until || until > Date.now());
    let isAcademy = false;
    if (d.enrollment) {
      try {
        const e = await fb.getDoc(fb.doc(fb.db, "enrollments", d.enrollment));
        isAcademy = e.exists() && e.data().claimedBy === u.uid && e.data().active !== false;
      } catch (err) { /* not linked to this account */ }
    }
    return { paid: isPaid, academy: isAcademy, enrollment: isAcademy ? d.enrollment : null };
  } catch (e) { console.warn("Access check failed:", e.code || e); return { paid: false, academy: false, enrollment: null }; }
}

// ChessDepth Academy students unlock the Lab for free, forever, with their enrollment number.
export function normalizeEnrollment(raw) { return String(raw || "").trim().toUpperCase().replace(/\s+/g, "").replace(/\//g, "-"); }
export async function claimEnrollment(raw) {
  const no = normalizeEnrollment(raw);
  if (!/^[A-Z0-9][A-Z0-9_.-]{1,39}$/.test(no)) throw new Error("Please enter your enrollment number exactly as given by the academy.");
  if (!user) throw new Error("Please sign in first.");
  if (mode === "demo") { LS.set("cd-lab-demo-enrollment", no); enrollmentNo = no; academy = true; access = true; progress = null; emit(); return no; }
  if (mode !== "firebase") throw new Error("The Chess Lab isn't connected yet.");
  try {
    await fb.updateDoc(fb.doc(fb.db, "enrollments", no), { claimedBy: user.uid, claimedEmail: user.email || "", claimedAt: fb.serverTimestamp() });
  } catch (e) {
    throw new Error("We couldn't find that enrollment number, or it's already linked to another account. Check the number, or WhatsApp us on +91 98230 29262.");
  }
  await fb.setDoc(fb.doc(fb.db, "students", user.uid), { enrollment: no }, { merge: true });
  const r = await checkAccess(user);
  paid = r.paid; academy = r.academy; enrollmentNo = r.enrollment; access = paid || academy || promoActive(); progress = null; emit();
  track("lab_enrollment_linked", {});
  return no;
}

const acct = (u) => { try { if (window.cdAccount) window.cdAccount.set(u); } catch (e) { /* header only */ } };
async function initFirebase() {
  const V = "10.12.2";
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
  fb = { ...authMod, ...fsMod, auth: authMod.getAuth(app), db: fsMod.getFirestore(app) };
  fb.getRedirectResult(fb.auth).catch(() => {});
  await new Promise((resolve) => {
    let first = true;
    fb.onAuthStateChanged(fb.auth, async (u) => {
      user = u ? { uid: u.uid, name: u.displayName || "", email: u.email || "", photoURL: u.photoURL || "" } : null;
      acct(u);
      const r = user ? await checkAccess(user) : { paid: false, academy: false, enrollment: null };
      paid = r.paid; academy = r.academy; enrollmentNo = r.enrollment;
      access = !!user && (paid || academy || promoActive());
      progress = null;
      if (first) { first = false; resolve(); } else emit();
    });
  });
}

export async function initLab() {
  const configured = firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("PASTE");
  const params = new URLSearchParams(location.search);
  if (params.get("demo") === "1") LS.set("cd-lab-demo", "1");
  if (params.get("demo") === "0") { ["cd-lab-demo", "cd-lab-demo-user", "cd-lab-demo-access"].forEach(LS.del); }
  if (configured) {
    mode = "firebase";
    try { await initFirebase(); } catch (e) { console.error(e); mode = "closed"; }
  } else if (LS.get("cd-lab-demo") === "1") {
    mode = "demo";
    try { user = JSON.parse(LS.get("cd-lab-demo-user") || "null"); } catch (e) { user = null; }
    paid = !!user && LS.get("cd-lab-demo-access") === "1";
    enrollmentNo = user ? LS.get("cd-lab-demo-enrollment") : null; academy = !!enrollmentNo;
    access = !!user && (paid || academy || promoActive());
  } else {
    mode = "closed";
  }
  return state();
}

// Firestore helpers for the admin page (rules only allow admins to use these).
export async function adminListStudents() {
  const snap = await fb.getDocs(fb.collection(fb.db, "students"));
  const rows = []; snap.forEach((d) => rows.push({ uid: d.id, ...d.data() })); return rows;
}
export async function adminSetAccess(uid, on, untilDate) {
  const data = { lab: !!on, labUntil: untilDate ? fb.Timestamp.fromDate(untilDate) : null, labUpdated: fb.serverTimestamp() };
  await fb.setDoc(fb.doc(fb.db, "students", uid), data, { merge: true });
}

// Enrollment numbers (admin only; the rules enforce it).
export async function adminListEnrollments() {
  const snap = await fb.getDocs(fb.collection(fb.db, "enrollments"));
  const rows = []; snap.forEach((d) => rows.push({ no: d.id, ...d.data() })); return rows;
}
export async function adminAddEnrollments(list) {
  const batch = fb.writeBatch(fb.db);
  list.forEach(({ no, name }) => batch.set(fb.doc(fb.db, "enrollments", no), { name: name || "", active: true, addedAt: fb.serverTimestamp() }, { merge: true }));
  await batch.commit();
}
export async function adminSetEnrollment(no, data) { await fb.setDoc(fb.doc(fb.db, "enrollments", no), data, { merge: true }); }
export async function adminReleaseEnrollment(no) { await fb.setDoc(fb.doc(fb.db, "enrollments", no), { claimedBy: null, claimedEmail: null, claimedAt: null }, { merge: true }); }

// Quiz links (admin only to write; academy students can read them in the Student Area).
export async function adminListQuizLinks() {
  const snap = await fb.getDocs(fb.collection(fb.db, "quizLinks"));
  const out = {}; snap.forEach((d) => { out[d.id] = d.data().url || ""; }); return out;
}
export async function adminSetQuizLink(id, url) {
  if (url) await fb.setDoc(fb.doc(fb.db, "quizLinks", id), { url, updated: fb.serverTimestamp() });
  else await fb.deleteDoc(fb.doc(fb.db, "quizLinks", id));
}

// Reviews (admin only): list every review, hide/unhide, reply publicly.
export async function adminListReviews() {
  const snap = await fb.getDocs(fb.collection(fb.db, "reviews"));
  const rows = []; snap.forEach((d) => rows.push({ id: d.id, ...d.data() })); return rows;
}
export async function adminUpdateReview(id, data) {
  const body = { ...data };
  if ("reply" in body) body.replyAt = fb.serverTimestamp();
  await fb.updateDoc(fb.doc(fb.db, "reviews", id), body);
}

export function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) { /* ignore */ } }
