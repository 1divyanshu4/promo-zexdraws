"""Split ui/studio.png into the layers of the exploded view (ui/studio/*.png + layers.json).

The base keeps the studio's shape with every lifted panel left as an empty socket, so a raised
panel never doubles with its own copy underneath. The page (canvas) is left out: it is the box.
Edges were measured on the 2x capture (panel colour 38, borders 53, workspace 23).
"""
import json, pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = Image.open(ROOT / "ui/studio.png").convert("RGB")
W, H = src.size
PANELS = {
    "title":   [0, 0, W, 56],
    "toolbar": [0, 56, W, 152],
    "tools":   [0, 152, 104, H],
    "rail":    [2464, 152, W, H],
    "bottom":  [104, 1336, 2464, H],
}
PAGE = [858, 182, 1710, 1306]
out = ROOT / "ui/studio"
base = src.copy()
d = ImageDraw.Draw(base)
for k, r in PANELS.items():
    src.crop(r).save(out / f"{k}.png")
    d.rectangle([r[0], r[1], r[2] - 1, r[3] - 1], fill=(30, 30, 30))
d.rectangle([PAGE[0], PAGE[1], PAGE[2] - 1, PAGE[3] - 1], fill=(23, 23, 23))
base.save(out / "base.png")
(out / "layers.json").write_text(json.dumps({"size": [W, H], "panels": PANELS, "page": PAGE}, indent=1) + "\n")
print("ok")
