# ChessDepth free book: "Opening Basics: Every Major Opening from Both Sides".
# Usage: python3 build.py out.pdf   (content in data.py; every line is played through with python-chess)
import sys, io, chess, chess.svg, cairosvg
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak, Image, NextPageTemplate
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from data import SECTIONS, PRINCIPLES, CHOOSE

OUT = sys.argv[1] if len(sys.argv) > 1 else 'out.pdf'
G = '/usr/share/fonts/truetype/google-fonts/'
for n, f in [('Pop', 'Poppins-Regular.ttf'), ('PopM', 'Poppins-Medium.ttf'), ('PopB', 'Poppins-Bold.ttf'), ('PopI', 'Poppins-Italic.ttf')]: pdfmetrics.registerFont(TTFont(n, G + f))
pdfmetrics.registerFont(TTFont('DJ', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFontFamily('Pop', normal='Pop', bold='PopB', italic='PopI', boldItalic='PopB')
pdfmetrics.registerFont(TTFont('Gar', '/root/.fonts/EBGaramond-600.ttf')); pdfmetrics.registerFont(TTFont('GarI', '/root/.fonts/EBGaramond-400i.ttf'))
INK = colors.HexColor('#1f2547'); BRASS = colors.HexColor('#b08a4e'); GOLD = colors.HexColor('#d2ad6e'); MUTE = colors.HexColor('#6b7088')
LINE = colors.HexColor('#dfe2ea'); SOFT = colors.HexColor('#f6f3ec'); WBG = colors.HexColor('#f3f5fb'); BBG = colors.HexColor('#f2efe8')
W, H = A4; M = 16 * mm

S = {
 'h1': ParagraphStyle('h1', fontName='Gar', fontSize=27, leading=31, textColor=INK, spaceAfter=4),
 'kick': ParagraphStyle('kick', fontName='PopB', fontSize=8.5, leading=11, textColor=BRASS, spaceAfter=3),
 'lead': ParagraphStyle('lead', fontName='Pop', fontSize=10, leading=15, textColor=INK, spaceAfter=8),
 'body': ParagraphStyle('body', fontName='Pop', fontSize=9.2, leading=13.6, textColor=INK, spaceAfter=4),
 'sec': ParagraphStyle('sec', fontName='Gar', fontSize=22, leading=26, textColor=INK),
 'secl': ParagraphStyle('secl', fontName='PopI', fontSize=9.2, leading=13, textColor=MUTE, spaceAfter=6),
 'name': ParagraphStyle('name', fontName='PopB', fontSize=14, leading=17, textColor=INK),
 'moves': ParagraphStyle('moves', fontName='PopM', fontSize=9.4, leading=13, textColor=BRASS, spaceAfter=3),
 'plan': ParagraphStyle('plan', fontName='PopI', fontSize=8.8, leading=12.4, textColor=MUTE),
 'colh': ParagraphStyle('colh', fontName='PopB', fontSize=8.6, leading=11, textColor=INK, spaceAfter=2),
 'li': ParagraphStyle('li', fontName='Pop', fontSize=8.5, leading=11.8, textColor=INK, leftIndent=9, bulletIndent=0, spaceAfter=2),
 'wt': ParagraphStyle('wt', fontName='Pop', fontSize=8.4, leading=11.8, textColor=INK),
 'ph': ParagraphStyle('ph', fontName='PopB', fontSize=10, leading=13, textColor=INK, spaceAfter=1),
}

def moves_text(sans):
    out = []
    for i, s in enumerate(sans):
        out.append('%d.%s' % (i // 2 + 1, s) if i % 2 == 0 else s)
    return ' '.join(out)

def board_img(b, size_mm, last=None):
    svg = chess.svg.board(b, size=420, coordinates=True, lastmove=last,
                          colors={'square light': '#ece6d6', 'square dark': '#8d99c8', 'square light lastmove': '#e6cf9c', 'square dark lastmove': '#c9a86a', 'margin': '#1f2547', 'coord': '#d2ad6e'})
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=840, output_height=840)
    return Image(io.BytesIO(png), width=size_mm * mm, height=size_mm * mm)

def play(moves):
    b = chess.Board(); last = None
    for s in moves.split(): last = b.parse_san(s); b.push(last)
    return b, last

def bullets(items): return [Paragraph(t, S['li'], bulletText='•') for t in items]

def opening_block(o):
    b, last = play(o['moves'])
    sans = o['moves'].split()
    head = [Paragraph(o['name'], S['name']), Paragraph(moves_text(sans), S['moves']), Paragraph(o['plan'], S['plan'])]
    side = Table([[ [Paragraph('<font name="DJ" size="10">♔</font> WHITE\'S IDEAS', S['colh'])] + bullets(o['white']),
                    [Paragraph('<font name="DJ" size="10">♚</font> BLACK\'S IDEAS', S['colh'])] + bullets(o['black']) ]],
                 colWidths=[60 * mm, 60 * mm])
    side.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (0, 0), WBG), ('BACKGROUND', (1, 0), (1, 0), BBG),
                              ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6), ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]))
    right = [*head, Spacer(1, 4), side]
    t = Table([[board_img(b, 52, last), right]], colWidths=[56 * mm, 122 * mm])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    wname, wline, wtxt, kind = o['watch']
    if wline:
        c = chess.Board()
        for s in wline.split(): c.push_san(s)
        if kind == 'mate': assert c.is_checkmate(), o['name']
        if kind == 'check': assert c.is_check(), o['name']
        wtxt = '<b>%s:</b> %s<br/><font color="#9a7438">%s</font>' % (wname, wtxt, moves_text(wline.split()))
    else:
        wtxt = '<b>%s:</b> %s' % (wname, wtxt)
    w = Table([[Paragraph('⚠', ParagraphStyle('ic', fontName='DJ', fontSize=12, leading=14, textColor=BRASS)), Paragraph(wtxt, S['wt'])]], colWidths=[7 * mm, 171 * mm])
    w.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOX', (0, 0), (-1, -1), 0.6, GOLD), ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fffaf0')),
                           ('LEFTPADDING', (0, 0), (-1, -1), 6), ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]))
    return KeepTogether([t, Spacer(1, 5), w, Spacer(1, 7), Table([['']], colWidths=[178 * mm], style=[('LINEABOVE', (0, 0), (-1, -1), 0.5, LINE)]), Spacer(1, 2)])

def rook(c, x, y, s, col):
    c.saveState(); c.translate(x, y + 32 * s); c.scale(s, -s); c.setFillColor(col); p = c.beginPath()
    for poly in ([(8,5),(11,5),(11,8),(13.5,8),(13.5,5),(18.5,5),(18.5,8),(21,8),(21,5),(24,5),(24,12.2),(21.6,14),(22.5,23),(9.5,23),(10.4,14),(8,12.2)],[(8.5,24.5),(23.5,24.5),(25,27),(7,27)],[(6,28),(26,28),(26,30.5),(6,30.5)]):
        p.moveTo(*poly[0]); [p.lineTo(*q) for q in poly[1:]]; p.close()
    c.drawPath(p, fill=1, stroke=0); c.restoreState()

def page_deco(c, d):
    top = H - 12 * mm
    rook(c, M, top - 11 * mm, 0.78, INK)
    c.setFillColor(INK); c.setFont('Gar', 22); c.drawString(M + 29, top - 6.2 * mm, 'ChessDepth')
    c.setFillColor(BRASS); c.setFont('GarI', 10.5); c.drawString(M + 30, top - 10.6 * mm, 'Think Deep. Play Deeper!')
    c.setFillColor(INK); c.setFont('PopB', 12); c.drawRightString(W - M, top - 5.6 * mm, 'OPENING BASICS')
    c.setFillColor(BRASS); c.setFont('PopM', 8.2); c.drawRightString(W - M, top - 10.2 * mm, 'EVERY MAJOR OPENING FROM BOTH SIDES')
    c.setStrokeColor(BRASS); c.setLineWidth(1.1); c.line(M, top - 13.5 * mm, W - M, top - 13.5 * mm)
    c.setFillColor(MUTE); c.setFont('Pop', 7.2)
    c.drawString(M, 10 * mm, 'ChessDepth  |  www.chessdepth.in  |  Free to print and share')
    c.drawRightString(W - M, 10 * mm, 'Page %d' % c.getPageNumber())

def cover(c, d):
    c.setFillColor(INK); c.rect(0, 0, W, H, fill=1, stroke=0)
    sq = W / 8
    c.setFillColor(colors.HexColor('#262d55'))
    for r in range(int(H / sq) + 1):
        for k in range(8):
            if (r + k) % 2: c.rect(k * sq, r * sq, sq, sq, fill=1, stroke=0)
    c.setFillColor(INK); c.roundRect(18 * mm, 70 * mm, W - 36 * mm, 150 * mm, 6 * mm, fill=1, stroke=0)
    c.setStrokeColor(GOLD); c.setLineWidth(1.4); c.roundRect(21 * mm, 73 * mm, W - 42 * mm, 144 * mm, 5 * mm, fill=0, stroke=1)
    rook(c, W / 2 - 22, 182 * mm, 1.4, GOLD)
    c.setFillColor(colors.white); c.setFont('Gar', 30); c.drawCentredString(W / 2, 168 * mm, 'ChessDepth')
    c.setFillColor(GOLD); c.setFont('GarI', 13); c.drawCentredString(W / 2, 160 * mm, 'Think Deep. Play Deeper!')
    c.setFillColor(GOLD); c.setFont('PopB', 10); c.drawCentredString(W / 2, 140 * mm, 'F R E E   B O O K')
    c.setFillColor(colors.white); c.setFont('Gar', 46); c.drawCentredString(W / 2, 122 * mm, 'Opening Basics')
    c.setFillColor(colors.HexColor('#cfd3ea')); c.setFont('Pop', 13); c.drawCentredString(W / 2, 110 * mm, 'Every major opening, explained from both sides')
    c.setFont('Pop', 10.5); c.drawCentredString(W / 2, 98 * mm, '21 openings  ·  the ideas for White and Black  ·  traps to know')
    c.setFillColor(GOLD); c.setFont('PopM', 10); c.drawCentredString(W / 2, 84 * mm, 'www.chessdepth.in')

def build():
    story = [NextPageTemplate('body'), PageBreak()]
    n = sum(len(o) for _, _, o in SECTIONS)
    story += [Paragraph('HOW TO USE THIS BOOK', S['kick']), Paragraph('Learn ideas, not just moves', S['h1']),
              Paragraph('This book shows the %d most important chess openings. For each one you get the main moves, the position on the board, and the plans <b>both</b> sides should follow, so it helps whichever colour you play. Each opening ends with a trap or tip worth knowing.' % n, S['lead']),
              Paragraph('Set up each line on a board and play it through. Then ask yourself: why was each move played? Once you know the ideas, you will still play good moves when your opponent goes off the main line.', S['body']), Spacer(1, 8),
              Paragraph('The six opening principles', S['sec']), Spacer(1, 4)]
    rows = []
    for i, (h, t) in enumerate(PRINCIPLES, 1):
        rows.append([Paragraph('<font color="#d2ad6e"><b>%d</b></font>' % i, ParagraphStyle('n', fontName='Gar', fontSize=22, leading=24, textColor=GOLD)), [Paragraph(h, S['ph']), Paragraph(t, S['body'])]])
    tp = Table(rows, colWidths=[12 * mm, 166 * mm]); tp.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -2), 0.5, LINE), ('TOPPADDING', (0, 0), (-1, -1), 6), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
    story += [tp, Spacer(1, 10), Paragraph('Contents', S['sec']), Spacer(1, 4)]
    toc = []
    for title, _, ops in SECTIONS:
        toc.append([Paragraph('<b>%s</b>' % title, S['body']), Paragraph(', '.join(o['name'] for o in ops), S['body'])])
    tt = Table(toc, colWidths=[52 * mm, 126 * mm]); tt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('LINEBELOW', (0, 0), (-1, -2), 0.4, LINE), ('TOPPADDING', (0, 0), (-1, -1), 4)]))
    story += [tt]
    for title, lead, ops in SECTIONS:
        story += [PageBreak(), Paragraph(title, S['sec']), Paragraph(lead, S['secl'])]
        story += [opening_block(o) for o in ops]
    story += [PageBreak(), Paragraph('WHERE TO START', S['kick']), Paragraph('Which openings should I play?', S['h1']),
              Paragraph('You only need one opening with White, one answer to 1.e4 and one answer to 1.d4. Pick from the row that sounds most like you, play it for a few months, and learn from every game.', S['lead'])]
    rows = [[Paragraph('<b>If you…</b>', S['body']), Paragraph('<b>With White, try</b>', S['body']), Paragraph('<b>With Black, try</b>', S['body'])]]
    rows += [[Paragraph(a, S['body']), Paragraph(b, S['body']), Paragraph(c, S['body'])] for a, b, c in CHOOSE]
    tc = Table(rows, colWidths=[50 * mm, 60 * mm, 68 * mm]); tc.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (-1, 0), SOFT), ('GRID', (0, 0), (-1, -1), 0.5, LINE), ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]))
    story += [tc, Spacer(1, 14), Paragraph('Keep learning with ChessDepth', S['sec']), Spacer(1, 4)]
    for t in ['<b>Live classes:</b> one-to-one and group classes for every level, with a free demo class. www.chessdepth.in/courses',
              '<b>Opening repertoires:</b> complete Italian Game, London System and Caro-Kann + QGD courses in our Shop.',
              '<b>Chess Lab:</b> courses, puzzles and training tools. www.chessdepth.in/lab',
              '<b>Puzzle of the Day:</b> a new puzzle every day on www.chessdepth.in']:
        story.append(Paragraph(t, S['li'], bulletText='•'))
    doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=M, rightMargin=M, topMargin=30 * mm, bottomMargin=18 * mm,
                          title='Opening Basics: Every Major Opening from Both Sides', author='ChessDepth', subject='Free chess openings book')
    fr = Frame(M, 18 * mm, W - 2 * M, H - 48 * mm, id='f')
    doc.addPageTemplates([PageTemplate('cover', [Frame(0, 0, W, H)], onPage=cover), PageTemplate('body', [fr], onPage=page_deco)])
    doc.build(story)
    return n

if __name__ == '__main__':
    print(build(), 'openings ->', OUT)
