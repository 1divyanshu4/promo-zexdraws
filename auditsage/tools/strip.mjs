// Film strip across a transition: N evenly spaced frames from A to B seconds, then one sheet.
//   node tools/strip.mjs 5.3 6.3 8        -> out/strip-5.30-6.30.png
// Use it on every handover. A contact sheet (one frame per beat) misses what happens between beats.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.end(fs.readFileSync(p)); });
await new Promise((r) => srv.listen(0, r));
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
pg.on('pageerror', (e) => console.error('page error', e.message));
await pg.goto(`http://127.0.0.1:${srv.address().port}/film.html?render`);
await pg.waitForFunction(() => window.filmReady === true);
const [a, z, n] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4] || 8)];
const dir = path.join(ROOT, 'build', 'strip'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const files = [];
for (let i = 0; i < n; i++) {
  const t = a + ((z - a) * i) / (n - 1);
  await pg.evaluate(async (t) => { await window.prepare([t]); window.seek(t); }, t);
  const f = path.join(dir, `${String(i).padStart(2, '0')}.jpg`);
  await pg.screenshot({ path: f, type: 'jpeg', quality: 80 }); files.push(['-label', `${t.toFixed(3)} s`, f]);
}
await b.close(); srv.close();
const out = path.join(ROOT, 'out', `strip-${a.toFixed(2)}-${z.toFixed(2)}.png`);
execFileSync('montage', [...files.flat(), '-tile', '4x', '-geometry', '480x270+3+3', '-pointsize', '16', out]);
console.log(`wrote ${path.relative(ROOT, out)}`);
