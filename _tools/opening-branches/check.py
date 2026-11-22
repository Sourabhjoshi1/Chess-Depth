import re, json, chess, chess.engine, sys
main = {c['id']: c for c in json.load(open('../../assets/lab/openings.json'))['courses']}
def parse(path):
    out = {}; cur = None
    for ln in open(path):
        ln = ln.rstrip('\n')
        if not ln or ln.startswith('#'): continue
        if ln.startswith('@'): cur = ln[1:].strip(); out[cur] = []; continue
        if ln.startswith('='):
            name, body = ln[1:].split('|', 1)
            toks = re.findall(r'\{[^}]*\}|\S+', body); mv = []
            for t in toks:
                if t.startswith('{'): mv[-1][1] = t[1:-1].strip()
                else: mv.append([t, ''])
            out[cur].append((name.strip(), mv))
    return out
if __name__ == '__main__':
    B = parse('branches.txt'); eng = chess.engine.SimpleEngine.popen_uci('/usr/games/stockfish'); bad = 0
    for cid, brs in B.items():
        c = main[cid]; side = chess.WHITE if c['side'] == 'w' else chess.BLACK; ml = [m['san'] for m in c['line']]
        for name, mv in brs:
            b = chess.Board(); sp = None
            try:
                for i, (san, _) in enumerate(mv):
                    if sp is None and (i >= len(ml) or ml[i] != san): sp = i
                    if b.turn == side and sp is not None and i >= sp:
                        info = eng.analyse(b, chess.engine.Limit(depth=14)); best = info['score'].pov(side).score(mate_score=3000)
                        m = b.parse_san(san); b2 = b.copy(); b2.push(m)
                        got = eng.analyse(b2, chess.engine.Limit(depth=14))['score'].pov(side).score(mate_score=3000)
                        if best - got > 70: print(f'  LOSS {cid} [{name}] {i//2+1}{"." if b.turn else "..."}{san} {best}->{got} best {b.san(info["pv"][0])}'); bad += 1
                    else: m = b.parse_san(san)
                    b.push(m)
            except ValueError as e: print('ILLEGAL', cid, name, i, san, e); bad += 1; continue
            if sp is None: print('NO BRANCH', cid, name); bad += 1
            ev = eng.analyse(b, chess.engine.Limit(depth=16))['score'].pov(side).score(mate_score=3000)
            last_mine = (len(mv) - 1) % 2 == (0 if side == chess.WHITE else 1)
            print(f'{cid:18} {name[:38]:38} branch@{sp} plies {len(mv)} final {ev:+} {"" if last_mine else "ENDS ON OPPONENT"}')
            if ev < -60: bad += 1; print('  BAD FINAL EVAL')
    eng.quit(); print('problems', bad)
