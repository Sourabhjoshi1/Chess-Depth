// ChessDepth AI - find a 2D chessboard in a screenshot or diagram.
// Idea: the lines between squares are where brightness flips from light to dark AND dark to light
// along the same line (the checkerboard alternates). We look for 7 such lines, evenly spaced,
// in each direction, and add one square on each side for the board edges.

export function toGray(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
  return g;
}

// returns {x, y, size} in the coordinates of the gray image, or null
export function findBoard(g, w, h) {
  // run on the image as is, and on a blurred copy (hatched book diagrams and noisy photos look like
  // plain squares once blurred); keep whichever looks more like a checkerboard
  let best = findGrid(g, w, h);
  for (const r of [2, 4]) {
    if (best && best.confidence > 0.9) break;
    const b = findGrid(boxBlur(g, w, h, r), w, h);
    if (b && (!best || b.confidence > best.confidence + 0.02)) best = b;
  }
  return best;
}

function boxBlur(g, w, h, r) {
  const t = new Float32Array(w * h), o = new Float32Array(w * h), k = 2 * r + 1;
  for (let y = 0; y < h; y++) { let acc = 0; const row = y * w;
    for (let x = -r; x < w + r; x++) { acc += g[row + Math.min(w - 1, Math.max(0, x))]; if (x - k >= -r - 1 && x - k >= -r) acc -= g[row + Math.min(w - 1, Math.max(0, x - k))]; if (x - r >= 0 && x - r < w) t[row + x - r] = acc / k; } }
  for (let x = 0; x < w; x++) { let acc = 0;
    for (let y = -r; y < h + r; y++) { acc += t[Math.min(h - 1, Math.max(0, y)) * w + x]; if (y - k >= -r) acc -= t[Math.min(h - 1, Math.max(0, y - k)) * w + x]; if (y - r >= 0 && y - r < h) o[(y - r) * w + x] = acc / k; } }
  return o;
}

function findGrid(g, w, h) {
  const colPos = new Float32Array(w), colNeg = new Float32Array(w), rowPos = new Float32Array(h), rowNeg = new Float32Array(h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = g[i + 1] - g[i - 1], gy = g[i + w] - g[i - w];
      if (gx > 0) colPos[x] += gx; else colNeg[x] -= gx;
      if (gy > 0) rowPos[y] += gy; else rowNeg[y] -= gy;
    }
  }
  const prof = (pos, neg) => { const n = pos.length, p = new Float32Array(n); let mx = 0; for (let i = 0; i < n; i++) { p[i] = Math.sqrt(pos[i] * neg[i]); if (p[i] > mx) mx = p[i]; } if (mx) for (let i = 0; i < n; i++) p[i] /= mx; return p; };
  const cx = prof(colPos, colNeg), cy = prof(rowPos, rowNeg);
  const best = (p, n, sMin, sMax) => {
    const peak = (v) => { const i = Math.round(v); let m = 0; for (let k = i - 1; k <= i + 1; k++) if (k >= 0 && k < n && p[k] > m) m = p[k]; return m; };
    const val = (v) => { const i = Math.round(v); return i >= 0 && i < n ? p[i] : 0; };
    const res = [];
    for (let s = sMin; s <= sMax; s += 0.5) {
      for (let o = 0; o + 8 * s <= n + 1; o += 1) {
        let on = 0, off = 0, minOn = 1;
        for (let k = 1; k <= 7; k++) { const a = peak(o + k * s); on += a; if (a < minOn) minOn = a; off += val(o + (k - 0.5) * s); }
        off += val(o + 7.5 * s);
        const score = on - off + 2 * minOn;
        res.push({ s, o, score });
      }
    }
    res.sort((a, b) => b.score - a.score);
    return res.slice(0, 40);
  };
  const minS = Math.max(6, Math.min(w, h) / 40), maxS = Math.min(w, h) / 8;
  const bx = best(cx, w, minS, maxS), by = best(cy, h, minS, maxS);
  // pick the best pairs whose square sizes agree (squares are square)
  const pairs = [];
  for (const a of bx) for (const b of by) {
    const ratio = a.s / b.s; if (ratio < 0.94 || ratio > 1.06) continue;
    pairs.push({ a, b, sc: a.score + b.score });
  }
  if (!pairs.length) return null;
  pairs.sort((p, q) => q.sc - p.sc);
  // the line search can land one square off (the board edge also looks like a line) or at half size,
  // so check the checkerboard itself for nearby candidates and keep the best one
  let top = null; const seen = new Set();
  for (const pr of pairs.slice(0, 6)) {
    const s0 = (pr.a.s + pr.b.s) / 2;
    for (const mul of [1, 2]) {
      const s = s0 * mul;
      for (let dx = -2; dx <= 1; dx++) for (let dy = -2; dy <= 1; dy++) {
        const x = Math.round(pr.a.o + dx * s0), y = Math.round(pr.b.o + dy * s0);
        if (x < -1 || y < -1 || x + 8 * s > w + 1 || y + 8 * s > h + 1) continue;
        const key = x + ',' + y + ',' + Math.round(s); if (seen.has(key)) continue; seen.add(key);
        const c = checker(g, w, h, x, y, s);
        const score = c + 0.02 * pr.sc;
        if (!top || score > top.score) top = { x, y, s, score, c };
      }
    }
  }
  if (!top || top.c < 40) return null;
  return { x: Math.max(0, top.x), y: Math.max(0, top.y), size: 8 * top.s, confidence: Math.min(1, (top.c - 32) / 32) };
}

// how well the 64 squares follow a light/dark checker pattern, judged on the ring near each square's edge
// (pieces sit in the middle). Returns roughly 64 for a real board, ~32 for a wrong grid.
function checker(g, w, h, x0, y0, s) {
  const m = new Float32Array(64), st = Math.max(1, Math.floor(s / 12));
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    let sum = 0, n = 0; const sx = x0 + c * s, sy = y0 + r * s;
    for (let v = 0.06 * s; v < 0.94 * s; v += st) for (let u = 0.06 * s; u < 0.94 * s; u += st) {
      const e = Math.min(u, v, s - u, s - v); if (e > 0.2 * s) continue;
      const X = Math.round(sx + u), Y = Math.round(sy + v); if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
      sum += g[Y * w + X]; n++;
    }
    m[r * 8 + c] = n ? sum / n : 0;
  }
  const a = [], b = [];
  for (let i = 0; i < 64; i++) (((i >> 3) + (i & 7)) % 2 ? b : a).push(m[i]);
  const med = (arr) => arr.slice().sort((p, q) => p - q)[arr.length >> 1];
  const ma = med(a), mb = med(b), mid = (ma + mb) / 2, contrast = Math.abs(ma - mb);
  if (contrast < 6) return 0;
  let agree = 0;
  for (let i = 0; i < 64; i++) { const odd = ((i >> 3) + (i & 7)) % 2; const own = odd ? mb : ma, oth = odd ? ma : mb; if (Math.abs(m[i] - own) < Math.abs(m[i] - oth)) agree++; }
  return agree + Math.min(4, contrast / 20);
}
