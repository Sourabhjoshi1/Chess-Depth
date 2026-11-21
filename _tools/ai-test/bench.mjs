// node bench.mjs DIR [detect.js] [guard] -> per-image results + summary (JSON lines in DIR/res-<tag>.json)
import fs from 'fs'; import { read } from './sim.mjs';
const [dir, det, guard, tag, fine] = process.argv.slice(2);
const cases = JSON.parse(fs.readFileSync(dir + '/cases.json'));
let perfect = 0, sq = 0, boxOk = 0, flips = 0; const out = [];
for (const c of cases) {
  const r = await read(dir + '/' + c.img, { detect: det && det !== '-' ? det : null, guard: guard && guard !== '-' ? +guard : null, fine: fine ? +fine : null });
  let n = 0; for (let i = 0; i < 64; i++) if (r.board[i] === c.board[i]) n++;
  const err = Math.max(Math.abs(r.box.x - c.x), Math.abs(r.box.y - c.y), Math.abs(r.box.size - c.size)) / (c.size / 8);   // in squares
  const ok = err < 0.25; if (ok) boxOk++; if (n === 64) perfect++; sq += n; if (!r.whiteBottom) flips++;
  out.push({ img: c.img, set: c.set, n, err: +err.toFixed(2), found: !!r.found, wb: r.whiteBottom });
}
fs.writeFileSync(dir + '/res-' + (tag || 'x') + '.json', JSON.stringify(out));
console.log(JSON.stringify({ dir, tag, boards: cases.length, perfect, squaresPct: +(100 * sq / (64 * cases.length)).toFixed(2), boxOk, flips }));
