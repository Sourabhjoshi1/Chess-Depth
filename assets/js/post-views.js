// ChessDepth Academy - blog read counts.
//
// Each article keeps a counter in Firestore (postViews/{slug}.count), shown live. A visit adds one read,
// at most once per article per browser session. Reads counted before the live counter started
// (from Google Analytics) come from _data/post_reads.yml and are added on top.
//
// Markup:
//   <span data-pv-count="slug" data-pv-base="123"></span>   shows "N reads"
//   <span data-pv-total></span>                             total reads across every article (blog page)
//   <span data-pv-hit="slug"></span>                         count this page as a read
import { firebaseConfig } from "./firebase-config.js";

const V = "10.12.2";
const fmt = (n) => n.toLocaleString("en-US");
const label = (n) => `${fmt(n)} ${n === 1 ? "read" : "reads"}`;

async function fb() {
  const [appMod, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
  return { fs, db: fs.getFirestore(app) };
}

function paint(live) {
  let total = 0;
  const seen = new Set();
  document.querySelectorAll("[data-pv-count]").forEach((el) => {
    const slug = el.dataset.pvCount;
    const n = (parseInt(el.dataset.pvBase, 10) || 0) + (live[slug] || 0);
    set(el, label(n));
    const wrap = el.closest(".pv-wrap"); if (wrap) wrap.hidden = false;
    if (!seen.has(slug)) { seen.add(slug); total += n; }
  });
  document.querySelectorAll("[data-pv-total]").forEach((el) => {
    set(el, fmt(total));
    const box = el.closest("[data-pv-box]");
    if (box) box.hidden = false;
  });
}
// Change the text, with a short flash when a number goes up while the page is open.
function set(el, text) {
  if (el.textContent === text) return;
  const first = !el.dataset.pvShown; el.textContent = text; el.dataset.pvShown = "1";
  if (!first) { el.classList.remove("pv-tick"); void el.offsetWidth; el.classList.add("pv-tick"); }
}

(async () => {
  const hitEl = document.querySelector("[data-pv-hit]");
  const hit = hitEl ? hitEl.dataset.pvHit : "";
  const els = document.querySelectorAll("[data-pv-count]");
  if (!hit && !els.length) return;
  const live = {};
  paint(live);   // show the saved counts straight away; live numbers follow
  try {
    const { fs, db } = await fb();
    // Live updates: the numbers change on screen as soon as anyone, anywhere, opens an article.
    if (document.querySelector("[data-pv-total]")) {
      fs.onSnapshot(fs.collection(db, "postViews"), (snap) => {
        snap.forEach((d) => { live[d.id] = Number(d.data().count) || 0; }); paint(live);
      }, () => {});
    } else if (hit) {
      fs.onSnapshot(fs.doc(db, "postViews", hit), (d) => { live[hit] = d.exists() ? Number(d.data().count) || 0 : 0; paint(live); }, () => {});
    }
    if (hit && /^[a-z0-9-]{1,120}$/.test(hit)) {
      let counted = false;
      try { counted = sessionStorage.getItem("pv:" + hit) === "1"; } catch (e) {}
      if (!counted) {
        try {
          await fs.setDoc(fs.doc(db, "postViews", hit), { count: fs.increment(1) }, { merge: true });
          try { sessionStorage.setItem("pv:" + hit, "1"); } catch (e) {}
        } catch (e) { /* counting is best-effort */ }
      }
    }
  } catch (e) { /* offline or blocked: the saved counts stay on screen */ }
})();
