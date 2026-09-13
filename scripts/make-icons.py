#!/usr/bin/env python3
"""Generate Windows icon assets (build/icon.ico + PNGs) from assets/images/logo-source.png.

Dev-time tool. Produces a multi-resolution ICO (PNG-compressed entries) suitable
for electron-builder, plus PNG icons used inside the app UI.
"""
import os
import struct
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "images", "logo-source.png")
BUILD = os.path.join(ROOT, "build")
ICONS = os.path.join(ROOT, "assets", "icons")

ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]


def prepare(src_path: str) -> Image.Image:
    img = Image.open(src_path).convert("RGBA")
    # Crop to the badge (drop white margins) using alpha/color bbox on non-white pixels.
    px = img.load()
    w, h = img.size
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a > 8 and not (r > 240 and g > 240 and b > 240):
                if x < minx: minx = x
                if y < miny: miny = y
                if x > maxx: maxx = x
                if y > maxy: maxy = y
    if maxx > minx and maxy > miny:
        img = img.crop((minx, miny, maxx + 1, maxy + 1))
    # Square it
    side = max(img.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    return square


def write_ico(images, path):
    """Write an ICO whose entries are PNG-compressed (valid for Vista+)."""
    entries = []
    offset = 6 + 16 * len(images)
    for im in images:
        import io
        buf = io.BytesIO()
        im.save(buf, format="PNG", optimize=True)
        data = buf.getvalue()
        w = 0 if im.width >= 256 else im.width
        h = 0 if im.height >= 256 else im.height
        entries.append((struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(data), offset), data))
        offset += len(data)
    out = struct.pack("<HHH", 0, 1, len(images))
    for header, _ in entries:
        out += header
    for _, data in entries:
        out += data
    with open(path, "wb") as fh:
        fh.write(out)


def main():
    os.makedirs(BUILD, exist_ok=True)
    os.makedirs(ICONS, exist_ok=True)
    base = prepare(SRC)
    images = []
    for size in ICO_SIZES:
        im = base.resize((size, size), Image.LANCZOS)
        images.append(im)
    write_ico(images, os.path.join(BUILD, "icon.ico"))
    base.resize((512, 512), Image.LANCZOS).save(os.path.join(ICONS, "icon-512.png"))
    base.resize((256, 256), Image.LANCZOS).save(os.path.join(ICONS, "icon.png"))
    base.resize((64, 64), Image.LANCZOS).save(os.path.join(ICONS, "icon-64.png"))
    base.resize((32, 32), Image.LANCZOS).save(os.path.join(ICONS, "tray.png"))
    base.resize((16, 16), Image.LANCZOS).save(os.path.join(ICONS, "tray-16.png"))
    print("icon assets written:", os.path.join(BUILD, "icon.ico"))


if __name__ == "__main__":
    sys.exit(main())
