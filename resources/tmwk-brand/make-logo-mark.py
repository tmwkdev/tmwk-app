"""Trace tmwk's small in-app logo mark (logo-mark.svg) from the beaver's silhouette.

White fill like Orca's resources/logo.svg, so callers' existing light-mode invert still works.
Reuses the tray template's mask (eyes knocked out, gap before the tail); stdlib only.
Usage: python3 -I make-logo-mark.py <beaver.png> <out_dir>
"""
import importlib.util
import os
import sys

_spec = importlib.util.spec_from_file_location(
    'tray', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'make-tray-template.py')
)
tray = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tray)

GRID = 96  # Field cells across the longer side; smooth enough at 48 px, small file.


def coverage(mask, box, grid):
    x0, y0, x1, y1 = box
    side = max(x1 - x0, y1 - y0)
    cell = side / grid
    gw, gh = round((x1 - x0) / cell), round((y1 - y0) / cell)
    integ = tray.integral(mask)
    h, w = len(mask), len(mask[0])
    field = [[0.0] * (gw + 2) for _ in range(gh + 2)]  # Zero border closes every contour.
    for gy in range(gh):
        for gx in range(gw):
            ax0, ay0 = round(x0 + gx * cell), round(y0 + gy * cell)
            ax1, ay1 = min(round(x0 + (gx + 1) * cell), w), min(round(y0 + (gy + 1) * cell), h)
            s = integ[ay1][ax1] - integ[ay0][ax1] - integ[ay1][ax0] + integ[ay0][ax0]
            field[gy + 1][gx + 1] = s / max((ax1 - ax0) * (ay1 - ay0), 1)
    return field


def blur(field):
    # 3x3 binomial blur rounds off fur-edge lumps before tracing.
    h, w = len(field), len(field[0])
    k = ((1, 2, 1), (2, 4, 2), (1, 2, 1))
    return [
        [
            sum(k[j][i] * field[min(max(y + j - 1, 0), h - 1)][min(max(x + i - 1, 0), w - 1)] for j in range(3) for i in range(3)) / 16
            for x in range(w)
        ]
        for y in range(h)
    ]


def march(field, iso=0.5001):  # Off 0.5 so no corner sits exactly on the contour.
    """Marching squares on cell centres; returns closed loops oriented so filled is on one side."""
    h, w = len(field), len(field[0])

    def lerp(p, q):
        (xa, ya, va), (xb, yb, vb) = sorted((p, q))  # Neighbouring cells must hash the same point.
        t = (iso - va) / (vb - va)
        return (round(xa + t * (xb - xa), 4), round(ya + t * (yb - ya), 4))

    nxt = {}
    for y in range(h - 1):
        for x in range(w - 1):
            tl, tr = (x, y, field[y][x]), (x + 1, y, field[y][x + 1])
            br, bl = (x + 1, y + 1, field[y + 1][x + 1]), (x, y + 1, field[y + 1][x])
            corners = (tl, tr, br, bl)
            inside = [c[2] >= iso for c in corners]
            edges = [(corners[i], corners[(i + 1) % 4]) for i in range(4)]
            # Walk edges clockwise; each edge entering "inside" pairs with the next edge leaving it.
            enter = [i for i in range(4) if not inside[i] and inside[(i + 1) % 4]]
            leave = [i for i in range(4) if inside[i] and not inside[(i + 1) % 4]]
            for e in enter:
                l = next(l for l in sorted(leave, key=lambda l: (l - e) % 4) if (l - e) % 4)
                nxt[lerp(*edges[l])] = lerp(*edges[e])
    loops = []
    while nxt:
        start, pt = next(iter(nxt.items()))
        loop = [start]
        cur = nxt.pop(start)
        while cur != start:
            loop.append(cur)
            cur = nxt.pop(cur)
        loops.append(loop)
    return loops


def simplify(pts, tol):
    def dp(seg):
        if len(seg) < 3:
            return seg
        (ax, ay), (bx, by) = seg[0], seg[-1]
        dx, dy = bx - ax, by - ay
        n = (dx * dx + dy * dy) ** 0.5 or 1
        far, idx = 0, 0
        for i in range(1, len(seg) - 1):
            d = abs(dy * (seg[i][0] - ax) - dx * (seg[i][1] - ay)) / n
            if d > far:
                far, idx = d, i
        if far <= tol:
            return [seg[0], seg[-1]]
        return dp(seg[: idx + 1])[:-1] + dp(seg[idx:])

    half = len(pts) // 2
    return dp(pts[: half + 1])[:-1] + dp(pts[half:] + [pts[0]])[:-1]


def smooth_path(pts):
    """Closed quadratic B-spline through edge midpoints: no corners at icon sizes."""
    n = len(pts)
    mid = [((pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2) for i in range(n)]
    f = lambda v: f'{v:.2f}'.rstrip('0').rstrip('.')
    d = f'M{f(mid[-1][0])} {f(mid[-1][1])}'
    for i in range(n):
        d += f'Q{f(pts[i][0])} {f(pts[i][1])} {f(mid[i][0])} {f(mid[i][1])}'
    return d + 'Z'


def svg(field, loops):
    h, w = len(field) - 2, len(field[0]) - 2
    paths = ''.join(
        smooth_path([(x - 1, y - 1) for x, y in simplify(loop, 0.45)]) for loop in loops if len(loop) > 8
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 {w + 2} {h + 2}">'
        f'<path fill="#fff" fill-rule="evenodd" d="{paths}"/></svg>\n'
    )


if __name__ == '__main__':
    src, out_dir = sys.argv[1], sys.argv[2]
    w, h, rows = tray.read_png(src)
    box = tray.bbox(tray.silhouette(w, h, rows))
    mask = tray.detailed(w, h, rows, gap=36, eye_grow=16, crease_is_tail=True)
    field = blur(coverage(mask, box, GRID))
    with open(os.path.join(out_dir, 'logo-mark.svg'), 'w') as fh:
        fh.write(svg(field, march(field)))
