// Reads footage.json, measures each clip and extracts its frames for the film.
//   node prep.mjs          (render.mjs also runs this automatically)
// Output: build/manifest.json and build/frames/<key>/<n>.jpg. Cached per clip on file size,
// mtime and settings, so swapping a clip re-extracts only that clip.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(ROOT, 'build');
const LOOK_WIDTH = 1280; // no template shows a look wider than this
const HERO_WIDTH = 900;

function probe(file) {
  const out = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=width,height,nb_read_frames:format=duration', '-of', 'json', file,
  ]).toString());
  const s = out.streams[0];
  const duration = Number(out.format.duration);
  const frames = Number(s.nb_read_frames);
  // Container frame rates lie (screen recordings often claim 240 fps); trust frames / duration.
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

export async function prep({ quiet = false } = {}) {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'footage.json'), 'utf8'));
  const manifestPath = path.join(BUILD, 'manifest.json');
  const old = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { clips: {} };
  const clips = {};
  const jobs = [
    ...Object.entries(cfg.looks).map(([key, file]) => ({ key, file, width: LOOK_WIDTH })),
    { key: 'hero', file: cfg.hero, width: HERO_WIDTH },
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
    clips[job.key] = { ...info, frames: fs.readdirSync(dir).length, stamp, dir: `build/frames/${job.key}` };
  }
  const lengths = Object.keys(cfg.looks).map((k) => clips[k].duration);
  if (Math.max(...lengths) - Math.min(...lengths) > 0.5) {
    console.warn('prep: the look clips differ in length by more than 0.5 s; look switches will jump.');
  }
  const manifest = { replay: cfg.replay, looks: Object.keys(cfg.looks), clips };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const m = await prep();
  for (const [k, c] of Object.entries(m.clips)) {
    console.log(`${k.padEnd(8)} ${c.width}x${c.height}  ${c.duration.toFixed(2)}s  ${c.frames} frames  ${c.fps.toFixed(2)} fps`);
  }
}
