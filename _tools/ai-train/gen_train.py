# Training crops for ChessDepth AI: boards in many piece styles (book diagrams, photographed pages, screen boards with
# highlights and coordinates), cropped exactly like the site: board box (with jitter) -> 256x256 area average -> 32x32 per square.
# Usage: python3 gen_train.py OUT.npz N SEED
import sys, io, os, json, glob, random
import numpy as np, chess, cairosvg
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont
sys.argv_ = sys.argv
OUT, N, SEED = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
random.seed(SEED); np.random.seed(SEED)
LILA = '/home/claude/ai/dl/lila/public/piece/'
HELD = {'celtic', 'riohacha', 'fantasy', 'reillycraig', 'mpchess', 'chessnut'}   # never trained on: used for the honest test
SKIP = {'disguised', 'letter', 'mono', 'monarchy'}
SETS = sorted(s for s in __import__('os').listdir(LILA) if s not in HELD | SKIP)
BOOKY = ['alpha', 'merida', 'leipzig', 'cburnett', 'kosal', 'maestro', 'companion', 'chess7', 'governor', 'fresca', 'cardinal', 'pirouetti', 'staunty', 'tatiana', 'california', 'gioco', 'icpieces', 'dubrovny', 'cooke', 'kiwen-suwi', 'anarcandy', 'caliente', 'rhosgfx', 'shahi-ivory-brown', 'firi', 'spatial', 'chessboart']
BOOKY = [s for s in BOOKY if s in SETS]
import os
if os.environ.get('HELDONLY'): SETS = BOOKY = sorted(HELD)
CL = '.PNBRQKpnbrqk'
_cache = {}
def piece(setname, sym, px):
    k = (setname, sym, px)
    if k not in _cache:
        if len(_cache) > 4000: _cache.clear()
        f = LILA + setname + '/' + ('w' if sym.isupper() else 'b') + sym.upper() + '.svg'
        _cache[k] = Image.open(io.BytesIO(cairosvg.svg2png(url=f, output_width=px, output_height=px))).convert('RGBA')
    return _cache[k]

test_boards = set()
for d in ['/home/claude/ai/btest', '/home/claude/ai/stest']:
    test_boards |= {c['board'] for c in json.load(open(d + '/cases.json'))}
POS = []
for f in glob.glob('/home/claude/site/repo/assets/lab/puzzles/shards/r*.json'):
    POS += [p[1] for p in json.load(open(f))['puzzles']]
random.shuffle(POS)
def board_str(fen): return ''.join(('.' if p is None else p.symbol()) for p in (chess.Board(fen).piece_at(chess.square(c, 7 - r)) for r in range(8) for c in range(8)))

def ink(im):
    g, a = im.convert('L'), im.split()[3]; cut = random.randint(100, 160)
    bw = g.point(lambda v: 255 if v > cut else 0).filter(ImageFilter.GaussianBlur(0.4))
    return Image.merge('RGBA', (bw, bw, bw, a.point(lambda v: 255 if v > 110 else 0).filter(ImageFilter.GaussianBlur(0.3))))

def book_board(b, S, pset):
    sq = S / 8; img = Image.new('RGB', (S, S), (255, 255, 255)); d = ImageDraw.Draw(img); mode = random.random()
    grey = random.randint(140, 220); dst = random.choice([2, 3, 3, 4, 5]); drad = random.choice([0, 1]) if dst > 3 else 0; dcol = (random.randint(20, 110),) * 3
    step = max(2, int(sq / random.uniform(4, 11))); lw = max(1, int(sq / random.uniform(20, 45))); ang = random.choice([1, -1])
    for r in range(8):
        for c in range(8):
            if (r + c) % 2 == 0: continue
            x0, y0, x1, y1 = round(c * sq), round(r * sq), round((c + 1) * sq), round((r + 1) * sq)
            tile = Image.new('RGB', (x1 - x0, y1 - y0), (255, 255, 255)); td = ImageDraw.Draw(tile)
            if mode < 0.45:
                for k in range(-int(sq), int(sq) * 2, step):
                    if ang > 0: td.line([(k, y1 - y0), (k + sq, 0)], fill=(40, 40, 40), width=lw)
                    else: td.line([(k, 0), (k + sq, y1 - y0)], fill=(40, 40, 40), width=lw)
            elif mode < 0.75: td.rectangle([0, 0, x1 - x0, y1 - y0], fill=(grey,) * 3)
            else:
                for yy in range(0, y1 - y0, dst):
                    for xx in range((yy // dst) % 2 * (dst // 2), x1 - x0, dst):
                        if drad: td.rectangle([xx, yy, xx + drad, yy + drad], fill=dcol)
                        else: td.point((xx, yy), fill=dcol)
            img.paste(tile, (x0, y0))
    if random.random() < 0.7: d.rectangle([0, 0, S - 1, S - 1], outline=(0, 0, 0), width=max(1, int(sq / 20)))
    img = img.convert('RGBA'); scale = random.uniform(0.75, 0.97); inked = random.random() < 0.75
    for i, p in enumerate(b):
        if p == '.': continue
        r, c = divmod(i, 8); ps = max(4, int(sq * scale)); pim = piece(pset, p, ps); pim = ink(pim) if inked else pim
        img.alpha_composite(pim, (int(c * sq + (sq - ps) / 2), int(r * sq + (sq - ps) / 2)))
    return img.convert('RGB')

def photo(img):
    w, h = img.size
    img = ImageChops.multiply(img, Image.new('RGB', img.size, random.choice([(250, 246, 235), (245, 240, 225), (240, 240, 240), (235, 228, 210), (225, 220, 200)])))
    g = np.linspace(random.uniform(0.6, 1.0), random.uniform(0.85, 1.1), w if random.random() < .5 else h)
    a = np.asarray(img, np.float32); a = a * (g[None, :, None] if len(g) == w else g[:, None, None])
    a += np.random.normal(0, random.uniform(2, 12), a.shape)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    if random.random() < 0.7: img = img.filter(ImageFilter.GaussianBlur(random.uniform(0.3, 1.3)))
    if random.random() < 0.4:
        bio = io.BytesIO(); img.save(bio, 'JPEG', quality=random.randint(35, 85)); img = Image.open(bio).convert('RGB')
    return img

def rcol(): return tuple(random.randint(0, 255) for _ in range(3))
PAL = [((240, 217, 181), (181, 136, 99)), ((222, 227, 230), (140, 162, 173)), ((238, 238, 210), (118, 150, 86)), ((234, 233, 210), (75, 115, 153)),
       ((240, 241, 240), (196, 216, 228)), ((232, 235, 239), (125, 135, 150)), ((245, 222, 179), (210, 140, 70)), ((235, 209, 166), (165, 117, 81))]
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
TD = '/home/claude/ai/dl/lila/public/images/board/'
TEXTURES = [TD + f for f in sorted(os.listdir(TD)) if f.endswith(('.jpg', '.png')) and '.thumbnail' not in f and '.orig' not in f and not f.startswith('horsey.') and 'svg' not in f]
_tex = {}
def texture(f):
    if f not in _tex: _tex[f] = Image.open(f).convert('RGB')
    return _tex[f]
TEXP = float(os.environ.get('TEXP', '0'))
def screen_board(b, S, pset):
    sq = S / 8
    if random.random() < 0.6: lt, dk = random.choice(PAL)
    else:
        lt = tuple(random.randint(170, 255) for _ in range(3)); dk = tuple(max(0, v - random.randint(40, 130)) for v in lt)
    if random.random() < TEXP:
        img = texture(random.choice(TEXTURES)).resize((S, S), Image.BILINEAR)
        a = np.asarray(img, np.float32); lt = tuple(int(v) for v in a[:int(sq), :int(sq)].reshape(-1, 3).mean(0)); dk = tuple(int(v) for v in a[:int(sq), int(sq):int(2 * sq)].reshape(-1, 3).mean(0))
        d = ImageDraw.Draw(img)
    else:
        img = Image.new('RGB', (S, S), lt); d = ImageDraw.Draw(img)
        for r in range(8):
            for c in range(8):
                if (r + c) % 2: d.rectangle([round(c * sq), round(r * sq), round((c + 1) * sq) - 1, round((r + 1) * sq) - 1], fill=dk)
    if random.random() < 0.6:   # last-move / selection highlights
        hc = random.choice([(205, 210, 106), (247, 247, 105), (170, 162, 58), (155, 199, 0), (100, 150, 220), (235, 97, 80)])
        for _ in range(random.choice([1, 2, 2, 3])):
            r, c = random.randrange(8), random.randrange(8); base = lt if (r + c) % 2 == 0 else dk; al = random.uniform(0.4, 0.8)
            col = tuple(int(base[k] * (1 - al) + hc[k] * al) for k in range(3))
            d.rectangle([round(c * sq), round(r * sq), round((c + 1) * sq) - 1, round((r + 1) * sq) - 1], fill=col)
    if random.random() < 0.5:   # coordinates inside the edge squares
        f = ImageFont.truetype(FONT, max(6, int(sq * random.uniform(0.15, 0.24))))
        for c in range(8): d.text((round((c + 1) * sq) - 2, S - 2), 'abcdefgh'[c], font=f, anchor='rd', fill=lt if c % 2 == 0 else dk)
        for r in range(8): d.text((2, round(r * sq) + 1), str(8 - r), font=f, anchor='lt', fill=dk if r % 2 == 0 else lt)
    img = img.convert('RGBA'); scale = random.uniform(0.85, 1.0)
    for i, p in enumerate(b):
        if p == '.': continue
        r, c = divmod(i, 8); ps = int(sq * scale); img.alpha_composite(piece(pset, p, ps), (int(c * sq + (sq - ps) / 2), int(r * sq + (sq - ps) / 2)))
    img = img.convert('RGB')
    if random.random() < 0.25:
        bio = io.BytesIO(); img.save(bio, 'JPEG', quality=random.randint(40, 90)); img = Image.open(bio).convert('RGB')
    return img

def crops(page, x, y, S, flip):
    sq = S / 8; j = random.uniform(-0.07, 0.07) * sq; k = random.uniform(-0.07, 0.07) * sq; s = S * random.uniform(0.97, 1.03)
    m = int(S * 0.15) + 2; pg = Image.new('RGB', (page.width + 2 * m, page.height + 2 * m), (136, 136, 136)); pg.paste(page, (m, m)); page = pg
    bx, by = m + x + j - (s - S) / 2, m + y + k - (s - S) / 2
    big = page.resize((512, 512), Image.BILINEAR if random.random() < .3 else Image.BOX, box=(bx, by, bx + s, by + s)).convert('L')
    a = np.asarray(big.resize((256, 256), Image.BOX), np.uint8)
    out = a.reshape(8, 32, 8, 32).transpose(0, 2, 1, 3).reshape(64, 32, 32)
    return out

X, Y = [], []
k = 0; made = 0
while made < N:
    fen = POS[(SEED * 7919 + k) % len(POS)]; k += 1
    b = board_str(fen)
    if b in test_boards: continue
    if random.random() < 0.3:   # thin the board out a bit: more empty-square variety, fewer full middlegames
        b = ''.join(p if (p in 'Kk' or random.random() < 0.85) else '.' for p in b)
    flip = random.random() < 0.25
    if flip: b = b[::-1]
    S = 8 * random.randint(22, 80); kind = random.random()
    if kind < 0.5:
        pset = random.choice(BOOKY if random.random() < 0.7 else SETS); img = book_board(b, S, pset)
        pad = random.randint(4, 60); page = Image.new('RGB', (S + 2 * pad, S + 2 * pad), (255, 255, 255)); page.paste(img, (pad, pad))
        if random.random() < 0.55: page = photo(page)
        x = y = pad
    else:
        pset = random.choice(SETS); img = screen_board(b, S, pset)
        pad = random.randint(0, 40); page = Image.new('RGB', (S + 2 * pad, S + 2 * pad), rcol()); page.paste(img, (pad, pad)); x = y = pad
    X.append(crops(page, x, y, S, flip)); Y.append(np.array([CL.index(p) for p in b], np.uint8)); made += 1
X = np.concatenate(X); Y = np.concatenate(Y)
np.savez_compressed(OUT, X=X, Y=Y)
print(OUT, X.shape, np.bincount(Y, minlength=13))
