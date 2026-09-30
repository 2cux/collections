"""Warm, soothing visual treatment of the existing three-act 8.5-second film."""
from pathlib import Path
from functools import lru_cache
import sys, math, subprocess, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(OUT.parents[1]/'.work/video-tools'))
import imageio_ffmpeg
W,H,FPS,DURATION=1920,1080,60,8.5
INK=(91,72,61);ACCENT=(167,108,80);LEFT=224
PALETTES=[((247,239,225),(243,207,168)),((239,211,190),(252,240,218)),((223,231,211),(249,234,202))]

def clamp(x):return max(0,min(1,x))
def out(x):return 1-(1-clamp(x))**3
def smooth(x):
    x=clamp(x);return x*x*(3-2*x)

@lru_cache(None)
def font(size,kind='cn'):
    path={'cn':'msyh.ttc','light':'msyhl.ttc','latin':'arial.ttf','serif':'georgiai.ttf'}[kind]
    return ImageFont.truetype('C:/Windows/Fonts/'+path,size)

def text(im,s,x,y,size,color=INK,alpha=1,spacing=0,kind='cn'):
    if alpha<=0:return
    layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer);f=font(size,kind)
    for c in s:
        d.text((round(x),round(y)),c,font=f,fill=(*color,round(255*clamp(alpha))),anchor='lt')
        x+=d.textlength(c,font=f)+spacing
    im.alpha_composite(layer)

@lru_cache(None)
def background(number):
    # Soft daylight and fixed paper grain; no moving noise or emblem.
    bw,bh=W+100,H+100
    yy,xx=np.mgrid[0:bh,0:bw].astype(np.float32);xx/=bw;yy/=bh
    base,glow=PALETTES[number-1]
    radial=np.exp(-((xx-.86)**2/.19+(yy-.20)**2/.36))*.54
    shade=np.exp(-((xx-.07)**2/.14+(yy-.98)**2/.13))*.08
    arr=np.zeros((bh,bw,3),dtype=np.float32)+np.array(base,dtype=np.float32)
    arr=arr*(1-radial[...,None])+np.array(glow,dtype=np.float32)*radial[...,None]
    arr-=shade[...,None]*np.array([19,13,9],dtype=np.float32)
    arr+=np.random.default_rng(27).normal(0,.45,(bh,bw,1)).astype(np.float32)
    return Image.fromarray(np.clip(arr,0,255).astype(np.uint8)).convert('RGBA')

def title(im,s,t,start,size,exit_at=None):
    baseline=700;y=baseline-size
    leave=smooth((t-exit_at)/.40) if exit_at is not None else 0
    for i,c in enumerate(s):
        p=out((t-start-i*.085)/.72)
        # A modest rise and gradual tracking settle suit the warmer typography.
        text(im,c,LEFT+i*(size+12)+(1-p)*i*14,y+(1-p)*48-leave*24,size,INK,p*(1-leave),kind='light')

def right_copy(im,lines,t,start):
    for i,s in enumerate(lines):
        p=out((t-start-i*.08)/.70)
        text(im,s,1330+(1-p)*24,450+i*126,82,ACCENT,p*.84,0,'serif')

def scene(t,number,real_t):
    bg=background(number)
    x=50+round(12*math.sin(real_t*.40));y=50+round(8*math.cos(real_t*.33))
    im=bg.crop((x,y,x+W,y+H));d=ImageDraw.Draw(im)
    text(im,'CAO BO',96,71,21,INK,.75,4,'latin')
    text(im,'personal website',1480,70,23,INK,.54,1,'serif')
    muted=tuple(round(a*.20+b*.80) for a,b in zip(INK,PALETTES[number-1][0]))
    d.line((96,119,1824,119),fill=muted,width=1)
    text(im,f'0{number} / 03',96,971,18,INK,.56,3,'latin')
    d.line((1494,985,1824,985),fill=muted,width=1)
    d.line((1494,985,1494+round(330*clamp(real_t/DURATION)),985),fill=ACCENT,width=2)
    start=[.08,2.05,4.10][number-1];exit_at=[1.64,3.64,None][number-1]
    p=out((t-start)/.66)
    leave=smooth((t-exit_at)/.40) if exit_at is not None else 0
    if number==1:
        heading='欢迎';size=306;intro='很高兴你来到这里';caption='WELCOME';lines=['welcome'];length=620
    elif number==2:
        heading='曹波';size=306;intro='我是';caption='CAO BO';lines=['Cao','Bo'];length=620
    else:
        heading='个人网站';size=216;intro='这是我的';caption='MY PERSONAL WEBSITE';lines=['my','space'];length=900
    text(im,intro,LEFT,286+(1-p)*14,38 if number==1 else 45,INK,p*(1-leave)*.78,2,'light')
    title(im,heading,t,start,size,exit_at)
    right_copy(im,lines,t,start+.30)
    p=out((t-start-.33)/.68)
    text(im,caption,LEFT,765+(1-p)*14,23,INK,p*(1-leave)*.58,4,'latin')
    d.line((1260,381,1260,381+round(343*p)),fill=muted,width=1)
    # Rounded accent endpoints replace the former hard graphic strokes.
    p=out((t-start-.48)/.78)
    if p>0:d.rounded_rectangle((LEFT,833,LEFT+round(length*p),837),radius=2,fill=ACCENT)
    return im

def transition(t,before,after,start):
    # A broad feathered curtain carries the pastel light across the frame.
    p=smooth((t-start)/.56);edge=-330+(W+660)*p
    alpha=np.clip((edge-np.arange(W,dtype=np.float32)+165)/330,0,1)*255
    mask=Image.fromarray(np.broadcast_to(alpha.astype(np.uint8),(H,W)).copy())
    return Image.composite(after,before,mask)

def frame(real_t):
    t=real_t*6/DURATION
    if t<1.74:im=scene(t,1,real_t)
    elif t<2.30:im=transition(t,scene(t,1,real_t),scene(t,2,real_t),1.74)
    elif t<3.74:im=scene(t,2,real_t)
    elif t<4.30:im=transition(t,scene(t,2,real_t),scene(t,3,real_t),3.74)
    else:im=scene(t,3,real_t)
    return im.convert('RGB')

if __name__=='__main__':
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();dest=OUT/'cao-bo-intro-v6.mp4';count=round(FPS*DURATION)
    cmd=[ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)]
    with (OUT/'encode-v6.log').open('w') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for i in range(count):
            proc.stdin.write(frame(i/FPS).tobytes())
            if i%60==0:print(f'Rendered {i}/{count}',flush=True)
        proc.stdin.close()
        if proc.wait():raise RuntimeError('Encoding failed')
    frame(8.1).save(OUT/'poster-v6.jpg',quality=95)
    board=Image.new('RGB',(1920,360),PALETTES[0][0])
    for i,t in enumerate([1.8,4.7,8.1]):board.paste(frame(t).resize((640,360),Image.Resampling.LANCZOS),(i*640,0))
    board.save(OUT/'storyboard-v6.jpg',quality=95)
    check=subprocess.run([ffmpeg,'-i',str(dest),'-f','null','-'],capture_output=True,text=True)
    (OUT/'verification-v6.txt').write_text(check.stderr,encoding='utf-8')
    if check.returncode:raise RuntimeError('Decode failed')
    print(json.dumps({'duration':DURATION,'frames':count,'fps':FPS,'bytes':dest.stat().st_size,'file':str(dest)}))
