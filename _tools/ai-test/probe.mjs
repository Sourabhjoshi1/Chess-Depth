import fs from 'fs'; import { read } from './sim.mjs';
const [dir, det, ...names] = process.argv.slice(2);
const cases = JSON.parse(fs.readFileSync(dir + '/cases.json'));
for (const c of cases.filter((c) => names.includes(c.img))) {
  for (const guard of [null, 0.9]) {
    const r = await read(dir + '/' + c.img, { detect: det, guard });
    const e = (b) => b ? [b.x - c.x, b.y - c.y, b.size - c.size].map((v) => (v / (c.size / 8)).toFixed(2)).join(',') : 'none';
    let n = 0; for (let i = 0; i < 64; i++) if (r.board[i] === c.board[i]) n++;
    console.log(c.img, c.set, 'guard', guard, 'found', e(r.found), 'conf', r.found && r.found.conf.toFixed(2), 'final', e(r.box), 'changed', r.changed, 'ok', n);
  }
}
