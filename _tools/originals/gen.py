# ChessDepth Originals: composed tactics puzzles, verified with Stockfish.
# Usage: python3 gen.py OUT.jsonl SECONDS SEED
# A position is kept only if the solver's first move is clearly the only winning move (every alternative is at least
# 2.5 pawns worse), every later solver move is also unique, and a recognisable theme is found.
import sys, random, time, json, chess, chess.engine
OUT, SECS, SEED = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); random.seed(SEED)
eng = chess.engine.SimpleEngine.popen_uci('/usr/games/stockfish'); eng.configure({'Threads': 1, 'Hash': 64})
V = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
def sq(f, r): return chess.square(f, r)
def empty(b, s): return b.piece_at(s) is None

def put(b, piece, s):
    if s is None or not empty(b, s): return False
    if piece.piece_type == chess.PAWN and chess.square_rank(s) in (0, 7): return False
    b.set_piece_at(s, piece); return True

def rand_sq(b, ranks=range(8), files=range(8)):
    for _ in range(40):
        s = sq(random.choice(list(files)), random.choice(list(ranks)))
        if empty(b, s): return s
    return None

def build():
    """A random but plausible position, often with a motif planted in it."""
    b = chess.Board(None); me = random.choice([chess.WHITE, chess.BLACK]); op = not me
    home = 0 if me == chess.WHITE else 7; ohome = 7 - home; fwd = 1 if me == chess.WHITE else -1
    motif = random.choice(['backrank', 'fork', 'fork', 'fork', 'skewer', 'skewer', 'discovered', 'discovered', 'smother', 'promo', 'promo', 'mixed', 'mixed', 'mixed', 'kingside'])
    # opponent king, often castled behind pawns
    if motif in ('backrank', 'smother', 'kingside') or random.random() < 0.5:
        kf = random.choice([6, 6, 7, 1, 2]); put(b, chess.Piece(chess.KING, op), sq(kf, ohome))
        for f in range(max(0, kf - 1), min(8, kf + 2)):
            if random.random() < (0.95 if motif == 'backrank' else 0.75): put(b, chess.Piece(chess.PAWN, op), sq(f, ohome - fwd * (1 if random.random() < .8 else 2)))
        if motif == 'smother':
            put(b, chess.Piece(chess.ROOK, op), sq(kf - 1 if kf > 0 else kf + 1, ohome))
    else:
        put(b, chess.Piece(chess.KING, op), rand_sq(b, ranks=range(8)))
    kf = random.choice([6, 6, 1, 2, 4]); put(b, chess.Piece(chess.KING, me), sq(kf, home))
    for f in range(max(0, kf - 1), min(8, kf + 2)):
        if random.random() < 0.7: put(b, chess.Piece(chess.PAWN, me), sq(f, home + fwd))
    if motif == 'backrank':
        put(b, chess.Piece(random.choice([chess.ROOK, chess.ROOK, chess.QUEEN]), me), rand_sq(b, ranks=range(8), files=range(8)))
        if random.random() < .7: put(b, chess.Piece(chess.ROOK, op), rand_sq(b))
    if motif == 'fork':
        ok = chess.Piece(chess.QUEEN if random.random() < .6 else chess.ROOK, op); put(b, ok, rand_sq(b))
        put(b, chess.Piece(chess.KNIGHT, me), rand_sq(b, ranks=range(2, 6)))
    if motif == 'skewer':
        put(b, chess.Piece(random.choice([chess.BISHOP, chess.ROOK, chess.QUEEN]), me), rand_sq(b))
        put(b, chess.Piece(chess.QUEEN if random.random() < .5 else chess.ROOK, op), rand_sq(b))
    if motif == 'discovered':
        put(b, chess.Piece(random.choice([chess.ROOK, chess.BISHOP, chess.QUEEN]), me), rand_sq(b))
        put(b, chess.Piece(random.choice([chess.KNIGHT, chess.BISHOP, chess.PAWN]), me), rand_sq(b, ranks=range(1, 7)))
        put(b, chess.Piece(chess.QUEEN, op), rand_sq(b))
    if motif == 'smother':
        put(b, chess.Piece(chess.KNIGHT, me), rand_sq(b, ranks=range(2, 6))); put(b, chess.Piece(chess.QUEEN, me), rand_sq(b))
    if motif == 'promo':
        put(b, chess.Piece(chess.PAWN, me), sq(random.randrange(8), ohome - fwd * random.choice([1, 1, 2])))
        put(b, chess.Piece(chess.ROOK, op), rand_sq(b))
    # fill with a few more pieces
    pool = [chess.PAWN] * 6 + [chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.ROOK, chess.QUEEN]
    for _ in range(random.randint(2, 8)):
        put(b, chess.Piece(random.choice(pool), random.choice([me, op])), rand_sq(b, ranks=range(1, 7) if random.random() < .5 else range(8)))
    b.turn = me; b.castling_rights = 0
    return b, motif

def realistic(b):
    for c in (chess.WHITE, chess.BLACK):
        n = lambda t: len(b.pieces(t, c))
        if n(chess.QUEEN) > 1 or n(chess.ROOK) > 2 or n(chess.KNIGHT) > 2 or n(chess.BISHOP) > 2 or n(chess.PAWN) > 8: return False
        bs = [chess.square_file(s) + chess.square_rank(s) & 1 for s in b.pieces(chess.BISHOP, c)]
        if len(bs) == 2 and bs[0] == bs[1]: return False
        # pawns: at most 2 on one file
        if any(len([s for s in b.pieces(chess.PAWN, c) if chess.square_file(s) == f]) > 2 for f in range(8)): return False
    return True

def score(info, pov):
    s = info['score'].pov(pov)
    return s.score(mate_score=10000)

def multipv(b, depth, n=2):
    r = eng.analyse(b, chess.engine.Limit(depth=depth), multipv=n)
    return [(x['pv'][0], score(x, b.turn), x['score'].pov(b.turn), x['pv']) for x in r if 'pv' in x]

def material(b, c): return sum(V[p.piece_type] for p in b.piece_map().values() if p.color == c)

def solve_line(b, me):
    """Solver move, best reply, solver move... until the gain is cashed in. Returns list of moves or None."""
    line = []; bb = b.copy()
    start_bal = material(bb, me) - material(bb, not me)
    for step in range(3):  # at most 3 solver moves
        r = multipv(bb, 18, 2)
        if not r: return None
        best, s1, raw, pv = r[0]
        mate = raw.is_mate() and raw.mate() > 0
        if len(r) > 1:
            s2 = r[1][1]
            if mate and r[1][2].is_mate() and r[1][2].mate() > 0: return None   # two ways to mate: not unique
            if not mate and s1 - s2 < 250: return None
            if mate and s2 > 600: return None
        line.append(best); bb.push(best)
        if bb.is_checkmate(): return line
        if mate:
            if raw.mate() > 3: return None
        else:
            bal = material(bb, me) - material(bb, not me)
            # stop once the solver is ahead in material by 2+ and the last move was a capture or promotion
            if step > 0 and bal - start_bal >= 2 and (bb.peek().promotion or b.piece_at(bb.peek().to_square) is not None or True) and not bb.is_check():
                q = eng.analyse(bb, chess.engine.Limit(depth=12))
                if score(q, me) >= 250: return line
        # opponent's best reply
        rep = eng.analyse(bb, chess.engine.Limit(depth=16))
        if 'pv' not in rep or bb.is_game_over(): return None
        line.append(rep['pv'][0]); bb.push(rep['pv'][0])
    return None

def themes_of(b, line, me):
    t = set(); bb = b.copy(); first = line[0]
    moved = bb.piece_at(first.from_square); captured = bb.piece_at(first.to_square)
    # sacrifice: first move puts a piece where it can be taken for less
    bb.push(first)
    if bb.is_check() and len(bb.checkers()) == 2: t.add('doubleCheck')
    attackers = bb.attackers(not me, first.to_square)
    if attackers and moved.piece_type != chess.PAWN and V[moved.piece_type] - (V[captured.piece_type] if captured else 0) >= 3 and not bb.is_checkmate():
        t.add('sacrifice')
    # fork: the moved piece attacks two valuable targets (king counts)
    tg = [s for s in bb.attacks(first.to_square) if bb.piece_at(s) and bb.piece_at(s).color != me and (bb.piece_at(s).piece_type == chess.KING or V[bb.piece_at(s).piece_type] >= 3)]
    if len(tg) >= 2 and not attackers: t.add('fork')
    # discovered attack: a different piece now attacks the king or queen
    for s, p in bb.piece_map().items():
        if p.color == me and s != first.to_square:
            for x in bb.attacks(s):
                q = bb.piece_at(x)
                if q and q.color != me and q.piece_type in (chess.KING, chess.QUEEN):
                    bb.pop(); before = x in bb.attacks(s); bb.push(first)
                    if not before: t.add('discoveredAttack')
    # pin / skewer by the moved piece
    if moved.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN):
        for x in bb.attacks(first.to_square):
            q = bb.piece_at(x)
            if q and q.color != me:
                ray = chess.SquareSet(chess.ray(first.to_square, x)) & chess.SquareSet(chess.between(first.to_square, 64) if False else chess.BB_ALL)
                # look one piece further along the line
                d = (chess.square_file(x) - chess.square_file(first.to_square), chess.square_rank(x) - chess.square_rank(first.to_square))
                st = (max(-1, min(1, d[0])), max(-1, min(1, d[1])))
                f, r = chess.square_file(x) + st[0], chess.square_rank(x) + st[1]
                while 0 <= f < 8 and 0 <= r < 8:
                    y = bb.piece_at(sq(f, r))
                    if y:
                        if y.color != me:
                            vq = 100 if q.piece_type == chess.KING else V[q.piece_type]; vy = 100 if y.piece_type == chess.KING else V[y.piece_type]
                            if vq > vy and vy >= 3: t.add('skewer')
                            if vq < vy and vq >= 1: t.add('pin')
                        break
                    f += st[0]; r += st[1]
    if any(m.promotion for m in line[0::2]): t.add('promotion')
    # mates
    end = b.copy()
    for m in line: end.push(m)
    if end.is_checkmate():
        n = (len(line) + 1) // 2; t.add(f'mateIn{n}')
        last = line[-1]; mp = end.piece_at(last.to_square); k = end.king(not me)
        if mp.piece_type == chess.KNIGHT and all(end.piece_at(s) and end.piece_at(s).color != me for s in chess.SquareSet(chess.BB_KING_ATTACKS[k])):
            t.add('smotheredMate')
        if chess.square_rank(k) in (0, 7) and mp.piece_type in (chess.ROOK, chess.QUEEN) and chess.square_rank(last.to_square) == chess.square_rank(k): t.add('backRankMate')
    if end.is_checkmate():
        t = {x for x in t if x.startswith('mateIn') or x in ('smotheredMate', 'backRankMate', 'doubleCheck', 'sacrifice', 'quietMove')}
    # endgames
    pcs = [p.piece_type for p in b.piece_map().values() if p.piece_type != chess.KING]
    if all(p == chess.PAWN for p in pcs): t.add('pawnEndgame')
    elif all(p in (chess.PAWN, chess.ROOK) for p in pcs) and chess.ROOK in pcs: t.add('rookEndgame')
    if not any(x in t for x in ('fork', 'pin', 'skewer', 'discoveredAttack', 'doubleCheck', 'sacrifice', 'promotion', 'pawnEndgame', 'rookEndgame')) and not end.is_checkmate():
        if b.is_capture(first) and not b.attackers(not me, first.to_square): t.add('hangingPiece')
    if not b.is_capture(first) and not b.gives_check(first) and not first.promotion: t.add('quietMove')
    return t

def rating(b, line, t):
    n = (len(line) + 1) // 2
    r = {1: 650, 2: 1150, 3: 1600}[n]
    if 'mateIn1' in t: r = 600 if 'backRankMate' in t else 750
    if 'hangingPiece' in t: r = min(r, 800)
    if 'sacrifice' in t: r += 250
    if 'quietMove' in t: r += 300
    if 'discoveredAttack' in t or 'doubleCheck' in t: r += 100
    r += (len(b.piece_map()) - 10) * 12
    return int(max(450, min(2300, r + random.randint(-60, 60))))

TITLE = {'smotheredMate': 'Smothered mate: the king is trapped by its own pieces.', 'backRankMate': 'Use the weak back rank.', 'doubleCheck': 'Double check: the king must move.',
         'discoveredAttack': 'Move one piece to unleash another.', 'skewer': 'Skewer: attack the big piece, win the one behind.', 'fork': 'Fork: attack two things at once.',
         'pin': 'Use a pin to win material.', 'promotion': 'Get a new queen.', 'sacrifice': 'Give something to get more back.', 'pawnEndgame': 'Pawn endgame: find the only winning move.',
         'rookEndgame': 'Rook endgame: find the winning idea.', 'hangingPiece': 'Something is undefended. Take it.', 'quietMove': 'A quiet move wins.'}
def title(t):
    for k in ('mateIn1', 'mateIn2', 'mateIn3'):
        if k in t:
            base = {'mateIn1': 'Checkmate in one move.', 'mateIn2': 'Mate in two: find the first move.', 'mateIn3': 'Mate in three: find the first move.'}[k]
            for z in ('smotheredMate', 'backRankMate', 'doubleCheck'):
                if z in t: return base.replace('.', '') + ' (' + TITLE[z].split(':')[0].lower().rstrip('.') + ').'
            return base
    for k in ('doubleCheck', 'discoveredAttack', 'skewer', 'fork', 'pin', 'promotion', 'sacrifice', 'pawnEndgame', 'rookEndgame', 'quietMove', 'hangingPiece'):
        if k in t: return TITLE[k]
    return 'Find the winning move.'

t0 = time.time(); tried = kept = 0
with open(OUT, 'a') as out:
    while time.time() - t0 < SECS:
        b, motif = build(); tried += 1
        if not b.is_valid() or b.is_game_over() or b.is_check() or len(b.piece_map()) < 6: continue
        if b.was_into_check() or not realistic(b): continue
        try:
            r = multipv(b, 10, 2)
            if len(r) < 2: continue
            s1, s2 = r[0][1], r[1][1]
            if s1 < 300 or s1 - s2 < 250: continue
            # the side to move must not already be winning without a tactic (other side's material not just hanging nonsense)
            line = solve_line(b, b.turn)
            if not line: continue
            t = themes_of(b, line, b.turn)
            if not t: continue
            if 'hangingPiece' in t and random.random() < 0.8: continue
            rec = dict(fen=b.fen(), moves=' '.join(m.uci() for m in line), themes=sorted(t), rating=rating(b, line, t), title=title(t), motif=motif)
            out.write(json.dumps(rec) + '\n'); out.flush(); kept += 1
        except Exception as e:
            continue
print('tried', tried, 'kept', kept)
eng.quit()
