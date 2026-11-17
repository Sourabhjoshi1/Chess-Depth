import sys
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
G='/usr/share/fonts/truetype/google-fonts/'
for n,f in [('Pop','Poppins-Regular.ttf'),('PopM','Poppins-Medium.ttf'),('PopB','Poppins-Bold.ttf')]: pdfmetrics.registerFont(TTFont(n,G+f))
pdfmetrics.registerFont(TTFont('Gar','/root/.fonts/EBGaramond-600.ttf')); pdfmetrics.registerFont(TTFont('GarI','/root/.fonts/EBGaramond-400i.ttf'))
INK=colors.HexColor('#1f2547'); BRASS=colors.HexColor('#b08a4e'); MUTE=colors.HexColor('#6b7088'); LINE=colors.HexColor('#b9bccb'); SOFT=colors.HexColor('#f3f2f8')

def rook(c,x,y,s,col):
    c.saveState(); c.translate(x,y+32*s); c.scale(s,-s); c.setFillColor(col); p=c.beginPath()
    for poly in ([(8,5),(11,5),(11,8),(13.5,8),(13.5,5),(18.5,5),(18.5,8),(21,8),(21,5),(24,5),(24,12.2),(21.6,14),(22.5,23),(9.5,23),(10.4,14),(8,12.2)],[(8.5,24.5),(23.5,24.5),(25,27),(7,27)],[(6,28),(26,28),(26,30.5),(6,30.5)]):
        p.moveTo(*poly[0]); [p.lineTo(*q) for q in poly[1:]]; p.close()
    c.drawPath(p,fill=1,stroke=0); c.restoreState()

def header(c,W,H,M,title,sub):
    top=H-M
    rook(c,M,top-11*mm,0.78,INK)
    c.setFillColor(INK); c.setFont('Gar',22); c.drawString(M+29,top-6.2*mm,'ChessDepth')
    c.setFillColor(BRASS); c.setFont('GarI',10.5); c.drawString(M+30,top-10.6*mm,'Think Deep. Play Deeper!')
    c.setFillColor(INK); c.setFont('PopB',15); c.drawRightString(W-M,top-6*mm,title)
    c.setFillColor(MUTE); c.setFont('Pop',8.2); c.drawRightString(W-M,top-10.4*mm,sub)
    c.setStrokeColor(BRASS); c.setLineWidth(1.1); c.line(M,top-13.5*mm,W-M,top-13.5*mm)
    return top-13.5*mm

def field(c,x,y,w,label,h=8.6*mm):
    c.setFillColor(MUTE); c.setFont('Pop',7); c.drawString(x+1.6*mm,y-3.1*mm,label.upper())
    c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(x+1.6*mm,y-h+1.4*mm,x+w-1.6*mm,y-h+1.4*mm)

def footer(c,W,M,page):
    c.setFillColor(MUTE); c.setFont('Pop',7.2)
    c.drawString(M,M-3.5*mm,'ChessDepth Academy  |  www.chessdepth.in  |  Free to print and share')
    c.drawRightString(W-M,M-3.5*mm,page)

def moves_table(c,x,ytop,w,start,n,rh):
    cw=[0.15*w,0.425*w,0.425*w]
    c.setFillColor(INK); c.rect(x,ytop-rh,w,rh,fill=1,stroke=0)
    c.setFillColor(colors.white); c.setFont('PopB',8)
    c.drawCentredString(x+cw[0]/2,ytop-rh+0.32*rh,'#'); c.drawCentredString(x+cw[0]+cw[1]/2,ytop-rh+0.32*rh,'WHITE'); c.drawCentredString(x+cw[0]+cw[1]+cw[2]/2,ytop-rh+0.32*rh,'BLACK')
    y=ytop-rh
    for i in range(n):
        if (i//5)%2==1: c.setFillColor(SOFT); c.rect(x,y-rh,w,rh,fill=1,stroke=0)
        c.setFillColor(INK); c.setFont('PopM',8.6); c.drawCentredString(x+cw[0]/2,y-rh+0.32*rh,str(start+i))
        y-=rh
    c.setStrokeColor(LINE); c.setLineWidth(0.5)
    for i in range(n+1): c.line(x,ytop-rh-i*rh,x+w,ytop-rh-i*rh)
    c.setStrokeColor(INK); c.setLineWidth(0.9); c.rect(x,y,w,ytop-y,fill=0,stroke=1)
    c.setLineWidth(0.5); c.setStrokeColor(LINE)
    c.line(x+cw[0],ytop-rh,x+cw[0],y); c.line(x+cw[0]+cw[1],ytop-rh,x+cw[0]+cw[1],y)
    return y

def box(c,x,y,label,size=3.4*mm):
    c.setStrokeColor(INK); c.setLineWidth(0.8); c.rect(x,y,size,size,fill=0,stroke=1)
    c.setFillColor(INK); c.setFont('PopM',9); c.drawString(x+size+1.6*mm,y+0.5*mm,label)

def page1(c,W,H):
    M=12*mm; y=header(c,W,H,M,'SCORE SHEET','Record every move. Review every game.')
    # details
    y-=3*mm; cw=(W-2*M)/4
    rows=[[('Event',2),('Date',1),('Round',0.5),('Board',0.5)],[('Time control',2),('Venue or platform',2)]]
    for r in rows:
        x=M
        for lab,span in r: field(c,x,y,cw*span,lab); x+=cw*span
        y-=8.6*mm
    # players
    y-=1.5*mm
    for side,fill in (('White',False),('Black',True)):
        c.setStrokeColor(INK); c.setLineWidth(0.8)
        c.setFillColor(INK if fill else colors.white); c.circle(M+2.6*mm,y-5*mm,1.9*mm,fill=1,stroke=1)
        c.setFillColor(INK); c.setFont('PopB',9.5); c.drawString(M+6*mm,y-6*mm,side)
        field(c,M+19*mm,y,(W-2*M)*0.55-19*mm,side+' player'); field(c,M+(W-2*M)*0.55,y,(W-2*M)*0.2,'Rating'); field(c,M+(W-2*M)*0.75,y,(W-2*M)*0.25,'Club / FIDE ID')
        y-=8.6*mm
    field(c,M,y,(W-2*M)*0.75,'Opening'); field(c,M+(W-2*M)*0.75,y,(W-2*M)*0.25,'ECO'); y-=8.6*mm
    y-=3*mm
    # moves
    gap=6*mm; tw=(W-2*M-gap)/2
    bottom_reserve=M+30*mm
    rh=(y-bottom_reserve)/31
    yb=moves_table(c,M,y,tw,1,30,rh); moves_table(c,M+tw+gap,y,tw,31,30,rh)
    # notation key
    y=yb-4.6*mm
    c.setFillColor(MUTE); c.setFont('Pop',7.4)
    c.drawCentredString(W/2,y,'K king   Q queen   R rook   B bishop   N knight   x captures   + check   # mate   O-O castles short   O-O-O castles long   =Q promotes')
    # result + signatures
    y-=9*mm
    c.setFillColor(INK); c.setFont('PopB',9.5); c.drawString(M,y,'Result')
    box(c,M+17*mm,y-0.5*mm,'1-0'); box(c,M+33*mm,y-0.5*mm,'½-½'); box(c,M+50*mm,y-0.5*mm,'0-1')
    sx=M+72*mm; sw=(W-M-sx-6*mm)/2
    for i,lab in enumerate(('White signature','Black signature')):
        xx=sx+i*(sw+6*mm)
        c.setStrokeColor(INK); c.setLineWidth(0.6); c.line(xx,y-0.5*mm,xx+sw,y-0.5*mm)
        c.setFillColor(MUTE); c.setFont('Pop',7); c.drawString(xx,y-4*mm,lab.upper())
    y-=11*mm
    c.setFillColor(MUTE); c.setFont('Pop',7); c.drawString(M,y,'TIME LEFT AT THE END:')
    c.drawString(M+33*mm,y,'WHITE ________     BLACK ________')
    c.drawRightString(W-M,y,'MOVES 61+ ON PAGE 2')
    footer(c,W,M,'Page 1 of 2')

def page2(c,W,H):
    M=12*mm; y=header(c,W,H,M,'AFTER THE GAME','Moves 61 to 100, and your own review')
    y-=4*mm
    gap=6*mm; tw=(W-2*M-gap)*0.42
    rh=(y-(M+8*mm))/41
    moves_table(c,M,y,tw,61,40,rh)
    # review prompts on the right
    x=M+tw+gap; w=W-M-x
    prompts=[('The opening','Did I reach a position I understood? What was my plan?'),
             ('The critical moment','Move number, and what I was thinking there.'),
             ('My best move','What made it good?'),
             ('My biggest mistake','What did I miss: a check, a capture or a threat?'),
             ("Time",'Was I too fast or too slow? Where did my time go?'),
             ('What I will practise next','One thing to work on before my next game.')]
    avail=y-(M+8*mm); ph=avail/len(prompts)
    for t,q in prompts:
        c.setFillColor(INK); c.setFont('PopB',9.5); c.drawString(x,y-4.5*mm,t)
        c.setFillColor(MUTE); c.setFont('Pop',7.6); c.drawString(x,y-8.6*mm,q)
        c.setStrokeColor(LINE); c.setLineWidth(0.5)
        ly=y-15*mm
        while ly>y-ph+3*mm:
            c.line(x,ly,x+w,ly); ly-=7*mm
        y-=ph
    footer(c,W,M,'Page 2 of 2   |   Bring this sheet to your next ChessDepth class')

def build(path,size,tag):
    W,H=size; c=canvas.Canvas(path,pagesize=size)
    c.setTitle('ChessDepth Score Sheet ('+tag+')'); c.setAuthor('ChessDepth'); c.setSubject('Printable chess score sheet')
    page1(c,W,H); c.showPage(); page2(c,W,H); c.showPage(); c.save()
build('chessdepth-score-sheet-a4.pdf',A4,'A4'); build('chessdepth-score-sheet-letter.pdf',LETTER,'US Letter')
