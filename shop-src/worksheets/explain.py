# Hints and explanations for the pack puzzles, generated from the verified solution lines.
import chess, re
VAL = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
NAME = {chess.PAWN: 'pawn', chess.KNIGHT: 'knight', chess.BISHOP: 'bishop', chess.ROOK: 'rook', chess.QUEEN: 'queen', chess.KING: 'king'}
SQ = chess.square_name

def mat(b, c): return sum(VAL[p.piece_type] for p in b.piece_map().values() if p.color == c)

def line(b, moves):
    s = b.variation_san(moves)
    return re.sub(r'(\d+)\.\s', r'\1.', s).replace('... ', '...')

def gain_text(start, end, solver):
    if end.is_checkmate(): return 'checkmate'
    g = (mat(end, solver) - mat(start, solver)) - (mat(end, not solver) - mat(start, not solver))
    lost = {t: len(start.pieces(t, not solver)) - len(end.pieces(t, not solver)) for t in VAL}
    mine = {t: len(start.pieces(t, solver)) - len(end.pieces(t, solver)) for t in VAL}
    promo = any(m.promotion for m in end.move_stack[len(start.move_stack):])
    if promo and g >= 5: return 'a new queen'
    if lost[chess.QUEEN] > mine[chess.QUEEN] and g >= 3:
        if g >= 8: return 'the queen'
        gv = [t for t in (chess.ROOK, chess.BISHOP, chess.KNIGHT) if mine[t] > 0]
        return f'the queen for a {NAME[gv[0]]}' if gv else 'the queen'
    if g >= 5 and lost[chess.ROOK] > mine[chess.ROOK]: return 'a rook'
    if g == 2 and lost[chess.ROOK] and mine[chess.KNIGHT] + mine[chess.BISHOP]: return 'the exchange (a rook for a minor piece)'
    if g >= 3: return 'a piece'
    if g == 2: return 'two pawns'
    if g == 1: return 'a pawn'
    return None

SECT={'mate1':'mateIn1','backrank':'backRankMate','hanging':'hangingPiece','fork':'fork','pin':'pin','intermezzo':'intermezzo'}
def describe(p, sec):
    """p: dict with fen, moves (uci, first = opponent's last move). Returns dict side, first, hint, text."""
    b = chess.Board(p['fen']); last = chess.Move.from_uci(p['moves'][0]); b.push(last); b.fullmove_number = 1
    solver = b.turn; side = 'White' if solver else 'Black'; opp = 'Black' if solver else 'White'
    mv = [chess.Move.from_uci(u) for u in p['moves'][1:]]
    first = mv[0]; san1 = b.san(first); piece = b.piece_at(first.from_square)
    end = b.copy(); [end.push(m) for m in mv]
    g = gain_text(b, end, solver)
    ln = line(b, mv)
    th = [SECT[sec]]; pname = NAME[piece.piece_type]
    after = b.copy(); after.push(first)
    # what the moved piece attacks after the first move
    tg = [after.piece_at(s) for s in after.attacks(first.to_square) if after.piece_at(s) and after.piece_at(s).color != solver]
    tgn = sorted({(VAL[t.piece_type] if t.piece_type != chess.KING else 99, NAME[t.piece_type]) for t in tg}, reverse=True)
    if 'mateIn1' in th:
        hint = 'Try every check.'
        why = f'The {pname} gives check, and the {opp.lower()} king can\'t escape, block or capture.'
        if end.is_checkmate():
            ks = end.king(not solver); own = [SQ(s) for s in end.attacks(ks) if end.piece_at(s) and end.piece_at(s).color != solver]
            if own: why += f' Its own pieces on {", ".join(own[:3])} take away its escape squares.'
        text = f'<b>{ln}</b>. {why}'
    elif 'backRankMate' in th:
        hint = 'Who guards the back rank?'
        text = f'<b>{ln}</b>. The king has no escape square because its own pawns block it in. ' + ('A check on the back rank is mate.' if len(mv) == 1 else 'The first move removes or deflects the only defender of the back rank, then the mate follows.')
    elif 'hangingPiece' in th:
        cap = b.piece_at(first.to_square)
        hint = 'Is anything left undefended?'
        defended = bool(after.attackers(not solver, first.to_square))
        cn = NAME[cap.piece_type] if cap else 'piece'
        text = f'<b>{ln}</b>. {opp}\'s {cn} on {SQ(first.to_square)} was left ' + ('without enough defenders, so ' if defended else 'undefended, so ') + ('you take it, and then your pawn queens.' if g == 'a new queen' else f'you take it and win {g}.' if g and g != 'checkmate' else 'you take it.')
    elif 'fork' in th:
        hint = 'Which piece can attack two things at once?'
        targets = ' and the '.join(n for _, n in tgn[:2]) if len(tgn) >= 2 else 'two pieces'
        text = f'<b>{ln}</b>. After {san1} the {pname} on {SQ(first.to_square)} attacks the {targets} at the same time. {opp} can only save one' + (f', and {side} wins {g}.' if g and g != 'checkmate' else '.')
    elif 'pin' in th:
        hint = 'What is pinned, and to what?'
        pins = []
        for bb in (b, after):
            for s_, pc in bb.piece_map().items():
                if pc.color != solver and pc.piece_type != chess.KING and bb.is_pinned(not solver, s_):
                    pins.append(f'{opp}\'s {NAME[pc.piece_type]} on {SQ(s_)}')
            if pins: break
        lead = (f'The key is the pin: {pins[0]} is pinned to its king, so it can\'t move away or help.' if pins
                else 'The key is the pin: a piece stuck in front of its king or queen can\'t move away or help.')
        text = f'<b>{ln}</b>. {lead}' + (f' {side} wins {g}.' if g and g != 'checkmate' else '')
    elif 'intermezzo' in th:
        hint = 'Is there something stronger first?'
        text = f'<b>{ln}</b>. Instead of the automatic move, {side} first plays {san1}, which {opp} must answer. Only then does {side} collect the material' + (f', ending up {g} ahead.' if g and g != 'checkmate' else '.')
    else:
        hint = 'Checks, captures and threats.'
        text = f'<b>{ln}</b>.'
    if g == 'checkmate' and sec not in ('mate1', 'backrank'): text += ' It ends in checkmate.'
    return dict(side=side, first=last.uci(), key=first.uci(), hint=hint, text=text, rating=p['rating'], fen=b.fen())
