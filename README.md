# ZexDraws launch film

A 15 s, 1920×1080 product film for ZexDraws. It's built from real app UI captured from a Linux
build, plus replay footage exported from the app. The film loops seamlessly.

```
python3 audio/score.py      # synthesize the 128 BPM score, measure beats.json, -14 LUFS
node render.mjs --contact   # one frame per beat -> out/contact.png (check this first)
node render.mjs             # full film -> out/zexdraws-launch.mp4 (60 fps, 4-subframe blur, CRF 16)
```

Open `film.html` through any static server to preview it in real time.

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
