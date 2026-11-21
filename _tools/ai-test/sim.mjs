// Node copy of the ChessDepth AI pipeline in assets/js/ai/app.js, for testing changes offline.
// Usage as a module: const r = await read(path, {site, detect, guard})
//   site:   folder that holds assets/js/ai and assets/ai (models)        default: the repo
//   detect: path of a detect.js to use instead of the site's             (to try a new board finder)
//   guard:  skip the grid fine-tuning when the board finder is this sure (e.g. 0.95), or null
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { pathToFileURL } from 'url';

const REPO = '/home/claude/site/repo';
const mods = {};
async function load(site, detectPath) {
  const key = site + '|' + (detectPath || '');
  if (mods[key]) return mods[key];
  // model.js fetches its weights: serve them from disk
  globalThis.fetch = async (u) => {
    const p = path.join(site, String(u).replace(/^\//, ''));
    const buf = fs.readFileSync(p);
    return { ok: true, json: async () => JSON.parse(buf.toString()), arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
  };
  const model = await import(pathToFileURL(path.join(site, 'assets/js/ai/model.js')).href + '?' + key);
  const detect = await import(pathToFileURL(detectPath || path.join(site, 'assets/js/ai/detect.js')).href + '?' + key);
  await model.loadModel('/assets/ai/');
  return (mods[key] = { model, detect });
}

export function decodeImage(p) {
  const buf = fs.readFileSync(p);
  let w, h, d;
  if (buf[0] === 0x89) { const im = PNG.sync.read(buf); w = im.width; h = im.height; d = im.data; }
  else { const im = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 2048 }); w = im.width; h = im.height; d = im.data; }
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {   // flatten transparency onto white, as a browser shows it
    const a = d[j + 3] / 255;
    rgb[i * 3] = d[j] * a + 255 * (1 - a); rgb[i * 3 + 1] = d[j + 1] * a + 255 * (1 - a); rgb[i * 3 + 2] = d[j + 2] * a + 255 * (1 - a);
  }
  return { w, h, rgb };
}

// like canvas drawImage(src, sx, sy, sw, sh, 0, 0, ow, oh) with smoothing: area average with 4x4 bilinear samples.
// Pixels outside the source come out as the fill colour (#888).
function draw(img, sx, sy, sw, sh, ow, oh) {
  const out = new Float32Array(ow * oh * 3), fx = sw / ow, fy = sh / oh, N = 4;
  const px = (x, y, c) => {
    if (x < 0 || y < 0 || x > img.w - 1 || y > img.h - 1) return 136;
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, img.w - 1), y1 = Math.min(y0 + 1, img.h - 1), ax = x - x0, ay = y - y0;
    const g = (xx, yy) => img.rgb[(yy * img.w + xx) * 3 + c];
    return (g(x0, y0) * (1 - ax) + g(x1, y0) * ax) * (1 - ay) + (g(x0, y1) * (1 - ax) + g(x1, y1) * ax) * ay;
  };
  for (let oy = 0; oy < oh; oy++) for (let ox = 0; ox < ow; ox++) for (let c = 0; c < 3; c++) {
    let s = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) s += px(sx + (ox + (i + 0.5) / N) * fx - 0.5, sy + (oy + (j + 0.5) / N) * fy - 0.5, c);
    out[(oy * ow + ox) * 3 + c] = s / (N * N);
  }
  return { w: ow, h: oh, rgb: out };
}
const gray = (im) => { const g = new Float32Array(im.w * im.h); for (let i = 0; i < g.length; i++) g[i] = 0.299 * im.rgb[i * 3] + 0.587 * im.rgb[i * 3 + 1] + 0.114 * im.rgb[i * 3 + 2]; return g; };

export async function read(file, opt = {}) {
  const site = opt.site || REPO, { model, detect } = await load(site, opt.detect);
  const img = decodeImage(file);
  const sc = Math.min(1, 900 / Math.max(img.w, img.h)), cw = Math.round(img.w * sc), ch = Math.round(img.h * sc);
  const small = sc === 1 ? img : draw(img, 0, 0, img.w, img.h, cw, ch);
  const found = detect.findBoard(gray(small), cw, ch);
  let box = found ? { x: found.x / sc, y: found.y / sc, size: found.size / sc } : null;
  if (!box) { const s = Math.min(img.w, img.h); box = { x: (img.w - s) / 2, y: (img.h - s) / 2, size: s }; }
  const found0 = found ? { x: found.x / sc, y: found.y / sc, size: found.size / sc, conf: found.confidence } : null;

  const drawBoard = (b) => draw(img, b.x, b.y, b.size, b.size, 512, 512);
  const crop = (big, i, dx = 0, dy = 0) => {
    const r = i >> 3, c = i & 7, sq = draw(big, c * 64 + dx, r * 64 + dy, 64, 64, 32, 32);
    return gray(sq);
  };
  const readSq = (big, list, dx = 0, dy = 0, both = false) => (list || [...Array(64).keys()]).map((i) => model.classify(crop(big, i, dx, dy), both));

  let big = drawBoard(box), P = readSq(big);
  // refine (copy of app.js)
  const skip = opt.guard != null && found && found.confidence >= opt.guard;
  const occ = [], emp = [];
  P.forEach((p, i) => { let b = 0; p.forEach((v, k) => { if (v > p[b]) b = k; }); (b ? occ : emp).push(i); });
  let changed = false;
  if (occ.length >= 2 && !skip) {
    const spread = (a, n) => (a.length <= n ? a : Array.from({ length: n }, (_, k) => a[Math.floor((k * a.length) / n)]));
    const sub = spread(occ, 16).concat(spread(emp, 6));
    const score = (Q) => Q.reduce((s, p) => s + Math.log(Math.max(...p) + 1e-6), 0);
    let best = box, bc = score(sub.map((i) => P[i]));
    const steps = opt.fine != null && found && found.confidence >= opt.fine ? [0.015] : [0.03, 0.015];
    for (const step of steps) {
      for (let pass = 0; pass < 2; pass++) {
        const { x, y, size: s } = best; let got = false;
        const cands = [{ x: x + step * s, y, size: s }, { x: x - step * s, y, size: s }, { x, y: y + step * s, size: s }, { x, y: y - step * s, size: s }];
        for (const ds of [-step, step]) { const s1 = s * (1 + ds); cands.push({ x: x - (s1 - s) / 2, y: y - (s1 - s) / 2, size: s1 }); }
        for (const cd of cands) { const q = score(readSq(drawBoard(cd), sub)); if (q > bc + 0.05) { bc = q; best = cd; got = true; changed = true; } }
        if (!got) break;
      }
    }
    if (changed) { box = best; big = drawBoard(box); }
  }
  P = readSq(big, null, 0, 0, true);
  P.forEach((p, i) => {
    if (Math.max(...p) >= 0.95) return;
    const L = p.map((v) => Math.log(v + 1e-6));
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) readSq(big, [i], dx, dy, true)[0].forEach((v, k) => { L[k] += Math.log(v + 1e-6); });
    const e = L.map((v) => Math.exp(v / 5)), sum = e.reduce((a, c) => a + c, 0);
    P[i] = e.map((v) => v / sum);
  });
  const res = decide(P);
  const C = model.CLASSES;
  // placement in FEN order from White's side
  const at = Array(64).fill('.');
  res.pick.forEach((v, i) => { const r = i >> 3, c = i & 7; const j = res.whiteBottom ? i : (7 - r) * 8 + (7 - c); at[j] = C[v]; });
  return { box, found: found0, changed, whiteBottom: res.whiteBottom, raw: res.pick.map((v) => C[v]).join(''), board: at.join(''), unsure: res.unsure.length };
}

function decide(P) {   // copy of app.js decide()
  const second = (p, ex) => { let b = -1; p.forEach((v, i) => { if (!ex.includes(i) && (b < 0 || v > p[b])) b = i; }); return b; };
  const pick = P.map((p) => { let b = 0; p.forEach((v, i) => { if (v > p[b]) b = i; }); return b; });
  pick.forEach((v, i) => { const r = Math.floor(i / 8); if ((v === 1 || v === 7) && (r === 0 || r === 7)) pick[i] = second(P[i], [1, 6, 7, 12]); });
  for (const pw of [1, 7]) {
    const idx = pick.map((v, i) => (v === pw ? i : -1)).filter((i) => i >= 0);
    if (idx.length > 8) { idx.sort((a, b) => P[b][pw] - P[a][pw]); idx.slice(8).forEach((i) => { pick[i] = second(P[i], [pw]); }); }
  }
  for (const k of [6, 12]) {
    const idx = pick.map((v, i) => (v === k ? i : -1)).filter((i) => i >= 0);
    if (idx.length > 1) { idx.sort((a, b) => P[b][k] - P[a][k]); idx.slice(1).forEach((i) => { pick[i] = second(P[i], [k, 6, 12]); }); }
    if (!idx.length) { let bi = -1; pick.forEach((v, i) => { if (v && v !== 6 && v !== 12 && (bi < 0 || P[i][k] > P[bi][k])) bi = i; }); if (bi >= 0 && P[bi][k] > 0.02) pick[bi] = k; }
  }
  let score = 0;
  pick.forEach((v, i) => { const r = Math.floor(i / 8); const w = r - 3.5; if (v === 1) score += w; else if (v === 7) score -= w; else if (v === 6) score += 0.5 * w; else if (v === 12) score -= 0.5 * w; });
  const whiteBottom = score > -3;
  const unsure = []; pick.forEach((v, i) => { if (P[i][v] < 0.75) unsure.push(i); });
  return { pick, whiteBottom, unsure };
}

export const fenBoard = (b) => b.match(/.{8}/g).map((r) => r.replace(/\.+/g, (m) => m.length)).join('/');
export const boardFromFen = (f) => f.split(' ')[0].split('/').map((r) => r.replace(/\d/g, (d) => '.'.repeat(+d))).join('');

if (process.argv[1] && process.argv[1].endsWith('sim.mjs')) {
  for (const f of process.argv.slice(2)) { const t = Date.now(); const r = await read(f); console.log(path.basename(f), fenBoard(r.board), JSON.stringify(r.found), 'wb', r.whiteBottom, (Date.now() - t) + 'ms'); }
}
