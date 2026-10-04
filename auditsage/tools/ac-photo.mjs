// Renders tools/ac-photo.html at 2x and post-processes it into product/photos/ac-01.jpg
// (grain, lens softness, vignette), so it reads as a site photo rather than an illustration.
//   node tools/ac-photo.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 520 }, deviceScaleFactor: 2 });
await p.goto('file://' + path.join(ROOT, 'tools/ac-photo.html'));
const raw = path.join(ROOT, 'build/ac-photo-raw.png');
fs.mkdirSync(path.dirname(raw), { recursive: true });
await (await p.$('#s')).screenshot({ path: raw });
await b.close();
fs.mkdirSync(path.join(ROOT, 'product/photos'), { recursive: true });
execFileSync('python3', ['-c', `
import numpy as np
from PIL import Image, ImageFilter
im = Image.open(${JSON.stringify(raw)}).convert('RGB').filter(ImageFilter.GaussianBlur(1.1))
a = np.asarray(im).astype(np.float32)
h, w, _ = a.shape
rng = np.random.default_rng(5)
a += rng.normal(0, 6.5, (h, w, 1))
y, x = np.mgrid[0:h, 0:w]
v = 1 - 0.38 * (((x - w * .45) / w) ** 2 + ((y - h * .4) / h) ** 2) * 2.2
a *= v[..., None]
a[..., 0] *= 1.03; a[..., 2] *= 0.97
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(${JSON.stringify(path.join(ROOT, 'product/photos/ac-01.jpg'))}, quality=90)
`]);
console.log('wrote product/photos/ac-01.jpg');
