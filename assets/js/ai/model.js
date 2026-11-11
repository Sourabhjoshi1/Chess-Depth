// ChessDepth AI - square classifier, run in the browser (no uploads, no libraries).
// Network: 4 conv layers (3x3, ReLU, max-pool) + 2 dense layers, 32x32 grayscale input, 13 classes.
// Weights: /assets/ai/model.bin (float16), layout described in /assets/ai/model.json.
export const CLASSES = [".", "P", "N", "B", "R", "Q", "K", "p", "n", "b", "r", "q", "k"];
let W = null;

function f16(u) { // IEEE half -> float
  const s = (u & 0x8000) ? -1 : 1, e = (u >> 10) & 0x1f, m = u & 0x3ff;
  if (e === 0) return s * Math.pow(2, -14) * (m / 1024);
  if (e === 31) return m ? NaN : s * Infinity;
  return s * Math.pow(2, e - 15) * (1 + m / 1024);
}
export async function loadModel(base = "/assets/ai/") {
  if (W) return W;
  const [meta, buf] = await Promise.all([
    fetch(base + "model.json", { cache: "no-cache" }).then((r) => r.json()),
    fetch(base + "model.bin", { cache: "no-cache" }).then((r) => r.arrayBuffer()),
  ]);
  const u16 = new Uint16Array(buf); const out = {};
  for (const t of meta.tensors) {
    const a = new Float32Array(t.size);
    for (let i = 0; i < t.size; i++) a[i] = f16(u16[t.offset + i]);
    out[t.name] = { data: a, shape: t.shape };
  }
  W = out; return W;
}

// conv 3x3, padding 1, then ReLU. input [C,H,W] -> [O,H,W]. The input is copied into a zero-padded
// buffer first, so the inner loop has no edge checks.
function conv(x, C, H, Wd, w, b, O) {
  const Wp = Wd + 2, Hp = H + 2, xp = new Float32Array(C * Hp * Wp);
  for (let c = 0; c < C; c++) for (let r = 0; r < H; r++) xp.set(x.subarray(c * H * Wd + r * Wd, c * H * Wd + (r + 1) * Wd), c * Hp * Wp + (r + 1) * Wp + 1);
  const y = new Float32Array(O * H * Wd);
  for (let o = 0; o < O; o++) {
    const yo = o * H * Wd; y.fill(b[o], yo, yo + H * Wd);
    for (let c = 0; c < C; c++) {
      const xc = c * Hp * Wp, wb = (o * C + c) * 9;
      const k0 = w[wb], k1 = w[wb + 1], k2 = w[wb + 2], k3 = w[wb + 3], k4 = w[wb + 4], k5 = w[wb + 5], k6 = w[wb + 6], k7 = w[wb + 7], k8 = w[wb + 8];
      for (let r = 0; r < H; r++) {
        let p = xc + r * Wp, q = yo + r * Wd;
        for (const end = q + Wd; q < end; q++, p++) {
          y[q] += k0 * xp[p] + k1 * xp[p + 1] + k2 * xp[p + 2] + k3 * xp[p + Wp] + k4 * xp[p + Wp + 1] + k5 * xp[p + Wp + 2] + k6 * xp[p + 2 * Wp] + k7 * xp[p + 2 * Wp + 1] + k8 * xp[p + 2 * Wp + 2];
        }
      }
    }
    for (let i = yo; i < yo + H * Wd; i++) if (y[i] < 0) y[i] = 0;
  }
  return y;
}
function pool(x, C, H, Wd) {
  const h = H >> 1, w = Wd >> 1, y = new Float32Array(C * h * w);
  for (let c = 0; c < C; c++) for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
    const p = c * H * Wd + 2 * r * Wd + 2 * q;
    y[c * h * w + r * w + q] = Math.max(x[p], x[p + 1], x[p + Wd], x[p + Wd + 1]);
  }
  return y;
}
function dense(x, w, b, O, relu) {
  const I = x.length, y = new Float32Array(O);
  for (let o = 0; o < O; o++) { let s = b[o]; const wo = o * I; for (let i = 0; i < I; i++) s += w[wo + i] * x[i]; y[o] = relu && s < 0 ? 0 : s; }
  return y;
}
// x: Float32Array(1024) of raw grayscale 0..255 -> probabilities for the 13 classes
export function classify(px) {
  let m = 0; for (let i = 0; i < 1024; i++) m += px[i]; m /= 1024 * 255;
  let v = 0; for (let i = 0; i < 1024; i++) { const d = px[i] / 255 - m; v += d * d; }
  const sd = Math.sqrt(v / 1024) + 0.05, x = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) x[i] = (px[i] / 255 - m) / sd;
  let h = conv(x, 1, 32, 32, W.c1w.data, W.c1b.data, 16); h = pool(h, 16, 32, 32);
  h = conv(h, 16, 16, 16, W.c2w.data, W.c2b.data, 32); h = pool(h, 32, 16, 16);
  h = conv(h, 32, 8, 8, W.c3w.data, W.c3b.data, 64);
  h = conv(h, 64, 8, 8, W.c4w.data, W.c4b.data, 64); h = pool(h, 64, 8, 8);
  h = dense(h, W.f1w.data, W.f1b.data, 128, true);
  const z = dense(h, W.f2w.data, W.f2b.data, 13, false);
  let mx = -Infinity; for (const a of z) mx = Math.max(mx, a);
  let sum = 0; const p = z.map((a) => { const e = Math.exp(a - mx); sum += e; return e; });
  return p.map((a) => a / sum);
}
