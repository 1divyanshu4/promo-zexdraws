# ZexDraws launch films

A 15 s, 1920×1080 product film for ZexDraws. It's built from real app UI captured from a Linux
build, plus replay footage exported from the app. The film loops seamlessly.

```
python3 audio/score.py      # synthesize the 128 BPM score, measure beats.json, -14 LUFS
node render.mjs --contact   # one frame per beat -> out/contact.png (check this first)
node render.mjs             # full film -> out/zexdraws-launch.mp4 (60 fps, 4-subframe blur, CRF 16)
```

Open `film.html` through any static server to preview it in real time.

### The dark film (`docs/shotlist.md`, in the style recorded in `docs/style_guide.md`)

```
python3 audio/score_dark.py         # dark 128 BPM score, measured 16th grid -> beats-dark.json
node render.mjs --film dark --contact
node render.mjs --film dark         # -> out/zexdraws-dark.mp4
```

`film-dark.html` is DOM + CSS 3D (tilted planes, a card flip, a floor of cards). It's still
driven only by `window.seek(t)`. The renderer screenshots 4 subframes per frame, and ffmpeg
averages them for motion blur.

### The studio film (`docs/shotlist-studio.md`, storyboard in `docs/storyboard/`)

```
python3 tools/studio_assets.py         # page-less + blurred studio, Export button crop
python3 audio/score_dark.py studio     # score from timeline-studio.json -> beats-studio.json
node render.mjs --film studio --contact
node render.mjs --film studio          # -> out/zexdraws-studio.mp4
```

The Brushes / Colours / Layers panel cuts lead into the studio. The page becomes the drawing
window, then Replay is clicked and the drawing becomes the skin showcase. Export is clicked
and the box becomes the TikTok window beside Instagram and YouTube windows. Everything folds
into the logo. One element (the box) carries the drawing through every shot. This film ends
on the lockup rather than looping. The panels in `ui/studio/` were captured from the Linux
build: open a 1200×1584 canvas and click each right-rail button.

## Motion (`lib/motion.js`)

All motion in both films comes from closed-form springs, as pure functions of time.
`node test/motion.test.js` runs the checks.

| Function | Use |
|---|---|
| `track(t, keys, {loop})` | Any value with more than one target: one spring per change, summed, never restarted |
| `indicator(t, stops)` | Tab or segment indicators: the leading edge is stiffer than the trailing edge, so it stretches |
| `swapAlpha(t, tIn, tOut)` | Text inside a morphing box: enters after the morph starts, gone before the next |
| `glide(t, keys)` | Slow camera drifts: velocity ramps on a spring, position integrated in closed form |
| `loopT(t, dur)` | Wraps time so the last frame is pinned to the first |

| Preset | Overshoot | For |
|---|---|---|
| `snappy` | about 1% | Buttons, toggles, leading edges, digits |
| `default` | about 0.5% | Cards, containers, camera |
| `heavy` | 0% | Big type, logo lockups |
| `playful` | about 16% | Mascots only |

## Swapping in a new drawing

1. Export the same drawing from ZexDraws five times, one per look: the Neubrutalism frame in
   the pink, yellow and orange presets, then Manga and Fantasy. Also record a short clip of the
   canvas while you paint (1200×1584 matches the studio capture).
2. Put them in `footage/`, or point `footage.json` at them. Adjust `useTo` (the moment the
   drawing is finished) and `skip` (a stretch to jump over) if needed.
3. Run `node render.mjs`. Durations, frame rates, aspect ratios and the cursor's path over the
   canvas are measured from the files. Only clips whose files changed get re-extracted.

## Files

- `film.js`: the whole film. `window.seek(t)` paints frame t using closed-form springs.
- `timeline.json`: tempo, plus the UI sound for each beat. `beats.json` is measured from the track.
- `ui/`: real ZexDraws UI captured at 2× from a Linux build (`ui/ui.json` holds the measured
  rects and click points). Export is Android-only in the app, so the capture build stubbed the
  encoder to reach these screens. That change was never committed to the app repo.
- `assets/`: logo and fonts (Southern Beach, Inter) from the ZexDraws repo.
- `footage/`, `build/` and `out/` are generated or local and are not committed.
