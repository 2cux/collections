"""Re-render the approved visual treatment at a relaxed 8.5-second cadence."""
from pathlib import Path
import importlib.util, subprocess, json
from PIL import Image

OUT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('intro_v4',OUT/'render-v4.py')
design=importlib.util.module_from_spec(spec)
spec.loader.exec_module(design)
W,H,FPS,DURATION=1920,1080,60,8.5

def frame(t):
    # Render each frame from source at 60 fps, preserving all easing and stagger.
    return design.frame(t*design.DURATION/DURATION)

if __name__=='__main__':
    ffmpeg=design.imageio_ffmpeg.get_ffmpeg_exe();dest=OUT/'cao-bo-intro-v5.mp4'
    cmd=[ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)]
    count=round(DURATION*FPS)
    with (OUT/'encode-v5.log').open('w') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for i in range(count):
            proc.stdin.write(frame(i/FPS).tobytes())
            if i%60==0:print(f'Rendered {i}/{count}',flush=True)
        proc.stdin.close()
        if proc.wait():raise RuntimeError('Encoding failed')
    frame(8.1).save(OUT/'poster-v5.jpg',quality=95)
    board=Image.new('RGB',(1920,360),design.INK)
    for i,t in enumerate([1.8,4.7,8.1]):
        board.paste(frame(t).resize((640,360),Image.Resampling.LANCZOS),(i*640,0))
    board.save(OUT/'storyboard-v5.jpg',quality=95)
    check=subprocess.run([ffmpeg,'-i',str(dest),'-f','null','-'],capture_output=True,text=True)
    (OUT/'verification-v5.txt').write_text(check.stderr,encoding='utf-8')
    if check.returncode:raise RuntimeError('Decode failed')
    print(json.dumps({'duration':DURATION,'frames':count,'fps':FPS,'bytes':dest.stat().st_size,'file':str(dest)}))
