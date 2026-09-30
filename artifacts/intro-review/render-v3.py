"""Three-act review: welcome, Cao Bo, personal website. Exactly six seconds."""
from pathlib import Path
import importlib.util, subprocess, json
from PIL import Image, ImageDraw

OUT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('typography',OUT/'render-v2.py')
design=importlib.util.module_from_spec(spec)
spec.loader.exec_module(design)
W,H,FPS,DURATION=1920,1080,60,6.0
PAPER,INK,BLUE=design.PAPER,design.INK,design.BLUE
label,headline,out,smooth=design.label,design.headline,design.out,design.smooth

def website(t):
    im=Image.new('RGBA',(W,H),INK+(255,));d=ImageDraw.Draw(im)
    label(im,'CAO BO',100,73,25,PAPER,.85,4,'bold')
    label(im,'PERSONAL WEBSITE',1430,78,18,PAPER,.60,3)
    d.line((100,126,1820,126),fill=(72,74,77),width=1)
    p=out((t-4.08)/.42)
    label(im,'这是我的',263,278+(1-p)*24,62,PAPER,p,5,'regular')
    headline(im,'个人网站',245,421,220,PAPER,t,4.15,.045)
    p=out((t-4.45)/.6)
    label(im,'MY PERSONAL WEBSITE',263,731+(1-p)*18,28,PAPER,p*.75,6,'bold')
    d.rectangle((265,817,265+int(910*out((t-4.42)/.72)),823),fill=BLUE)
    design.star(im,1515,540,t-3.5,out((t-4.18)/.65))
    label(im,'03',103,977,23,PAPER,.65,2)
    label(im,'曹波的个人网站',263,972,24,PAPER,out((t-4.50)/.5)*.7,2,'regular')
    label(im,'MY WEBSITE',1592,979,18,PAPER,.60,3)
    return im

def frame(t):
    # Compress the approved first two acts; retain their typography and motion.
    if t<3.75:
        oldtime=t*2.32/1.80 if t<1.80 else 2.32+(t-1.80)*1.25
        return design.frame(oldtime)
    if t>=4.17:return website(t).convert('RGB')
    before=design.introduction(4.75)
    p=smooth((t-3.75)/.42)
    edge=H+180-p*(H+360)
    mask=Image.new('L',(W,H));ImageDraw.Draw(mask).polygon([(0,edge+130),(W,edge-130),(W,H),(0,H)],fill=255)
    return Image.composite(website(t),before,mask).convert('RGB')

if __name__=='__main__':
    ffmpeg=design.imageio_ffmpeg.get_ffmpeg_exe()
    dest=OUT/'cao-bo-intro-v3.mp4'
    cmd=[ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)]
    with (OUT/'encode-v3.log').open('w') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for i in range(round(DURATION*FPS)):
            proc.stdin.write(frame(i/FPS).tobytes())
            if i%60==0:print(f'Rendered {i}/{round(DURATION*FPS)}',flush=True)
        proc.stdin.close()
        if proc.wait():raise RuntimeError('Encoding failed')
    frame(5.7).save(OUT/'poster-v3.jpg',quality=95)
    board=Image.new('RGB',(1920,360),INK)
    for i,t in enumerate([1.4,3.45,5.7]):
        board.paste(frame(t).resize((640,360),Image.Resampling.LANCZOS),(i*640,0))
    board.save(OUT/'storyboard-v3.jpg',quality=95)
    check=subprocess.run([ffmpeg,'-i',str(dest),'-f','null','-'],capture_output=True,text=True)
    (OUT/'verification-v3.txt').write_text(check.stderr,encoding='utf-8')
    if check.returncode:raise RuntimeError('Decode failed')
    print(json.dumps({'duration':DURATION,'frames':round(DURATION*FPS),'bytes':dest.stat().st_size,'file':str(dest)}))
