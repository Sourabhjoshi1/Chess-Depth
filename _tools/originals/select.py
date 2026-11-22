# Pick a balanced set of new Originals from the generator output and merge into assets/lab/originals.json.
import json, glob, random, collections, chess
random.seed(7)
L = [json.loads(l) for f in sorted(glob.glob('out/*.jsonl')) for l in open(f)]
P = '../../assets/lab/originals.json'; data = json.load(open(P))
have = {p[1].split(' ')[0] for p in data['puzzles']}
seen, pool = set(have), []
for x in L:
    k = x['fen'].split(' ')[0]
    if k in seen: continue
    seen.add(k); pool.append(x)
ORDER = ['smotheredMate', 'doubleCheck', 'mateIn3', 'discoveredAttack', 'skewer', 'pin', 'promotion', 'mateIn2', 'sacrifice', 'rookEndgame', 'pawnEndgame', 'fork', 'mateIn1', 'quietMove', 'hangingPiece']
TARGET = {'smotheredMate': 4, 'doubleCheck': 4, 'mateIn3': 8, 'discoveredAttack': 20, 'skewer': 20, 'pin': 8, 'promotion': 20, 'mateIn2': 35,
          'sacrifice': 15, 'rookEndgame': 10, 'pawnEndgame': 2, 'fork': 40, 'mateIn1': 25, 'quietMove': 0, 'hangingPiece': 0}
def primary(x): return next((t for t in ORDER if t in x['themes']), None)
groups = collections.defaultdict(list)
for x in pool:
    p = primary(x)
    if p: groups[p].append(x)
chosen = []
for t in ORDER:
    g = groups[t]; random.shuffle(g)
    # spread over ratings: sort by rating and take evenly
    g = sorted(g[:max(TARGET[t] * 4, TARGET[t])], key=lambda x: x['rating'])
    n = min(TARGET[t], len(g))
    if n: chosen += [g[int(i * len(g) / n)] for i in range(n)]
counter = collections.Counter()
new = []
for x in chosen:
    t = primary(x); counter[t] += 1
    pid = f"cd-{t.lower()}-{counter[t]:02d}"
    new.append([pid, x['fen'], x['moves'], x['rating'], ' '.join(x['themes']), x['title']])
ids = {p[0] for p in data['puzzles']}
for p in new:
    while p[0] in ids: p[0] += 'b'
    ids.add(p[0])
data['puzzles'] += new
json.dump(data, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
print('added', len(new), 'total', len(data['puzzles'])); print(dict(counter))
print(collections.Counter(p[3] // 250 * 250 for p in new))
