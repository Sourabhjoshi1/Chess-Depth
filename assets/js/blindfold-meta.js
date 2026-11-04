// ChessDepth Blindfold Training - shared facts used by the training page, the Student Area and the admin page.
// Scores are stored as flat keys, e.g. "colours-easy" = best score on Easy, "rounds-colours" = rounds played.

// stage 1 = see the board, 2 = hold the position, 3 = calculate blind.
// medal = the score that earns the medal for a level (bronze = Easy, silver = Medium, gold = Hard).
export const DRILLS = [
  { id: "colours", name: "Square Colours", icon: "fa-chess-board", stage: 1, metric: "best score", medal: 20, blurb: "Light or dark? Name it fast." },
  { id: "squares", name: "Find the Square", icon: "fa-crosshairs", stage: 1, metric: "best score", medal: 15, blurb: "Tap e5 on a board with no letters." },
  { id: "diagonals", name: "Lines & Diagonals", icon: "fa-slash", stage: 1, metric: "best out of 10", medal: 8, blurb: "Bishop and queen geometry in your head." },
  { id: "knight", name: "Knight Routes", icon: "fa-chess-knight", stage: 1, metric: "best out of 10", medal: 8, blurb: "Fewest moves from A to B." },
  { id: "memory", name: "Remember the Position", icon: "fa-brain", stage: 2, metric: "perfect rounds", medal: 3, blurb: "Look, then answer with it hidden." },
  { id: "hear", name: "Hear the Position", icon: "fa-headphones", stage: 2, metric: "perfect rounds", medal: 3, blurb: "Build a position from words alone." },
  { id: "moves", name: "Follow the Moves", icon: "fa-list-ol", stage: 2, metric: "perfect rounds", medal: 3, blurb: "Play an opening in your head." },
  { id: "puzzles", name: "Blindfold Puzzles", icon: "fa-eye-slash", stage: 3, metric: "best streak", medal: 5, blurb: "Solve with the pieces gone." },
  { id: "mates", name: "Blindfold Mates", icon: "fa-chess-king", stage: 3, metric: "mates delivered", medal: 3, blurb: "Checkmate a lone king, blind." },
  { id: "play", name: "Play Blindfold", icon: "fa-robot", stage: 3, metric: "games won", medal: 1, blurb: "A full game vs Stockfish, 400–2800 Elo." },
];
export const STAGES = { 1: "See the board", 2: "Hold the position", 3: "Calculate blind" };
export const LEVELS = ["easy", "medium", "hard"];
export const MEDAL_NAMES = ["Bronze", "Silver", "Gold"];

export const RANKS = [
  { at: 0, title: "Beginner" }, { at: 3, title: "Pawn" }, { at: 6, title: "Knight" }, { at: 10, title: "Bishop" },
  { at: 15, title: "Rook" }, { at: 20, title: "Queen" }, { at: 25, title: "King" }, { at: 30, title: "Blindfold Master" },
];

// get(key) -> number. Returns { byDrill: {id: [easy, medium, hard] booleans}, total }
export function medals(get) {
  const byDrill = {}; let total = 0;
  DRILLS.forEach((d) => { byDrill[d.id] = LEVELS.map((l) => { const ok = (get(`${d.id}-${l}`) || 0) >= d.medal; if (ok) total++; return ok; }); });
  return { byDrill, total };
}
export function rankOf(total) {
  let i = 0; RANKS.forEach((r, k) => { if (total >= r.at) i = k; });
  const next = RANKS[i + 1] || null;
  return { title: RANKS[i].title, index: i, next: next ? next.title : null, nextAt: next ? next.at : null, prevAt: RANKS[i].at };
}

// 28-day mastery plan: three drills a day, one stage at a time, with a suggested level.
export const PLAN_WEEKS = [
  { title: "Week 1 · Learn the board", level: "easy", days: [["colours", "squares", "knight"], ["colours", "squares", "diagonals"], ["squares", "diagonals", "knight"], ["colours", "diagonals", "knight"], ["squares", "diagonals", "knight"], ["colours", "squares", "diagonals"], ["colours", "diagonals", "knight"]] },
  { title: "Week 2 · Hold a picture", level: "easy", days: [["diagonals", "memory", "knight"], ["squares", "memory", "moves"], ["diagonals", "memory", "hear"], ["knight", "memory", "moves"], ["colours", "hear", "memory"], ["diagonals", "moves", "hear"], ["memory", "hear", "moves"]] },
  { title: "Week 3 · See further", level: "medium", days: [["memory", "moves", "puzzles"], ["hear", "moves", "puzzles"], ["diagonals", "memory", "puzzles"], ["moves", "hear", "mates"], ["memory", "puzzles", "mates"], ["knight", "moves", "puzzles"], ["hear", "puzzles", "mates"]] },
  { title: "Week 4 · Play blind", level: "medium", days: [["moves", "puzzles", "mates"], ["memory", "puzzles", "play"], ["hear", "mates", "puzzles"], ["moves", "puzzles", "play"], ["diagonals", "mates", "puzzles"], ["hear", "puzzles", "play"], ["memory", "mates", "play"]] },
];
export function planDay(n) { // n = 1..28
  const d = Math.min(Math.max(1, n), 28) - 1, w = PLAN_WEEKS[Math.floor(d / 7)];
  return { day: d + 1, week: Math.floor(d / 7) + 1, weekTitle: w.title, level: w.level, drills: w.days[d % 7] };
}

// consecutive days (ending today or yesterday) in a list of "YYYY-MM-DD" strings
export function dayStreak(days) {
  const set = new Set(days || []); let n = 0; const d = new Date();
  if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
  while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
