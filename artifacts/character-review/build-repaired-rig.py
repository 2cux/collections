"""Build SVG geometry and bindings; keep the ImageGen raster unmodified."""
from pathlib import Path
from collections import deque
import math
import json
import statistics
from PIL import Image

root = Path(__file__).resolve().parents[2]
im = Image.open(root / 'public/media/greeting-character-repaired.png').convert('RGB')
pixels = im.load()
dark = {(x, y) for y in range(im.height) for x in range(im.width) if max(pixels[x, y]) < 65}
components = []
while dark:
    first = dark.pop()
    queue = deque([first])
    component = [first]
    while queue:
        x, y = queue.popleft()
        for neighbour in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]:
            if neighbour in dark:
                dark.remove(neighbour)
                queue.append(neighbour)
                component.append(neighbour)
    if len(component) > 1000:
        components.append(component)
eyes = sorted(sorted(components, key=len, reverse=True)[:2], key=lambda points: sum(x for x, _ in points) / len(points))
assert len(eyes) == 2, 'Expected two clean black eyes'
centers = [(sum(x for x, _ in points) / len(points), sum(y for _, y in points) / len(points)) for points in eyes]
dx, dy = centers[1][0] - centers[0][0], centers[1][1] - centers[0][1]
scale = 370 / math.hypot(dx, dy)
angle = math.radians(20) - math.atan2(dy, dx)
a, b = scale * math.cos(angle), scale * math.sin(angle)
cx, cy = (centers[0][0] + centers[1][0]) / 2, (centers[0][1] + centers[1][1]) / 2
tx, ty = 700 - a * cx + b * cy, 737 - b * cx - a * cy
matrix = f'matrix({a:.6f} {b:.6f} {-b:.6f} {a:.6f} {tx:.3f} {ty:.3f})'

corners = [(a * x - b * y + tx, b * x + a * y + ty) for x, y in [(0, 0), (im.width, 0), (0, im.height), (im.width, im.height)]]
left, top = math.floor(min(x for x, _ in corners) - 75), math.floor(min(y for _, y in corners) - 75)
width, height = math.ceil(max(x for x, _ in corners) + 75 - left), math.ceil(max(y for _, y in corners) + 75 - top)
colors = []
for eye in eyes:
    x0, x1 = min(x for x, _ in eye), max(x for x, _ in eye)
    y0, y1 = min(y for _, y in eye), max(y for _, y in eye)
    skin = [pixels[x, y] for y in range(max(0, y0 - 15), min(im.height, y1 + 15), 3) for x in range(max(0, x0 - 15), min(im.width, x1 + 15), 3) if pixels[x, y][0] > 230 and 170 < pixels[x, y][1] < 242 and 140 < pixels[x, y][2] < 225]
    colors.append('#' + ''.join(f'{int(statistics.median(pixel[channel] for pixel in skin)):02x}' for channel in range(3)))
paths = json.loads((root / 'artifacts/character-review/repaired-paths.json').read_text(encoding='utf-8'))
image = f'<image href="/media/greeting-character-repaired.png" width="{im.width}" height="{im.height}"'
svg = f'''
<svg class="character-art" viewBox="{left} {top} {width} {height}" role="img" aria-labelledby="character-art-title character-art-description">
  <title id="character-art-title">金发猫耳的小伙伴</title>
  <desc id="character-art-description">眼睛跟随鼠标，轻轻转头、呼吸并眨眼的二维卡通形象。</desc>
  <defs>
    <clipPath id="portrait-outline"><path d="{paths['silhouette']}" /></clipPath>
    <clipPath id="portrait-shirt"><path d="{paths['shirt']}" /></clipPath>
    <mask id="portrait-head-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="{im.width}" height="{im.height}"><rect width="{im.width}" height="{im.height}" fill="white"/><path d="{paths['shirt']}" fill="black" /></mask>
    <filter id="eye-patch-feather" x="-.25" y="-.25" width="1.5" height="1.5"><feGaussianBlur stdDeviation="7" /></filter>
    <linearGradient id="eye-ink" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#121416"/><stop offset="1" stop-color="#1b1d1f"/></linearGradient>
  </defs>
  <g class="character-breath">
    <g data-character-body><g transform="{matrix}">{image} clip-path="url(#portrait-shirt)" /></g></g>
    <g data-character-head>
      <g transform="{matrix}">{image} clip-path="url(#portrait-outline)" mask="url(#portrait-head-mask)" /></g>
      <g transform="translate(700 737) rotate(20)">
        <g filter="url(#eye-patch-feather)">
          <rect x="-260" y="-140" width="150" height="280" rx="75" fill="{colors[0]}" />
          <rect x="110" y="-140" width="150" height="280" rx="75" fill="{colors[1]}" />
        </g>
        <g data-character-eye="left" transform="translate(-185 0)"><rect x="-47" y="-104" width="94" height="208" rx="47" fill="url(#eye-ink)" /></g>
        <g data-character-eye="right" transform="translate(185 0)"><rect x="-47" y="-104" width="94" height="208" rx="47" fill="url(#eye-ink)" /></g>
      </g>
    </g>
  </g>
</svg>'''
(root / 'src/character-art.js').write_text('// Repaired ImageGen artwork with calibrated 2D bindings.\nexport const CHARACTER_ART = ' + json.dumps(svg, ensure_ascii=False) + ';\n', encoding='utf-8')
print(json.dumps({'eyeCenters': centers, 'skin': colors, 'viewBox': [left, top, width, height], 'matrix': matrix}, ensure_ascii=False))
