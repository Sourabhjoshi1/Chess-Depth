// ChessDepth Academy - Student Area (Google sign-in + PDF downloads from Firebase Storage)
import { firebaseConfig, courseNames } from "./firebase-config.js";
import { lookupUser, showReport } from "./lichess-report.js";

const $ = (id) => document.getElementById(id);
const STATES = ["state-loading", "state-setup", "state-signed-out", "state-signed-in"];
function show(state) { STATES.forEach((s) => $(s).classList.toggle("hidden", s !== state)); }

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
  const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = fsMod;

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const storage = getStorage(app);
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
    if (user.photoURL) { $("user-photo").src = user.photoURL; $("user-photo").classList.remove("hidden"); }
    show("state-signed-in");
    const saved = await recordStudent(user);
    setupLichess(user, saved && saved.lichess ? saved.lichess.username : "");
    loadMaterials();
  });

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
        try { await saveLink(null); linked = ""; $("lr-sub").textContent = "Link your Lichess account to see your ratings, strengths and what to work on, updated from your latest games."; showForm(false); }
        catch (e) { un.textContent = "Couldn't unlink. Try again"; un.dataset.sure = ""; }
      };
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
    box.appendChild(el("p", "text-center text-gray-500 py-6", "Loading your material…"));
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
      if (!nonEmpty.length) { $("materials-empty").classList.remove("hidden"); return; }
      nonEmpty.forEach((g) => box.appendChild(renderGroup(g)));
    } catch (e) {
      box.innerHTML = "";
      // Storage not set up yet (or no files): show a friendly note instead of an error
      $("materials-error").innerHTML = 'Your course PDFs are being uploaded and will appear here soon. Meanwhile, train in the <a href="/lab/" class="underline font-semibold">Chess Lab</a> (free for students right now) or download the free <a href="/shop/tactics-starter/" class="underline font-semibold">Tactics Starter Pack</a>.';
      $("materials-error").classList.remove("hidden");
      console.error(e);
    }
  }

  function renderGroup(group) {
    const card = el("section", "bg-white rounded-lg shadow p-6 cd-course");
    const head = el("div", "flex items-center justify-between mb-4");
    head.appendChild(el("h3", "text-xl font-bold text-indigo-700", group.title));
    head.appendChild(el("span", "text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full px-3 py-1", group.items.length + (group.items.length === 1 ? " file" : " files")));
    card.appendChild(head);
    const list = el("ul", "divide-y divide-gray-100");
    group.items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).forEach((item) => {
      const li = el("li", "py-3 flex items-center justify-between gap-4 cd-file");
      li.dataset.search = (group.title + " " + item.name).toLowerCase();
      const left = el("div", "flex items-center gap-3 min-w-0");
      left.appendChild(el("i", "fas fa-file-pdf text-2xl text-red-500 flex-shrink-0"));
      const txt = el("div", "min-w-0");
      txt.appendChild(el("p", "font-medium text-gray-800 truncate", prettyName(item.name)));
      const meta = el("p", "text-xs text-gray-500", "PDF");
      txt.appendChild(meta);
      left.appendChild(txt);
      li.appendChild(left);
      const btn = el("button", "flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md px-4 py-2 transition");
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
          btn.disabled = false; btn.innerHTML = '<i class="fas fa-download mr-1"></i>Download';
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
    const q = ev.target.value.trim().toLowerCase();
    document.querySelectorAll(".cd-course").forEach((card) => {
      let any = false;
      card.querySelectorAll(".cd-file").forEach((li) => {
        const hit = !q || li.dataset.search.includes(q);
        li.classList.toggle("hidden", !hit); if (hit) any = true;
      });
      card.classList.toggle("hidden", !any);
    });
  });
}
