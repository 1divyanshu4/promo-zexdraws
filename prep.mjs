// Reads footage.json, measures each clip and extracts its frames for the film.
//   node prep.mjs          (render.mjs also runs this automatically)
// Output: build/manifest.json and build/frames/<key>/<n>.jpg. Cached per clip on file size,
// mtime and settings, so swapping a clip re-extracts only that clip.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(ROOT, 'build');
const REPLAY_WIDTH = 1280; // the preview box never shows footage wider than this
const CANVAS_WIDTH = 900;
const THUMBS = 6;

// Bounding box of the near-white canvas in an extracted frame, in source-video pixels.
function canvasRect(jpg, info) {
  const w = 240, h = Math.round((240 * info.height) / info.width);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', jpg, '-vf', `scale=${w}:${h}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
  const rowsOk = [], colsOk = [];
  for (let y = 0; y < h; y++) { let c = 0; for (let x = 0; x < w; x++) if (raw[y * w + x] > 245) c++; if (c > w * 0.3) rowsOk.push(y); }
  for (let x = 0; x < w; x++) { let c = 0; for (let y = 0; y < h; y++) if (raw[y * w + x] > 245) c++; if (c > h * 0.3) colsOk.push(x); }
  const sx = info.width / w, sy = info.height / h;
  return [Math.round(colsOk[0] * sx), Math.round(rowsOk[0] * sy), Math.round((colsOk.at(-1) + 1) * sx), Math.round((rowsOk.at(-1) + 1) * sy)];
}

function probe(file) {
  const out = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=width,height,nb_read_frames:format=duration', '-of', 'json', file,
  ]).toString());
  const s = out.streams[0];
  const duration = Number(out.format.duration);
  const frames = Number(s.nb_read_frames);
  // Container frame rates lie (the canvas clip claims 240 fps); trust frames / duration.
  return { width: s.width, height: s.height, duration, frames, fps: frames / duration };
}

function extract(file, dir, width) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('ffmpeg', [
    '-v', 'error', '-i', file, '-vf', `scale=${width}:-2:flags=lanczos`,
    '-q:v', '2', '-start_number', '0', '-fps_mode', 'passthrough', path.join(dir, '%d.jpg'),
  ]);
}

// Where the paint changes in each frame of the canvas clip, as 0..1 coordinates of the clip.
async function paintTrack(file, info) {
  const w = 60, h = Math.round((60 * info.height) / info.width);
  const raw = await new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=area`,
      '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'gray', '-']);
    const chunks = [];
    p.stdout.on('data', (c) => chunks.push(c));
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error('ffmpeg ' + code))));
  });
  const n = Math.floor(raw.length / (w * h));
  const pts = [];
  for (let f = 0; f < n; f++) {
    if (f === 0) { pts.push(null); continue; }
    let sx = 0, sy = 0, sw = 0;
    for (let i = 0; i < w * h; i++) {
      const d = Math.abs(raw[f * w * h + i] - raw[(f - 1) * w * h + i]);
      if (d > 6) { sx += (i % w) * d; sy += Math.floor(i / w) * d; sw += d; }
    }
    pts.push(sw > 40 ? [(sx / sw + 0.5) / w, (sy / sw + 0.5) / h] : null);
  }
  // Hold the last known point through still frames, then smooth.
  let last = pts.find(Boolean) || [0.5, 0.5];
  const held = pts.map((p) => (last = p || last));
  return held.map((_, i) => {
    let x = 0, y = 0, c = 0;
    for (let k = -4; k <= 4; k++) {
      const q = held[Math.min(held.length - 1, Math.max(0, i + k))];
      x += q[0]; y += q[1]; c++;
    }
    return [+(x / c).toFixed(4), +(y / c).toFixed(4)];
  });
}

export async function prep({ quiet = false } = {}) {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'footage.json'), 'utf8'));
  const manifestPath = path.join(BUILD, 'manifest.json');
  const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { clips: {} };
  const clips = {};
  const jobs = [
    ...Object.entries(cfg.replay.skins).map(([key, file]) => ({ key, file, width: REPLAY_WIDTH })),
    { key: 'canvas', file: cfg.canvas.file, width: CANVAS_WIDTH, track: true },
  ];
  for (const job of jobs) {
    const abs = path.join(ROOT, job.file);
    if (!fs.existsSync(abs)) throw new Error(`footage.json points at a missing file: ${job.file}`);
    const st = fs.statSync(abs);
    const stamp = `${job.file}|${st.size}|${st.mtimeMs}|${job.width}`;
    const dir = path.join(BUILD, 'frames', job.key);
    if (old.clips[job.key]?.stamp === stamp && fs.existsSync(dir)) {
      clips[job.key] = old.clips[job.key];
      continue;
    }
    if (!quiet) console.log(`prep: ${job.key} <- ${job.file}`);
    const info = probe(abs);
    extract(abs, dir, job.width);
    const count = fs.readdirSync(dir).length;
    clips[job.key] = { ...info, frames: count, stamp, dir: `build/frames/${job.key}` };
    if (job.track) clips[job.key].paint = await paintTrack(abs, info);
  }
  // Floor thumbnails (dark film): THUMBS per look, evenly spread over the usable range.
  for (const key of Object.keys(cfg.replay.skins)) {
    const c = clips[key];
    if (c.thumbs && c.thumbs.length === THUMBS && c.thumbs[0].endsWith('_g.jpg')) continue;
    const dir = path.join(BUILD, 'thumbs');
    fs.mkdirSync(dir, { recursive: true });
    c.thumbs = [];
    for (let i = 0; i < THUMBS; i++) {
      const sec = cfg.replay.useFrom + ((i + 0.5) / THUMBS) * (cfg.replay.useTo - cfg.replay.useFrom);
      const n = Math.min(c.frames - 1, Math.round(sec * c.fps));
      const out = `build/thumbs/${key}_${i}_g.jpg`; // grey, dimmed: the floor's look, baked in
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(c.dir, `${n}.jpg`), '-vf', "scale=480:-2,hue=s=0.12,curves=all='0/0 1/0.62'", '-q:v', '3', path.join(ROOT, out)]);
      c.thumbs.push(out);
    }
  }
  // The drawing's canvas inside the exported frame: the white rectangle on frame 0.
  const firstSkin = Object.keys(cfg.replay.skins)[0];
  if (!clips[firstSkin].canvasRect) clips[firstSkin].canvasRect = canvasRect(path.join(ROOT, clips[firstSkin].dir, '0.jpg'), clips[firstSkin]);
  const lengths = Object.keys(cfg.replay.skins).map((k) => clips[k].duration);
  if (Math.max(...lengths) - Math.min(...lengths) > 0.5) {
    console.warn('prep: replay skins differ in length by more than 0.5 s; skin switches will jump.');
  }
  const manifest = { replay: { ...cfg.replay, canvasRect: clips[firstSkin].canvasRect }, clips };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const m = await prep();
  for (const [k, c] of Object.entries(m.clips)) {
    console.log(`${k.padEnd(8)} ${c.width}x${c.height}  ${c.duration.toFixed(2)}s  ${c.frames} frames  ${c.fps.toFixed(2)} fps`);
  }
}
