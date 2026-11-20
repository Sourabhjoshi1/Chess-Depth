# ChessDepth Academy certificates (landscape A4). Usage: python3 certificate.py data.json
# data.json: {"student": "...", "certs": [{"kind": "completion"|"association", "title", "line1", "line2", "line3",
#             "detail": [[label, value], ...], "no": "...", "date": "...", "out": "file.pdf"}]}
import sys, json
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

G = '/usr/share/fonts/truetype/google-fonts/'
for n, f in [('Pop', 'Poppins-Regular.ttf'), ('PopM', 'Poppins-Medium.ttf'), ('PopB', 'Poppins-Bold.ttf')]: pdfmetrics.registerFont(TTFont(n, G + f))
pdfmetrics.registerFont(TTFont('Gar', '/root/.fonts/EBGaramond-600.ttf')); pdfmetrics.registerFont(TTFont('GarI', '/root/.fonts/EBGaramond-400i.ttf'))
INK = colors.HexColor('#1f2547'); BRASS = colors.HexColor('#b08a4e'); GOLD = colors.HexColor('#d2ad6e'); MUTE = colors.HexColor('#6b7088'); CREAM = colors.HexColor('#fbf8f1')
W, H = landscape(A4)

def rook(c, x, y, s, col):
    c.saveState(); c.translate(x, y + 32 * s); c.scale(s, -s); c.setFillColor(col); p = c.beginPath()
    for poly in ([(8,5),(11,5),(11,8),(13.5,8),(13.5,5),(18.5,5),(18.5,8),(21,8),(21,5),(24,5),(24,12.2),(21.6,14),(22.5,23),(9.5,23),(10.4,14),(8,12.2)],[(8.5,24.5),(23.5,24.5),(25,27),(7,27)],[(6,28),(26,28),(26,30.5),(6,30.5)]):
        p.moveTo(*poly[0]); [p.lineTo(*q) for q in poly[1:]]; p.close()
    c.drawPath(p, fill=1, stroke=0); c.restoreState()

def checker_corner(c, x, y, n, sq, flipx=1, flipy=1):
    for r in range(n):
        for k in range(n - r):
            if (r + k) % 2 == 0:
                c.rect(x + flipx * k * sq - (sq if flipx < 0 else 0), y + flipy * r * sq - (sq if flipy < 0 else 0), sq, sq, fill=1, stroke=0)

def cert(c, d, student):
    c.setFillColor(CREAM); c.rect(0, 0, W, H, fill=1, stroke=0)
    # frame
    c.setStrokeColor(INK); c.setLineWidth(3); c.rect(10 * mm, 10 * mm, W - 20 * mm, H - 20 * mm)
    c.setStrokeColor(BRASS); c.setLineWidth(0.9); c.rect(13.5 * mm, 13.5 * mm, W - 27 * mm, H - 27 * mm)
    c.setFillColor(colors.HexColor('#e9dfc8'))
    sq = 4.2 * mm
    checker_corner(c, 13.5 * mm, 13.5 * mm, 5, sq, 1, 1); checker_corner(c, W - 13.5 * mm, 13.5 * mm, 5, sq, -1, 1)
    checker_corner(c, 13.5 * mm, H - 13.5 * mm, 5, sq, 1, -1); checker_corner(c, W - 13.5 * mm, H - 13.5 * mm, 5, sq, -1, -1)
    # brand
    cx = W / 2
    rook(c, cx - 13, H - 40 * mm, 0.85, INK)
    c.setFillColor(INK); c.setFont('Gar', 26); c.drawCentredString(cx, H - 49 * mm, 'ChessDepth Academy')
    c.setFillColor(BRASS); c.setFont('GarI', 12); c.drawCentredString(cx, H - 55 * mm, 'Think Deep. Play Deeper!')
    # title
    c.setFillColor(BRASS); c.setFont('PopB', 10); c.drawCentredString(cx, H - 68 * mm, ' '.join(d['kicker'].upper()))
    c.setFillColor(INK); c.setFont('Gar', 34); c.drawCentredString(cx, H - 82 * mm, d['title'])
    c.setFillColor(MUTE); c.setFont('Pop', 11); c.drawCentredString(cx, H - 93 * mm, 'This is to certify that')
    c.setFillColor(INK); c.setFont('GarI', 38); c.drawCentredString(cx, H - 109 * mm, student)
    c.setStrokeColor(GOLD); c.setLineWidth(1); c.line(cx - 75 * mm, H - 113 * mm, cx + 75 * mm, H - 113 * mm)
    c.setFillColor(colors.HexColor('#2b2f45'))
    y = H - 123 * mm
    for ln in d['lines']:
        c.setFont('Pop', 11.2); c.drawCentredString(cx, y, ln); y -= 6.6 * mm
    # detail chips
    y -= 2 * mm
    items = d.get('detail', [])
    if items:
        widths = [max(pdfmetrics.stringWidth(v, 'PopB', 10), pdfmetrics.stringWidth(l, 'Pop', 7.6)) + 12 * mm for l, v in items]
        total = sum(widths) + 4 * mm * (len(items) - 1); x = cx - total / 2
        for (l, v), w in zip(items, widths):
            c.setFillColor(colors.white); c.setStrokeColor(colors.HexColor('#e2d6bd')); c.roundRect(x, y - 9 * mm, w, 12 * mm, 2.5 * mm, fill=1, stroke=1)
            c.setFillColor(MUTE); c.setFont('Pop', 7.6); c.drawCentredString(x + w / 2, y - 0.6 * mm, l.upper())
            c.setFillColor(INK); c.setFont('PopB', 10); c.drawCentredString(x + w / 2, y - 6 * mm, v)
            x += w + 4 * mm
    # signature and date
    by = 30 * mm
    c.setStrokeColor(INK); c.setLineWidth(0.7)
    c.line(40 * mm, by + 8 * mm, 105 * mm, by + 8 * mm); c.line(W - 105 * mm, by + 8 * mm, W - 40 * mm, by + 8 * mm)
    c.setFillColor(INK); c.setFont('GarI', 18); c.drawCentredString(72.5 * mm, by + 10 * mm, 'Sourabh Joshi')
    c.setFont('PopB', 9.5); c.drawCentredString(72.5 * mm, by + 3 * mm, 'Sourabh Joshi')
    c.setFillColor(MUTE); c.setFont('Pop', 8); c.drawCentredString(72.5 * mm, by - 1.5 * mm, 'Founder and Head Coach, ChessDepth Academy')
    c.setFillColor(INK); c.setFont('PopB', 10); c.drawCentredString(W - 72.5 * mm, by + 10 * mm, d['date'])
    c.setFont('PopB', 9.5); c.drawCentredString(W - 72.5 * mm, by + 3 * mm, 'Date of issue')
    c.setFillColor(MUTE); c.setFont('Pop', 8); c.drawCentredString(W - 72.5 * mm, by - 1.5 * mm, 'Certificate No. ' + d['no'])
    # seal
    sx, sy, r = cx, by + 6 * mm, 15 * mm
    c.setFillColor(INK); c.circle(sx, sy, r, fill=1, stroke=0)
    c.setStrokeColor(GOLD); c.setLineWidth(1.2); c.circle(sx, sy, r - 2 * mm, fill=0, stroke=1)
    rook(c, sx - 8.5, sy - 4 * mm, 0.53, GOLD)
    c.setFillColor(GOLD); c.setFont('PopB', 5.6); c.drawCentredString(sx, sy - 9.2 * mm, 'CHESSDEPTH')
    c.setFillColor(MUTE); c.setFont('Pop', 7.2); c.drawCentredString(cx, 15.5 * mm, 'www.chessdepth.in  |  Verify this certificate on WhatsApp +91 98230 29262')

if __name__ == '__main__':
    D = json.load(open(sys.argv[1]))
    for d in D['certs']:
        c = canvas.Canvas(d['out'], pagesize=(W, H)); c.setTitle(d['title'] + ' - ' + D['student']); c.setAuthor('ChessDepth Academy')
        cert(c, d, D['student']); c.showPage(); c.save(); print(d['out'])
