# ZexDraws studio launch film

A 15 s, 1920×1080, 60 fps launch film for ZexDraws. It's built in code from real UI captured
from a Linux build of the app and replay footage exported from the app. The plan is in
`docs/shotlist.md`, and the approved storyboard is in `docs/storyboard/`.

```
node render.mjs --contact          # one frame per beat -> out/contact-zexdraws-studio.png (check this first)
node tools/strip.mjs 5.3 6.3 8     # frames across a transition -> out/strip-*.png
node render.mjs --draft            # quick preview: 2 subframes, fast encode -> out/zexdraws-studio-draft.mp4
node render.mjs                    # full film -> out/zexdraws-studio.mp4 (~3 min, 2 GPU workers on a 7 GB laptop)
python3 audio/score.py             # re-synthesize the score after editing timeline.json
```

Open `film.html` through any static server to preview it in real time (after one render, or
`node prep.mjs && python3 tools/assets.py`, has built `build/`).

## How it's put together

- `film.html`, `film.js`: the film. `window.seek(t)` paints frame t from closed-form springs
  (`lib/motion.js`, tested by `node test/motion.test.js`). There are no timers and no state.
- `product/product.json`: every ZexDraws-specific value: copy, colours, fonts, the studio
  geometry, the skins and the post captions. `product/` also holds the logo, fonts and UI captures.
- `footage.json`: the replay exports (one per skin) and the canvas clip. These live in `footage/`
  and aren't committed. To swap in a better drawing, point the paths at new files and re-render.
- `timeline.json`: the score's arrangement and every UI sound, in beats. `audio/score.py`
  synthesizes the track, measures the beat grid into `beats.json`, and masters to -14 LUFS.
- `render.mjs`: parallel headless-Chromium renderer, with 4 motion-blur subframes per frame and
  H.264 CRF 16. Chromium paints on the GPU (`--cpu` falls back to SwiftShader, ~3x slower), and the
  worker count is sized from free RAM (~0.7 GB each); pass `--jobs N` to override. `prep.mjs` extracts footage frames, and `tools/assets.py` builds the page-less
  and blurred studio stills. `render.mjs` runs both.

## Making another promo film

The approach, rules, style guide and motion rules this film taught us are in the `promo-film`
skill (`.claude/skills/promo-film/`), with a reusable kit (springs, renderer, score, transition
checker). This film is its worked reference.
