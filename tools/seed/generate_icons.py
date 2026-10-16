#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Draws the EduLanka mark (teal card + open book + gold rule) and writes:

    app/assets/images/logo.png            512x512  (in-app About/Splash art)
    app/assets/images/app_icon.png        512x512  (Play Store listing icon)
    app/android/app/src/main/res/mipmap-*/ic_launcher.png   (launcher icons)

Written with the standard library only (zlib + struct) so the artwork can be
regenerated on any machine, and so the repo carries no binary build step.

Usage:  python3 tools/seed/generate_icons.py
"""
import os
import struct
import sys
import zlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

TEAL_TOP = (0, 128, 116)
TEAL_BOTTOM = (0, 66, 58)
GOLD = (249, 168, 37)
PAPER = (255, 255, 255)
INK = (0, 74, 66)

SUPERSAMPLE = 4


def blend(dst, src):
    """Source-over blend of two (r,g,b,a) tuples."""
    sa = src[3] / 255.0
    if sa <= 0:
        return dst
    return tuple(
        int(round(src[i] * sa + dst[i] * (1 - sa))) for i in range(3)
    ) + (max(dst[3], src[3]),)


def rounded_rect(px, size, x0, y0, x1, y1, radius, color, gradient=None):
    """Fills a rounded rectangle, optionally with a vertical gradient."""
    for y in range(max(0, int(y0)), min(size, int(y1))):
        for x in range(max(0, int(x0)), min(size, int(x1))):
            # corner test
            cx = min(max(x, x0 + radius), x1 - radius)
            cy = min(max(y, y0 + radius), y1 - radius)
            dx = x - cx
            dy = y - cy
            if dx * dx + dy * dy > radius * radius:
                continue
            if gradient is not None:
                top, bottom = gradient
                ratio = (y - y0) / max(1.0, (y1 - y0))
                fill = tuple(
                    int(round(top[i] + (bottom[i] - top[i]) * ratio)) for i in range(3)
                ) + (255,)
            else:
                fill = color
            px[y][x] = blend(px[y][x], fill)


def triangle(px, size, points, color):
    (x0, y0), (x1, y1), (x2, y2) = points
    min_x = max(0, int(min(x0, x1, x2)))
    max_x = min(size, int(max(x0, x1, x2)) + 1)
    min_y = max(0, int(min(y0, y1, y2)))
    max_y = min(size, int(max(y0, y1, y2)) + 1)

    def edge(ax, ay, bx, by, x, y):
        return (x - ax) * (by - ay) - (y - ay) * (bx - ax)

    for y in range(min_y, max_y):
        for x in range(min_x, max_x):
            e0 = edge(x0, y0, x1, y1, x, y)
            e1 = edge(x1, y1, x2, y2, x, y)
            e2 = edge(x2, y2, x0, y0, x, y)
            if (e0 >= 0 and e1 >= 0 and e2 >= 0) or (e0 <= 0 and e1 <= 0 and e2 <= 0):
                px[y][x] = blend(px[y][x], color)


def circle(px, size, cx, cy, r, color):
    for y in range(max(0, int(cy - r)), min(size, int(cy + r) + 1)):
        for x in range(max(0, int(cx - r)), min(size, int(cx + r) + 1)):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                px[y][x] = blend(px[y][x], color)


def render_mark(size):
    """Renders the logo at `size * SUPERSAMPLE` and box-downsamples it."""
    big = size * SUPERSAMPLE
    px = [[(0, 0, 0, 0) for _ in range(big)] for _ in range(big)]
    unit = big / 512.0

    # 1. rounded teal card
    rounded_rect(
        px, big,
        0, 0, big, big, 120 * unit,
        None, gradient=(TEAL_TOP, TEAL_BOTTOM),
    )

    # 2. an open book: two white pages with a spine gap
    page_top = 150 * unit
    page_bottom = 352 * unit
    left_x0, left_x1 = 116 * unit, 246 * unit
    right_x0, right_x1 = 266 * unit, 396 * unit
    rounded_rect(px, big, left_x0, page_top, left_x1, page_bottom, 14 * unit, PAPER + (255,))
    rounded_rect(px, big, right_x0, page_top, right_x1, page_bottom, 14 * unit, PAPER + (255,))

    # 3. a couple of "text lines" on each page so it reads as a book
    for i in range(4):
        y = (188 + i * 34) * unit
        width = (94 if i % 2 == 0 else 74) * unit
        rounded_rect(px, big, (left_x0 + 16 * unit), y, (left_x0 + 16 * unit) + width,
                     y + 10 * unit, 5 * unit, INK + (150,))
        rounded_rect(px, big, (right_x0 + 16 * unit), y, (right_x0 + 16 * unit) + width,
                     y + 10 * unit, 5 * unit, INK + (150,))

    # 4. gold rule under the book (the "shelf")
    rounded_rect(px, big, 158 * unit, 386 * unit, 354 * unit, 408 * unit, 11 * unit, GOLD + (255,))

    # 5. gold bookmark ribbon hanging from the right page
    triangle(
        px, big,
        ((right_x1 - 56 * unit, page_top), (right_x1 - 22 * unit, page_top),
         (right_x1 - 39 * unit, page_top + 54 * unit)),
        GOLD + (255,),
    )

    # 6. tiny gold dot as a highlight on the card
    circle(px, big, 96 * unit, 96 * unit, 16 * unit, (255, 255, 255, 60))

    # downsample
    out = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = 0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    p = px[y * SUPERSAMPLE + sy][x * SUPERSAMPLE + sx]
                    r += p[0]
                    g += p[1]
                    b += p[2]
            n = SUPERSAMPLE * SUPERSAMPLE
            row += bytes((r // n, g // n, b // n, 255))
        out.append(bytes(row))
    return out


def write_png(path, size, rows):
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    raw = b''.join(b'\x00' + row for row in rows)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as handle:
        handle.write(png)
    return len(png)


DENSITIES = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192,
}


def main():
    cache = {}
    written = 0

    def icon(size, path):
        nonlocal written
        if size not in cache:
            cache[size] = render_mark(size)
        written += 1
        return write_png(path, size, cache[size])

    big = icon(512, os.path.join(ROOT, 'app', 'assets', 'images', 'logo.png'))
    print('assets/images/logo.png           512x512  %6.1f KB' % (big / 1024.0))
    big = icon(512, os.path.join(ROOT, 'app', 'assets', 'images', 'app_icon.png'))
    print('assets/images/app_icon.png       512x512  %6.1f KB' % (big / 1024.0))

    for density, px in DENSITIES.items():
        path = os.path.join(
            ROOT, 'app', 'android', 'app', 'src', 'main', 'res',
            'mipmap-%s' % density, 'ic_launcher.png',
        )
        size = icon(px, path)
        print('mipmap-%-8s ic_launcher.png    %3dx%-3d  %6.1f KB' % (density, px, px, size / 1024.0))
    print('wrote %d PNG files' % written)
    return 0


if __name__ == '__main__':
    sys.exit(main())
