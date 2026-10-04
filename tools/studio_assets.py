"""Derived stills for the studio film (film-studio.js). Run after re-capturing ui/studio/clean.png.

  ui/studio/nopage.png       the studio with the page cut out (the page is the film's box)
  ui/studio/nopage_blur.jpg  the same, pre-blurred and darkened: the out-of-focus backdrop
  ui/studio/export_btn.png   the real "Export video" button, cropped from the replay dialog
"""
import pathlib
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
S = ROOT / "ui/studio"
PAGE = (856, 178, 1713, 1309)  # page rect in the 2x capture, measured (white edge at 858..1710)

im = Image.open(S / "clean.png").convert("RGB")
ImageDraw.Draw(im).rectangle(PAGE, fill=(23, 23, 23))
im.save(S / "nopage.png")
blur = im.resize((1280, 720), Image.LANCZOS).filter(ImageFilter.GaussianBlur(9))
ImageEnhance.Brightness(blur).enhance(0.55).save(S / "nopage_blur.jpg", quality=92)
Image.open(ROOT / "ui/panel_pink.png").convert("RGB").crop((1615, 253, 1885, 310)).save(S / "export_btn.png")
print("ok")
