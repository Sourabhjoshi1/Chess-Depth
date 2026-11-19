# Blindfold mate puzzles: small random positions, each with exactly one first move that mates in N.
# Usage: python3 puzzles.py N npieces_min npieces_max count seed out.json
import sys, json, random, chess, chess.engine

N, lo, hi, count, seed, out = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
random.seed(seed)
eng = chess.engine.SimpleEngine.popen_uci('/usr/games/stockfish'); eng.configure({'Threads': 1, 'Hash': 64})

WHITE_POOL = 'QRRBBNNPPPPP'
BLACK_POOL = 'qrrbbnnppppp'

def edge_square():
    f, r = random.randint(0, 7), random.randint(0, 7)
    side = random.random()
    if side < 0.55: r = random.choice([6, 7])          # black king usually on its back ranks
    elif side < 0.8: f = random.choice([0, 7])
    return chess.square(f, r)

def random_position(n):
    b = chess.Board(None); b.turn = chess.WHITE
    b.set_piece_at(edge_square(), chess.Piece(chess.KING, chess.BLACK))
    while True:
        s = random.randrange(64)
        if not b.piece_at(s) and chess.square_distance(s, b.king(chess.BLACK)) > 1: b.set_piece_at(s, chess.Piece(chess.KING, chess.WHITE)); break
    nw = random.randint(1, max(1, (n - 2 + 1) // 2 + 1)); nb = n - 2 - nw
    if nb < 0: nb, nw = 0, n - 2
    pieces = [chess.Piece.from_symbol(c) for c in random.sample(WHITE_POOL, nw)] + [chess.Piece.from_symbol(c) for c in random.sample(BLACK_POOL, max(0, nb))]
    if not any(p.color and p.piece_type in (chess.QUEEN, chess.ROOK) for p in pieces) and random.random() < 0.8:
        pieces[0] = chess.Piece(random.choice([chess.QUEEN, chess.ROOK]), chess.WHITE)
    for p in pieces:
        for _ in range(50):
            s = random.randrange(64)
            if b.piece_at(s): continue
            if p.piece_type == chess.PAWN and chess.square_rank(s) in (0, 7): continue
            b.set_piece_at(s, p); break
    return b

def mate_in1_unique(b):
    mates = []
    for m in b.legal_moves:
        b.push(m)
        if b.is_checkmate(): mates.append(m)
        b.pop()
    return mates

found, seen, tries = [], set(), 0
while len(found) < count:
    tries += 1
    b = random_position(random.randint(lo, hi))
    if not b.is_valid() or b.is_check() or b.was_into_check(): continue
    if b.fen() in seen: continue
    seen.add(b.fen())
    m1 = mate_in1_unique(b)
    if N == 1:
        if len(m1) != 1: continue
        # the mate should not be a plain capture of a hanging piece next to the king only: keep all, but avoid promotions-only
        found.append({'fen': b.fen(), 'line': [b.san(m1[0])]}); print(len(found), tries, b.fen(), flush=True); continue
    if m1: continue                                     # must not have a quicker mate
    # quick filter: some check or quiet move must exist; ask the engine
    info = eng.analyse(b, chess.engine.Limit(depth=12 + 2 * N), multipv=2)
    s0 = info[0]['score'].white()
    if not (s0.is_mate() and s0.mate() == N): continue
    if len(info) > 1:
        s1 = info[1]['score'].white()
        if s1.is_mate() and s1.mate() <= N + 1: continue   # second move also mates (quickly): not unique
        if not s1.is_mate() and s1.score() is not None and s1.score() > 700: continue  # the other moves win easily too: dull
    # confirm with a deeper search, and get a clean line that ends in mate
    info2 = eng.analyse(b, chess.engine.Limit(depth=22), multipv=2)
    if not (info2[0]['score'].white().is_mate() and info2[0]['score'].white().mate() == N): continue
    if info2[0]['pv'][0] != info[0]['pv'][0]: continue
    if len(info2) > 1 and info2[1]['score'].white().is_mate() and info2[1]['score'].white().mate() <= N + 1: continue
    pv = info2[0]['pv'][:2 * N - 1]
    c = b.copy(); sans = []
    for m in pv: sans.append(c.san(m)); c.push(m)
    if not c.is_checkmate(): continue
    found.append({'fen': b.fen(), 'line': sans}); print(len(found), tries, b.fen(), sans, flush=True)
eng.quit()
json.dump(found, open(out, 'w'), indent=1)
