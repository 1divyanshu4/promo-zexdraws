# Pipeline

Tooling that works, with the traps we already hit.

## Environment

- Node 22+, ffmpeg, ImageMagick (`montage`, `compare`), Python 3 with numpy, scipy, librosa,
  soundfile, Pillow. `npm i playwright@<version matching the installed Chromium>`; if a
  Chromium is preinstalled (e.g. `/opt/pw-browsers`), pin the Playwright release whose browser
  build matches it instead of downloading (we pinned 1.56.1 for build 1194).
- Keep footage, `build/` and `out/` out of git. Commit captures, config, code and docs.

## Capturing real UI

- Build the product for a desktop target and run it headless under Xvfb at 2× scale
  (`Xvfb :99 -screen 0 2560x1600x24`, `GDK_SCALE=2`), drive it with `xdotool`
  (click, type, key), and grab frames with `import -window root`.
- Apps may need XDG folders (`xdg-user-dirs-update`, `~/Documents`) to start.
- To isolate a panel: capture with it open and closed, diff the two, take the bounding box,
  then trim the workspace colour off the edges (`convert -fuzz 4% -trim`).
- Wait long enough for the UI to settle (crossfades, animations) before capturing.
- If a feature is platform-gated (ours: video export only on Android), stub it in a **scratch
  copy** of the app to reach its screens; never commit that change to the product repo.
- Pre-process stills once (cut-outs, pre-blurred backdrops) with a script, not CSS at runtime.

## Score and timing

- `kit/audio/score.py` + `synth.py`: seeded drums, sub, lead, pad, risers, impacts.
  The arrangement and the UI sound events come from `timeline.json` (beats, 16ths allowed).
  Any number of bars; the progression repeats every 8 and the last bar takes the turnaround chord.
- The film's own sound lives in `music.sound` (all keys optional; omitted keys fall back to the
  reference film's sound, which renders byte-identical):

  | Key | Values |
  |---|---|
  | `seed` | integer: noise and variation |
  | `progression` | 8 × `[bass root MIDI, [voicing MIDI notes]]` |
  | `lead` | `voice`: `bell` (FM), `marimba` (modal), `keys` (electric piano); `pattern`: beat positions in the bar; `octave`; `gain` |
  | `pad` | `voice`: `dark` (filtered saws), `warm` (sines, slow tremolo), `glass` (high detuned sines); `cutoff`; `gain` |
  | `drums` | `kick`: `punchy`, `soft`, `deep`; `snare`: `clap`, `rim`, `snap`; `hats`: `16ths`, `8ths`, `offbeat`; `swing` 0–0.2 |
  | `ui` | `tone`: `digital`, `wood`, `glass` (clicks and ticks); `pitch` multiplier; `gain` |
  | `mix` | `stereo` (spreads lead and hats, decorrelated reverb); `width` 0–0.6; `duck` sidechain depth (0.3 smooth, 0.6 pumping); `reverb` amount; `hatsLP` Hz to soften hats |

  Polish checklist (the user called an early GreenSage mix "not polished and smooth"): stereo on,
  duck ≤ 0.35, hats low-passed around 9 kHz, a soft kick and snap rather than distorted ones, the
  lead a little under the pad, UI ticks at about 0.8 gain when there are many of them.

  Swing moves odd 16ths, so expect `maxGridErrorMs` near the 30 ms snap window; hits on beats and
  8ths are unaffected.
- The script measures onsets with librosa and snaps each 16th to the nearest measured peak
  (within 30 ms) into `beats.json`. The film converts beats to seconds only through that grid.
- Mastering: two-pass `loudnorm` to -14 LUFS then `alimiter` at 0.8 (a plain limit of 1.0 let
  true peak overshoot -1 dBTP). Check with `ffmpeg -af ebur128=peak=true`.

## Rendering

- `kit/render.mjs` serves the project over HTTP, opens N headless browsers, renders 60-frame
  chunks in parallel, pipes JPEG (q95) subframes into ffmpeg (`tmix` over 4 subframes → 180°
  shutter motion blur), joins the chunks with the concat demuxer (stream copy), muxes the score.
- Measured costs, so you know where time goes: `seek()` is 3–10 ms; screenshots dominate.
  JPEG capture was ~2.5× faster than PNG; a `preserve-3d` rig over a large scene ~4× slower than
  flat; four browsers ~2–3× faster on four cores. 15 s at 60 fps renders in about 6 minutes.
- The page must expose `window.seek(t)`, `window.prepare(times)` (await images needed for those
  times), `window.LOOP` (duration), `window.BEAT_TIMES`, and set `window.filmReady = true`.
- Write to a temp file and rename on success: a stopped render must never clobber a good film.

## Verification

- `node render.mjs --contact`: one frame per beat (+0.2 s) → `out/contact-*.png`.
- `node tools/strip.mjs A B 8`: eight frames across a transition → `out/strip-A-B.png`.
- `node render.mjs --still T` for a single full-resolution frame.
- After encoding: `ffprobe` for frame count and duration, `ebur128` for loudness, and grab a
  few frames from the MP4 at full resolution (downscaled montages show false banding).
- When refactoring, compare contact sheets before/after (`compare -metric RMSE`, then a
  thresholded difference image) to prove nothing moved that shouldn't.

## Visibility gotcha

`visibility: visible` on a child overrides `hidden` on its parent. If a world element is shown
by its own time window, its window must also be inside the parent's, or it leaks into shots
where the parent is hidden (we had a white page floating behind the opening panels).
