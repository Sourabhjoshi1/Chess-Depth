# Kaggle "Chess Positions"-style boards, rebuilt from koryakinp/chess-generator's own assets
# (28 boards x 32 piece sets, 400x400, 50 px pieces, 5-15 pieces incl. both kings, JPEG).
# test:  python3 kag.py test OUT N SEED   -> OUT/kNNNN.jpg + cases.json (bench format)
# train: python3 kag.py train OUT.npz N SEED -> 32x32 square crops, same cropping as gen_train.py
import sys, os, io, json, random
import numpy as np
from PIL import Image
A = '/home/claude/koryakinp/chess-generator/ChessGenerator/'
BOARDS = sorted(os.listdir(A + 'boards')); PSETS = sorted(os.listdir(A + 'pieces'), key=int)
mode, OUT, N, SEED = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
random.seed(SEED); np.random.seed(SEED)
_c = {}
def img(path):
    if path not in _c: _c[path] = Image.open(A + path).convert('RGBA')
    return _c[path]
def position():
    n = random.randint(5, 15); b = ['.'] * 64
    for k in 'Kk':
        while True:
            i = random.randrange(64)
            if b[i] == '.': b[i] = k; break
    for _ in range(n - 2):
        r = random.random()
        t = 'P' if r < .3 else 'B' if r < .5 else 'N' if r < .7 else 'R' if r < .9 else 'Q'
        if random.random() < .5: t = t.lower()
        while True:
            i = random.randrange(64)
            if b[i] != '.': continue
            if t in 'Pp' and i // 8 in (0, 7): continue
            b[i] = t; break
    return ''.join(b)
def render(b):
    bd = img('boards/' + random.choice(BOARDS)).copy(); ps = random.choice(PSETS)
    for i, p in enumerate(b):
        if p == '.': continue
        r, c = divmod(i, 8); bd.alpha_composite(img(f'pieces/{ps}/{p.lower()}_{"w" if p.isupper() else "b"}.png'), (c * 50, r * 50))
    bio = io.BytesIO(); bd.convert('RGB').save(bio, 'JPEG', quality=random.choice([75, 75, 60, 90])); return Image.open(io.BytesIO(bio.getvalue())).convert('RGB'), ps

if mode == 'test':
    os.makedirs(OUT, exist_ok=True); cases = []
    for k in range(N):
        b = position(); im, ps = render(b); name = f'k{k:04d}.jpg'; im.save(OUT + '/' + name, quality=95)
        cases.append({'img': name, 'x': 0, 'y': 0, 'size': 400, 'board': b, 'set': 'kaggle-' + ps})
    json.dump(cases, open(OUT + '/cases.json', 'w')); print(OUT, len(cases))
else:
    def crops(page, x, y, S):
        sq = S / 8; j = random.uniform(-0.07, 0.07) * sq; k = random.uniform(-0.07, 0.07) * sq; s = S * random.uniform(0.97, 1.03)
        m = int(S * 0.15) + 2; pg = Image.new('RGB', (page.width + 2 * m, page.height + 2 * m), (136, 136, 136)); pg.paste(page, (m, m)); page = pg
        bx, by = m + x + j - (s - S) / 2, m + y + k - (s - S) / 2
        big = page.resize((512, 512), Image.BILINEAR if random.random() < .3 else Image.BOX, box=(bx, by, bx + s, by + s)).convert('L')
        a = np.asarray(big.resize((256, 256), Image.BOX), np.uint8)
        return a.reshape(8, 32, 8, 32).transpose(0, 2, 1, 3).reshape(64, 32, 32)
    CL = '.PNBRQKpnbrqk'; X, Y = [], []
    for _ in range(N):
        b = position(); im, _ = render(b)
        S = random.choice([400, 400, random.randint(180, 400)])
        if S != 400: im = im.resize((S, S), Image.BILINEAR)
        pad = random.choice([0, 0, random.randint(2, 40)]); page = Image.new('RGB', (S + 2 * pad, S + 2 * pad), tuple(random.randint(0, 255) for _ in range(3))); page.paste(im, (pad, pad))
        X.append(crops(page, pad, pad, S)); Y.append(np.array([CL.index(p) for p in b], np.uint8))
    X = np.concatenate(X); Y = np.concatenate(Y); np.savez_compressed(OUT, X=X, Y=Y); print(OUT, X.shape, np.bincount(Y, minlength=13))
