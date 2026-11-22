import json, sys, chess, chess.engine
d = json.load(open('../../assets/lab/originals.json'))['puzzles']
part, n = int(sys.argv[1]), int(sys.argv[2])
eng = chess.engine.SimpleEngine.popen_uci('/usr/games/stockfish'); bad = []
for i, (pid, fen, moves, rating, themes, title) in enumerate(d):
    if i % n != part or not pid.startswith('cd-') or i < 99: continue
    b = chess.Board(fen); mv = moves.split()
    try:
        for k, u in enumerate(mv):
            m = chess.Move.from_uci(u); assert m in b.legal_moves
            if k % 2 == 0:
                r = eng.analyse(b, chess.engine.Limit(depth=20), multipv=2)
                s1 = r[0]['score'].pov(b.turn); best = r[0]['pv'][0]
                last = k == len(mv) - 1
                b2 = b.copy(); b2.push(m)
                if last and b2.is_checkmate(): b.push(m); continue
                if best != m: bad.append((pid, k, 'engine prefers', b.san(best), 'over', b.san(m))); break
                if len(r) > 1:
                    s2 = r[1]['score'].pov(b.turn)
                    if not (s1.is_mate() and s1.mate() > 0) and s1.score(mate_score=10000) - s2.score(mate_score=10000) < 200: bad.append((pid, k, 'not unique', str(s1), str(s2))); break
                    if s1.is_mate() and s1.mate() > 0 and s2.is_mate() and s2.mate() > 0 and not last: bad.append((pid, k, 'two mates', str(s1), str(s2))); break
            b.push(m)
    except AssertionError: bad.append((pid, 'illegal'))
print(json.dumps(bad)); eng.quit()
