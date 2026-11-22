# Adds the branches in branches.txt to assets/lab/openings.json as course["variations"].
# variations[0] is always the main line (same moves as course["line"]).
import json, chess, sys
from check import parse
P = '../../assets/lab/openings.json'
data = json.load(open(P)); B = parse('branches.txt')
for c in data['courses']:
    main = c['line']
    c['variations'] = [{"id": "main", "name": "Main line", "from": None, "line": main, "final": c.get('final')}]
    for k, (name, mv) in enumerate(B.get(c['id'], [])):
        b = chess.Board(); line = []; sp = None
        for i, (san, note) in enumerate(mv):
            m = b.parse_san(san)
            if sp is None and (i >= len(main) or main[i]['uci'] != m.uci()): sp = i
            if sp is None and not note: note = main[i]['note']
            line.append({"san": b.san(m), "uci": m.uci(), "note": note}); b.push(m)
        c['variations'].append({"id": f"b{k + 1}", "name": name, "from": sp, "line": line, "final": b.fen()})
json.dump(data, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
print(sum(len(c['variations']) - 1 for c in data['courses']), 'branches in', len(data['courses']), 'courses')
