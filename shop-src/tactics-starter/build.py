import json, chess, chess.svg, html
exec(open('text.py').read())
D=json.load(open('chosen.json'))
SECTIONS=[
 ('mate1','Mate in one','Find the move that checkmates straight away. Look for checks first, then ask: can the king escape, block or capture?','fa-chess-king'),
 ('mate2','Mate in two','Your first move is usually a check or a sacrifice that forces the reply. Then deliver mate on the next move.','fa-chess-king'),
 ('fork','Forks','One piece attacks two targets at the same time. Your opponent can only save one of them.','fa-code-branch'),
 ('pin','Pins and skewers','Two enemy pieces stand on the same line. Attack the front one: if it moves, you win the piece behind it.','fa-arrows-alt-h'),
 ('disc','Discovered attacks and deflection','Move one piece out of the way to unleash another, or force a defender to leave its post.','fa-bolt'),
]
LIGHT,DARK='#eef0fb','#a3aae0'
def board_svg(fen, side, lastmove=None, arrows=(), size=300):
    b=chess.Board(fen)
    return chess.svg.board(b, orientation=chess.WHITE if side=='White' else chess.BLACK, lastmove=lastmove, arrows=list(arrows), size=size, coordinates=True,
        colors={'square light':LIGHT,'square dark':DARK,'square light lastmove':'#fde68a','square dark lastmove':'#f4cf5a','margin':'#ffffff','coord':'#6b7280'})
n=0; PZ=[]
for key,*_ in SECTIONS:
    for p in D[key]:
        n+=1; p['n']=n; p['sec']=key; PZ.append(p)
LOGO='<svg viewBox="0 0 32 32" class="logo"><path fill="currentColor" d="M8 5h3v3h2.5V5h5v3H21V5h3v7.2l-2.4 1.8.9 9H9.5l.9-9L8 12.2zM8.5 24.5h15l1.5 2.5H7zM6 28h20v2.5H6z"/></svg>'
pages=[]
def page(body, cls='', num=True):
    pages.append((body,cls,num))
# ---- Cover
page(f'''
<div class="cover-inner">
  <div class="cover-top">{LOGO}<span>ChessDepth Academy</span></div>
  <div class="cover-glyph">♞</div>
  <p class="cover-kicker">Free training pack</p>
  <h1 class="cover-title">Tactics<br>Starter Pack</h1>
  <p class="cover-sub">30 hand-picked puzzles with full solutions and explanations</p>
  <ul class="cover-topics"><li>Mate in one</li><li>Mate in two</li><li>Forks</li><li>Pins &amp; skewers</li><li>Discovered attacks</li></ul>
  <p class="cover-level">For players rated roughly 600–1400 · Beginners to club players</p>
  <p class="cover-url">chessdepth.in</p>
</div>''','cover',False)
# ---- How to use
rows=''.join(f'<li><span class="toc-n">{i+1}</span><span class="toc-t">{s[1]}</span><span class="toc-p">Puzzles {i*6+1}–{i*6+6}</span></li>' for i,s in enumerate(SECTIONS))
page(f'''
<h2 class="h2">How to use this pack</h2>
<p class="lead">Tactics decide most games below 1800. The good news: tactical patterns can be learned. Solve these 30 puzzles carefully and you will start to see the same ideas in your own games.</p>
<div class="steps">
 <div class="step"><b>1</b><div><h3>Solve from the diagram</h3><p>Try to work out the whole solution in your head before you touch a board. Calculating without moving the pieces is the skill you are training.</p></div></div>
 <div class="step"><b>2</b><div><h3>Checks, captures, threats</h3><p>In every position, look at all checks first, then all captures, then moves that threaten something. The answer is almost always among them.</p></div></div>
 <div class="step"><b>3</b><div><h3>Write your answer down</h3><p>Write the move (and the reply you expect) on the line under each puzzle. Then compare with the answers at the back of the pack.</p></div></div>
 <div class="step"><b>4</b><div><h3>Understand, don't just check</h3><p>Read the explanation even when you were right. Knowing <i>why</i> a move works is what makes you spot it next time.</p></div></div>
</div>
<div class="two">
 <div class="box"><h3>Reading the diagrams</h3>
  <ul class="plain">
   <li>The side to move is always at the <b>bottom</b> of the diagram.</li>
   <li><span class="sw y"></span> Yellow squares show your opponent's <b>last move</b>.</li>
   <li><span class="dot w"></span> White to move · <span class="dot b"></span> Black to move</li>
   <li><b>+</b> check · <b>#</b> checkmate · <b>x</b> capture · <b>!</b> strong move</li>
  </ul></div>
 <div class="box"><h3>What's inside</h3><ol class="toc">{rows}</ol><p class="small">Answers and explanations start on page 8.</p></div>
</div>
<div class="score"><h3>Your score</h3>
 <p>Give yourself 1 point for each puzzle you solve completely without help.</p>
 <div class="score-row"><span><b>26–30</b> Excellent: you're ready for harder puzzles.</span><span><b>18–25</b> Good: repeat the ones you missed in a week.</span><span><b>0–17</b> Keep going: re-read the explanations and try again.</span></div>
</div>''')
# ---- Puzzle pages
for i,(key,title,intro,icon) in enumerate(SECTIONS):
    cells=''
    for p in [q for q in PZ if q['sec']==key]:
        hint,_=T[p['id']]
        lm=chess.Move.from_uci(p['first'])
        svg=board_svg(p['fen'],p['side'],lastmove=lm,size=260)
        cells+=f'''<div class="pz"><div class="pz-head"><span class="pz-n">{p['n']}</span><span class="pz-side"><span class="dot {'w' if p['side']=='White' else 'b'}"></span>{p['side']} to move</span></div>
<div class="pz-board">{svg}</div><p class="pz-hint">Hint: {html.escape(hint)}</p><p class="pz-line">Your answer:</p></div>'''
    page(f'''<div class="sec-head"><span class="sec-n">{i+1}</span><div><h2 class="h2">{title}</h2><p>{intro}</p></div></div><div class="grid">{cells}</div>''')
# ---- Solutions
for i,(key,title,intro,icon) in enumerate(SECTIONS):
    rows=''
    for p in [q for q in PZ if q['sec']==key]:
        _,expl=T[p['id']]
        b=chess.Board(p['fen']); km=chess.Move.from_uci(p['uci'][0])
        svg=board_svg(p['fen'],p['side'],arrows=[chess.svg.Arrow(km.from_square,km.to_square,color='#16a34acc')],size=200)
        rows+=f'''<div class="sol"><div class="sol-board">{svg}</div><div class="sol-text"><p class="sol-h"><span class="pz-n">{p['n']}</span>{p['side']} to move <span class="sol-r">Puzzle rating {p['rating']}</span></p><p>{expl}</p></div></div>'''
    page(f'''<p class="ans-kicker">Answers</p><h2 class="h2">{i+1}. {title}</h2><div class="sols">{rows}</div>''','answers')
# ---- Closing
page(f'''
<h2 class="h2">What next?</h2>
<p class="lead">Tactics improve fastest with a little practice every day. Here is how ChessDepth can help you keep going.</p>
<div class="next">
 <div class="nx"><h3>Chess Lab</h3><p>Thousands of rated puzzles that adapt to your level, Puzzle Streak, opening courses and a progress dashboard, all in your browser.</p><p class="url">chessdepth.in/lab</p></div>
 <div class="nx"><h3>Classes with a coach</h3><p>Structured online classes from beginner to tournament level, with worksheets, regular tests and game reviews. Your first demo class is free.</p><p class="url">chessdepth.in/courses</p></div>
 <div class="nx"><h3>More training packs</h3><p>Checkmate patterns, tactics by theme, endgame workbooks, opening repertoires and 90-day improvement plans.</p><p class="url">chessdepth.in/shop</p></div>
</div>
<div class="tracker"><h3>Puzzle tracker</h3><p class="small">Tick each puzzle you solved without help. Come back to the empty ones in a week.</p>
<div class="tk">{''.join(f'<span><b>{k}</b></span>' for k in range(1,31))}</div></div>
<div class="contact"><div>{LOGO}<b>ChessDepth Academy</b></div><p>WhatsApp / phone +91 98230 29262 · info@chessdepth.in · Instagram @chessdepthacademy1</p></div>
<p class="credits">Puzzle positions from the free Lichess puzzle database (lichess.org, CC0). Selected, checked and explained by ChessDepth Academy. © 2026 ChessDepth Academy. This pack is free to download, print and share for personal and classroom use.</p>
''')
total=len(pages)
out=[]
for k,(body,cls,num) in enumerate(pages,1):
    foot=f'<div class="foot"><span>ChessDepth Academy · Tactics Starter Pack</span><span>{k}</span></div>' if num else ''
    out.append(f'<section class="page {cls}">{body}{foot}</section>')
CSS=open('pack.css').read()
open('pack.html','w').write(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Tactics Starter Pack – ChessDepth Academy</title><style>{CSS}</style></head><body>{"".join(out)}</body></html>')
print('pages',total)
