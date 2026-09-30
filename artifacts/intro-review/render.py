"""Render the standalone review film; no website source files are changed."""
from pathlib import Path
import sys, math, subprocess, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.work/video-tools'))
import imageio_ffmpeg

OUT = Path(__file__).resolve().parent
W, H, FPS, DURATION = 1920, 1080, 60, 5.5
BG = (17, 17, 15)
WHITE = (243, 243, 236)
font = lambda size: ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', size)
latin = lambda size: ImageFont.truetype('C:/Windows/Fonts/arial.ttf', size)
FONTS = {size: font(size) for size in (28, 34, 100, 112)}

def clamp(x): return max(0, min(1, x))
def ease(x): return 1 - (1-clamp(x))**3
def smooth(x):
    x=clamp(x)
    return x*x*(3-2*x)
def mix(a,b,t): return a+(b-a)*t

def text(im, value, y, size, opacity=1, x=W/2, tracking=0, english=False):
    if opacity <= 0: return
    layer = Image.new('RGBA', (W,H))
    d = ImageDraw.Draw(layer)
    f = latin(size) if english else FONTS[size]
    widths = [d.textlength(ch, font=f) for ch in value]
    cursor = x-(sum(widths)+tracking*(len(value)-1))/2
    for ch, width in zip(value,widths):
        d.text((cursor,y),ch,font=f,fill=(*WHITE,round(255*clamp(opacity))),anchor='lt')
        cursor += width+tracking
    im.alpha_composite(layer)

def sphere(size=320):
    yy,xx=np.mgrid[-1:1:complex(size),-1:1:complex(size)]
    rr=xx*xx+yy*yy
    z=np.sqrt(np.maximum(0,1-rr))
    light=np.maximum(0, -.38*xx-.58*yy+.70*z)
    green=np.array([74,226,163])[None,None,:]
    blue=np.array([5,108,127])[None,None,:]
    color=green*(1-(yy[...,None]+1)/2)+blue*(yy[...,None]+1)/2
    color*= (.21+.84*light[...,None])
    spec=np.exp(-((xx+.36)**2+(yy+.40)**2)/.035)*.63
    color=color*(1-spec[...,None])+np.array([227,255,238])*spec[...,None]
    arr=np.zeros((size,size,4),dtype=np.uint8)
    arr[:,:,:3]=np.clip(color,0,255).astype(np.uint8)
    arr[:,:,3]=(np.clip((1-rr)*size,0,1)*255).astype(np.uint8)
    im=Image.fromarray(arr)
    d=ImageDraw.Draw(im)
    for cx in (.39,.61):
        d.ellipse((size*(cx-.025),size*.36,size*(cx+.025),size*.46),fill=(8,54,48,255))
    d.arc((size*.32,size*.39,size*.68,size*.66),10,170,fill=(8,54,48,255),width=9)
    return im

ORB=sphere()

def graphic(im, x,y,width,height,pattern=0,mint=0,opacity=1,angle=0):
    if opacity<=0:return
    sw,sh=max(2,round(width*2)),max(2,round(height*2))
    patch=Image.new('RGBA',(sw,sh), tuple(round(mix(a,b,mint)) for a,b in zip((45,140,255),(80,214,178)))+(255,))
    if pattern>0:
        art=Image.new('RGBA',(sw,sh),(45,140,255,255)); d=ImageDraw.Draw(art)
        d.rectangle((0,0,sw*.42,sh),fill='#7654e8')
        d.arc((sw*.04,sh*.19,sw*.64,sh*1.38),185,350,fill='#19264a',width=round(sh*.15))
        d.ellipse((sw*.56,sh*.16,sw*.75,sh*.63),fill='#b2ed5b')
        d.polygon([(sw*.80,-sh*.2),(sw*1.15,sh*.2),(sw,sh*1.3),(sw*.73,sh)],fill='#ff7155')
        patch=Image.blend(patch,art,clamp(pattern))
    mask=Image.new('L',(sw,sh));d=ImageDraw.Draw(mask)
    radius=mix(sh/2,sh*.20,clamp((width/height-1)/1.4))
    d.rounded_rectangle((0,0,sw-1,sh-1),radius=radius,fill=round(255*opacity))
    patch.putalpha(mask)
    patch=patch.resize((max(2,round(width)),max(2,round(height))),Image.Resampling.LANCZOS)
    if angle:patch=patch.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True)
    im.alpha_composite(patch,(round(x-patch.width/2),round(y-patch.height/2)))

def frame(t):
    im=Image.new('RGBA',(W,H),BG+(255,))
    # Quiet framing stays out of the central motion.
    text(im,'CAO BO',58,24,.35,x=130,tracking=3,english=True)
    text(im,'PERSONAL WEBSITE',H-66,18,.30,tracking=4,english=True)
    welcome=ease(t/.48)*(1-ease((t-1.04)/.32))
    text(im,'欢迎',490+24*(1-ease(t/.48))-20*ease((t-1.04)/.32),100,welcome,tracking=10)
    text(im,'WELCOME',628,22,welcome*.46,tracking=7,english=True)
    name=ease((t-1.52)/.46)*(1-ease((t-3.36)/.40))
    text(im,'我是曹波',490+30*(1-ease((t-1.52)/.46))-18*ease((t-3.36)/.40),100,name,tracking=6)
    text(im,'CAO BO',628,22,name*.48,tracking=9,english=True)
    if .68<=t<4.25:
        birth=ease((t-.68)/.22)
        if t<1.45:
            p=clamp((t-.68)/.77)
            y=mix(480,315,p)-140*math.sin(math.pi*p)
            width=height=104*birth
            pattern=0
        elif t<2.16:
            p=smooth((t-1.45)/.71)
            y=mix(315,364,p)
            width=mix(104,260,p);height=mix(104,108,p);pattern=p
        elif t<3.32:
            p=clamp((t-2.16)/1.16)
            y=364-5*math.sin(p*math.pi)
            width=260;height=108;pattern=1
        else:
            p=smooth((t-3.32)/.76)
            y=mix(364,340,p);width=mix(260,116,p);height=mix(108,116,p);pattern=1-p
        blend=ease((t-4.00)/.25)
        graphic(im,W/2,y,width,height,pattern,smooth((t-3.32)/.76),1-blend, -5*math.sin(math.pi*clamp((t-1.45)/.71)))
    final=ease((t-3.94)/.42)
    if final>0:
        orb=ORB.resize((116,116),Image.Resampling.LANCZOS)
        orb.putalpha(orb.getchannel('A').point(lambda a:round(a*final)))
        im.alpha_composite(orb,(W//2-58,282))
        text(im,'我是曹波',478+16*(1-final),112,final,tracking=5)
        text(im,'欢迎来到我的个人网站',635+12*(1-final),34,final*.65,tracking=3)
        text(im,'CAO BO',728,24,final*.42,tracking=10,english=True)
    return im.convert('RGB')

if __name__=='__main__':
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    cmd=[ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'cao-bo-intro-v1.mp4')]
    with (OUT/'encode.log').open('w') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for i in range(round(DURATION*FPS)):
            proc.stdin.write(frame(i/FPS).tobytes())
            if i%60==0:print(f'Rendered {i}/{round(DURATION*FPS)} frames',flush=True)
        proc.stdin.close()
        if proc.wait()!=0:raise RuntimeError('Encoding failed; see encode.log')
    frame(5.0).save(OUT/'poster.jpg',quality=94)
    times=[.6,1.25,2.55,4.8]
    board=Image.new('RGB',(1280,760),BG)
    d=ImageDraw.Draw(board)
    for i,t in enumerate(times):
        x=(i%2)*640;y=(i//2)*380
        board.paste(frame(t).resize((640,360),Image.Resampling.LANCZOS),(x,y))
        d.text((x+20,y+338),f'{t:.2f}s',font=latin(18),fill='#93938a')
    board.save(OUT/'storyboard.jpg',quality=94)
    result=subprocess.run([ffmpeg,'-i',str(OUT/'cao-bo-intro-v1.mp4'),'-f','null','-'],capture_output=True,text=True)
    (OUT/'verification.txt').write_text(result.stderr,encoding='utf-8')
    if result.returncode:raise RuntimeError('Decode verification failed')
    print(json.dumps({'video':str(OUT/'cao-bo-intro-v1.mp4'),'duration':DURATION,'resolution':[W,H],'fps':FPS,'bytes':(OUT/'cao-bo-intro-v1.mp4').stat().st_size}))
