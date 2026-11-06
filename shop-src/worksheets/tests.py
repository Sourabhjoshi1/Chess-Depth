# ChessDepth Evaluation Test Papers pack: two written tests, one position test, and model answers.
import chess
from packs import svg, fig, cover, sechead, render, LOGO

def paper_head(title, level, mins, marks):
    return f'''<div class="paper-h"><div><p class="ans-kicker">ChessDepth Academy · {level}</p><h2 class="h2">{title}</h2></div>
<div class="meta">Instructor: AFM Sourabh Joshi<br>Time: {mins} · Total: {marks} marks<br>Answer all questions</div></div>
<div class="fill"><span>Name:</span><span>Batch:</span><span>Date:</span></div>'''

def qs(items, start=1, lines=1):
    out = ''
    for k, q in enumerate(items, start):
        out += f'<div class="q"><b>{k}.</b><div>{q}' + ''.join('<span class="wl"></span>' for _ in range(lines)) + '</div></div>'
    return out

def sec(t, m): return f'<div class="qsec"><span>{t}</span><small>{m}</small></div>'

# ---------------- Beginner test
B_A = ['What is the value of a bishop and of a knight, in points?', 'Which is more valuable, a rook or a bishop?', 'Write any two opening principles.',
       'What is castling, and when is it not allowed?', 'What does "development" mean in chess?', 'What is the risk of bringing your queen out early in the opening? Is it usually a good idea?',
       'What is a tempo in chess?', 'You win your opponent\'s queen but lose your rook for it. About how many points have you gained?', 'Which piece can move both diagonally and in straight lines?',
       'Write one golden rule of the opening.']
B_B = ['What is a pin? Explain with an example (in words).', 'What is a skewer, and how is it different from a pin?', 'What is a double attack? Give one example from your games or your imagination.',
       'What is a back-rank mate?', 'Why is it dangerous to move the pawns in front of your castled king too much?',
       'White: King g1, Rook d1, Bishop b2. Black: King e4, Queen e8. White to move. Who wins material, and how? (Hint: look for a skewer.)',
       'Black\'s king is on g8 with its pawns on f7, g7 and h7, and nothing guards the back rank. What tactical idea does White have with a rook?',
       'Which piece is usually the best one for making a pin?', 'Why does a double check often lead to checkmate?', 'What is a discovered attack? Explain briefly.']
B_C = ['Write any two rules for good piece placement in the opening.', 'What should you do if your opponent attacks your queen in the opening?', 'Name any two checkmate patterns you have learned.',
       'Why is king safety still important in the endgame?', 'Your opponent blunders a piece. What should you check before you capture it?']
B_D = ['You are White: King g1, Queen d2, Rook d1, pawns f2, g2, h2. Black: King g8, Rook d8, Queen c7, pawns f7, g7, h7. White to move. What is your best move, and why?',
       'You are Black and see a chance to fork with your knight. What should you check before jumping in?']

# ---------------- Intermediate test
I_A = ['What is a "pawn structure"? Name two common pawn structures (for example the Isolated Queen\'s Pawn or the Carlsbad) and describe the plans for both sides in one of them.',
       'What is a space advantage, and how do you usually use it? Mention two drawbacks that often come with a big space advantage.',
       'Explain "prophylaxis". Give one concrete example of a prophylactic move and what it is for.',
       'Why is the seventh rank so important for a rook in the middlegame and endgame? Why are two rooks on the seventh so powerful?',
       'What is a "bad bishop" and what is a "good bishop"? How can you improve a bad bishop?']
I_B = ['What is a deflection (or decoy) tactic? Describe a position where a piece is lured away from its defensive job.',
       'What is the difference between a zwischenzug (in-between move) and a normal forcing sequence? Give a short example.',
       'What is a clearance sacrifice? Why is it often the key to opening lines for a queen or rook attack on the king?',
       'What is the opposition (direct and diagonal) in king and pawn endgames? Why is winning the opposition the key to promoting a pawn?',
       'White: Queen d5, Knight h6. Black: King h8, Rook f8, pawns g7 and h7. White plays Qg8+!! What is this pattern called? Explain the forced follow-up.']
I_C = ['Explain the "rule of the square". How does it help you decide whether to chase a pawn or do something else?',
       'Describe the two main steps for checkmating with king and rook against a lone king.']
I_D = ['You are a pawn down, but you have a clear lead in development and strong pressure in the centre. Should you win the pawn back immediately, or keep developing and attacking? Explain.',
       'Your opponent has just castled and their king looks safe. You are thinking about a pawn storm (h4-h5, g4). What must you check before starting it?']

# ---------------- Position test (from ChessDepth Test Paper 2)
POS = [
 ('r1bqk2r/ppp2ppp/2p2n2/4p3/1b2P3/P1N2N2/1PPP1PPP/R1BQK2R b KQkq - 0 6', True, 'a2a3', (), 'White has just played a3. Was it a good move? If not, how can Black punish it, and what is the idea behind it?'),
 ('r2qk2r/ppp2p2/2p2p2/2b4p/4P3/P1N5/1PPP1PPP/R1BQ1RK1 w kq - 0 10', True, None, (), 'How many times do White and Black control the d4 square? White would like to play d4 here. Is it a good move or a bad one? Explain.'),
 ('4k2r/pppr1p2/2p2p2/7p/3bPB2/P1N5/1PP2PPP/R2R2K1 w k - 0 15', True, 'd8d7', (('f4', 'c7'),), 'White played Bxc7, thinking "if ...Rxc7, then Rxd4". What did White miss?'),
 ('4k1r1/p2r1p2/1p3p2/2p4p/1B1bP3/P1N5/1PP2PPP/R2R2K1 w - - 0 17', True, 'c6c5', (), 'Black has just played ...c5, attacking the bishop on b4. Is White losing a piece? Explain the whole position.'),
 ('6r1/p4p2/1p2kp2/5N1p/4P3/P7/2P2PPP/3R2K1 w - - 0 25', True, 'd7e6', (), 'White to play and force mate. What does White play, and what is the idea behind it?'),
 ('6r1/p4p2/1p2kp2/5N1p/4P3/P7/2P2PPP/3R2K1 w - - 0 25', True, 'd7e6', (('d1', 'd6'),), 'In the same position, White played Rd6+. Was it a good move, or did White miss something? Explain.'),
 ('8/p3kp2/1p3p2/7p/4r1r1/P1P5/5PPP/R1R3K1 w - - 0 30', True, 'g8g4', (), 'Black has just played ...Rg4. How can White win?'),
 ('8/8/8/1k5p/8/2R2P2/1p3KPP/8 w - - 0 40', True, 'b3b2', (), 'Black has just pushed the pawn to b2. How does White stop it? Find the winning move.'),
 ('r3k2r/1pp1qp1p/p3b1p1/3P2P1/1P6/P2P1Q1P/3P4/bNB1K1NR b Kkq - 0 12', False, 'e4d5', (), 'Black to play. What should Black play here?'),
 ('r3k2r/1pp1qp1p/p3b1p1/3P2P1/1P6/P2P1Q1P/3P4/bNB1K1NR b Kkq - 0 12', False, 'e4d5', (('e6', 'g4'),), 'In the same position, Black played ...Bg4+. Is it a good move? How can White respond, and what else could Black have played? Explain why.'),
]

ANS_B = [
 'Bishop 3, knight 3.', 'The rook (5 points against 3).', 'For example: control the centre, develop your knights and bishops, castle early, don\'t move the same piece twice without a reason.',
 'Castling moves the king two squares towards a rook and puts the rook on the other side of the king. Not allowed if the king or that rook has moved, if pieces stand between them, if the king is in check, or if the king would pass through or land on an attacked square.',
 'Bringing your pieces from their starting squares to active squares where they control the centre and can work together.',
 'The queen can be chased by the opponent\'s knights, bishops and pawns, which develop with tempo while you lose time. Usually it is not a good idea.',
 'A tempo is one move, or a unit of time. You gain a tempo when you make a useful move that also forces your opponent to react.',
 'About 4 points (queen 9 minus rook 5).', 'The queen.', 'For example: develop all your pieces before you attack.',
 'A pin attacks a piece that can\'t move without exposing a more valuable piece behind it. Example: a white bishop on b5 pins the black knight on c6 to the king on e8.',
 'A skewer attacks a valuable piece; when it moves away, you capture the piece behind it. In a pin the less valuable piece is in front; in a skewer the more valuable one is in front.',
 'One move that attacks two targets at once, for example a knight on c7 attacking a king on e8 and a rook on a8.',
 'A mate by a rook or queen on the back rank (1st or 8th), when the king is trapped by its own pawns.',
 'Pawn moves can\'t be taken back. They leave holes and open lines next to the king that enemy pieces can use.',
 'White wins the queen: 1.Re1+! is a skewer. The king must leave the e-file (the bishop on b2 also takes away d4 and e5), and 2.Rxe8 takes the queen.',
 'A back-rank mate: a rook check on the 8th rank (Re8 or Rd8) is mate, because the king can\'t escape past its own pawns.',
 'The bishop (rooks and queens can also pin, but bishops make pins most often).',
 'The king is attacked by two pieces at once. You can\'t block or capture both, so the king must move, and often it has no safe square.',
 'One piece moves out of the way and uncovers an attack by a piece behind it. The moving piece can make a second threat at the same time.',
 'For example: knights before bishops; put pieces on active central squares; don\'t block your centre pawns; connect your rooks.',
 'Move the queen to a safe square, ideally gaining time (for example by developing or threatening something). Don\'t keep moving it while your other pieces stay at home.',
 'For example: back-rank mate, smothered mate, Scholar\'s Mate, Fool\'s Mate, the ladder mate.',
 'There are fewer pieces, but the king can still be checkmated, forked or skewered, and it must stay safe while it becomes active.',
 'Use CCT for your opponent: is it really free, or a trap? After you capture, does your opponent have a check, a capture or a threat (mate, a fork, a pin)?',
 '1.Qxd8+! Qxd8 2.Rxd8#. The rook on d8 is Black\'s only back-rank defender. White removes it with a queen sacrifice and mates on the back rank.',
 'Is the fork square safe? Can the opponent capture the knight, give a check, or move one target with a threat? Count the material after the whole sequence, and check that you don\'t leave your own pieces hanging.',
]
ANS_I = [
 'The arrangement of the pawns, which decides the plans. IQP: the side with the isolated pawn wants active pieces, a kingside attack and the d4-d5 break; the other side blockades d5 and trades pieces towards an endgame. Carlsbad: White plays the minority attack (b4-b5) against c6; Black looks for kingside play and a knight on e4.',
 'More room behind your pawns for your pieces. Use it by keeping pieces on (avoid exchanges) and gaining more space. Drawbacks: advanced pawns can become targets, and the squares behind them can become weak.',
 'Preventing your opponent\'s idea before carrying out your own. Examples: h3 to stop ...Bg4 or ...Ng4; a4 to stop ...b5; Kh1 to step off a diagonal before it opens.',
 'On the 7th the rook attacks pawns on their starting squares and cuts the enemy king off on the back rank. Two rooks there attack everything along the rank and create mating threats.',
 'A bad bishop is blocked by its own pawns on its colour; a good bishop has its pawns on the other colour. Improve it by moving the pawns, bringing the bishop outside the pawn chain, or exchanging it.',
 'Deflection forces a defender away from a key square or piece; a decoy lures a piece onto a bad square. Example: a rook guards the back rank; a check with another piece forces it to capture, and the back rank is open.',
 'In a normal sequence you make the expected moves (I take, you take back). A zwischenzug inserts a forcing move first. Example: White takes a knight on c6, and instead of recapturing at once Black first plays ...Bxf2+, and recaptures after the king moves.',
 'Giving up a piece to clear a square or a line for another piece. Against the king, it opens a file or diagonal for the queen or rook, or frees a square for a mating piece.',
 'Direct opposition: kings face each other on a line with one square between them, and the other side has to move. Diagonal opposition: the same on a diagonal. With the opposition your opponent\'s king must give way, so your king reaches the key squares in front of the pawn.',
 'Smothered mate (Philidor\'s legacy). 1.Qg8+!! Rxg8 (the king can\'t take, because the knight on h6 guards g8) 2.Nf7#: the king is boxed in by its own rook and pawns.',
 'Draw a square from the pawn to its promotion square. If the defending king is inside the square (or can step into it with the move), it catches the pawn. If not, the pawn queens, so you can spend your moves elsewhere.',
 'Step 1: use the rook to cut the king off and push it, rank by rank, to the edge of the board, with your king helping. Step 2: put your king opposite the enemy king and give a rook check along the edge: mate.',
 'Usually keep developing and attacking. A lead in development is a temporary advantage that disappears if you spend time winning the pawn back. Take the pawn only if it costs no time and doesn\'t release the pressure.',
 'Is your own king safe (are you castled on the same side)? Is the centre closed? (A flank attack with an open centre is risky.) Can the opponent counter-attack in the centre? Will the storm open files towards their king? Are your pieces ready to join?',
]
ANS_I_BONUS = 'White to move must deal with the attack on the queen (the e5 pawn attacks d4). After a queen exchange such as 1.Qxd8 Rxd8 the position is equal: same material, symmetrical pawns. Neither side has a real strategic advantage.'
ANS_POS = [
 'Not a blunder, but it doesn\'t develop a piece. Black can punish it with <b>6...Bxc3! 7.bxc3 Nxe4</b>, removing the only defender of e4 and winning a pawn. White gets it back with 8.Qe2 (attacking the knight and then e5), so the game stays level. The idea is <b>removing the defender</b>. Developing moves such as d3 or O-O were more useful than a3.',
 'Black controls d4 twice (bishop c5 and queen d8 on the open d-file). White controls it zero times: the d2 pawn blocks the queen. After <b>d4?</b> only the queen supports it (1 against 2), so Black wins a pawn with ...Bxd4 or ...Qxd4. <b>d4 is a bad move.</b> A quiet move such as d3 or Kh1 is better.',
 'White missed the in-between move <b>15...Bxc3!</b> The bishop on d4 was attacked anyway, so it takes the knight first (a desperado). After 16.Rxd7 Kxd7, Black has won back the piece and soon picks up White\'s queenside pawns. White\'s big advantage almost disappears (Stockfish: about +5 before Bxc7, about +1.8 after).',
 'No. <b>17.Nd5!</b> blocks the d-file, so the rook on d7 no longer defends the bishop on d4, which is attacked by Rd1. If 17...cxb4 18.Rxd4 and White is still a piece up. If 17...Rxd5 18.exd5 also wins. White saves the material by counter-attacking.',
 '<b>25.f4!</b> A quiet move that takes the e5 square from the black king. Now Rd6# is threatened: the rook on d6 is protected by the knight, and the king has no square (d5 and f5 are covered by the e4 pawn, e7 by the knight, d7 by the rook). Black can only delay it: 25...Rxg2+ 26.Kxg2 h4 27.Rd6#.',
 'Rd6+ still wins, but it misses the mate. After <b>25.Rd6+ Ke5!</b> the king escapes to e5. The point of 25.f4! was to take that square away <b>first</b>, so that Rd6 is mate.',
 '<b>30.f3!</b> A pawn fork: the f3 pawn attacks both rooks, on e4 and g4. Black can save only one rook, and White wins the other.',
 '<b>40.Rb3+!</b> The check gains a tempo: after the king moves, 41.Rxb2 wins the pawn and White wins the endgame. 40.Rc8 (with the idea Rb8+ and Rxb2) also wins. Slow moves lose, because the pawn queens next move.',
 '<b>12...Bxd5+!</b> The bishop leaves the e-file, so the queen on e7 gives a <b>discovered check</b>, and the bishop on d5 also attacks the queen on f3. After 13.Qe3 (blocking) Bxh1, Black wins the rook on h1 as well. (Stockfish: about −7.)',
 '12...Bg4+ is a good move: it is also a discovered check, and the bishop attacks the queen. White must block with 13.Qe3 or 13.Qe4 (13.Kd1? Bxf3+ wins the queen), and after 13...Bf5 Black is clearly better (about −4). But <b>12...Bxd5+!</b> was even stronger: it also takes a pawn and wins the rook on h1.',
]

def build():
    P = [cover('Free test papers · Level 1 and 2', 'Evaluation<br>Test Papers', 'The tests we use in ChessDepth classes, with model answers for students and coaches',
               ['Beginner written test', 'Intermediate written test', 'Position test', 'Model answers'], 'For students and coaches · beginner to roughly 1500', '♖')]
    P.append((f'''<h2 class="h2">How to use these tests</h2><p class="lead">ChessDepth students take a test like these every few weeks. They show what has been learned, and what needs another look. You can use them on your own, with a coach, or with a whole class.</p>
<div class="steps">
 <div class="step"><b>1</b><div><h3>Print and time it</h3><p>Each written test takes up to 2 hours and is marked out of 50. The position test has 10 diagrams and takes about an hour.</p></div></div>
 <div class="step"><b>2</b><div><h3>No board, no engine</h3><p>Answer from the diagrams and from what you know. Write your reasons, not just the move: a correct move with a correct reason gets full marks.</p></div></div>
 <div class="step"><b>3</b><div><h3>Mark with the key</h3><p>Model answers are at the back. Answers in your own words are fine if the idea is right.</p></div></div>
 <div class="step"><b>4</b><div><h3>Go back to the lesson</h3><p>For every question you missed, re-read the matching chapter in our Foundation or Intermediate Worksheets.</p></div></div>
</div>
<div class="two"><div class="box"><h3>What's inside</h3><ol class="toc"><li><span class="toc-n">1</span><span class="toc-t">Beginner Evaluation Test 1</span><span class="toc-p">page 3</span></li><li><span class="toc-n">2</span><span class="toc-t">Intermediate Evaluation Test 1</span><span class="toc-p">page 5</span></li><li><span class="toc-n">3</span><span class="toc-t">Position Test</span><span class="toc-p">page 7</span></li><li><span class="toc-n">4</span><span class="toc-t">Model answers</span><span class="toc-p">page 11</span></li></ol></div>
<div class="box"><h3>Marking guide</h3><ul class="plain"><li><b>45–50</b> Excellent: ready for the next level.</li><li><b>35–44</b> Good: revise the topics you missed.</li><li><b>25–34</b> Fair: repeat the worksheets for this level.</li><li><b>Below 25</b> Go back through the lessons, then retake the test in a month.</li></ul></div></div>''', '', True))
    # Beginner test: 2 pages
    P.append((f'''{paper_head('Beginner Evaluation Test 1', 'Beginner level', '2 hours', '50')}
{sec('Section A · Fundamentals', '10 marks · 1 mark each')}{qs(B_A, 1)}
{sec('Section B · Tactical themes', '20 marks · 2 marks each')}{qs(B_B[:5], 11)}''', 'lesson', True))
    P.append((f'''{qs(B_B[5:], 16)}
{sec('Section C · Practical understanding', '10 marks · 2 marks each')}{qs(B_C, 21)}
{sec('Section D · Critical thinking', '10 marks · 5 marks each')}{qs(B_D, 26, 2)}
{sec('Bonus question (optional)', '5 marks')}<div class="q"><b>★</b><div>Describe a moment in one of your games where you used a pin, fork or skewer, or spotted one too late. What did you learn from it?<span class="wl"></span><span class="wl"></span></div></div>''', 'lesson', True))
    P.append((f'''{paper_head('Intermediate Evaluation Test 1', 'Intermediate level', '2 hours', '50')}
{sec('Section A · Positional and strategic concepts', '15 marks · 3 marks each')}{qs(I_A, 1, 2)}
{sec('Section B · Advanced tactical themes', '15 marks · 3 marks each')}{qs(I_B[:2], 6, 2)}''', 'lesson', True))
    P.append((f'''{qs(I_B[2:], 8, 2)}
{sec('Section C · Endgame mastery', '10 marks · 5 marks each')}{qs(I_C, 11, 2)}
{sec('Section D · Critical thinking and calculation', '10 marks · 5 marks each')}{qs(I_D, 13, 2)}
{sec('Bonus question (optional): evaluation', '5 marks')}<div class="q"><b>★</b><div>White: King f2, Queen d4, Rook a1, pawn e4. Black: King g8, Queen d8, Rook e8, pawn e5. White to move. Who has the better position, and why? Think about piece activity, coordination and the centre.<span class="wl"></span><span class="wl"></span></div></div>''', 'lesson', True))
    # Position test: 2 per page
    groups = [(0, 2), (2, 5), (5, 8), (8, 10)]
    for gi, (a, z) in enumerate(groups):
        body = '' if gi else f'{paper_head("Position Test", "Beginner to intermediate", "about 1 hour", "10 questions")}'
        for j in range(a, z):
            fen, wb, last, arrows, q = POS[j]
            side = 'White' if chess.Board(fen).turn else 'Black'
            lm = chess.Move.from_uci(last) if last else None
            body += f'''<div class="pq"><div>{svg(fen, wb, arrows, lm, size=300)}</div><div><p class="ans-kicker">Question {j+1} · {side} to move</p><p class="qt">{q}</p><div class="lines">{'<span></span>' * 5}</div></div></div>'''
        P.append((body, 'lesson', True))
    # Answers
    def alist(lst, start): return ''.join(f'<div class="ansq"><b>{n}.</b><div>{a}</div></div>' for n, a in enumerate(lst, start))
    P.append((f'''<p class="ans-kicker">Model answers</p><h2 class="h2">Beginner Evaluation Test 1</h2>{alist(ANS_B[:22], 1)}''', 'lesson', True))
    P.append((f'''{alist(ANS_B[22:], 23)}<p class="ans" style="margin-top:3mm"><b>Bonus:</b> any honest example earns the marks if it names the tactic and the lesson learned.</p>
<p class="ans-kicker" style="margin-top:6mm">Model answers</p><h2 class="h2">Intermediate Evaluation Test 1</h2>{alist(ANS_I[:9], 1)}''', 'lesson', True))
    P.append((f'''{alist(ANS_I[9:], 10)}<p class="ans" style="margin-top:3mm"><b>Bonus:</b> {ANS_I_BONUS}</p>''', 'lesson', True))
    P.append((f'''<p class="ans-kicker">Model answers · checked with Stockfish</p><h2 class="h2">Position Test</h2>{alist(ANS_POS, 1)}
<div class="contact" style="margin-top:6mm"><div>{LOGO}<b>ChessDepth Academy</b></div><p>Online classes from beginner to tournament level · chessdepth.in · WhatsApp +91 98230 29262 · info@chessdepth.in</p></div>
<p class="credits">© 2026 ChessDepth Academy. Free to download, print and use for personal and classroom use.</p>''', 'lesson', True))
    render(P, 'Evaluation Test Papers', 'tests.html')

if __name__ == '__main__':
    build()
