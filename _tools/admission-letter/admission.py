import sys, json
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, KeepTogether

S = json.load(open(sys.argv[1]))
G='/usr/share/fonts/truetype/google-fonts/'
pdfmetrics.registerFont(TTFont('Pop', G+'Poppins-Regular.ttf')); pdfmetrics.registerFont(TTFont('PopM', G+'Poppins-Medium.ttf')); pdfmetrics.registerFont(TTFont('PopB', G+'Poppins-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Gar', '/root/.fonts/EBGaramond-600.ttf')); pdfmetrics.registerFont(TTFont('GarI', '/root/.fonts/EBGaramond-400i.ttf'))
pdfmetrics.registerFontFamily('Pop', normal='Pop', bold='PopB', italic='Pop', boldItalic='PopB')
INK=colors.HexColor('#1f2547'); BRASS=colors.HexColor('#b08a4e'); SOFT=colors.HexColor('#f6f5fa'); LINE=colors.HexColor('#e6e3ef'); MUTE=colors.HexColor('#5b6080')
W,H=A4; M=20*mm

def rook(c, x, y, s, col):
    c.saveState(); c.translate(x, y+32*s); c.scale(s, -s); c.setFillColor(col); p=c.beginPath()
    for poly in ([(8,5),(11,5),(11,8),(13.5,8),(13.5,5),(18.5,5),(18.5,8),(21,8),(21,5),(24,5),(24,12.2),(21.6,14),(22.5,23),(9.5,23),(10.4,14),(8,12.2)],[(8.5,24.5),(23.5,24.5),(25,27),(7,27)],[(6,28),(26,28),(26,30.5),(6,30.5)]):
        p.moveTo(*poly[0]); [p.lineTo(*q) for q in poly[1:]]; p.close()
    c.drawPath(p, fill=1, stroke=0); c.restoreState()

def page(c, doc):
    c.saveState()
    c.setFillColor(INK); c.rect(0, H-38*mm, W, 38*mm, fill=1, stroke=0)
    c.setFillColor(BRASS); c.rect(0, H-39.2*mm, W, 1.2*mm, fill=1, stroke=0)
    rook(c, M, H-27*mm, 0.95, colors.white)
    c.setFillColor(colors.white); c.setFont('Gar', 27); c.drawString(M+36, H-19.5*mm, 'ChessDepth')
    c.setFillColor(colors.HexColor('#d2ad6e')); c.setFont('GarI', 12); c.drawString(M+37, H-25.5*mm, 'Think Deep. Play Deeper!')
    c.setFillColor(colors.white); c.setFont('PopM', 10.5); c.drawRightString(W-M, H-15.5*mm, 'ChessDepth Academy')
    c.setFillColor(colors.HexColor('#c9cde6')); c.setFont('Pop', 8.5)
    c.drawRightString(W-M, H-20.5*mm, 'Bhopal, India  |  Live online chess coaching')
    c.drawRightString(W-M, H-25*mm, 'www.chessdepth.in  |  WhatsApp +91 98230 29262')
    c.drawRightString(W-M, H-29.5*mm, 'info@chessdepth.in')
    c.setStrokeColor(LINE); c.line(M, 16*mm, W-M, 16*mm)
    c.setFillColor(MUTE); c.setFont('Pop', 7.8)
    c.drawString(M, 11*mm, 'www.chessdepth.in  |  info@chessdepth.in  |  WhatsApp +91 98230 29262')
    c.drawRightString(W-M, 11*mm, 'Scholar No. ' + S['no'])
    c.restoreState()

st=lambda n,**k: ParagraphStyle(n,**k)
P=st('p',fontName='Pop',fontSize=9.4,leading=13.6,textColor=colors.HexColor('#2b2f45'),spaceAfter=7)
SM=st('sm',parent=P,fontSize=8.8,leading=13,textColor=MUTE,spaceAfter=0)
TITLE=st('t',fontName='Gar',fontSize=24,leading=27,textColor=INK,spaceAfter=2)
EYE=st('e',fontName='PopM',fontSize=8.5,leading=11,textColor=BRASS)
H2=st('h2',fontName='PopB',fontSize=11,leading=15,textColor=INK,spaceBefore=6,spaceAfter=3)
TDL=st('tdl',fontName='Pop',fontSize=9.3,leading=13,textColor=MUTE)
TDV=st('tdv',fontName='PopB',fontSize=9.6,leading=13.5,textColor=INK)
LI=st('li',parent=P,spaceAfter=2)
SIGN=st('sg',fontName='Gar',fontSize=17,leading=20,textColor=INK)

def bullets(items):
    t=Table([[Paragraph('<font color="#b08a4e">&bull;</font>', st('b',parent=LI,fontName='PopB',fontSize=12,leading=15)), Paragraph(i, LI)] for i in items], colWidths=[5*mm,None])
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),1.5)]))
    return t

ref=Table([[Paragraph('<b>Scholar No.</b> '+S['no'], st('r',parent=SM,textColor=INK,fontSize=9.5)), Paragraph('<b>Date</b> '+S['date'], st('r2',parent=SM,textColor=INK,fontSize=9.5,alignment=2))]], colWidths=[(W-2*M)/2]*2)
ref.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)]))

details=[['Student', S['student']],['Age', S['age']],['Scholar number', S['no']],['Programme', S['programme']],['Level', S['level']],['Coach', S['coach']],
         ['Classes', S['classes']],['Start date', S['start']],['Monthly fee', S['fee']]]
dt=Table([[Paragraph(a,TDL),Paragraph(b,TDV)] for a,b in details], colWidths=[42*mm, W-2*M-42*mm])
dt.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),SOFT),('LINEBELOW',(0,0),(-1,-2),0.6,colors.white),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),3.4),('BOTTOMPADDING',(0,0),(-1,-1),3.4),('LINEBEFORE',(0,0),(0,-1),3,BRASS),('VALIGN',(0,0),(-1,-1),'MIDDLE')]))

s=[ref, Spacer(1,4), Paragraph('LETTER OF ADMISSION', EYE), Paragraph('Welcome to ChessDepth Academy', TITLE), Spacer(1,6),
   Paragraph('To '+S['to'], st('to',parent=P,spaceAfter=7)),
   Paragraph('Dear '+S['dear']+',', P),
   Paragraph(S['body'], P), Spacer(1,1), dt, Spacer(1,2),
   Paragraph('Included with the programme', H2),
   bullets(['Live online classes that follow the '+S['level_short']+' level syllabus, with worksheets and concept books',
            'A quiz every eight sessions to track progress; students move up a level when they are ready',
            'Free access to the Chess Lab and Student Area, club tournaments and the student community']),
   Paragraph('Next steps', H2),
   bullets(['Your coach will confirm class days and times with you on WhatsApp.',
            'Sign in to the Student Area at <b>www.chessdepth.in/student</b> with a Google account and enter the scholar number <b>'+S['no']+'</b>. The same number unlocks the Chess Lab.',
            'Fees are paid monthly in advance. Please send the payment receipt on WhatsApp or to info@chessdepth.in.',
            ]),
   Spacer(1,3),
   Paragraph('Please keep this letter, as the scholar number is used for all academy records. Our class rules, refund policy and terms are at www.chessdepth.in/refunds and www.chessdepth.in/terms. We look forward to helping '+S['first']+' grow as a player.', P),
   KeepTogether([Paragraph('With warm regards,', st('wr',parent=P,spaceAfter=2)), Paragraph('Sourabh Joshi', SIGN), Paragraph('Founder and Head Coach, ChessDepth Academy', SM)])]

doc=BaseDocTemplate(S['out'], pagesize=A4, leftMargin=M, rightMargin=M, topMargin=44*mm, bottomMargin=22*mm,
    title='Letter of Admission: '+S['student'], author='ChessDepth Academy', subject='Admission to ChessDepth Academy')
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(M,19*mm,W-2*M,H-62*mm,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)], onPage=page)])
doc.build(s)
