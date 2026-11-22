# Test images for ChessDepth AI: real puzzle positions drawn as (a) printed book diagrams, some photographed,
# and (b) flat screen-style boards. Writes OUT/<name>.png and OUT/cases.json [{img, x, y, size, board, set}].
# Usage: python3 gen_test.py book|screen OUT N SEED
import sys, os, io, json, glob, random
import numpy as np, chess, cairosvg
from PIL import Image, ImageDraw, ImageFilter, ImageChops

kind, OUT, N, SEED = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
random.seed(SEED); np.random.seed(SEED); os.makedirs(OUT, exist_ok=True)
LILA = '/home/claude/ai/dl/lila/public/piece/'
BOOK_SETS = ['celtic', 'riohacha', 'fantasy', 'reillycraig', 'mpchess', 'chessnut']
SCREEN_SETS = ['celtic', 'riohacha', 'fantasy', 'reillycraig', 'mpchess', 'chessnut']
_cache = {}
def piece(setname, sym, px):
    k = (setname, sym, px)
    if k not in _cache:
        f = LILA + setname + '/' + ('w' if sym.isupper() else 'b') + sym.upper() + '.svg'
        _cache[k] = Image.open(io.BytesIO(cairosvg.svg2png(url=f, output_width=px, output_height=px))).convert('RGBA')
    return _cache[k]

POS = []
for f in glob.glob('/home/claude/site/repo/assets/lab/puzzles/shards/r*.json'):
    POS += [p[1] for p in json.load(open(f))['puzzles']]
random.shuffle(POS)

def board_str(fen): return ''.join(('.' if p is None else p.symbol()) for p in (chess.Board(fen).piece_at(chess.square(c, 7 - r)) for r in range(8) for c in range(8)))

def ink(im):
    g, a = im.convert('L'), im.split()[3]
    cut = random.randint(100, 160)
    bw = g.point(lambda v: 255 if v > cut else 0).filter(ImageFilter.GaussianBlur(0.4))
    return Image.merge('RGBA', (bw, bw, bw, a.point(lambda v: 255 if v > 110 else 0).filter(ImageFilter.GaussianBlur(0.3))))

def book_board(b, S, pset):
    sq = S / 8; img = Image.new('RGB', (S, S), (255, 255, 255)); d = ImageDraw.Draw(img); mode = random.random()
    grey = random.randint(150, 215); dst = random.choice([3, 3, 4, 5]); drad = random.choice([0, 1]) if dst > 3 else 0; dcol = (random.randint(20, 90),) * 3
    step = max(2, int(sq / random.uniform(5, 10))); lw = max(1, int(sq / random.uniform(22, 40)))
    for r in range(8):
        for c in range(8):
            if (r + c) % 2 == 0: continue
            x0, y0, x1, y1 = round(c * sq), round(r * sq), round((c + 1) * sq), round((r + 1) * sq)
            tile = Image.new('RGB', (x1 - x0, y1 - y0), (255, 255, 255)); td = ImageDraw.Draw(tile)
            if mode < 0.5:
                for k in range(-int(sq), int(sq) * 2, step): td.line([(k, y1 - y0), (k + sq, 0)], fill=(40, 40, 40), width=lw)
            elif mode < 0.8:
                td.rectangle([0, 0, x1 - x0, y1 - y0], fill=(grey,) * 3)
            else:
                for yy in range(0, y1 - y0, dst):
                    for xx in range((yy // dst) % 2 * (dst // 2), x1 - x0, dst):
                        if drad: td.rectangle([xx, yy, xx + drad, yy + drad], fill=dcol)
                        else: td.point((xx, yy), fill=dcol)
            img.paste(tile, (x0, y0))
    if random.random() < 0.7: d.rectangle([0, 0, S - 1, S - 1], outline=(0, 0, 0), width=max(1, int(sq / 20)))
    img = img.convert('RGBA'); scale = random.uniform(0.78, 0.95)
    for i, p in enumerate(b):
        if p == '.': continue
        r, c = divmod(i, 8); ps = max(4, int(sq * scale)); pim = ink(piece(pset, p, ps))
        img.alpha_composite(pim, (int(c * sq + (sq - ps) / 2), int(r * sq + (sq - ps) / 2)))
    return img.convert('RGB')

def photo(img):
    w, h = img.size
    img = ImageChops.multiply(img, Image.new('RGB', img.size, random.choice([(250, 246, 235), (245, 240, 225), (240, 240, 240), (235, 228, 210)])))
    g = np.linspace(random.uniform(0.7, 1.0), random.uniform(0.9, 1.1), w if random.random() < .5 else h)
    a = np.asarray(img, np.float32); a = a * (g[None, :, None] if len(g) == w else g[:, None, None])
    a += np.random.normal(0, random.uniform(2, 9), a.shape)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    if random.random() < 0.6: img = img.filter(ImageFilter.GaussianBlur(random.uniform(0.3, 1.0)))
    return img

PALETTES = [((240, 217, 181), (181, 136, 99)), ((222, 227, 230), (140, 162, 173)), ((238, 238, 210), (118, 150, 86)), ((234, 233, 210), (75, 115, 153)),
            ((240, 241, 240), (196, 216, 228)), ((232, 235, 239), (125, 135, 150)), ((245, 222, 179), (210, 140, 70)), ((235, 209, 166), (165, 117, 81))]
def screen_board(b, S, pset):
    sq = S / 8; lt, dk = random.choice(PALETTES); img = Image.new('RGB', (S, S), lt); d = ImageDraw.Draw(img)
    for r in range(8):
        for c in range(8):
            if (r + c) % 2: d.rectangle([round(c * sq), round(r * sq), round((c + 1) * sq) - 1, round((r + 1) * sq) - 1], fill=dk)
    img = img.convert('RGBA')
    for i, p in enumerate(b):
        if p == '.': continue
        r, c = divmod(i, 8); ps = int(sq); img.alpha_composite(piece(pset, p, ps), (int(c * sq), int(r * sq)))
    return img.convert('RGB')

cases = []
for k in range(N):
    b = board_str(POS[k]); S = 8 * random.randint(28, 70)
    if kind == 'book':
        pset = BOOK_SETS[k % len(BOOK_SETS)]; img = book_board(b, S, pset)
        W, H = S + random.randint(40, 300), S + random.randint(60, 320); x, y = random.randint(10, W - S - 10), random.randint(10, H - S - 10)
        page = Image.new('RGB', (W, H), (255, 255, 255)); page.paste(img, (x, y))
        dd = ImageDraw.Draw(page)   # a line of "text" under the diagram, as in a book
        if y + S + 30 < H: dd.rectangle([x, y + S + 14, x + int(S * random.uniform(.4, .9)), y + S + 22], fill=(60, 60, 60))
        if k % 2: page = photo(page)
    else:
        pset = SCREEN_SETS[k % len(SCREEN_SETS)]; img = screen_board(b, S, pset)
        W, H = S + random.randint(0, 400), S + random.randint(0, 200); x, y = random.randint(0, W - S), random.randint(0, H - S)
        page = Image.new('RGB', (W, H), random.choice([(255, 255, 255), (40, 40, 40), (22, 21, 18), (245, 245, 245)])); page.paste(img, (x, y))
    n = f'{kind[0]}{k:02d}.png'; page.save(f'{OUT}/{n}')
    cases.append(dict(img=n, x=x, y=y, size=S, board=b, set=pset))
json.dump(cases, open(f'{OUT}/cases.json', 'w'))
print(kind, len(cases))
