// ChessDepth Chess Lab - puzzle library: ~26,000 Lichess puzzles split into 100-point rating shards
// (assets/lab/puzzles/shards/r600.json = puzzles rated 600-699, and so on). Shards load only when needed.
const BASE = "/assets/lab/puzzles/shards/";
let indexP = null;
const shards = {};

export function loadIndex() {
  if (!indexP) indexP = fetch(BASE + "index.json").then((r) => r.json()).then((d) => d.shards);
  return indexP;
}
export function loadShard(file) {
  if (!shards[file]) shards[file] = fetch(BASE + file + ".json").then((r) => r.json())
    .then((d) => d.puzzles.map(([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(" "), rating, themes: themes.split(" "), opponentFirst: true })))
    .catch((e) => { delete shards[file]; throw e; });
  return shards[file];
}
// Shards nearest to a rating: the one containing it first, then neighbours outwards.
export async function nearestShards(rating, count = 2) {
  const idx = await loadIndex();
  return idx.slice().sort((a, b) => dist(a, rating) - dist(b, rating)).slice(0, count);
}
const dist = (s, r) => (r < s.min ? s.min - r : r > s.max ? r - s.max : 0);
// Puzzles from the `count` shards nearest to `rating`, loaded in parallel.
export async function puzzlesNear(rating, count = 2) {
  const list = await nearestShards(rating, count);
  return (await Promise.all(list.map((s) => loadShard(s.file)))).flat();
}
export async function totalPuzzles() { return (await loadIndex()).reduce((n, s) => n + s.count, 0); }
