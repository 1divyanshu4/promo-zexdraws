// Renders a film in headless Chromium.
//   node render.mjs              full film -> out/<product.output>.mp4 (60 fps, 4 subframes, H.264 CRF 16)
//   node render.mjs --contact    one frame per beat -> out/contact-<product.output>.png (look at this first)
//   node render.mjs --still 7.5  a single frame at t=7.5 s -> out/still.png
//   --jobs N                     parallel browsers (default: one per CPU core)
//
// Every frame is a pure function of time, so the film is cut into chunks that a pool of
// browsers renders in parallel; each chunk becomes a video segment, and the segments are
// joined losslessly and muxed with the score. Output is written to a temp file and renamed
// only when complete, so a stopped render never clobbers a finished film.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prep } from './prep.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const FPS = 60, SUBFRAMES = 4, CHUNK = 60, JPEG_Q = 95;
const args = process.argv.slice(2);
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const mode = args.includes('--contact') ? 'contact' : args.includes('--still') ? 'still' : 'film';
// The product decides the output name; the engine (film.html) is the same for every product.
const PRODUCT = JSON.parse(fs.readFileSync(path.join(ROOT, 'product/product.json'), 'utf8'));
const FILM = { html: 'film.html', audio: 'audio/score.wav', out: PRODUCT.output || 'launch', capture: 'dom' };
const JOBS = Math.max(1, Number(opt('--jobs', os.cpus().length)));
const DOM = FILM.capture === 'dom';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.otf': 'font/otf', '.ttf': 'font/ttf' };

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

// Subframe times for frame f: a 180-degree shutter centred on the frame.
const subTimes = (f) => Array.from({ length: SUBFRAMES }, (_, k) => (f + ((k + 0.5) / SUBFRAMES - 0.5) * 0.5) / FPS);

// One browser + page. Separate browser instances so each gets its own renderer process.
async function openWorker(base) {
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`${base}/${FILM.html}?render`);
  await page.waitForFunction(() => window.filmReady === true, null, { timeout: 60000 });
  const cdp = DOM ? await page.context().newCDPSession(page) : null;
  const w = { browser, page };
  // DOM films: one JPEG per subframe (ffmpeg blends them). Canvas films blend in-page.
  w.shoot = async (t, format = 'jpeg') => {
    await page.evaluate(async (t) => { await window.prepare([t]); window.seek(t); }, t);
    try {
      const { data } = await cdp.send('Page.captureScreenshot', format === 'png' ? { format: 'png' } : { format: 'jpeg', quality: JPEG_Q, optimizeForSpeed: true });
      return Buffer.from(data, 'base64');
    } catch {
      return await page.screenshot({ type: format === 'png' ? 'png' : 'jpeg', quality: format === 'png' ? undefined : JPEG_Q });
    }
  };
  w.frame = async (f, format = 'jpeg') => {
    const u = await page.evaluate(async ([f, fps, n, fmt, q]) => {
      await window.renderFrame(f, fps, n);
      return document.getElementById('film').toDataURL(fmt === 'png' ? 'image/png' : 'image/jpeg', q / 100);
    }, [f, FPS, SUBFRAMES, format, JPEG_Q]);
    return Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');
  };
  // Images for frame f, in the order ffmpeg expects.
  w.images = async (f) => {
    if (!DOM) return [await w.frame(f)];
    const out = [];
    for (const t of subTimes(f)) out.push(await w.shoot(t));
    return out;
  };
  return w;
}

// Encode frames [a, b) to a video-only segment.
async function renderChunk(w, a, b, file) {
  const blend = DOM ? ['-vf', `tmix=frames=${SUBFRAMES},select='eq(mod(n\\,${SUBFRAMES})\\,${SUBFRAMES - 1})',setpts=N/${FPS}/TB`] : [];
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(DOM ? FPS * SUBFRAMES : FPS), '-i', '-',
    ...blend, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-an', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg ' + c)))));
  for (let f = a; f < b; f++) {
    for (const img of await w.images(f)) if (!ff.stdin.write(img)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
}

await prep();
await run('python3', [path.join(ROOT, 'tools/assets.py')]);
if (!fs.existsSync(path.join(ROOT, FILM.audio))) await run('python3', [path.join(ROOT, 'audio/score.py')]);
fs.mkdirSync(OUT, { recursive: true });
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;

if (mode === 'still' || mode === 'contact') {
  const w = await openWorker(base);
  const one = async (f) => (DOM ? w.shoot(f / FPS, 'png') : w.frame(f, 'png'));
  if (mode === 'still') {
    fs.writeFileSync(path.join(OUT, 'still.png'), await one(Math.round(Number(opt('--still', 0)) * FPS)));
    console.log('wrote out/still.png');
  } else {
    // One frame per beat, taken a little after the hit so the change is visible.
    const beats = await w.page.evaluate(() => window.BEAT_TIMES);
    const dir = path.join(ROOT, 'build', 'contact');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < beats.length; i++) {
      fs.writeFileSync(path.join(dir, `${String(i).padStart(2, '0')}.png`), await one(Math.round((beats[i] + 0.2) * FPS)));
    }
    const files = fs.readdirSync(dir).sort().map((f) => path.join(dir, f));
    await run('montage', [...files.flatMap((f, i) => ['-label', `beat ${i + 1}  ${(beats[i] + 0.2).toFixed(2)}s`, f]),
      '-tile', '4x', '-geometry', '640x360+6+6', '-pointsize', '18', '-background', '#d8d2c8', path.join(OUT, `contact-${FILM.out}.png`)]);
    console.log(`wrote out/contact-${FILM.out}.png`);
  }
  await w.browser.close();
} else {
  const probeWorker = await openWorker(base);
  const LOOP = await probeWorker.page.evaluate(() => window.LOOP);
  await probeWorker.browser.close();
  const frames = Math.round(LOOP * FPS);
  const segDir = path.join(ROOT, 'build', 'segments', FILM.out);
  fs.mkdirSync(segDir, { recursive: true });
  const chunks = [];
  for (let a = 0; a < frames; a += CHUNK) chunks.push([a, Math.min(frames, a + CHUNK), path.join(segDir, `${String(a).padStart(5, '0')}.mp4`)]);
  const t0 = Date.now();
  let next = 0, done = 0;
  const log = () => {
    const s = (Date.now() - t0) / 1000;
    const eta = done ? (s / done) * (chunks.length - done) : 0;
    console.log(`chunks ${done}/${chunks.length}  ${s.toFixed(0)}s elapsed${done ? `  ~${eta.toFixed(0)}s left` : ''}`);
  };
  console.log(`rendering ${frames} frames (${DOM ? SUBFRAMES + ' subframes each' : 'in-page blur'}) with ${JOBS} worker slots`);
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (next < chunks.length) {
      const [a, b, file] = chunks[next++];
      if (fs.existsSync(file) && fs.statSync(file).size > 10000) {
        done++;
        log();
        continue;
      }
      const w = await openWorker(base);
      try {
        await renderChunk(w, a, b, file);
      } finally {
        await w.browser.close().catch(() => {});
      }
      done++;
      log();
    }
  }));

  // Join segments (stream copy) and mux the score; write to a temp name, rename when done.
  const list = path.join(segDir, 'list.txt');
  fs.writeFileSync(list, chunks.map((c) => `file '${c[2]}'`).join('\n') + '\n');
  const file = path.join(OUT, `${FILM.out}.mp4`);
  const tmp = path.join(OUT, `.${FILM.out}.partial.mp4`);
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', path.join(ROOT, FILM.audio),
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', String(frames / FPS),
    '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, file);
  console.log(`wrote ${path.relative(ROOT, file)} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
server.close();
