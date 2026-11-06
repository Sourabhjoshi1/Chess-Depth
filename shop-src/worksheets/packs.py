# Builds the three ChessDepth worksheet/test packs as HTML (printed to PDF by pdf.js).
import json, chess, chess.svg, html, sys
from explain import describe

LIGHT, DARK = '#eef0fb', '#a3aae0'
def svg(fen, white=True, arrows=(), last=None, size=300, marks=()):
    b = chess.Board(fen)
    fill = {chess.parse_square(s): '#86efac' for s in marks}
    return chess.svg.board(b, orientation=chess.WHITE if white else chess.BLACK, lastmove=last, size=size, coordinates=True,
        arrows=[chess.svg.Arrow(chess.parse_square(a), chess.parse_square(c), color='#16a34acc') for a, c in arrows], fill=fill,
        colors={'square light': LIGHT, 'square dark': DARK, 'square light lastmove': '#fde68a', 'square dark lastmove': '#f4cf5a', 'margin': '#ffffff', 'coord': '#6b7280'})
def fig(fen, cap, white=True, arrows=(), marks=(), last=None):
    lm = chess.Move.from_uci(last) if last else None
    return f'<figure class="fig">{svg(fen, white, arrows, lm, marks=marks)}<figcaption>{cap}</figcaption></figure>'

LOGO = '<svg viewBox="0 0 32 32" class="logo"><path fill="currentColor" d="M8 5h3v3h2.5V5h5v3H21V5h3v7.2l-2.4 1.8.9 9H9.5l.9-9L8 12.2zM8.5 24.5h15l1.5 2.5H7zM6 28h20v2.5H6z"/></svg>'
CSS = open('base.css').read() + open('extra.css').read()
D = json.load(open('chosen.json'))

def cover(kicker, title, sub, topics, level, glyph):
    t = ''.join(f'<li>{x}</li>' for x in topics)
    return (f'''<div class="cover-inner"><div class="cover-top">{LOGO}<span>ChessDepth Academy</span></div><div class="cover-glyph">{glyph}</div>
<p class="cover-kicker">{kicker}</p><h1 class="cover-title">{title}</h1><p class="cover-sub">{sub}</p><ul class="cover-topics">{t}</ul>
<p class="cover-level">{level}</p><p class="cover-url">chessdepth.in</p></div>''', 'cover', False)

def sechead(n, title, intro):
    return f'<div class="sec-head"><span class="sec-n">{n}</span><div><h2 class="h2">{title}</h2><p>{intro}</p></div></div>'

def puzzle_pages(sections, start=1):
    """sections: list of (key, title, intro). Returns pages and numbered puzzle list."""
    pages, allp, n = [], [], start - 1
    for key, title, intro, num in sections:
        ps = []
        for p in D[key]:
            n += 1; d = describe(p, key); d['n'] = n; d['sec'] = key; ps.append(d); allp.append(d)
        for k in range(0, len(ps), 6):
            cells = ''
            for d in ps[k:k + 6]:
                s = svg(d['fen'], d['side'] == 'White', last=chess.Move.from_uci(d['first']), size=260)
                cells += f'''<div class="pz"><div class="pz-head"><span class="pz-n">{d['n']}</span><span class="pz-side"><span class="dot {'w' if d['side']=='White' else 'b'}"></span>{d['side']} to move</span></div>
<div class="pz-board">{s}</div><p class="pz-hint">Hint: {html.escape(d['hint'])}</p><p class="pz-line">Your answer:</p></div>'''
            head = sechead(num, title, intro) if k == 0 else sechead(num, title + ' (continued)', '')
            pages.append((f'<div class="puzzles">{head}<div class="grid">{cells}</div></div>', '', True))
    return pages, allp

def answer_pages(allp, titles):
    pages = []
    for k in range(0, len(allp), 6):
        rows = ''
        for d in allp[k:k + 6]:
            km = chess.Move.from_uci(d['key'])
            s = svg(d['fen'], d['side'] == 'White', arrows=[(chess.square_name(km.from_square), chess.square_name(km.to_square))], size=200)
            rows += f'''<div class="sol"><div class="sol-board">{s}</div><div class="sol-text"><p class="sol-h"><span class="pz-n">{d['n']}</span>{titles[d['sec']]} · {d['side']} to move <span class="sol-r">Puzzle rating {d['rating']}</span></p><p>{d['text']}</p></div></div>'''
        pages.append((f'<p class="ans-kicker">Answers</p><h2 class="h2">Puzzles {allp[k]["n"]}–{allp[min(k+5,len(allp)-1)]["n"]}</h2><div class="sols">{rows}</div>', 'answers', True))
    return pages

def closing(count, packname):
    tk = ''.join(f'<span><b>{k}</b></span>' for k in range(1, count + 1))
    return (f'''<h2 class="h2">What next?</h2>
<p class="lead">A little practice every day beats a long session once a week. Here is how ChessDepth can help you keep going.</p>
<div class="next">
 <div class="nx"><h3>Chess Lab</h3><p>Thousands of rated puzzles that adapt to your level, Puzzle Streak, opening courses and a progress dashboard, all in your browser.</p><p class="url">chessdepth.in/lab</p></div>
 <div class="nx"><h3>Blindfold Training</h3><p>Ten free drills that train you to see the board in your head, from square colours to full games against Stockfish.</p><p class="url">chessdepth.in/blindfold</p></div>
 <div class="nx"><h3>Classes with a coach</h3><p>Structured online classes from beginner to tournament level, with worksheets, regular tests and game reviews. Your first demo class is free.</p><p class="url">chessdepth.in/courses</p></div>
</div>
<div class="tracker"><h3>Puzzle tracker</h3><p class="small">Tick each puzzle you solved without help. Come back to the empty ones in a week.</p><div class="tk">{tk}</div></div>
<div class="contact"><div>{LOGO}<b>ChessDepth Academy</b></div><p>WhatsApp / phone +91 98230 29262 · info@chessdepth.in · Instagram @chessdepthacademy1</p></div>
<p class="credits">Puzzle positions from the free Lichess puzzle database (lichess.org, CC0), every solution checked with Stockfish. Lessons written by the coaches of ChessDepth Academy. © 2026 ChessDepth Academy. Free to download, print and share for personal and classroom use.</p>''', '', True)

def render(pages, title, out):
    body = ''
    for k, (b, cls, num) in enumerate(pages, 1):
        foot = f'<div class="foot"><span>ChessDepth Academy · {title}</span><span>{k}</span></div>' if num else ''
        body += f'<section class="page {cls}">{b}{foot}</section>'
    open(out, 'w').write(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{title} – ChessDepth Academy</title><style>{CSS}</style></head><body>{body}</body></html>')
    print(out, len(pages), 'pages')

def howto(lead, toc, extra=''):
    rows = ''.join(f'<li><span class="toc-n">{i+1}</span><span class="toc-t">{t}</span><span class="toc-p">{p}</span></li>' for i, (t, p) in enumerate(toc))
    return (f'''<h2 class="h2">How to use this pack</h2><p class="lead">{lead}</p>
<div class="steps">
 <div class="step"><b>1</b><div><h3>Read the lesson</h3><p>Each chapter explains one idea with diagrams. Set the positions up on a board if that helps you.</p></div></div>
 <div class="step"><b>2</b><div><h3>Solve from the diagram</h3><p>Work out the answer in your head before you touch the pieces. Seeing ahead without moving is the skill you are training.</p></div></div>
 <div class="step"><b>3</b><div><h3>Checks, captures, threats</h3><p>In every puzzle look at all checks first, then all captures, then moves that threaten something.</p></div></div>
 <div class="step"><b>4</b><div><h3>Read every answer</h3><p>Even when you were right. Knowing <i>why</i> a move works is what makes you spot it in your own games.</p></div></div>
</div>
<div class="two">
 <div class="box"><h3>What's inside</h3><ol class="toc">{rows}</ol></div>
 <div class="box"><h3>Reading the diagrams</h3><ul class="plain">
   <li>In the puzzles, the side to move is at the <b>bottom</b>.</li>
   <li><span class="sw y"></span> Yellow squares show the <b>last move</b>.</li>
   <li><span class="dot w"></span> White to move · <span class="dot b"></span> Black to move</li>
   <li><b>+</b> check · <b>#</b> checkmate · <b>x</b> capture · <b>!</b> strong move</li></ul>{extra}</div>
</div>''', '', True)

# ===================================================== FOUNDATION PACK
def foundation():
    P = [cover('Free worksheet pack · Level 1', 'Foundation<br>Worksheets', 'The Level 1 lessons from our classes, with 24 puzzles and full answers',
               ['Chess notation', 'Castling &amp; special moves', 'Attack &amp; defence', 'Threats', 'Checkmate in one', 'Back-rank mate'], 'For beginners and young players · roughly 0–1100 rating', '♙')]
    P.append(howto('These are the first lessons every ChessDepth student learns: how to write moves down, the special moves, how attack and defence work, and how to give (and avoid) checkmate. Read a chapter, then solve its puzzles.',
        [('Chess notation', 'page 3'), ('Castling, en passant, promotion', 'page 4'), ('Attack, defence and threats', 'page 6'), ('Checkmate and the back rank', 'page 7'), ('24 puzzles', 'page 8'), ('Answers', 'page 12')]))
    # --- Notation
    start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    fool = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
    P.append((f'''<div class="lesson">{sechead(1,'Chess notation','Notation is how we write moves down, so a game can be replayed, studied and shared. Everyone in the world uses the same system: algebraic notation.')}
<div class="side">{fig(start,'Every square has a name: its <b>file</b> (a–h) and its <b>rank</b> (1–8). The white king starts on <b>e1</b>, the black queen on <b>d8</b>.', marks=('e1','d8','e4'))}
<div><h3>The board</h3><ul><li><b>Files</b> are the columns, a to h, from White's left to right.</li><li><b>Ranks</b> are the rows, 1 to 8, from White's side to Black's.</li><li>Every square has one name, such as <b>e4</b> (highlighted) or c6.</li></ul>
<h3>The pieces</h3><table class="tbl"><tr><th>Piece</th><th>Letter</th><th>Example</th></tr><tr><td>King</td><td><b>K</b></td><td>Ke2</td></tr><tr><td>Queen</td><td><b>Q</b></td><td>Qh5</td></tr><tr><td>Rook</td><td><b>R</b></td><td>Rd1</td></tr><tr><td>Bishop</td><td><b>B</b></td><td>Bc4</td></tr><tr><td>Knight</td><td><b>N</b> (K is taken by the king)</td><td>Nf3</td></tr><tr><td>Pawn</td><td>no letter</td><td>e4</td></tr></table></div></div>
<h3>Writing a move</h3><table class="tbl"><tr><th>Move</th><th>How to write it</th><th>Example</th></tr>
<tr><td>Pawn move</td><td>just the square</td><td>e4, d5</td></tr><tr><td>Piece move</td><td>letter + square</td><td>Nf3, Bb5</td></tr><tr><td>Capture</td><td>add <b>x</b></td><td>Nxe5, Bxf7</td></tr><tr><td>Pawn capture</td><td>the pawn's file + x + square</td><td>exd5</td></tr>
<tr><td>Castling</td><td>kingside / queenside</td><td>O-O / O-O-O</td></tr><tr><td>Promotion</td><td>square + = + new piece</td><td>e8=Q</td></tr><tr><td>Check / mate</td><td>add + or #</td><td>Qh5+ / Qh4#</td></tr></table>
<div class="figs c2" style="grid-template-columns:52mm 1fr;align-items:center">{fig(fool,'Fool\'s Mate: 1.f3 e5 2.g4 Qh4#', last='d8h4')}
<div><h3>Results and symbols</h3><ul><li><b>1-0</b> White wins · <b>0-1</b> Black wins · <b>½-½</b> draw</li><li><b>!</b> good move · <b>!!</b> brilliant · <b>?</b> mistake · <b>??</b> blunder · <b>!?</b> interesting · <b>?!</b> dubious</li></ul>
<div class="key">Write down every move in your tournament games (it's compulsory in slow games), and replay games from books in algebraic notation. After a few weeks it becomes automatic.</div></div></div></div>''', 'lesson', True))
    # --- Special moves (2 pages)
    both = '4k3/8/8/8/8/8/PPP2PPP/R3K2R w KQ - 0 1'
    P.append((f'''<div class="lesson">{sechead(2,'Castling, en passant and promotion','Three special moves follow their own rules. Castling is the one you will use in almost every game.')}
<h3>Castling: two pieces, one move</h3>
<p>Castling is the only move where you move two pieces at once. It takes the king to safety behind its pawns and brings a rook towards the centre.</p>
<ul><li>The <b>king moves two squares</b> towards a rook.</li><li>The <b>rook jumps over</b> the king and lands on the square right next to it.</li></ul>
<div class="figs c3">{fig(both,'Before castling. Nothing stands between the king and either rook.')}{fig('4k3/8/8/8/8/8/PPP2PPP/R4RK1 b - - 1 1','<b>Kingside (O-O):</b> king e1→g1, rook h1→f1. Black: Ke8→g8, Rh8→f8.', last='e1g1')}{fig('4k3/8/8/8/8/8/PPP2PPP/2KR3R b - - 1 1','<b>Queenside (O-O-O):</b> king e1→c1, rook a1→d1. Black: Ke8→c8, Ra8→d8.', last='e1c1')}</div>
<h3>You may castle only if…</h3>
<ol><li>neither the king nor that rook has moved yet in the game;</li><li>there are no pieces between them;</li><li>the king is <b>not in check</b>;</li><li>the king does not <b>pass through</b> or <b>land on</b> a square attacked by the opponent.</li></ol>
<div class="key">Easy to remember: you can't castle <b>out of</b> check, <b>through</b> check or <b>into</b> check. The rook, though, may pass over or stand on an attacked square.</div>
<h3>Three positions where White can't castle kingside</h3>
<div class="figs c3">{fig('4k3/8/8/8/1b6/8/PPP2PPP/R3K2R w KQ - 0 1','<b>Out of check.</b> The bishop on b4 gives check, so White can\'t castle at all this move.', arrows=[('b4','e1')])}{fig('4k3/8/b7/8/8/8/PPP2PPP/R3K2R w KQ - 0 1','<b>Through check.</b> The bishop on a6 attacks f1, the square the king passes over.', arrows=[('a6','f1')])}{fig('4k3/8/8/2b5/8/8/PPP3PP/R3K2R w KQ - 0 1','<b>Into check.</b> The bishop on c5 attacks g1, where the king would land.', arrows=[('c5','g1')])}</div>
<p>In the second and third positions White can still castle <b>queenside</b>, because the bishops don't attack c1 or d1.</p>
</div>''', 'lesson', True))
    P.append((f'''<div class="lesson"><h3>Why castle early?</h3><p>Castling gets the king out of the centre, where the files open quickly, and hides it behind three pawns. It also connects the rooks so they can work together. Most quick checkmates in beginners' games happen to a king that stayed on e1 or e8.</p>
<h3>En passant</h3>
<div class="side">{fig('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1','Black has just played ...d7-d5. White can take <b>exd6 e.p.</b>', arrows=[('e5','d6')], last='d7d5')}
<div><p>When a pawn moves <b>two squares</b> from its starting rank and lands right beside an enemy pawn, that enemy pawn may capture it <b>as if it had moved only one square</b>.</p><ul><li>It is only allowed on the very next move. Wait, and the chance is gone.</li><li>The capturing pawn ends up on the square the other pawn passed over (d6 here).</li><li>It is written like a normal capture: <b>exd6</b> (sometimes with "e.p.").</li></ul></div></div>
<h3>Promotion</h3>
<div class="side">{fig('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1','The pawn on e7 moves to e8 and becomes a queen: <b>e8=Q</b>.', arrows=[('e7','e8')])}
<div><p>A pawn that reaches the last rank <b>must</b> become a queen, rook, bishop or knight of the same colour, straight away. Almost always you choose a queen. You can have two or more queens at once.</p><div class="key">Choosing a knight or rook instead of a queen is called <b>under-promotion</b>. Players do it to give a check with the knight, or to avoid stalemate.</div></div></div></div>''', 'lesson', True))
    # --- Attack, defence, threats
    sch = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3'
    P.append((f'''<div class="lesson">{sechead(3,'Attack, defence and threats','An attack means making threats. Defence means stopping them. Good players know when to switch from one to the other.')}
<div class="side">{fig(sch,'White threatens <b>Qxf7#</b>: the queen and the bishop both aim at f7. Black must defend with ...g6 or ...Qe7. After ...Nf6?? White mates.', arrows=[('h5','f7'),('c4','f7')], last='d1h5')}
<div><h3>What is a threat?</h3><p>A threat is a move that says: <i>"If you don't do something right now, I will gain something next move."</i></p>
<ul><li><b>Capture a piece:</b> Bb5 attacks the knight on c6.</li><li><b>Checkmate:</b> queen and bishop aiming at f7.</li><li><b>Fork:</b> a knight jumps to c7, attacking king and rook.</li><li><b>Promote:</b> a pawn on the 7th rank, ready to queen.</li></ul>
<h3>Four ways to meet a threat</h3><ol><li><b>Defend</b> the attacked piece with another piece.</li><li><b>Escape:</b> move it to a safe square.</li><li><b>Block</b> the line of attack.</li><li><b>Counter-attack</b> something of equal or greater value. Only ignore a threat if your own is stronger.</li></ol></div></div>
<div class="two" style="margin-top:4mm"><div class="box"><h3>Simple rules of attack</h3><ul class="plain"><li><b>Use more pieces.</b> Three attackers against one defender usually wins.</li><li><b>Aim at weak spots:</b> f7/f2 at the start, the back rank, a king without pawns.</li><li><b>Open lines</b> (files and diagonals) help the attacker.</li><li><b>Don't rush.</b> Bring your pieces first, then strike.</li><li><b>Don't attack</b> if your own king is unsafe.</li></ul></div>
<div class="box"><h3>Simple rules of defence</h3><ul class="plain"><li><b>Stay calm</b> and look at every threat.</li><li><b>Protect directly:</b> defend an attacked piece with another.</li><li><b>Trade attackers:</b> swap off the opponent's most dangerous piece.</li><li><b>Give your king air:</b> h3 or h6 creates an escape square.</li><li><b>Counter-attack</b> on the other side when you can.</li></ul></div></div>
<div class="key">Before every move, ask two questions: <b>What is my opponent threatening?</b> and <b>What will my opponent be able to do after my move?</b> These two questions prevent most blunders.</div></div>''', 'lesson', True))
    # --- Checkmate + back rank + avoiding
    P.append((f'''<div class="lesson">{sechead(4,'Checkmate and the back rank','Checkmate: the king is in check and there is no way out. It can\'t move, the check can\'t be blocked, and the checking piece can\'t be captured.')}
<div class="figs c3">{fig('5rk1/5pp1/8/7Q/8/3B4/5PPP/6K1 w - - 0 1','<b>Qh7#.</b> The queen gives check and the bishop on d3 protects it. The king\'s own rook and pawns block its escape.', arrows=[('h5','h7')])}{fig('6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1','<b>Nf7#,</b> a smothered mate. The king is boxed in by its own pieces and a knight check can\'t be blocked.', arrows=[('g5','f7')])}{fig('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1','<b>Rd8#,</b> the back-rank mate. The pawns on f7, g7 and h7 stop the king from escaping.', arrows=[('d1','d8')])}</div>
<h3>The back-rank mate</h3><p>Castling puts the king behind a wall of pawns, which is usually great. But if those pawns never move, the king has no escape square, and a rook or queen that reaches the back rank (the 1st rank for White, the 8th for Black) gives mate. Watch out for it whenever the back rank is guarded by just one piece: if that defender can be removed or lured away, the mate is on.</p>
<div class="key"><b>How to prevent it:</b> when you have a moment, play <b>h3</b> (or ...h6) to give your king an escape square (often called <i>luft</i>, German for air), and keep a rook or queen guarding your back rank.</div>
<h3>How to avoid getting checkmated</h3>
<div class="cols"><ol><li><b>Know the patterns</b>: back-rank mate, smothered mate, queen-and-bishop mates. If you know them, you see them coming.</li><li><b>King safety</b>: castle early and don't push the pawns in front of your king without a reason.</li><li><b>Check your opponent's checks</b> before every move.</li><li><b>Keep pieces near your king</b> when the opponent is attacking it.</li><li><b>Don't only defend.</b> Look for counter-threats so the opponent can't attack freely.</li><li><b>Play safe openings</b> that develop pieces and castle quickly.</li><li><b>Take your time</b> when your king might be in danger.</li><li><b>Spot tactics:</b> forks, pins and skewers often come just before a mate.</li><li><b>In the endgame, use your king.</b> With the queens gone, it becomes a strong piece.</li></ol></div></div>''', 'lesson', True))
    pz, allp = puzzle_pages([('mate1', 'Mate in one', 'Find the move that checkmates straight away. Look at every check, then ask: can the king escape, block or capture?', 5),
                             ('backrank', 'Back-rank mates', 'The king is stuck behind its own pawns. Most of these take two moves: remove or distract the defender first, then mate.', 6),
                             ('hanging', 'Free pieces', 'Something is undefended or not defended enough. Find it and take it, but check your opponent\'s reply first.', 7)])
    P += pz
    P += answer_pages(allp, {'mate1': 'Mate in one', 'backrank': 'Back-rank mate', 'hanging': 'Free piece'})
    P.append(closing(len(allp), 'Foundation Worksheets'))
    render(P, 'Foundation Worksheets', 'foundation.html')

# ===================================================== INTERMEDIATE PACK
def intermediate():
    P = [cover('Free worksheet pack · Level 2', 'Intermediate<br>Worksheets', 'The Level 2 lessons from our classes, with 18 puzzles and full answers',
               ['The CCT method', 'Double attacks', 'Pins', 'Zwischenzug', 'Desperado', 'Half-open files'], 'For club players · roughly 900–1500 rating', '♘')]
    P.append(howto('These lessons turn you from someone who sees tactics sometimes into someone who looks for them every move. Start with the CCT method: it is the habit that every other chapter builds on.',
        [('The CCT thinking method', 'page 3'), ('Double attacks', 'page 4'), ('Pins', 'page 5'), ('Zwischenzug and desperado', 'page 6'), ('Half-open files', 'page 8'), ('18 puzzles and answers', 'page 9')]))
    P.append((f'''<div class="lesson">{sechead(1,'The CCT thinking method','CCT stands for Checks, Captures and Threats: the forcing moves. Look at them first, in that order, for you and for your opponent, and you will miss far fewer tactics.')}
<h3>Why forcing moves first?</h3><p>A forcing move limits your opponent's replies, so it is easier to calculate and more likely to win something straight away. Most tactics, from a simple fork to a long combination, begin with a forcing move.</p>
<table class="tbl"><tr><th>Step</th><th>Ask yourself</th><th>Why it matters</th></tr>
<tr><td><b>1. Checks</b></td><td>Which checks can I give? How can the king reply to each one?</td><td>The opponent <i>must</i> answer a check: move the king, block, or capture the checking piece.</td></tr>
<tr><td><b>2. Captures</b></td><td>What can I take? What happens after the recapture?</td><td>Never assume a piece is protected. Count the attackers and defenders and calculate the exchange to the end.</td></tr>
<tr><td><b>3. Threats</b></td><td>Which moves attack something: a loose piece, the king, a promotion square?</td><td>Threats give the opponent a little more choice, but forks, pins, mate threats and promotions are all here.</td></tr></table>
<h3>Then turn the board around</h3><p>Once you have a candidate move, do a <b>blunder check</b>: imagine the position after your move and run CCT for your opponent.</p>
<ul><li><b>Their checks:</b> does my move allow a check that wins something?</li><li><b>Their captures:</b> did I leave a piece unprotected, or take away a defender?</li><li><b>Their threats:</b> what is their strongest attacking idea now?</li></ul>
<div class="key">An important extra rule: <b>before</b> you look for your own ideas, ask what your opponent's last move threatens. A single question, asked every move, prevents most blunders.</div>
<h3>Making it a habit</h3><ul><li>Use CCT on every puzzle in this pack, even when the answer seems obvious.</li><li>In slow games, run CCT on every move until you do it without thinking.</li><li>When you review your games, find the moment where CCT would have saved you, or won.</li><li>Later, combine CCT with positional ideas: piece activity, king safety and plans. CCT keeps you tactically safe; the plan tells you where to go.</li></ul>
<div class="key">Want more practice? Our free <b>Checks, Captures and Threats workbook</b> has 20 more graded problems: chessdepth.in/shop</div></div>''', 'lesson', True))
    P.append((f'''<div class="lesson">{sechead(2,'Double attacks','A double attack is one move that creates two threats at once. Your opponent can usually meet only one of them, so you win the other.')}
<div class="side">{fig('r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1','<b>Nc7+</b> forks the king and the rook. After the king moves, Nxa8 wins the rook.', arrows=[('d5','c7'),('c7','e8'),('c7','a8')])}
<div><h3>The key idea</h3><p>Two threats are much harder to meet than one. Typical pairs: attacking a piece <i>and</i> threatening mate, giving check <i>and</i> attacking a loose piece, or attacking two pieces at once.</p>
<h3>Typical patterns</h3><ul><li><b>Loose pieces</b> (undefended) are the favourite targets. "Loose pieces drop off."</li><li><b>Look for forcing moves</b>: a check that also attacks something is the most common double attack.</li><li><b>Knights</b> are the great forking pieces: their jumps are hard to see coming.</li></ul></div></div>
<h3>Types of double attack</h3><table class="tbl"><tr><th>Type</th><th>What happens</th><th>Typical example</th></tr>
<tr><td><b>Queen double attack</b></td><td>The long-range queen hits two targets, often with check.</td><td>Qd5+ hitting the king on g8 and a rook on a8</td></tr>
<tr><td><b>Knight fork</b></td><td>The knight attacks two or more pieces, often king and queen.</td><td>Nc7+ forking king and rook</td></tr>
<tr><td><b>Pawn fork</b></td><td>A pawn attacks two bigger pieces diagonally.</td><td>e5 attacking knights on d6 and f6</td></tr>
<tr><td><b>Discovered attack</b></td><td>One piece moves and uncovers an attack by the piece behind it, and the moving piece makes a threat too.</td><td>A bishop moves off the e-file with a threat, uncovering the rook on e1</td></tr>
<tr><td><b>Double check</b></td><td>The moving piece and the uncovered piece both give check. Only a king move can answer it.</td><td>Nf7++ with a bishop behind</td></tr></table>
<div class="key">When you find a double attack, check that your opponent has no <b>check or capture</b> that meets both threats at once. That is the only defence against a double attack.</div></div>''', 'lesson', True))
    P.append((f'''<div class="lesson">{sechead(3,'Pins','A pin freezes an enemy piece: it can\'t move without exposing a more valuable piece behind it.')}
<p>Every pin has three parts, all on one rank, file or diagonal: the <b>pinning piece</b> (always a bishop, rook or queen), the <b>pinned piece</b> in front, and the more valuable piece <b>behind</b> it.</p>
<div class="figs c2">{fig('8/8/8/4k3/3r4/2B5/8/4K3 w - - 0 1','<b>Absolute pin.</b> The rook on d4 is pinned to its king by the bishop on c3. It is <i>illegal</i> for it to move off the diagonal.', arrows=[('c3','e5')])}{fig('k7/8/8/4q3/3r4/2B5/8/7K w - - 0 1','<b>Relative pin.</b> Now the queen is behind the rook. The rook <i>may</i> move, but then Bxe5 wins the queen.', arrows=[('c3','e5')])}</div>
<h3>Why pins are so strong</h3><ul><li><b>Immobilise:</b> a pinned piece can't move, so it can't defend other pieces or squares either.</li><li><b>Win material:</b> pile up on the pinned piece. It can't run away, so more attackers win it (often a pawn attacking it does the job).</li><li><b>Tie the opponent down:</b> pinned pieces need extra defenders, which leaves the opponent passive.</li></ul>
<h3>How to escape a pin</h3><ul><li><b>Block</b> the line with another piece.</li><li><b>Move the piece behind</b> (the king or queen) so the pin disappears.</li><li><b>Attack the pinning piece</b> and force it to move or be exchanged, for example with a pawn (…h6 against Bg5).</li><li><b>Counter-attack</b> with something more forcing.</li></ul>
<div class="key">A pinned piece is a <b>bad defender</b>. When a pinned piece seems to guard a square, check whether it really can: a knight pinned to the king doesn't protect anything at all.</div></div>''', 'lesson', True))
    zw = 'rnbqkr2/ppppbpQp/7B/8/2n5/5N2/PPP2PPP/RN2R1K1 b q - 2 9'
    zw0 = 'rnbqkb1r/pppp1ppp/8/8/2nQ4/5N2/PPP2PPP/RNB2RK1 w kq - 0 7'
    P.append((f'''<div class="lesson">{sechead(4,'Zwischenzug and desperado','Two ideas about timing: sometimes the move everyone expects is not the best one, and sometimes a doomed piece can still take something with it.')}
<h3>The zwischenzug (in-between move)</h3><p><b>Zwischenzug</b> is German for "in-between move"; it is also called an <b>intermezzo</b>. Instead of the automatic move, usually a recapture, you first play a <b>forcing move</b> (a check, a capture or a big threat). The opponent has to answer it, and only then do you make the move you were expected to make, in a better version.</p>
<ul><li><b>Forcing:</b> the best in-between moves are checks (in German, <i>Zwischenschach</i>), because the opponent has no choice.</li><li><b>Purpose:</b> win more material, gain time, or create a new threat before finishing the exchange.</li></ul>
<div class="figs c2">{fig(zw0,'After 1.e4 e5 2.Bc4 Nf6 3.d4 exd4 4.Nf3 Nxe4 5.Qxd4 Nd6 6.O-O Nxc4. Black expects 7.Qxc4. White first plays <b>7.Re1+!</b>', last='d6c4', arrows=[('f1','e1')])}{fig(zw,'7…Be7 8.Qxg7 Rf8 9.Bh6. Instead of recapturing, White opened up the black king, and Qxf8# is threatened.', last='c1h6')}</div>
<p style="font-size:8.6pt;color:#6b7280">A Bishop's Opening game from 2000. Black was hoping simply to swap off White's dangerous bishop, but the in-between check changed everything.</p>
<h3>Questions to ask</h3><ol><li>Is there an exchange, or a sequence of captures, happening right now?</li><li>Before the natural move, is there a check, a capture of something valuable or a threat that can't be ignored?</li><li>After the opponent answers it, can I still make the original move, with a better result?</li></ol></div>''', 'lesson', True))
    P.append((f'''<div class="lesson"><h3 style="margin-top:0">The desperado</h3><p>A <b>desperado</b> is a piece that is lost anyway: it is attacked and can't escape, or it is about to be captured in an exchange. Instead of letting it die for nothing, you use it to <b>take as much as possible first</b>, ideally a piece of equal or higher value, or a pawn with check.</p>
<ul><li>The desperado often dives into the enemy position, capturing material or wrecking the pawn structure.</li><li>Desperado sequences can go back and forth: your attacked knight takes a rook, now their attacked piece takes something too. Both sides keep capturing with pieces that are already lost.</li><li>Count to the <b>end</b> of the sequence. Only the final material balance matters.</li></ul>
<div class="key"><b>Typical case:</b> your knight is attacked by a pawn and has no safe square. Before you give up on it, look at everything it can take: a pawn with check, a defended piece of the same value, or a pawn that wrecks the enemy king's shelter. Something is better than nothing.</div>
<h3>Questions to ask</h3><ol><li>Is one of my pieces trapped or attacked, with no good square to go to?</li><li>Can this piece capture something of equal or higher value right now, or take with check?</li><li>What is the final material balance after the whole sequence, and what does the position look like? Calculate it to the end.</li></ol>
<h3>Zwischenzug and desperado together</h3><p>Both ideas break the "I take, you take back" rhythm. In a capture sequence, always ask before recapturing: <b>is there something better first?</b> And when a piece of yours is doomed, ask: <b>what can it take with it?</b></p>
<div class="key warn">The most common mistake: recapturing automatically. Make it a habit to pause for one second before every recapture and run CCT.</div></div>''', 'lesson', True))
    sic = 'r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 2 6'
    P.append((f'''<div class="lesson">{sechead(5,'Half-open files','A file is a column of the board. What matters for your rooks is whose pawns are still on it.')}
<table class="tbl"><tr><th>File type</th><th>Pawns on it</th><th>Who it helps</th></tr><tr><td><b>Open</b></td><td>No pawns at all</td><td>Both sides: rooks fight for it</td></tr><tr><td><b>Half-open</b> (semi-open)</td><td>Only an enemy pawn, none of yours</td><td>You: your rook presses against that pawn</td></tr><tr><td><b>Closed</b></td><td>Pawns of both colours</td><td>Nobody, until a pawn exchange opens it</td></tr></table>
<div class="side">{fig(sic,'An Open Sicilian after 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 Nc6. The c-file is half-open for Black, the d-file for White.', marks=('c2','c7','d6','d1'))}
<div><h3>Using a half-open file</h3><ul><li><b>Put a rook (or queen) on it</b> to attack the enemy pawn at the end of the file, often the base of a pawn chain.</li><li><b>Double up:</b> two rooks, or rook and queen, add pressure.</li><li><b>Target weak pawns:</b> an isolated or backward pawn on a half-open file is a classic target.</li><li><b>Create an outpost:</b> the file can help you plant a knight on a strong square near the enemy position.</li></ul>
<p>The side that still has a pawn on the file has to defend it, often by blocking the file with a piece.</p></div></div>
<div class="key">In the Sicilian, Black's rook usually goes to <b>c8</b> to use the half-open c-file against c2 and the knight on c3, while White's pieces use the half-open d-file against the d6 pawn. Knowing which files are half-open tells you where your rooks belong.</div></div>''', 'lesson', True))
    pz, allp = puzzle_pages([('fork', 'Double attacks', 'Find a move that attacks two things at once. Checks that also attack a piece are the most common.', 6),
                             ('pin', 'Pins', 'Use a pin to win material: attack the pinned piece, or exploit the fact that it can\'t move or defend.', 7),
                             ('intermezzo', 'In-between moves', 'Don\'t play the automatic move. Find the forcing move that comes first.', 8)])
    P += pz
    P += answer_pages(allp, {'fork': 'Double attack', 'pin': 'Pin', 'intermezzo': 'In-between move'})
    P.append(closing(len(allp), 'Intermediate Worksheets'))
    render(P, 'Intermediate Worksheets', 'intermediate.html')

if __name__ == '__main__':
    foundation(); intermediate()
