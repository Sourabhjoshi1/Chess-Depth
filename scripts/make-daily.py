"""Build assets/lab/daily.json: one puzzle per date (India time), easier on Monday, harder on Sunday.
Run: python3 scripts/make-daily.py   (needs: pip install chess)"""
import json, random, datetime, chess
random.seed(2026)
P = []
for band in ["beginner", "intermediate", "advanced"]:
    for pid, fen, moves, rating, themes in json.load(open(f"assets/lab/puzzles/{band}.json"))["puzzles"]:
        P.append(dict(id=pid, fen=fen, moves=moves.split(), rating=rating, themes=themes.split()))

# Main theme shown to the visitor (first match wins)
ORDER = ["smotheredMate", "backRankMate", "mateIn1", "mateIn2", "mateIn3", "doubleCheck", "fork", "skewer", "pin",
         "discoveredAttack", "deflection", "attraction", "capturingDefender", "interference", "trappedPiece",
         "hangingPiece", "promotion", "advancedPawn", "sacrifice", "quietMove", "defensiveMove", "intermezzo"]
def main_theme(t):
    for x in ORDER:
        if x in t: return x
    return None

def ok(p):
    if not (2 <= len(p["moves"]) <= 6): return False
    if not main_theme(p["themes"]): return False
    b = chess.Board(p["fen"])
    for m in p["moves"]:
        mv = chess.Move.from_uci(m)
        if mv not in b.legal_moves: return False
        b.push(mv)
    if any(t.startswith("mateIn") for t in p["themes"]) and not b.is_checkmate(): return False
    return True

pool = [p for p in P if ok(p)]
BANDS = {0: (800, 1000), 1: (900, 1100), 2: (1000, 1200), 3: (1100, 1300), 4: (1200, 1400), 5: (1300, 1500), 6: (1400, 1600)}
used, recent, out = set(), [], {}
start, end = datetime.date(2026, 10, 22), datetime.date(2027, 12, 31)
d = start
while d <= end:
    lo, hi = BANDS[d.weekday()]
    cands = [p for p in pool if p["id"] not in used and lo <= p["rating"] < hi]
    fresh = [p for p in cands if main_theme(p["themes"]) not in recent[-3:]]  # no same theme within 3 days
    p = random.choice(fresh or cands)
    used.add(p["id"]); recent.append(main_theme(p["themes"]))
    out[d.isoformat()] = [p["id"], p["fen"], " ".join(p["moves"]), p["rating"], main_theme(p["themes"])]
    d += datetime.timedelta(days=1)

json.dump({"source": "Lichess puzzle database (CC0), https://database.lichess.org/#puzzles",
           "note": "Key = date in India time. First move in each line is the opponent's move; the solver plays the next one.",
           "days": out}, open("assets/lab/daily.json", "w"), separators=(",", ":"))
from collections import Counter
print(len(out), "days;", "themes:", Counter(v[4] for v in out.values()).most_common())
