"""Add a gently revealed entrance button to the approved final scene."""
from pathlib import Path
import importlib.util, subprocess, json
from PIL import Image, ImageDraw, ImageFilter

OUT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('intro_v7',OUT/'render-v7.py')
design=importlib.util.module_from_spec(spec)
spec.loader.exec_module(design)
W,H,FPS,DURATION=design.W,design.H,design.FPS,design.DURATION

def frame(t):
    im=design.frame(t).convert('RGBA')
    # The button enters after the final headline, with the same gentle easing.
    p=design.out((t-7.02)/.68)
    if p>0:
        width,height=260,78
        x=design.LEFT;y=round(892+(1-p)*14)
        shadow=Image.new('RGBA',(width+32,height+32))
        ImageDraw.Draw(shadow).rounded_rectangle((16,19,width+16,height+19),radius=39,fill=(*design.INK,round(24*p)))
        shadow=shadow.filter(ImageFilter.GaussianBlur(6))
        im.alpha_composite(shadow,(x-16,y-16))
        button=Image.new('RGBA',(width*2,height*2))
        d=ImageDraw.Draw(button)
        d.rounded_rectangle((0,0,width*2-1,height*2-1),radius=height,fill=(*design.ACCENT,round(255*p)))
        d.text((width,height),'点击进入',font=design.font(60),anchor='mm',fill=(252,247,236,round(255*p)))
        button=button.resize((width,height),Image.Resampling.LANCZOS)
        im.alpha_composite(button,(x,y))
    return im.convert('RGB')

if __name__=='__main__':
    ffmpeg=design.imageio_ffmpeg.get_ffmpeg_exe();dest=OUT/'cao-bo-intro-v8.mp4';count=round(FPS*DURATION)
    cmd=[ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)]
    with (OUT/'encode-v8.log').open('w') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for i in range(count):
            proc.stdin.write(frame(i/FPS).tobytes())
            if i%60==0:print(f'Rendered {i}/{count}',flush=True)
        proc.stdin.close()
        if proc.wait():raise RuntimeError('Encoding failed')
    frame(8.1).save(OUT/'poster-v8.jpg',quality=95)
    board=Image.new('RGB',(1920,360),design.PALETTES[0][0])
    for i,t in enumerate([1.8,4.7,8.1]):board.paste(frame(t).resize((640,360),Image.Resampling.LANCZOS),(i*640,0))
    board.save(OUT/'storyboard-v8.jpg',quality=95)
    check=subprocess.run([ffmpeg,'-i',str(dest),'-f','null','-'],capture_output=True,text=True)
    (OUT/'verification-v8.txt').write_text(check.stderr,encoding='utf-8')
    if check.returncode:raise RuntimeError('Decode failed')
    print(json.dumps({'duration':DURATION,'frames':count,'fps':FPS,'bytes':dest.stat().st_size,'file':str(dest)}))
