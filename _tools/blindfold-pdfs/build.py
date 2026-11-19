# ChessDepth blindfold practice workbooks: four free PDFs (Beginner, Intermediate, Advanced, Elite).
# Every answer is worked out with python-chess here (mates come from puzzles.py, checked with Stockfish).
# Usage: python3 build.py OUTDIR
import sys, json, random, collections, chess
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak, CondPageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
G = '/usr/share/fonts/truetype/google-fonts/'
for n, f in [('Pop', 'Poppins-Regular.ttf'), ('PopM', 'Poppins-Medium.ttf'), ('PopB', 'Poppins-Bold.ttf'), ('PopI', 'Poppins-Italic.ttf')]: pdfmetrics.registerFont(TTFont(n, G + f))
pdfmetrics.registerFontFamily('Pop', normal='Pop', bold='PopB', italic='PopI', boldItalic='PopB')
pdfmetrics.registerFont(TTFont('Gar', '/root/.fonts/EBGaramond-600.ttf')); pdfmetrics.registerFont(TTFont('GarI', '/root/.fonts/EBGaramond-400i.ttf'))
INK = colors.HexColor('#1f2547'); BRASS = colors.HexColor('#b08a4e'); MUTE = colors.HexColor('#6b7088'); LINE = colors.HexColor('#c9ccd8'); SOFT = colors.HexColor('#f4f2ec')

ST = {
  'h1': ParagraphStyle('h1', fontName='PopB', fontSize=21, leading=26, textColor=INK, spaceAfter=2),
  'kick': ParagraphStyle('kick', fontName='PopB', fontSize=8.5, leading=11, textColor=BRASS, spaceAfter=3),
  'lead': ParagraphStyle('lead', fontName='Pop', fontSize=10, leading=15, textColor=INK, spaceAfter=6),
  'h2': ParagraphStyle('h2', fontName='PopB', fontSize=13, leading=17, textColor=INK, spaceBefore=10, spaceAfter=2),
  'how': ParagraphStyle('how', fontName='PopI', fontSize=8.6, leading=12.5, textColor=MUTE, spaceAfter=6),
  'q': ParagraphStyle('q', fontName='Pop', fontSize=9.2, leading=13.2, textColor=INK),
  'qn': ParagraphStyle('qn', fontName='PopB', fontSize=9.2, leading=13.2, textColor=BRASS),
  'body': ParagraphStyle('body', fontName='Pop', fontSize=9.2, leading=13.6, textColor=INK, spaceAfter=4),
  'li': ParagraphStyle('li', fontName='Pop', fontSize=9.2, leading=13.6, textColor=INK, leftIndent=12, bulletIndent=2, spaceAfter=2),
  'ans': ParagraphStyle('ans', fontName='Pop', fontSize=8.2, leading=11.2, textColor=INK),
  'ansh': ParagraphStyle('ansh', fontName='PopB', fontSize=9.5, leading=13, textColor=INK, spaceBefore=6, spaceAfter=2),
}
NAMES = {chess.KING: 'K', chess.QUEEN: 'Q', chess.ROOK: 'R', chess.BISHOP: 'B', chess.KNIGHT: 'N'}
WORD = {chess.KING: 'king', chess.QUEEN: 'queen', chess.ROOK: 'rook', chess.BISHOP: 'bishop', chess.KNIGHT: 'knight', chess.PAWN: 'pawn'}

def pieces_text(b):
    out = []
    for col, lab in ((chess.WHITE, 'White'), (chess.BLACK, 'Black')):
        parts = []
        for pt in (chess.KING, chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT):
            parts += [NAMES[pt] + chess.square_name(s) for s in sorted(b.pieces(pt, col))]
        pawns = [chess.square_name(s) for s in sorted(b.pieces(chess.PAWN, col))]
        if pawns: parts.append(('pawn ' if len(pawns) == 1 else 'pawns ') + ' '.join(pawns))
        out.append('<b>%s:</b> %s' % (lab, ', '.join(parts)))
    return '<br/>'.join(out)

def moves_text(sans, start_ply=0):
    out = []
    for i, s in enumerate(sans):
        ply = start_ply + i
        if ply % 2 == 0: out.append('%d.%s' % (ply // 2 + 1, s))
        elif i == 0: out.append('%d…%s' % (ply // 2 + 1, s))
        else: out.append(s)
    return ' '.join(out)

def describe(b, sq):
    p = b.piece_at(sq)
    return 'empty' if not p else ('a %s %s' % ('white' if p.color else 'black', WORD[p.piece_type]))

def light(sq): return bool(chess.BB_LIGHT_SQUARES & chess.BB_SQUARES[sq])
def knight_targets(sq): return sorted(chess.SquareSet(chess.BB_KNIGHT_ATTACKS[sq]), key=lambda s: (chess.square_file(s), chess.square_rank(s)))
def knight_route(a, z):
    prev = {a: None}; q = collections.deque([a])
    while q:
        s = q.popleft()
        if s == z: break
        for t in chess.SquareSet(chess.BB_KNIGHT_ATTACKS[s]):
            if t not in prev: prev[t] = s; q.append(t)
    path = [z]
    while prev[path[-1]] is not None: path.append(prev[path[-1]])
    return path[::-1]
def bishop_reach(sq): return len(chess.SquareSet(chess.BB_DIAG_ATTACKS[sq][0]))
def sqn(s): return chess.square_name(s)

# ---------------- opening lines (all moves are checked by python-chess when used) ----------------
OPEN_SHORT = [
  ('Italian Game', 'e4 e5 Nf3 Nc6 Bc4 Bc5'), ('Ruy Lopez', 'e4 e5 Nf3 Nc6 Bb5 a6'), ("Queen's Gambit", 'd4 d5 c4 e6 Nc3 Nf6'),
  ('Scotch Game', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4'), ('Sicilian Defence', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4'), ('Caro-Kann Defence', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4'),
]
OPEN_MID = [
  ('Italian Game, Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O'),
  ('London System', 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3'),
  ('French Defence, Winawer', 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 Qc7'),
  ('Scotch Game', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4'),
  ("Queen's Gambit Declined", 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7'),
  ('Caro-Kann, Classical', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7'),
]
OPEN_LONG = [
  ('Ruy Lopez, Closed', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Na5 Bc2 c5 d4 Qc7'),
  ("Queen's Gambit Declined, Orthodox", 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3 dxc4 Bxc4 Nd5'),
  ('Sicilian Najdorf, English Attack', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7 g4 b5'),
  ("King's Indian, Classical", 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7'),
  ('Caro-Kann, Classical', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6'),
  ('French Defence, Winawer', 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 Qc7 Qxg7 Rg8 Qxh7 cxd4'),
]
FAMOUS = [  # (players, event, all moves, ply at which the reader must find the win, prompt)
  ('Légal vs Saint Brie', 'Paris 1750', 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#', 8, 'White to play. The black bishop pins the knight to the queen. Find the win.'),
  ('Réti vs Tartakower', 'Vienna 1910', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Qd3 e5 dxe5 Qa5+ Bd2 Qxe5 O-O-O Nxe4 Qd8+ Kxd8 Bg5+ Kc7 Bd8#', 16, 'White to play and mate in three.'),
  ('Morphy vs Duke Karl and Count Isouard', 'Paris 1858', 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#', 30, 'White to play and mate in two.'),
  ('Edward Lasker vs Thomas', 'London 1912', 'd4 e6 Nf3 f5 Nc3 Nf6 Bg5 Be7 Bxf6 Bxf6 e4 fxe4 Nxe4 b6 Ne5 O-O Bd3 Bb7 Qh5 Qe7 Qxh7+ Kxh7 Nxf6+ Kh6 Neg4+ Kg5 h4+ Kf4 g3+ Kf3 Be2+ Kg2 Rh2+ Kg1 Kd2#', 20, 'White to play. Find the sacrifice that starts a king hunt across the whole board, ending in mate in eight.'),
]

def play(moves):
    b = chess.Board(); sans = moves.split()
    for s in sans: b.push_san(s)
    return b, sans

def opening_questions(name, moves, rnd, n_q, extra):
    b, sans = play(moves)
    occupied_moved = []
    for i, s in enumerate(sans):
        pass
    # squares that pieces landed on (still occupied), and squares pieces left (now empty)
    bb = chess.Board(); landed, left = [], []
    for s in sans:
        m = bb.parse_san(s); bb.push(m)
        if m.from_square not in landed: left.append(m.from_square)
        landed.append(m.to_square)
    landed = [s for s in dict.fromkeys(landed) if b.piece_at(s)]
    left = [s for s in dict.fromkeys(left) if not b.piece_at(s)]
    qs = []
    picks = rnd.sample(landed, min(len(landed), n_q - (1 if left else 0)))
    if left: picks.append(rnd.choice(left))
    rnd.shuffle(picks)
    for s in picks:
        qs.append(('What is on %s?' % sqn(s), describe(b, s)[0].upper() + describe(b, s)[1:]))
    if extra:  # a harder question: legal moves of one piece
        cands = [s for s in landed if b.piece_at(s) and b.piece_at(s).piece_type in (chess.KNIGHT, chess.BISHOP, chess.QUEEN, chess.ROOK)]
        if cands:
            s = rnd.choice(cands); p = b.piece_at(s); bb = b.copy(); bb.turn = p.color
            ms = [m for m in bb.legal_moves if m.from_square == s]
            qs.append(('If it were %s to move, how many legal moves would the %s on %s have?' % ('White' if p.color else 'Black', WORD[p.piece_type], sqn(s)),
                       '%d (%s)' % (len(ms), ', '.join(sorted(sqn(m.to_square) for m in ms)) or 'none')))
    return moves_text(sans), qs

# ---------------- document ----------------
class Doc(BaseDocTemplate):
    def __init__(self, path, level, sub):
        super().__init__(path, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=30 * mm, bottomMargin=18 * mm,
                         title='ChessDepth Blindfold Practice: ' + level, author='ChessDepth', subject='Free blindfold chess practice workbook, ' + level + ' level')
        self.level, self.sub = level, sub
        fr = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='f')
        self.addPageTemplates([PageTemplate('p', [fr], onPage=self.deco)])
    def deco(self, c, d):
        W, H = A4; M = 16 * mm; top = H - 12 * mm
        rook(c, M, top - 11 * mm, 0.78, INK)
        c.setFillColor(INK); c.setFont('Gar', 22); c.drawString(M + 29, top - 6.2 * mm, 'ChessDepth')
        c.setFillColor(BRASS); c.setFont('GarI', 10.5); c.drawString(M + 30, top - 10.6 * mm, 'Think Deep. Play Deeper!')
        c.setFillColor(INK); c.setFont('PopB', 12.5); c.drawRightString(W - M, top - 5.6 * mm, 'BLINDFOLD PRACTICE')
        c.setFillColor(BRASS); c.setFont('PopM', 8.4); c.drawRightString(W - M, top - 10.2 * mm, self.level.upper() + '  ·  ' + self.sub)
        c.setStrokeColor(BRASS); c.setLineWidth(1.1); c.line(M, top - 13.5 * mm, W - M, top - 13.5 * mm)
        c.setFillColor(MUTE); c.setFont('Pop', 7.2)
        c.drawString(M, 10 * mm, 'ChessDepth Academy  |  www.chessdepth.in/blindfold/  |  Free to print and share')
        c.drawRightString(W - M, 10 * mm, 'Page %d' % c.getPageNumber())

def rook(c, x, y, s, col):
    c.saveState(); c.translate(x, y + 32 * s); c.scale(s, -s); c.setFillColor(col); p = c.beginPath()
    for poly in ([(8,5),(11,5),(11,8),(13.5,8),(13.5,5),(18.5,5),(18.5,8),(21,8),(21,5),(24,5),(24,12.2),(21.6,14),(22.5,23),(9.5,23),(10.4,14),(8,12.2)],[(8.5,24.5),(23.5,24.5),(25,27),(7,27)],[(6,28),(26,28),(26,30.5),(6,30.5)]):
        p.moveTo(*poly[0]); [p.lineTo(*q) for q in poly[1:]]; p.close()
    c.drawPath(p, fill=1, stroke=0); c.restoreState()

class Book:
    def __init__(self, level, sub):
        self.level, self.sub = level, sub; self.story = []; self.answers = []; self.n = 0; self.sec = 0
    def P(self, t, s='body'): self.story.append(Paragraph(t, ST[s]))
    def section(self, title, how):
        self.sec += 1; letter = 'ABCDEFG'[self.sec - 1]
        self.story.append(CondPageBreak(60 * mm))
        self.story.append(Paragraph('%s. %s' % (letter, title), ST['h2'])); self.story.append(Paragraph(how, ST['how']))
        self.answers.append(('h', '%s. %s' % (letter, title)))
    def items(self, qa, cols=1, line=True, space=0, inline=False):
        """qa: list of (question html, answer html). Numbers run on through the book."""
        cells = []
        for q, a in qa:
            self.n += 1
            if inline: body = [Paragraph(q + '&nbsp;&nbsp;<font color="#9aa0b4">' + '_' * 22 + '</font>', ST['q'])]
            else:
                body = [Paragraph(q, ST['q'])]
                if line: body.append(Paragraph('<font color="#9aa0b4">Answer: ' + '_' * (27 if cols == 2 else 62) + '</font>', ST['q']))
            if space: body.append(Spacer(1, space))
            cells.append([Paragraph(str(self.n), ST['qn']), body])
            self.answers.append(('a', self.n, a))
        if cols == 1:
            t = Table(cells, colWidths=[9 * mm, None]); t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('LINEBELOW', (0, 0), (-1, -2), 0.4, LINE)]))
            self.story.append(t)
        else:
            rows = []
            for i in range(0, len(cells), 2):
                r = cells[i] + (cells[i + 1] if i + 1 < len(cells) else ['', ''])
                rows.append(r)
            w = (A4[0] - 32 * mm) / 2
            t = Table(rows, colWidths=[8 * mm, w - 8 * mm, 8 * mm, w - 8 * mm])
            t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('LINEBELOW', (0, 0), (-1, -2), 0.4, LINE)]))
            self.story.append(t)
    def intro(self, title, rng, lead, steps):
        self.story += [Paragraph('FREE WORKBOOK  ·  ' + rng, ST['kick']), Paragraph(title, ST['h1']), Paragraph(lead, ST['lead'])]
        box = [Paragraph('<b>How to practise</b>', ST['body'])] + [Paragraph(s, ST['li'], bulletText='•') for s in steps]
        t = Table([[box]], colWidths=[A4[0] - 32 * mm]); t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), SOFT), ('BOX', (0, 0), (-1, -1), 0.6, BRASS), ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
        self.story += [t, Spacer(1, 4)]
    def log(self):
        self.story.append(CondPageBreak(75 * mm))
        self.story.append(Paragraph('Your practice log', ST['h2'])); self.story.append(Paragraph('Do one section a day. Write your score, then do the same section again a week later and see how much faster it feels.', ST['how']))
        hdr = ['Date', 'Section', 'Score', 'Time taken', 'What felt hard']
        rows = [hdr] + [[''] * 5 for _ in range(10)]
        t = Table(rows, colWidths=[24 * mm, 22 * mm, 20 * mm, 26 * mm, None], rowHeights=[7 * mm] + [7.4 * mm] * 10)
        t.setStyle(TableStyle([('FONT', (0, 0), (-1, 0), 'PopB', 8), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white), ('BACKGROUND', (0, 0), (-1, 0), INK), ('GRID', (0, 0), (-1, -1), 0.5, LINE), ('BOX', (0, 0), (-1, -1), 0.8, INK), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
        self.story.append(t)
    def build(self, path, next_text):
        self.log()
        self.story.append(Spacer(1, 6)); self.P(next_text, 'how')
        self.story.append(PageBreak()); self.story.append(Paragraph('Answers', ST['h1'])); self.P('Check each answer on a real board after you have written yours. If you got one wrong, set up the position and play it through slowly, then try it again blindfold the next day.', 'how')
        rows = []
        for a in self.answers:
            if a[0] == 'h': rows.append([Paragraph(a[1], ST['ansh']), ''])
            else: rows.append([Paragraph('<b>%d</b>' % a[1], ST['ans']), Paragraph(a[2], ST['ans'])])
        t = Table(rows, colWidths=[9 * mm, None]); t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5), ('TOPPADDING', (0, 0), (-1, -1), 1)]
            + [('SPAN', (0, i), (1, i)) for i, a in enumerate(self.answers) if a[0] == 'h']))
        self.story.append(t)
        Doc(path, self.level, self.sub).build(self.story)

STEPS = ['Read the question once, out loud if you like. Then look away from the page and picture the board.',
         'Do not use a board or an app while you solve. Write your answer first, then check it on a board.',
         'Answers are at the back. Cover them while you work.',
         'Little and often works best: 10 to 15 minutes a day beats one long session a week.']

def mate_items(puz, n):
    out = []
    for p in puz:
        b = chess.Board(p['fen'])
        q = '%s<br/><i>White to play and mate in %d.</i>' % (pieces_text(b), n)
        line = moves_text(p['line'])
        out.append((q, line + ('  (the only move that mates)' if n == 1 else '')))
    return out

def load(f, k): return json.load(open(f))[:k]

# ---------------- the four books ----------------
def beginner():
    r = random.Random(101)
    bk = Book('Beginner', 'rating up to 1000')
    bk.intro('Blindfold Practice for Beginners', 'BEGINNER · UP TO 1000',
             'Strong players can see the board in their head. That skill is trained, not born, and it starts with knowing every square by name and colour. This workbook takes you from square colours to your first blindfold checkmates, all without looking at a board.', STEPS)
    sq = r.sample(range(64), 20)
    bk.section('Light or dark?', 'Is the square light or dark? Tip: a1 is dark, and the colours change every time you move one square sideways or up.')
    bk.items([('%s' % sqn(s), 'light' if light(s) else 'dark') for s in sq], cols=2, inline=True)
    bk.section('Same colour?', 'Are the two squares the same colour? Answer yes or no.')
    pairs = [tuple(r.sample(range(64), 2)) for _ in range(10)]
    bk.items([('%s and %s' % (sqn(a), sqn(b)), ('yes, both %s' % ('light' if light(a) else 'dark')) if light(a) == light(b) else 'no (%s is %s, %s is %s)' % (sqn(a), 'light' if light(a) else 'dark', sqn(b), 'light' if light(b) else 'dark')) for a, b in pairs], cols=2, inline=True)
    bk.section('Knight jumps', 'A knight stands alone on the square. Name every square it can jump to. Corner and edge squares have fewer.')
    ks = [chess.parse_square(s) for s in ['a1', 'd4', 'h8', 'b1', 'g1', 'e5', 'h4', 'c7', 'f3', 'a8']]
    bk.items([('Knight on %s' % sqn(s), '%d squares: %s' % (len(knight_targets(s)), ', '.join(sqn(t) for t in knight_targets(s)))) for s in ks], cols=2)
    bk.section('Follow the opening', 'Play these moves in your head from the starting position. Then answer the questions without looking back at the moves.')
    for name, mv in OPEN_SHORT:
        txt, qs = opening_questions(name, mv, r, 2, False)
        bk.P('<b>%s:</b> %s' % (name, txt), 'body'); bk.items(qs, cols=2)
    bk.section('Blindfold mate in one', 'Picture the pieces, then find the one move that gives checkmate.')
    bk.items(mate_items(load('m1_beg.json', 12), 1), cols=1, space=2)
    bk.build(OUT + '/chessdepth-blindfold-practice-beginner.pdf', 'Next: when you can do every section in under five minutes, move on to the Intermediate workbook, and try the Easy drills on chessdepth.in/blindfold/.')

def intermediate():
    r = random.Random(202)
    bk = Book('Intermediate', 'rating 1000 to 1500')
    bk.intro('Blindfold Practice: Intermediate', 'INTERMEDIATE · 1000 TO 1500',
             'Now we move pieces in your head over several moves. You will trace diagonals, plan knight routes, follow longer opening lines and solve two-move mates, all from the written position alone.', STEPS)
    bk.section('Bishop diagonals', 'A bishop stands alone on an empty board. How many squares can it reach in one move? Bishops in the centre see more.')
    bs = [chess.parse_square(s) for s in ['d4', 'a1', 'c1', 'f5', 'h3', 'b7', 'e6', 'g2']]
    bk.items([('Bishop on %s' % sqn(s), '%d squares' % bishop_reach(s)) for s in bs], cols=2, inline=True)
    bk.section('One bishop move?', 'Can a bishop go from the first square to the second in one move on an empty board? Answer yes or no.')
    prs = [('c1', 'h6'), ('b2', 'g8'), ('a3', 'f8'), ('d1', 'h5'), ('e4', 'b7'), ('g7', 'a1'), ('c4', 'f1'), ('h2', 'b8'), ('f3', 'c5'), ('e2', 'a6')]
    def diag(a, b): a, b = chess.parse_square(a), chess.parse_square(b); return bool(chess.BB_DIAG_ATTACKS[a][0] & chess.BB_SQUARES[b])
    bk.items([('%s to %s' % (a, b), 'yes' if diag(a, b) else 'no (%s)' % ('different colours' if light(chess.parse_square(a)) != light(chess.parse_square(b)) else 'same colour, but not on one diagonal')) for a, b in prs], cols=2, inline=True)
    bk.section('Knight routes', 'What is the fewest number of moves a knight needs to go from the first square to the second? Name one route.')
    kr = [('b1', 'c5'), ('g1', 'g3'), ('a1', 'b2'), ('e4', 'e5'), ('d4', 'h8'), ('c3', 'f7'), ('h1', 'a8'), ('g8', 'd2'), ('a1', 'h8'), ('e2', 'e7')]
    bk.items([('%s to %s' % (a, b), '%d moves: %s' % (len(knight_route(chess.parse_square(a), chess.parse_square(b))) - 1, ' – '.join(sqn(s) for s in knight_route(chess.parse_square(a), chess.parse_square(b))))) for a, b in kr], cols=2)
    bk.section('Follow the opening', 'Play the moves in your head from the starting position, then answer without looking back.')
    for name, mv in OPEN_MID:
        txt, qs = opening_questions(name, mv, r, 2, False)
        bk.P('<b>%s:</b> %s' % (name, txt), 'body'); bk.items(qs, cols=2)
    bk.section('Blindfold mate in one', 'More pieces this time. Find the one mating move.')
    bk.items(mate_items(load('m1_int.json', 12), 1), cols=1)
    bk.section('Blindfold mate in two', 'White plays a move, Black replies, and White mates. Write the full line.')
    bk.items(mate_items(load('m2_int.json', 10), 2), cols=1)
    bk.build(OUT + '/chessdepth-blindfold-practice-intermediate.pdf', 'Next: try the Medium drills and a full blindfold game against the computer on chessdepth.in/blindfold/, then move on to the Advanced workbook.')

def advanced():
    r = random.Random(303)
    bk = Book('Advanced', 'rating 1500 to 1900')
    bk.intro('Blindfold Practice: Advanced', 'ADVANCED · 1500 TO 1900',
             'At this level blindfold work becomes calculation training. You will hold a whole position in your head, count every legal move of a piece, and solve two-move mates with many pieces on the board.', STEPS)
    bk.section('Long knight routes', 'Fewest knight moves from the first square to the second, and one route. Picture each jump.')
    kr = [('a1', 'h8'), ('a1', 'b2'), ('h1', 'g2'), ('b1', 'h7'), ('a8', 'h1'), ('c3', 'c4'), ('d1', 'e8'), ('h4', 'a5')]
    bk.items([('%s to %s' % (a, b), '%d moves: %s' % (len(knight_route(chess.parse_square(a), chess.parse_square(b))) - 1, ' – '.join(sqn(s) for s in knight_route(chess.parse_square(a), chess.parse_square(b))))) for a, b in kr], cols=2)
    bk.section('Hold the position', 'Read the position, then answer both questions without looking back at it.')
    pos = load('hold.json', 6)
    qa = []
    for p in pos:
        b = chess.Board(p['fen']); b.turn = chess.WHITE
        cands = [s for s in chess.SquareSet(b.occupied_co[chess.WHITE]) if b.piece_at(s).piece_type in (chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT)]
        s = r.choice(cands); pc = b.piece_at(s)
        ms = [m for m in b.legal_moves if m.from_square == s]
        att = [t for t in chess.SquareSet(b.attacks_mask(s)) if b.piece_at(t) and b.piece_at(t).color == chess.BLACK]
        qa.append(('%s<br/><i>a) How many legal moves does the white %s on %s have?  b) Which black pieces does it attack?</i>' % (pieces_text(b), WORD[pc.piece_type], sqn(s)),
                   'a) %d: %s.  b) %s' % (len(ms), ', '.join(sorted(sqn(m.to_square) for m in ms)) or 'none', ', '.join('%s on %s' % (WORD[b.piece_at(t).piece_type], sqn(t)) for t in att) or 'none')))
    bk.items(qa, cols=1)
    bk.section('Follow the opening', 'Longer main lines. Play them in your head, then answer the three questions.')
    for name, mv in OPEN_LONG[:5]:
        txt, qs = opening_questions(name, mv, r, 2, True)
        bk.P('<b>%s:</b> %s' % (name, txt), 'body'); bk.items(qs, cols=1)
    bk.section('Blindfold mate in two', 'Busy positions. Find the first move, Black\'s best reply and the mate.')
    bk.items(mate_items(json.load(open('m2_adv.json'))[:12], 2), cols=1)
    bk.build(OUT + '/chessdepth-blindfold-practice-advanced.pdf', 'Next: play the Hard drills on chessdepth.in/blindfold/ and finish the 28-day plan, then take on the Elite workbook.')

def elite():
    r = random.Random(404)
    bk = Book('Elite', 'rating 1900 and above')
    bk.intro('Blindfold Practice: Elite', 'ELITE · 1900 AND ABOVE',
             'Elite players calculate long forcing lines without moving a piece. Here you play through famous games in your head and find the winning blow, follow full opening main lines, and solve mates in three from the written position.', STEPS)
    bk.section('Famous finishes', 'Play the game in your head from the start, without a board. Then find the winning continuation and write the whole line.')
    qa = []
    for players, event, mv, stop, prompt in FAMOUS:
        b, sans = play(mv)
        assert b.is_checkmate()
        qa.append(('<b>%s, %s</b><br/>%s<br/><i>%s</i>' % (players, event, moves_text(sans[:stop]), prompt), moves_text(sans[stop:], stop)))
    bk.items(qa, cols=1, space=4)
    bk.section('Opening main lines', 'Play each line in your head, then answer the three questions.')
    for name, mv in OPEN_LONG[2:]:
        txt, qs = opening_questions(name, mv, r, 2, True)
        bk.P('<b>%s:</b> %s' % (name, txt), 'body'); bk.items(qs, cols=1)
    bk.section('Crowded mate in two', 'Many pieces, and only one first move works. Hold the whole position before you start calculating.')
    bk.items(mate_items(load('m2_eli.json', 8), 2), cols=1)
    bk.section('Blindfold mate in three', 'Find the forcing line: White\'s first move, the best defence, and mate on the third move. Write the main line.')
    bk.items(mate_items(load('m3_elib.json', 10), 3), cols=1)
    bk.build(OUT + '/chessdepth-blindfold-practice-elite.pdf', 'Next: play full blindfold games against the computer on chessdepth.in/blindfold/, and replay your own tournament games in your head before you check them on a board.')

if __name__ == '__main__':
    for f in (beginner, intermediate, advanced, elite):
        try: f(); print('built', f.__name__)
        except FileNotFoundError as e: print('skipped', f.__name__, e)
