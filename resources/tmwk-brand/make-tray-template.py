"""Make macOS menu-bar template images (black + alpha) from the beaver's alpha silhouette.

Stdlib only, so it runs on any Mac without ImageMagick or Pillow. Source: tmwkdev/grenada@10d408f apps/desktop/assets/brand/beaver.png.
"""
import struct
import sys
import zlib


def read_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos, idat, ihdr = 8, b'', None
    while pos < len(data):
        (length,) = struct.unpack('>I', data[pos:pos + 4])
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if kind == b'IHDR':
            ihdr = struct.unpack('>IIBBBBB', body)
        elif kind == b'IDAT':
            idat += body
    w, h, depth, ctype, _, _, interlace = ihdr
    assert depth == 8 and ctype == 6 and interlace == 0, ihdr
    bpp, stride = 4, w * 4
    raw = zlib.decompress(idat)
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[i]
        line = bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        rows.append(line)
        prev = line
    return w, h, rows


def write_png(path, w, h, rgba_rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rgba_rows)

    def chunk(kind, body):
        return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body))

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def silhouette(w, h, rows, threshold=128):
    return [[1 if rows[y][x * 4 + 3] >= threshold else 0 for x in range(w)] for y in range(h)]


def bbox(mask, min_fraction=0.01):
    # Ignore stray fringe specks: a row/column counts only with a real run of the body.
    h, w = len(mask), len(mask[0])
    rows = [y for y in range(h) if sum(mask[y]) > w * min_fraction]
    cols = [x for x in range(w) if sum(mask[y][x] for y in range(h)) > h * min_fraction]
    return cols[0], rows[0], cols[-1] + 1, rows[-1] + 1


def render(mask, box, cw, ch, pad):
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    scale = min((cw - 2 * pad) / bw, (ch - 2 * pad) / bh)
    tw, th = bw * scale, bh * scale
    ox, oy = (cw - tw) / 2, (ch - th) / 2
    # Integral image for exact area averages.
    h, w = len(mask), len(mask[0])
    integ = [[0] * (w + 1) for _ in range(h + 1)]
    for y in range(h):
        acc = 0
        for x in range(w):
            acc += mask[y][x]
            integ[y + 1][x + 1] = integ[y][x + 1] + acc

    def area(ax0, ay0, ax1, ay1):
        ax0, ay0 = max(ax0, 0), max(ay0, 0)
        ax1, ay1 = min(ax1, w), min(ay1, h)
        if ax1 <= ax0 or ay1 <= ay0:
            return 0, 1
        s = integ[ay1][ax1] - integ[ay0][ax1] - integ[ay1][ax0] + integ[ay0][ax0]
        return s, (ax1 - ax0) * (ay1 - ay0)

    out = []
    for py in range(ch):
        line = bytearray()
        for px in range(cw):
            sx0 = x0 + (px - ox) / scale
            sx1 = x0 + (px + 1 - ox) / scale
            sy0 = y0 + (py - oy) / scale
            sy1 = y0 + (py + 1 - oy) / scale
            s, n = area(round(sx0), round(sy0), round(sx1), round(sy1))
            cov = s / n if (sx1 > x0 and sx0 < x1 and sy1 > y0 and sy0 < y1) else 0
            line += bytes((0, 0, 0, round(255 * cov)))
        out.append(line)
    return out


def preview(rows, cw, ch, zoom, bg, fg):
    out = []
    for py in range(ch * zoom):
        line = bytearray()
        for px in range(cw * zoom):
            a = rows[py // zoom][(px // zoom) * 4 + 3] / 255
            line += bytes(round(bg[i] * (1 - a) + fg[i] * a) for i in range(3)) + b'\xff'
        out.append(line)
    return out

def integral(mask):
    h, w = len(mask), len(mask[0])
    integ = [[0] * (w + 1) for _ in range(h + 1)]
    for y in range(h):
        acc = 0
        for x in range(w):
            acc += mask[y][x]
            integ[y + 1][x + 1] = integ[y][x + 1] + acc
    return integ


def near(integ, x, y, r, w, h):
    ax0, ay0, ax1, ay1 = max(x - r, 0), max(y - r, 0), min(x + r + 1, w), min(y + r + 1, h)
    return integ[ay1][ax1] - integ[ay0][ax1] - integ[ay1][ax0] + integ[ay0][ax0] > 0


def detailed(w, h, rows, gap, eye_grow, crease_is_tail=False):
    """Silhouette with the eyes knocked out and a gap where the body meets the purple tail."""
    base = silhouette(w, h, rows)
    tail = [[0] * w for _ in range(h)]
    eye = [[0] * w for _ in range(h)]
    for y in range(h):
        r = rows[y]
        for x in range(w):
            if not base[y][x]:
                continue
            R, G, B = r[x * 4], r[x * 4 + 1], r[x * 4 + 2]
            if R + G + B < 200 and not (crease_is_tail and x > 760):
                # The tail's dark crease would otherwise read as an eye and cut a spur into the tail.
                eye[y][x] = 1
            elif x > 860 or (x > 760 and B > 150 and G < 0.42 * B):
                # The purple tail sits right of the body; the right foot is also deep blue, so bound by x.
                tail[y][x] = 1
    ti, ei = integral(tail), integral(eye)
    out = [[0] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if not base[y][x]:
                continue
            if near(ei, x, y, eye_grow, w, h):
                continue
            if not tail[y][x] and near(ti, x, y, gap, w, h):
                continue
            out[y][x] = 1
    return out


if __name__ == '__main__':
    # python3 -I make-tray-template.py <beaver.png> <out_dir> [--preview]
    src, out_dir = sys.argv[1], sys.argv[2]
    w, h, rows = read_png(src)
    box = bbox(silhouette(w, h, rows))
    mask = detailed(w, h, rows, gap=30, eye_grow=14)
    for name, cw, ch, pad in (('trayTemplate.png', 22, 14, 1), ('trayTemplate@2x.png', 44, 28, 2)):
        img = render(mask, box, cw, ch, pad)
        write_png(f'{out_dir}/{name}', cw, ch, img)
        if '--preview' in sys.argv:
            for theme, bg, fg in (('light', (236, 236, 236), (0, 0, 0)), ('dark', (40, 40, 40), (255, 255, 255))):
                write_png(f'{out_dir}/preview-{cw}-{theme}.png', cw * 8, ch * 8, preview(img, cw, ch, 8, bg, fg))
