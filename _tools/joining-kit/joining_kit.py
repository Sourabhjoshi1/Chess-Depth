# ChessDepth Academy: personalised Student Joining Kit (6-page A4 PDF).
# Usage: python3 joining_kit.py student.json   (see example.json)
# base.pdf is the full kit with the cover's "Your details" values left blank;
# this script writes the student's details onto the cover in the same font, size and colour.
import sys, json, io, os
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(sys.argv[1]))
pdfmetrics.registerFont(TTFont('PB', '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf'))
INK = (0.121569, 0.145098, 0.278431)
X, MAXW = 215.4331, 290          # value column start and width on the cover card
ROWS = [(258.4528, 'student'), (231.8071, 'no'), (205.1614, 'level'), (178.5157, 'format'), (151.8701, 'coach'), (124.7244 + 0.5, 'class_time')]

fmt = S.get('format') or ('Group: ' + S['batch'] if S.get('batch') else 'One-to-one')
vals = dict(S, format=fmt)
buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(595.2756, 841.8898))
c.setFillColorRGB(*INK)
for y, k in ROWS:
    t = vals.get(k, '')
    if not t: continue
    size = 10.5
    while pdfmetrics.stringWidth(t, 'PB', size) > MAXW and size > 8: size -= 0.25
    c.setFont('PB', size); c.drawString(X, y, t)
c.save()

w = PdfWriter(clone_from=PdfReader(os.path.join(HERE, 'base.pdf')))
w.pages[0].merge_page(PdfReader(io.BytesIO(buf.getvalue())).pages[0])
w.add_metadata({'/Title': 'ChessDepth Academy: Student Joining Kit', '/Author': 'ChessDepth Academy'})
out = S.get('out') or 'ChessDepth-Joining-Kit-%s-%s.pdf' % (S['student'].replace(' ', '-'), S['no'])
w.write(out); print('built', out)
