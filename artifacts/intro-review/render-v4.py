"""Refined typography, staggered glyph motion and coordinated panel transitions."""
from pathlib import Path
from functools import lru_cache
import sys, math, subprocess, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(OUT.parents[1]/'.work/video-tools'))
import imageio_ffmpeg
W,H,FPS,DURATION=1920,1080,60,6.0
PAPER=(239,237,229);INK=(26,28,31);BLUE=(39,68,235)
LEFT=224;DIVIDER=1260;RIGHT=1340

def clamp(x):return max(0,min(1,x))
def out(x):return 1-(1-clamp(x))**4
def smooth(x):
    x=clamp(x);return x*x*(3-2*x)
@lru_cache(None)
def font(size,kind='cn'):
    return ImageFont.truetype('C:/Windows/Fonts/'+{'cn':'msyhbd.ttc','regular':'msyh.ttc','latin':'arial.ttf','bold':'arialbd.ttf'}[kind],size)

def label(im,s,x,y,size,color,alpha=1,spacing=0,kind='latin'):
    if alpha<=0:return
    layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer);f=font(size,kind)
    for c in s:
        d.text((round(x),round(y)),c,font=f,fill=(*color,round(255*clamp(alpha))),anchor='lt')
        x+=d.textlength(c,font=f)+spacing
    im.alpha_composite(layer)

@lru_cache(None)
def glyph(c,size,color):
    # Render at twice the target resolution to preserve sharp rotated edges.
    im=Image.new('RGBA',(size*2+80,size*2+100))
    ImageDraw.Draw(im).text((40,30),c,font=font(size*2),fill=color+(255,),anchor='lt')
    return im

def title(im,s,t,start,size,color,exit_at=None):
    baseline=705;y=baseline-size
    layer=Image.new('RGBA',(W,H))
    leave=smooth((t-exit_at)/.28) if exit_at is not None else 0
    for i,c in enumerate(s):
        p=out((t-start-i*.075)/.57)
        if p<=0 or leave>=1:continue
        scale=.88+.12*p
        g=glyph(c,size,color)
        g=g.resize((round(g.width*scale/2),round(g.height*scale/2)),Image.Resampling.LANCZOS)
        g=g.rotate((1-p)*(-6 if i%2==0 else 6),Image.Resampling.BICUBIC,expand=True)
        if p<.85:g=g.filter(ImageFilter.GaussianBlur((1-p)*2.8))
        alpha=g.getchannel('A').point(lambda a:round(a*(1-leave)))
        g.putalpha(alpha)
        x=LEFT+i*(size+10)+(i-.5)*(1-p)*25-20
        gy=y+(1-p)*(size+75)-leave*100-15
        layer.alpha_composite(g,(round(x),round(gy)))
    mask=Image.new('L',(W,H));ImageDraw.Draw(mask).rectangle((LEFT-45,y-20,1230,baseline+10),fill=255)
    layer.putalpha(Image.fromarray(np.minimum(np.asarray(layer.getchannel('A')),np.asarray(mask))))
    im.alpha_composite(layer)

def english_pair(im,a,b,t,start,color):
    for i,s in enumerate([a,b]):
        p=out((t-start-i*.09)/.55)
        label(im,s,RIGHT+(1-p)*74,421+i*140,108,color,p*.92,2+(1-p)*10,'bold')

def chrome(im,number,color,t):
    d=ImageDraw.Draw(im)
    label(im,'CAO BO',96,68,23,color,.8,4,'bold')
    label(im,'PERSONAL WEBSITE',1434,72,17,color,.52,3)
    line=tuple(round(c*.30+b*.70) for c,b in zip(color,im.getpixel((0,0))[:3]))
    d.line((96,117,1824,117),fill=line,width=1)
    label(im,f'0{number} / 03',96,970,19,color,.62,3)
    # A quiet progress rule replaces redundant footer labels.
    d.line((1474,984,1824,984),fill=line,width=2)
    d.line((1474,984,1474+round(350*clamp(t/DURATION)),984),fill=color,width=2)

def scene(t,number):
    bg=[PAPER,BLUE,INK][number-1];color=INK if number==1 else PAPER
    im=Image.new('RGBA',(W,H),bg+(255,));d=ImageDraw.Draw(im)
    chrome(im,number,color,t)
    start=[.10,2.07,4.10][number-1]
    exit_at=[1.65,3.64,None][number-1]
    reveal=out((t-start)/.43)
    leaving=smooth((t-exit_at)/.28) if exit_at is not None else 0
    if number==1:
        title(im,'欢迎',t,start,320,color,exit_at)
        label(im,'很高兴你来到这里',LEFT,279+(1-reveal)*22,38,color,reveal*(1-leaving)*.70,2,'regular')
        english_pair(im,'WEL','COME',t,.45,BLUE)
        caption='WELCOME';width=650
    elif number==2:
        title(im,'曹波',t,start,320,color,exit_at)
        label(im,'我是',LEFT,276+(1-reveal)*22,48,color,reveal*(1-leaving),3,'regular')
        english_pair(im,'CAO','BO',t,2.38,color)
        caption='CAO BO';width=650
    else:
        title(im,'个人网站',t,start,220,color)
        label(im,'这是我的',LEFT,276+(1-reveal)*22,48,color,reveal,3,'regular')
        english_pair(im,'MY','SPACE',t,4.39,color)
        caption='MY PERSONAL WEBSITE';width=910
    p=out((t-start-.34)/.56)
    label(im,caption,LEFT,765+(1-p)*22,26,BLUE if number==1 else color,p*(1-leaving)*.70,5+(1-p)*8,'bold')
    # One shared grid, baseline and separator across all three acts.
    divider=tuple(round(c*.24+b*.76) for c,b in zip(color,bg))
    d.line((DIVIDER,326,DIVIDER,326+round(422*p)),fill=divider,width=1)
    accent=BLUE if number!=2 else PAPER
    lineprogress=out((t-start-.47)/.66)
    if lineprogress>0:
        d.rectangle((LEFT,835,LEFT+round(width*lineprogress),839),fill=accent)
    return im

def transition(t,before,after,start,direction):
    # Staggered panels make the change of color carry the motion between scenes.
    mask=Image.new('L',(W,H));d=ImageDraw.Draw(mask)
    for i in range(3):
        p=smooth((t-start-i*.055)/.37)
        x=i*640
        if direction=='up':d.rectangle((x,H-round(H*p),x+640,H),fill=255)
        else:d.rectangle((x,0,x+640,round(H*p)),fill=255)
    return Image.composite(after,before,mask)

def frame(t):
    if t<1.76:im=scene(t,1)
    elif t<2.24:im=transition(t,scene(t,1),scene(t,2),1.76,'up')
    elif t<3.76:im=scene(t,2)
    elif t<4.24:im=transition(t,scene(t,2),scene(t,3),3.76,'down')
    else:im=scene(t,3)
    return im.convert('RGB')

if __name__=='__main__':
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();dest=OUT/'cao-bo-intro-v4.mp4'
    cmd=[ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)]
    with (OUT/'encode-v4.log').open('w') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for i in range(round(DURATION*FPS)):
            proc.stdin.write(frame(i/FPS).tobytes())
            if i%60==0:print(f'Rendered {i}/360',flush=True)
        proc.stdin.close()
        if proc.wait():raise RuntimeError('Encoding failed')
    frame(5.7).save(OUT/'poster-v4.jpg',quality=95)
    board=Image.new('RGB',(1920,720),INK)
    for i,t in enumerate([1.35,3.35,5.7,.32,1.97,3.98]):
        board.paste(frame(t).resize((640,360),Image.Resampling.LANCZOS),((i%3)*640,(i//3)*360))
    board.save(OUT/'storyboard-v4.jpg',quality=95)
    check=subprocess.run([ffmpeg,'-i',str(dest),'-f','null','-'],capture_output=True,text=True)
    (OUT/'verification-v4.txt').write_text(check.stderr,encoding='utf-8')
    if check.returncode:raise RuntimeError('Decode failed')
    print(json.dumps({'duration':DURATION,'frames':360,'bytes':dest.stat().st_size,'file':str(dest)}))
