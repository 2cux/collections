"""A two-act typographic film. Render review assets only."""
from pathlib import Path
import sys, math, subprocess, json
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'.work/video-tools'))
import imageio_ffmpeg

W,H,FPS,DURATION=1920,1080,60,5.8
PAPER=(239,237,229)
INK=(26,28,31)
BLUE=(39,68,235)

def clamp(x):return max(0,min(1,x))
def out(x):return 1-(1-clamp(x))**4
def smooth(x):
    x=clamp(x)
    return x*x*(3-2*x)
@lru_cache(None)
def font(size,kind='cn'):
    path={'cn':'msyhbd.ttc','regular':'msyh.ttc','latin':'arial.ttf','bold':'arialbd.ttf'}[kind]
    return ImageFont.truetype('C:/Windows/Fonts/'+path,size)

def label(im,s,x,y,size,color,alpha=1,spacing=0,kind='latin'):
    if alpha<=0:return
    layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer);f=font(size,kind)
    for c in s:
        d.text((round(x),round(y)),c,font=f,fill=(*color,round(255*clamp(alpha))),anchor='lt')
        x+=d.textlength(c,font=f)+spacing
    im.alpha_composite(layer)

def headline(im,s,x,y,size,color,t,start,stagger=.1):
    # Each glyph rises through a shared baseline mask, without bouncing.
    layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer);f=font(size)
    for i,c in enumerate(s):
        p=out((t-start-i*stagger)/.62)
        d.text((x+i*(size+8),round(y+(1-p)*(size+32))),c,font=f,fill=(*color,255),anchor='lt')
    mask=Image.new('L',(W,H));ImageDraw.Draw(mask).rectangle((0,y-4,W,y+size+30),fill=255)
    layer.putalpha(Image.fromarray(__import__('numpy').minimum(__import__('numpy').array(layer.getchannel('A')),__import__('numpy').array(mask))))
    im.alpha_composite(layer)

def star(im,cx,cy,t,alpha):
    layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer)
    rotation=math.radians(-16+20*out((t-.2)/1.4))
    for i in range(4):
        a=rotation+i*math.pi/4
        dx,dy=108*math.cos(a),108*math.sin(a)
        d.line((cx-dx,cy-dy,cx+dx,cy+dy),fill=(*BLUE,round(255*alpha)),width=24)
    im.alpha_composite(layer)

def welcome(t):
    im=Image.new('RGBA',(W,H),PAPER+(255,));d=ImageDraw.Draw(im)
    label(im,'CAO BO',100,73,25,INK,.8,4,'bold')
    label(im,'PERSONAL WEBSITE',1430,78,18,INK,.5,3)
    d.line((100,126,1820,126),fill=(197,197,189),width=1)
    headline(im,'欢迎',245,325,330,INK,t,.08,.11)
    p=out((t-.56)/.65)
    label(im,'WELCOME',264,733+(1-p)*18,43,BLUE,p,11,'bold')
    # A clean typographic accent establishes the transition color.
    d.rectangle((265,817,265+int(665*out((t-.70)/.9)),823),fill=BLUE)
    star(im,1435,540,t,out((t-.36)/.7))
    label(im,'01',103,977,23,INK,.55,2)
    label(im,'很高兴，你来到这里。',263,972,24,INK,out((t-.82)/.5)*.6,2,'regular')
    label(im,'WELCOME',1651,979,18,INK,.45,3)
    return im

def introduction(t):
    im=Image.new('RGBA',(W,H),BLUE+(255,));d=ImageDraw.Draw(im)
    label(im,'CAO BO',100,73,25,PAPER,.85,4,'bold')
    label(im,'PERSONAL WEBSITE',1430,78,18,PAPER,.65,3)
    d.line((100,126,1820,126),fill=(100,123,239),width=1)
    p=out((t-2.86)/.48)
    label(im,'我是',267,268+(1-p)*24,54,PAPER,p,6,'regular')
    headline(im,'曹波',245,373,330,PAPER,t,2.93,.12)
    latin=out((t-3.20)/.62)
    d.line((1173,330,1173,771),fill=(115,136,242),width=1)
    label(im,'CAO',1280+(1-latin)*45,391,132,PAPER,latin,3,'bold')
    label(im,'BO',1280+(1-latin)*45,548,132,PAPER,latin,3,'bold')
    label(im,'THIS IS MY SPACE.',269,815,24,PAPER,out((t-3.62)/.5)*.72,5)
    label(im,'02',103,977,23,PAPER,.65,2)
    label(im,'曹波 / CAO BO',263,972,24,PAPER,out((t-3.65)/.5)*.75,2,'regular')
    label(im,'INTRODUCTION',1550,979,18,PAPER,.65,3)
    return im

def frame(t):
    if t<2.32:return welcome(t).convert('RGB')
    if t>=2.92:return introduction(t).convert('RGB')
    im=welcome(t)
    p=smooth((t-2.32)/.60)
    edge=-180+p*(W+360)
    mask=Image.new('L',(W,H));ImageDraw.Draw(mask).polygon([(0,0),(edge+180,0),(edge-180,H),(0,H)],fill=255)
    im=Image.composite(introduction(t),im,mask)
    return im.convert('RGB')

if __name__=='__main__':
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    dest=OUT/'cao-bo-intro-v2.mp4'
    cmd=[ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)]
    with (OUT/'encode-v2.log').open('w') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for i in range(round(DURATION*FPS)):
            proc.stdin.write(frame(i/FPS).tobytes())
            if i%60==0:print(f'Rendered {i}/{round(DURATION*FPS)}',flush=True)
        proc.stdin.close()
        if proc.wait():raise RuntimeError('Encoding failed')
    frame(5.0).save(OUT/'poster-v2.jpg',quality=95)
    board=Image.new('RGB',(1280,720),PAPER)
    for i,t in enumerate([1.4,4.7]):board.paste(frame(t).resize((1280,720),Image.Resampling.LANCZOS).resize((640,360),Image.Resampling.LANCZOS),(i*640,180))
    board.save(OUT/'storyboard-v2.jpg',quality=95)
    check=subprocess.run([ffmpeg,'-i',str(dest),'-f','null','-'],capture_output=True,text=True)
    (OUT/'verification-v2.txt').write_text(check.stderr,encoding='utf-8')
    if check.returncode:raise RuntimeError('Decode failed')
    print(json.dumps({'duration':DURATION,'frames':round(DURATION*FPS),'size':dest.stat().st_size,'file':str(dest)}))
