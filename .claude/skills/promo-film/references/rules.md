# Rules

Hard rules. Each one exists because breaking it cost us a revision on the reference film.

## Render contract
- Every film is a pure function of time: `window.seek(t)` paints frame `t`, from nothing.
- No CSS transitions, no `setTimeout`, no `requestAnimationFrame` in render mode, no state carried
  between frames. Noise is seeded (mulberry32), never `Math.random`.
- Anything read from layout (`getBoundingClientRect`, text measurement) is read from the current
  frame's own transforms, or once at load. Never from "the last frame".
- Render with the kit's `render.mjs`: 1920×1080, 60 fps, 4 subframes blended for motion blur,
  H.264 yuv420p CRF 16, AAC 256k. The output is written to a temp file and renamed on success.

## Product truth
- **Find the real selling point before anything else.** Ask what the product does that others
  don't, or verify it from the repo and docs. Our first ZexDraws cut sold drawing. The user
  stopped it: drawing is commodity; replay and customisable export are the point. The whole
  structure changed.
- **Real UI by default.** Capture it from a running build or use the product's own screenshots
  (docs, manuals), and crop, composite and animate those. Do not invent UI.
- **Rebuilt screens only with the user's OK**, and then faithfully: same layout, components, type
  and colours as the real screens. The reason to rebuild is usually data: real screenshots come
  from different demo records, so a story that follows one thing (one machine, one customer)
  needs one consistent dataset across every screen. Keep that dataset in the shot list and use
  it everywhere; never let numbers drift between shots. (AuditSage: the docs' nameplate, data entry
  and analysis came from three different sample audits; we rebuilt them around one compressor.)
- **Fact-check every label against the screen it points at** before showing a frame.
- Use the user's real footage for the product in use. If footage is weak (e.g. the drawing is
  already finished on frame 0), say so and say what clip would be better. Keep footage swappable
  through a config file so they can drop a better clip in later.
- Copy must describe what the product really does. Panel captions name what is visibly in the
  panel ("5 sets · pressure dynamics" only if there are 5 sets).

## Copy
- Short lines. One idea per line. A headline in the display face; supporting lines in the UI face.
- No pressure words for a calm, creative product: we removed "Recorder", "REC", "recorded",
  "always on". Say what the user gains ("Every stroke · saved"), not what is watching them.
- No badges or stat blocks that don't add meaning. We removed a "1,284 strokes saved" chip and a
  stats column: they cluttered the shot and said nothing the headline didn't.

## Look (banned defaults)
- Centred title on a gradient, everything fading in, corner labels and frame borders, glow on
  UI chrome, generic particle bursts.
- Mac traffic-light windows and heavily rounded cards. Windows are flat: title left, line-icon
  minimise/maximise/close right, 6 px corners, 16 px padding around their content.
- Cropping the product's output to fit a format. Extend it instead (see style guide, "Formats").
- Busy compositions: if a shot shows more than one idea, split it into short shots. Our exploded
  view of four floating panels became three 0.7 s panel shots.
- One display face, one UI face, one accent colour unless the brief says otherwise.

## Platforms
- Social post templates follow each platform's real layout (header, action rows, counts, caption,
  player chrome) and may name the platform in the window title. Never use platform logo marks.
  Counts, handles and captions are invented for the product and plausible.

## Sound
- Score and sound effects are synthesized in code unless a track is supplied.
- Every hit lands on the **measured** beat grid (`beats.json`, 16th-note resolution), not on
  arithmetic beat times.
- Loudness -14 LUFS integrated, true peak ≤ -1 dBTP (two-pass loudnorm + limiter at 0.8).
- A film that ends (not a loop) fades its last half second.

## Process
- Storyboard first: static key frames rendered from real assets, plus a beat-grid shot table.
  Show them, iterate on the user's notes, and **wait for an explicit go** before film code.
- Before showing any render: contact sheet (one frame per beat), film strips across every
  transition, score 1–10 on hook in first 2 s, readability at phone size, motion quality, variety,
  brand accuracy, sound sync. Fix the three worst until every score is 8+. Then full render.
- Something new must happen every 2–4 seconds.
- Commit and push each meaningful step. Rendered video is not committed; send it to the user.
