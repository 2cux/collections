"""Trace native SVG clip geometry from the supplied, unmodified portrait."""
from collections import defaultdict
from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parent.parent
im = Image.open(root / 'public/media/greeting-avatar.png').convert('RGB')
step = 3
w, h = (im.width + step - 1) // step, (im.height + step - 1) // step


def trace(predicate):
    cells = set()
    for y in range(h):
        for x in range(w):
            pixel = im.getpixel((min(x * step + 1, im.width - 1), min(y * step + 1, im.height - 1)))
            if predicate(*pixel):
                cells.add((x, y))
    edges = defaultdict(list)
    for x, y in cells:
        if (x, y - 1) not in cells:
            edges[x, y].append((x + 1, y))
        if (x + 1, y) not in cells:
            edges[x + 1, y].append((x + 1, y + 1))
        if (x, y + 1) not in cells:
            edges[x + 1, y + 1].append((x, y + 1))
        if (x - 1, y) not in cells:
            edges[x, y + 1].append((x, y))
    loops = []
    while edges:
        start = next(iter(edges))
        point = start
        loop = [start]
        while point in edges:
            following = edges[point].pop()
            if not edges[point]:
                del edges[point]
            loop.append(following)
            point = following
            if point == start:
                break
        loops.append(loop)
    points = max(loops, key=len)

    def simplify(points, tolerance):
        if len(points) < 3:
            return points
        a, b = points[0], points[-1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = (dx * dx + dy * dy) ** .5
        distances = [abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / length if length else ((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2) ** .5 for p in points]
        index = max(range(len(points)), key=lambda i: distances[i])
        if distances[index] <= tolerance:
            return [a, b]
        return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)

    split = len(points) // 2
    points = simplify(points[:split + 1], .85)[:-1] + simplify(points[split:], .85)[:-1]
    return 'M' + 'L'.join(f'{min(x * step, im.width)} {min(y * step, im.height)}' for x, y in points) + 'Z'


paths = {
    'silhouette': trace(lambda r, g, b: max(r, g, b) > 65),
    'shirt': trace(lambda r, g, b: g > r * 1.12 and b > r * 1.15 and b > 90),
}
(root / 'artifacts/portrait-paths.json').write_text(json.dumps(paths), encoding='utf-8')
print({name: len(path) for name, path in paths.items()})
