// ChessDepth Chess Lab - accounts, access, points and progress.
// Three modes:
//   "firebase" - real Google sign-in; access granted by an admin in Firestore (students/{uid}.lab).
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

let mode = "closed", user = null, access = false, fb = null, progress = null, saveTimer = null;
const listeners = [];
function emit() { const s = state(); listeners.forEach((f) => { try { f(s); } catch (e) { console.error(e); } }); }
export function onChange(f) { listeners.push(f); }
export function state() { return { mode, user, access, admin: !!(user && isAdminEmail(user.email)) }; }
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
    openings: {}, log: [] };
}
function normalise(p) {
  const b = blankProgress(); p = p || {};
  const out = { ...b, ...p, puzzle: { ...b.puzzle, ...(p.puzzle || {}) }, streak: { ...b.streak, ...(p.streak || {}) }, week: { ...b.week, ...(p.week || {}) }, openings: p.openings || {}, log: p.log || [] };
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
  if (mode === "demo") { user = { uid: "demo", name: "Demo Student", email: "demo@chessdepth.in" }; LS.set("cd-lab-demo-user", JSON.stringify(user)); access = LS.get("cd-lab-demo-access") === "1"; progress = null; emit(); return; }
  if (mode !== "firebase") return;
  const provider = new fb.GoogleAuthProvider(); provider.setCustomParameters({ prompt: "select_account" });
  try { await fb.signInWithPopup(fb.auth, provider); }
  catch (e) { if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") await fb.signInWithRedirect(fb.auth, provider); else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") throw e; }
}
export async function signOut() {
  if (mode === "demo") { LS.del("cd-lab-demo-user"); user = null; access = false; progress = null; emit(); return; }
  if (mode === "firebase") await fb.signOut(fb.auth);
}
export function unlockDemo() { if (mode !== "demo") return; LS.set("cd-lab-demo-access", "1"); access = true; emit(); }
export function exitDemo() { ["cd-lab-demo", "cd-lab-demo-user", "cd-lab-demo-access"].forEach(LS.del); location.href = location.pathname; }
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
    return d.lab === true && (!until || until > Date.now());
  } catch (e) { console.warn("Access check failed:", e.code || e); return false; }
}

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
      access = user ? await checkAccess(user) : false;
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
    access = !!user && LS.get("cd-lab-demo-access") === "1";
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

export function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) { /* ignore */ } }
