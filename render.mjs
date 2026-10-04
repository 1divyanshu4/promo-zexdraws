// Renders film.html in headless Chromium.
//   node render.mjs              full film -> out/zexdraws-launch.mp4 (60 fps, 4 subframes, H.264 CRF 16)
//   node render.mjs --contact    one frame per beat -> out/contact.png (look at this first)
//   node render.mjs --still 7.5  a single frame at t=7.5 s -> out/still.png
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prep } from './prep.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const FPS = 60, SUBFRAMES = 4;
const args = process.argv.slice(2);
const mode = args.includes('--contact') ? 'contact' : args.includes('--still') ? 'still' : 'film';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.otf': 'font/otf', '.ttf': 'font/ttf' };

function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
  });
}

await prep();
fs.mkdirSync(OUT, { recursive: true });
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`${base}/film.html?render`);
await page.waitForFunction(() => window.filmReady === true, null, { timeout: 60000 });
const LOOP = await page.evaluate(() => window.LOOP);

const grab = (f) => page.evaluate(async ([f, fps, n]) => {
  await window.renderFrame(f, fps, n);
  return document.getElementById('film').toDataURL('image/png');
}, [f, FPS, SUBFRAMES]).then((u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));

if (mode === 'still') {
  const t = Number(args[args.indexOf('--still') + 1]);
  fs.writeFileSync(path.join(OUT, 'still.png'), await grab(Math.round(t * FPS)));
  console.log('wrote out/still.png');
} else if (mode === 'contact') {
  // One frame per beat, taken a little after the hit so the change is visible.
  const beats = await page.evaluate(() => window.BEAT_TIMES);
  const dir = path.join(ROOT, 'build', 'contact');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < beats.length; i++) {
    const f = Math.round((beats[i] + 0.2) * FPS);
    fs.writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}.png`), await grab(f));
  }
  const files = fs.readdirSync(dir).sort().map((f) => path.join(dir, f));
  await run('montage', [...files.flatMap((f, i) => ['-label', `beat ${i + 1}  ${(beats[i] + 0.2).toFixed(2)}s`, f]),
    '-tile', '4x', '-geometry', '640x360+6+6', '-pointsize', '18', '-background', '#d8d2c8', path.join(OUT, 'contact.png')]);
  console.log('wrote out/contact.png');
} else {
  const frames = Math.round(LOOP * FPS);
  const file = path.join(OUT, 'zexdraws-launch.mp4');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-i', path.join(ROOT, 'audio', 'score.wav'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '256k', '-t', String(frames / FPS), '-movflags', '+faststart', file],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg ' + c)))));
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const png = await grab(f);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await done;
  console.log(`\nwrote ${path.relative(ROOT, file)}`);
}
await browser.close();
server.close();
