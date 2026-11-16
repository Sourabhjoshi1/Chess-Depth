"""ChessDepth 'Move of the Day' image generator.
Edit the DAY dict (or pass a JSON file) and run:  python3 motd.py [day.json]
The script checks every move is legal before drawing anything."""
import sys, json, re, datetime, html
import chess, chess.svg, cairosvg
from PIL import ImageFont

DAY = {
  "date": "2026-11-16",
  "fen": "6k1/1q4np/4pP2/p1p1Q1p1/P4nP1/2P3R1/1P5P/3r1RK1 b - - 0 1",
  "move": "Qg2+",            # the star move, in SAN
  "mark": "!",               # ! or !!
  "line": ["Rxg2", "Nh3+", "Kh1", "Rxf1+", "Rg1", "Rxg1#"],   # what follows (optional)
  "white": "Pricha Sinprayoon",
  "black": "Ghulam Dastgir Butt",
  "event": "Thessaloniki Olympiad 1984",
  "explain": "A queen sacrifice that forces mate. The knight on f4 guards g2, so White can only take with the rook, and that rook now blocks its own king. After Nh3+ the king must go to h1, and Black's rook finishes on g1.",
  "idea": "Lure a defender onto the king's escape square.",
}
if len(sys.argv) > 1: DAY.update(json.load(open(sys.argv[1])))

# ---------- chess: validate ----------
b = chess.Board(DAY["fen"])
side = "White" if b.turn == chess.WHITE else "Black"
star = b.parse_san(DAY["move"])
star_san = b.san(star); b.push(star)
line_san = []
for m in DAY.get("line", []):
    mv = b.parse_san(m); line_san.append(b.san(mv)); b.push(mv)
board0 = chess.Board(DAY["fen"])
dots = "" if board0.turn == chess.WHITE else "…"

# ---------- look ----------
NAVY1, NAVY2, INK = "#2b3366", "#121630", "#ffffff"
BRASS, BRASS2, SUB = "#b08a4e", "#d2ad6e", "#c9cde6"
W, H = 1080, 1350
GF = "/usr/share/fonts/truetype/google-fonts/"
INTER = "/usr/share/fonts/opentype/inter/Inter-Regular.otf"
def width(text, size, font=INTER):
    return ImageFont.truetype(font, size).getlength(text)
def wrap(text, size, maxw, font=INTER):
    out, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if width(t, size, font) <= maxw: cur = t
        else: out.append(cur); cur = w
    if cur: out.append(cur)
    return out
esc = lambda s: html.escape(s, quote=False)

# board
sq = chess.parse_square
star_from, star_to = star.from_square, star.to_square
bsvg = chess.svg.board(board0, orientation=board0.turn, size=580, coordinates=True,
    arrows=[chess.svg.Arrow(star_from, star_to, color=BRASS2 + "dd")],
    fill={star_from: BRASS2 + "66", star_to: BRASS2 + "88"},
    colors={"square light": "#ece6d6", "square dark": "#7884b8", "margin": "#1a1f40", "coord": "#c9cde6",
            "square light lastmove": "#ece6d6", "square dark lastmove": "#7884b8"})
bsvg = re.sub(r'^<\?xml[^>]*>\s*', '', bsvg)
BS, BX, BY = 580, (W - 580) // 2, 318
bsvg = f'<g transform="translate({BX},{BY})">' + bsvg + '</g>'

# chequer background
S = 135; tiles = ""
for r in range(11):
    for c in range(8):
        if (r + c) % 2 == 0: tiles += f'<rect x="{c*S}" y="{r*S}" width="{S}" height="{S}" fill="#fff" opacity=".03"/>'

d = datetime.date.fromisoformat(DAY["date"])
if DAY.get("white") and DAY.get("black"):
    sub_line = "  ·  ".join(x for x in [DAY.get("event",""), side + " to move"] if x)
    players_svg = (f'<text x="{W/2}" y="246" text-anchor="middle" font-family="Poppins" font-size="25" fill="{INK}">{esc(DAY["white"])}  –  {esc(DAY["black"])}</text>'
                   f'<text x="{W/2}" y="284" text-anchor="middle" font-family="Poppins" font-size="21" fill="{SUB}">{esc(sub_line)}</text>')
else:
    players_svg = f'<text x="{W/2}" y="262" text-anchor="middle" font-family="Poppins" font-weight="500" font-size="28" fill="{INK}">{side} to move</text>' 
datestr = d.strftime("%A, %-d %B %Y")
ROOK = "M8 5h3v3h2.5V5h5v3H21V5h3v7.2l-2.4 1.8.9 9H9.5l.9-9L8 12.2zM8.5 24.5h15l1.5 2.5H7zM6 28h20v2.5H6z"

# numbered from 1, as in puzzle books: 1...Qg2+! 2.Rxg2 Nh3+ 3.Kh1 ...
n, white_to_move, parts = 1, board0.turn == chess.WHITE, []
big = f"1.{star_san}{DAY['mark']}" if white_to_move else f"1…{star_san}{DAY['mark']}"
wtm = not white_to_move
if not white_to_move: n = 2
for m in line_san:
    parts.append(f"{n}.{m}" if wtm else m)
    if not wtm: n += 1
    wtm = not wtm
line_txt = DAY.get("line_display") or " ".join(parts)
ex_lines = wrap(DAY["explain"], 25, W - 200)

y_ex = BY + BS + 176
ex_svg = "".join(f'<text x="80" y="{y_ex + i*37}" font-family="Inter" font-size="25" fill="{SUB}">{esc(t)}</text>' for i, t in enumerate(ex_lines))
y_idea = y_ex + len(ex_lines) * 37 + 16

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs><radialGradient id="g" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="{NAVY1}"/><stop offset="1" stop-color="{NAVY2}"/></radialGradient></defs>
<rect width="{W}" height="{H}" fill="url(#g)"/>{tiles}
<rect x="24" y="24" width="{W-48}" height="{H-48}" fill="none" stroke="{BRASS}" stroke-width="2" opacity=".6"/>

<g transform="translate(70,58)"><g transform="scale(1.55)" fill="{INK}"><path d="{ROOK}"/></g>
<text x="62" y="40" font-family="EB Garamond SemiBold" font-size="50" fill="{INK}">ChessDepth</text>
<text x="63" y="70" font-family="EB Garamond" font-style="italic" font-size="24" fill="{BRASS2}">Think Deep. Play Deeper!</text></g>
<text x="{W-70}" y="88" text-anchor="end" font-family="Poppins" font-weight="500" font-size="22" fill="{SUB}">{esc(datestr)}</text>

<text x="{W/2}" y="196" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="26" letter-spacing="9" fill="{BRASS2}">MOVE OF THE DAY</text>
{players_svg}

<rect x="{BX-8}" y="{BY-8}" width="{BS+16}" height="{BS+16}" rx="10" fill="#0e1228" stroke="{BRASS}" stroke-width="2"/>
{bsvg}

<text x="80" y="{BY+BS+82}" font-family="EB Garamond SemiBold" font-size="74" fill="{INK}">{esc(big)}</text>
<text x="82" y="{BY+BS+126}" font-family="Inter" font-weight="600" font-size="26" fill="{BRASS2}">{esc(line_txt)}</text>
{ex_svg}
<text x="80" y="{y_idea}" font-family="Inter" font-size="24" fill="{INK}"><tspan font-weight="600" fill="{BRASS2}">Idea: </tspan>{esc(DAY["idea"])}</text>

<line x1="80" y1="{H-104}" x2="{W-80}" y2="{H-104}" stroke="{BRASS}" stroke-width="1" opacity=".5"/>
<text x="80" y="{H-62}" font-family="Poppins" font-weight="600" font-size="24" fill="{INK}">www.chessdepth.in</text>
<text x="{W-80}" y="{H-62}" text-anchor="end" font-family="Poppins" font-size="22" fill="{SUB}">Train tactics in the Chess Lab</text>
</svg>'''
out = f"ChessDepth-Move-of-the-Day-{DAY['date']}.png"
cairosvg.svg2png(bytestring=svg.encode(), write_to=out, output_width=W, output_height=H)
print(out, "|", big, line_txt, "|", len(ex_lines), "explanation lines")
