---
name: promo-film
description: Use when asked to make a product promo, launch film, feature video, app trailer or any short motion-design video for a product (especially a software product with a real UI). Gives the approach, hard rules, style guide and motion rules that made our reference studio film feel smooth, plus a small proven kit (closed-form springs, parallel renderer, synthesized score, transition checker), so the film is researched and built for its own product without re-learning any of it.
---

# Promo film

You are going to research a product and make a 10–20 s promo film for it, built in code: an HTML
page whose every frame is a pure function of time, rendered headless to H.264 with a synthesized,
beat-measured score. The reference is our ZexDraws studio film (see `references/reference-film.md`).
Do not copy that film. Copy the **approach** that made it work, and the **rules** it taught us.

Read these before you start, in this order:

1. `references/rules.md`: the hard rules. Breaking one is a bug.
2. `references/approach.md`: the phases, from research to delivery, and where to stop for the user.
3. `references/style-guide.md`: the look, type hierarchy, layout and UI-chrome conventions.
4. `references/motion-rules.md`: why things feel smooth or stiff, and the exact spring settings.
5. `references/reference-film.md`: the worked example, shot by shot, with what the user rejected and why.
6. `references/pipeline.md`: capture, render, audio and verification tooling. Read before building.

## The kit (`kit/`): copy, don't reinvent

| File | What it gives you |
|---|---|
| `kit/lib/motion.js` | Closed-form springs: `spring`, `track`, `indicator`, `swapAlpha`, `glide`, `pick`, `clock`, `loopT`; presets snappy/default/heavy/playful tuned to a 128 BPM beat. Pure functions of time. |
| `kit/test/motion.test.js` | 20 checks for the above. Run after touching presets. |
| `kit/render.mjs` | Parallel headless-Chromium renderer: 4 motion-blur subframes per frame, JPEG capture, chunked across browsers, joined losslessly, muxed with the score. `--contact` gives one frame per beat, `--still T` one frame. |
| `kit/tools/strip.mjs` | Film strip across a time range. Use on every transition; contact sheets miss what happens between beats. |
| `kit/audio/synth.py`, `kit/audio/score.py`, `kit/timeline.example.json` | Seeded synth score (128 BPM, 8 bars) whose arrangement and UI sounds come from the timeline; measures the 16th-note grid into `beats.json`; masters to -14 LUFS / -1 dBTP. |
| `kit/prep.mjs` | Measures footage clips and extracts frames (cached by file stamp). |

The reference film's own source (`film.js`, `film.html`) lives in the promo-zexdraws repo. Read it
for patterns (the box, masked text strips, docking to a moving camera, post windows), not to fill in.

## Non-negotiables at a glance

- Storyboard with static key frames **before** any film code, and wait for the user's OK.
- Real product UI and real footage only: capture, crop, composite. Never redraw the product's UI.
- One object carries the film from shot to shot. Shots hand over; they do not cut and restart.
- Every move is a spring from `motion.js`; any value with more than one target uses `track()`.
- Every exit overlaps the next entrance. Nothing finishes and then waits.
- Contact sheet + transition strips + scoring loop before every full render.
