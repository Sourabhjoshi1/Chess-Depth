import json, chess, chess.engine, random
SH='/home/claude/site/repo/assets/lab/puzzles/shards/'
def load(fs):
    P=[]
    for f in fs:
        try: data=json.load(open(SH+f+'.json'))['puzzles']
        except FileNotFoundError: continue
        for pid,fen,moves,rating,themes in data: P.append(dict(id=pid,fen=fen,moves=moves.split(),rating=rating,themes=themes.split()))
    return P
used=set(q['id'] for q in json.load(open('/home/claude/quiz/puzzles.json')))
for v in json.load(open('/home/claude/quiz2/picked.json')).values(): used.update(p if isinstance(p,str) else p['id'] for p in v)
for v in json.load(open('/home/claude/quiz3/picked.json')).values(): used.update(v)
ch=json.load(open('/home/claude/site/repo/shop-src/tactics-starter/chosen.json'))
for v in ch.values(): used.update(p['id'] for p in v)
eng=chess.engine.SimpleEngine.popen_uci('/usr/games/stockfish'); eng.configure({'Threads':2,'Hash':128})
def ok(p,maxs):
    n=len(p['moves'])
    if n%2 or n//2>maxs: return False
    b=chess.Board(p['fen']); b.push_uci(p['moves'][0])
    if 'mateIn1' in p['themes']:
        mates=[m for m in b.legal_moves if (b.push(m) or b.is_checkmate()) | (b.pop() and False)]
        return len(mates)==1 and mates[0].uci()==p['moves'][1]
    info=eng.analyse(b,chess.engine.Limit(depth=16),multipv=3)
    if len(info)<2 or info[0]['pv'][0].uci()!=p['moves'][1]: return False
    sc=[i['score'].pov(b.turn).score(mate_score=10000) for i in info]
    return sc[0]-sc[1]>=250 and sc[0]>=250
def pick(fs,theme,k,maxs,extra=lambda p:True):
    P=load(fs); random.seed(theme+str(fs)); random.shuffle(P); out=[]
    for p in P:
        if len(out)>=k: break
        if p['id'] in used or theme not in p['themes'] or not extra(p): continue
        if ok(p,maxs): out.append(p); used.add(p['id'])
    return sorted(out,key=lambda p:p['rating'])
R=lambda a,b:[f'r{x}' for x in range(a,b+1,100)]
res={
 'mate1': pick(R(400,800),'mateIn1',12,1),
 'backrank': pick(R(500,1100),'backRankMate',6,2),
 'hanging': pick(R(400,800),'hangingPiece',6,1),
 'fork': pick(R(900,1300),'fork',6,2),
 'pin': pick(R(900,1300),'pin',6,2),
 'intermezzo': pick(R(1000,1400),'intermezzo',6,3),
}
eng.quit()
json.dump(res,open('chosen.json','w'),indent=1)
print({k:[(p['rating'],len(p['moves'])//2) for p in v] for k,v in res.items()})
