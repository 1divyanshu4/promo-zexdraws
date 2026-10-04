"""Derived stills for the film, built from product/product.json. render.mjs runs this.

  build/studio/nopage.png       the studio capture with the hero surface (the page) cut out:
                                the page is the film's box, so the capture must not show it twice
  build/studio/nopage_blur.jpg  the same, pre-blurred and darkened: the out-of-focus backdrop
                                (a CSS blur on a moving layer would re-rasterise every frame)
"""
import json
import pathlib

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
P = json.loads((ROOT / "product/product.json").read_text())
OUT = ROOT / "build/studio"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    src = ROOT / P["studio"]["capture"]
    stamp = OUT / "stamp.txt"
    key = f'{src.stat().st_size}|{src.stat().st_mtime}|{P["studio"]["page"]}'
    if stamp.exists() and stamp.read_text() == key:
        return
    im = Image.open(src).convert("RGB")
    x0, y0, x1, y1 = P["studio"]["page"]
    # Fill the page with the workspace colour just outside its left edge.
    fill = im.getpixel((max(0, x0 - 6), (y0 + y1) // 2))
    ImageDraw.Draw(im).rectangle((x0 - 2, y0 - 4, x1 + 3, y1 + 3), fill=fill)
    im.save(OUT / "nopage.png")
    blur = im.resize((1280, round(1280 * im.height / im.width)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(9))
    ImageEnhance.Brightness(blur).enhance(0.55).save(OUT / "nopage_blur.jpg", quality=92)
    stamp.write_text(key)
    print("assets: build/studio rebuilt")


if __name__ == "__main__":
    main()
