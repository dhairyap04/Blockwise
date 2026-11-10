"""Print-ready evidence briefs built from a server-owned building snapshot."""
from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,Flowable,KeepTogether

FONT_DIR=Path(reportlab.__file__).parent/'fonts'
pdfmetrics.registerFont(TTFont('BriefSans',str(FONT_DIR/'Vera.ttf')))
pdfmetrics.registerFont(TTFont('BriefSansBold',str(FONT_DIR/'VeraBd.ttf')))
pdfmetrics.registerFontFamily('BriefSans',normal='BriefSans',bold='BriefSansBold')
INK=colors.HexColor('#152d3b');TEAL=colors.HexColor('#0f766e');LIGHT=colors.HexColor('#edf4f5')
TIMEZONE=ZoneInfo('America/Edmonton')


def _time(timestamp):
    return datetime.fromtimestamp(timestamp,TIMEZONE).strftime('%Y-%m-%d %H:%M %Z')


def describe_filter(filt):
    if not filt:return 'No attribute filter applied.'
    if 'conditions' in filt:return (' '+filt['logic'].upper()+' ').join(describe_filter(c) for c in filt['conditions'])
    labels={'height':'Height (ft)','height_m':'Height (m)','assessed_value':'Parcel assessment (CAD)','zoning':'Zoning','address':'Address','stage':'Stage','assessment_class':'Assessment class'}
    return f"{labels.get(filt['attribute'],filt['attribute'])} {filt['operator']} {filt['value']}"


class FootprintPlan(Flowable):
    """Vector plan view: public footprints only, with no third-party map tiles."""
    def __init__(self,buildings,selected,origin,bbox,width=515,height=150):
        super().__init__();self.width=width;self.height=height;self.buildings=buildings;self.selected=selected;self.origin=origin;self.bbox=bbox

    def draw(self):
        c=self.canv;w,h=self.width,self.height
        c.setFillColor(LIGHT);c.roundRect(0,0,w,h,5,fill=1,stroke=0)
        points=[point for b in self.buildings for polygon in b.get('polygons',[{'outer':b.get('footprint',[])}]) for point in polygon['outer']]
        if not points:
            c.setFillColor(INK);c.setFont('BriefSans',9);c.drawString(12,h/2,'Footprint geometry is unavailable in this snapshot.');return
        xs=[p[0] for p in points];ys=[p[1] for p in points]
        minx,maxx,miny,maxy=min(xs),max(xs),min(ys),max(ys)
        scale=min((w-48)/max(1,maxx-minx),(h-35)/max(1,maxy-miny))
        ox=(w-(maxx-minx)*scale)/2;oy=(h-(maxy-miny)*scale)/2
        def position(x,y):return ox+(x-minx)*scale,oy+(y-miny)*scale
        labels={b['id']:chr(65+i) for i,b in enumerate(self.selected)}
        c.saveState();clip=c.beginPath();clip.rect(4,4,w-8,h-8);c.clipPath(clip,stroke=0,fill=0)
        ordered=[b for b in self.buildings if b['id'] not in labels]+self.selected
        for b in ordered:
            c.setFillColor(TEAL if b['id'] in labels else colors.HexColor('#c3d1d6'));c.setStrokeColor(colors.HexColor('#8ba1ab'));c.setLineWidth(.25)
            for polygon in b.get('polygons',[{'outer':b.get('footprint',[]),'holes':[]}]):
                path=c.beginPath()
                for ring in [polygon['outer']]+polygon.get('holes',[]):
                    if not ring:continue
                    x,y=position(*ring[0]);path.moveTo(x,y)
                    for point in ring[1:]:path.lineTo(*position(*point))
                    path.close()
                c.drawPath(path,fill=1,stroke=1,fillMode=0)
        placed=[]
        for b in self.selected:
            ring=b.get('footprint',[])
            if not ring:continue
            x,y=position(sum(p[0] for p in ring)/len(ring),sum(p[1] for p in ring)/len(ring))
            anchor=(x,y)
            for dx,dy in [(0,0),(16,16),(-16,16),(16,-16),(-16,-16),(30,0)]:
                px,py=max(12,min(w-12,anchor[0]+dx)),max(12,min(h-12,anchor[1]+dy))
                if all((px-a)**2+(py-b)**2>=16**2 for a,b in placed):x,y=px,py;break
            placed.append((x,y));c.setStrokeColor(INK);c.line(anchor[0],anchor[1],x,y)
            c.setFillColor(INK);c.circle(x,y,7,fill=1,stroke=0);c.setFillColor(colors.white);c.setFont('BriefSansBold',8);c.drawCentredString(x,y-3,labels[b['id']])
        c.restoreState()
        c.setStrokeColor(INK);c.setFillColor(INK);c.setLineWidth(1)
        c.line(w-18,h-32,w-18,h-12);c.line(w-18,h-12,w-21,h-18);c.line(w-18,h-12,w-15,h-18)
        c.setFont('BriefSansBold',8);c.drawCentredString(w-18,h-9,'N')
        metres=100 if 100*scale<w/3 else 50;c.line(12,12,12+metres*scale,12);c.setFont('BriefSans',7);c.drawString(12,16,f'{metres} m (approx.)')


def build_brief(snapshot,area,selected,title,notes,filters=None,query='',search=''):
    """Return PDF bytes; inputs have already been validated by the API."""
    output=BytesIO();width=A4[0]-80
    styles={
        'title':ParagraphStyle('Title',fontName='BriefSansBold',fontSize=19,leading=24,textColor=INK,spaceAfter=8),
        'heading':ParagraphStyle('Heading',fontName='BriefSansBold',fontSize=10.5,leading=15,textColor=TEAL,spaceBefore=10,spaceAfter=5),
        'body':ParagraphStyle('Body',fontName='BriefSans',fontSize=9,leading=13,textColor=INK,spaceAfter=5,splitLongWords=True),
        'small':ParagraphStyle('Small',fontName='BriefSans',fontSize=7.5,leading=10.5,textColor=INK,spaceAfter=4,splitLongWords=True),
        'table':ParagraphStyle('Cell',fontName='BriefSans',fontSize=8,leading=11,textColor=INK,alignment=TA_LEFT,splitLongWords=True),
    }
    def p(text,kind='body'):return Paragraph(escape(str(text)).replace('\n','<br/>'),styles[kind])
    story=[p('URBAN DESIGN 3D | CALGARY','small'),p(title,'title'),p(area['name']),p(f"Retrieved: {_time(snapshot['fetched_at'])} | Dataset: {snapshot['version']}",'small'),
        p(f"Comparison shortlist: {len(selected)} buildings from {len(snapshot['buildings'])} loaded. This shortlist is independent of the active result filter.",'small')]
    story+=[p('Location and selected buildings','heading'),FootprintPlan(snapshot['buildings'],selected,snapshot['origin'],area['bbox'],width=width),p('Plan view of source footprints. Teal buildings and A/B/C labels identify the comparison. Not a survey or a proposal rendering.','small')]
    money=lambda v:'Unavailable' if v is None else f'CAD {v:,.0f}'
    rows=[[p('Attribute','table')]+[p(f"{chr(65+i)} | {b.get('address') or 'Address unavailable'}\nBuilding {b['id']}",'table') for i,b in enumerate(selected)]]
    fields=[('Height',lambda b:'Unavailable' if b.get('height_m') is None else f"{b['height_m']:g} m / {b.get('height','?')} ft"),
        ('Zoning',lambda b:b.get('zoning') or 'Unavailable'),('Parcel assessment',lambda b:money(b.get('assessed_value'))+(' | '+str(b['assessment_year']) if b.get('assessment_year') else '')),
        ('Parcel ID',lambda b:b.get('parcel_id') or 'Unmatched'),('Footprint overlap',lambda b:'Not recorded' if b.get('parcel_overlap') is None else f"{b['parcel_overlap']*100:.1f}%"),
        ('Assessment rolls',lambda b:str(b.get('assessment_rolls','Unavailable')))]
    for label,get in fields:rows.append([p(label,'table')]+[p(get(b),'table') for b in selected])
    table=Table(rows,colWidths=[105]+[(width-105)/len(selected)]*len(selected),repeatRows=1,hAlign='LEFT')
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#d9e9ec')),('BACKGROUND',(0,1),(0,-1),LIGHT),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#b1c2c8'))]))
    story+=[p('Comparison evidence','heading'),table]
    heights=[b['height_m'] for b in selected if b.get('height_m') is not None]
    if len(heights)>1:story.append(p(f'Known height difference: {max(heights)-min(heights):.1f} m between shortest and tallest.','small'))
    parcel_ids=[b['parcel_id'] for b in selected if b.get('parcel_id')]
    if len(set(parcel_ids))<len(parcel_ids):story.append(p('SHARED PARCEL: Some selected buildings repeat the same parcel assessment. Do not add those values together.','small'))
    story+=[p('Analysis context','heading'),p('Active filter: '+describe_filter(filters),'small')]
    if query:story.append(p('Original question: '+query,'small'))
    if search:story.append(p('Address/ID search in displayed results: '+search,'small'))
    bbox=area['bbox'];story.append(p(f"Study bounds: {bbox['min_lat']:.6f}, {bbox['min_lon']:.6f} to {bbox['max_lat']:.6f}, {bbox['max_lon']:.6f} (latitude, longitude).",'small'))
    if area.get('address'):story.append(p(f"Address anchor: {area['address']}. Square width: {area['size_m']} m. The selected City parcel-address point is the study centre.",'small'))
    story.append(p('Discussion notes','heading'));story.append(p(notes or 'No notes supplied.'))
    sources_start=len(story)
    story.append(p('Interpretation and sources','heading'))
    story.append(p('Assessments belong to parcels, not individual buildings or market listings. Distinct assessment rolls on a parcel are combined. Unavailable values are not zero. Footprint overlap is a spatial association, not verified property identity. Retrieval time is not the acquisition date of the geometry; source vintages can differ. This brief does not determine development permission.','small'))
    from data import SOURCES
    sources=SOURCES+([area['source']] if area.get('source') else [])
    for source in sources:
        story.append(Paragraph(f"<b>{escape(source['name'])}</b>: <link href=\"{escape(source['url'])}\" color=\"#075b86\">{escape(source['url'])}</link>",styles['small']))
    story.append(p('Official applications and public comments: https://dmap.calgary.ca/','small'))
    story[sources_start:]=[KeepTogether(story[sources_start:])]
    def footer(canvas,doc):
        canvas.saveState();canvas.setStrokeColor(colors.HexColor('#b1c2c8'));canvas.line(40,34,A4[0]-40,34)
        canvas.setFont('BriefSans',7);canvas.setFillColor(INK);canvas.drawString(40,23,'Neighbourhood comparison brief | Generated '+datetime.now(TIMEZONE).strftime('%Y-%m-%d %Z'))
        canvas.drawRightString(A4[0]-40,23,f'Page {doc.page}');canvas.restoreState()
    doc=SimpleDocTemplate(output,pagesize=A4,leftMargin=40,rightMargin=40,topMargin=36,bottomMargin=46,title=title,author='Urban Design 3D',allowSplitting=1)
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    return output.getvalue()
