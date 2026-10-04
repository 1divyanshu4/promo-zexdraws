# Approach

Seven phases. Two of them end at the user (marked **STOP**). Everything else you can do alone.

## 1. Research the product

- Read the product's repo, README, docs and site. Install and run it if you can.
- Write down, in one sentence each: what it is, who it's for, the **one** thing it does better than
  the alternatives, and the outcome the user gets (what they walk away with).
- Ask the user if the selling point is not obvious or you are guessing. A wrong selling point
  wastes the whole film; ours did once (we sold drawing; the point was replay and export).
- Collect brand assets from the source, not from memory: logo files, colours (from theme code),
  fonts (from the asset folder), real product names for features.

## 2. Gather real material

- Capture the real UI from a running build at 2× (see `pipeline.md`): the main workspace with an
  empty work surface, the panels/menus that show depth, the button the story clicks, the export
  or share control.
- Get footage of the product in use from the user (or record it). If the product has variants
  (themes, skins, styles), get the **same** piece of work in each variant, same length, so the
  film can switch variants mid-playback without the content jumping.
- Inventory what you have and what is weak. Tell the user what a better clip would be.

## 3. Shape the story on the beat grid

Fit the story to 8 bars at 128 BPM (32 beats, 15 s; one beat = 0.469 s). The arc that worked:

| Beats | Job | Reference film |
|---|---|---|
| 0–6 | **Hook with real UI.** Short shots of the product's parts, already moving on frame 0. | Brushes / Colours / Layers panels, 1.5 beats each, then the studio |
| 6–12 | **The product in use + the promise.** Footage in a window, a headline in the display face, two supporting lines. | "You just draw." beside the drawing |
| 12–14 | **The action.** The camera finds the control that starts the hero feature; a cursor clicks it. | Replay button |
| 14–21.5 | **The hero feature, shown as variety.** One preview, cycling variants on the beat, with a labelled HUD. | Five frame skins |
| 21.5–23 | **The outcome action.** The real export/share control appears and is clicked. | Export video |
| 23–27 | **Where it goes.** The output in real destination contexts. | Instagram / TikTok / YouTube windows |
| 27–32 | **Lockup.** Everything folds into the logo; name, tagline, one pill; hold to the end. Design a new lockup and logo move for each film (style guide, Lockup). | Logo, wordmark, tagline |

Adapt the jobs to the product; keep the rhythm: a change every 1.5–6 beats, one hero beat with a
sound accent where the music drops (beat 13 → boom on 14), the lockup with the crash.

Decide the **one object** that carries the film through every shot (ours: the page → the
drawing window → the page again → the preview → the TikTok video → the logo's seed). Every shot
change should be that object moving, resizing, re-skinning or docking, not a cut.

## 4. Storyboard (**STOP** for approval)

- Build one static HTML page per key frame from the real captures and footage (a single
  `storyboard.html?f=N` file is enough), screenshot each with Playwright, and montage a board.
- Write `docs/shotlist.md`: a table with beats, seconds, what is on screen, how it moves, and the
  sound for each shot. List open questions at the bottom with your default for each.
- Show the board and the table. Expect several rounds; they are cheap now and expensive later.
  Typical notes we got and what they taught: "too busy → split into short shots", "looks basic →
  give it the same hierarchy as the strongest shot", "balance the frame", "not a Mac window",
  "less rounded", "add padding so it reads as a window", "don't crop the video, expand it".
- Do not write film code until the user says go.

## 5. Build

- Start from the kit (`kit/`): `lib/motion.js`, `render.mjs`, `tools/strip.mjs`, the score.
- One HTML page, DOM + CSS 3D, a `seek(t)` that sets every property from springs (see
  `motion-rules.md`). Put product values (copy, colours, geometry measured from captures) in
  one place at the top or in a config file, so revisions are edits, not rewrites.
- Lay the score's arrangement and every UI sound on the timeline (`timeline.json`) in beats;
  run the score script to measure `beats.json`; drive all film timing through `B(beat)` on the
  measured grid.
- Derive geometry from the assets (natural image sizes, measured text widths) instead of
  hard-coding pixel numbers that only fit one string.

## 6. Verify (the loop)

1. `node render.mjs --contact`: look at it. Every beat should read.
2. `node tools/strip.mjs A B 8` across **every** transition. Look for: dead holds (something
   finished and the frame waits), collisions (an exiting label under an entering panel),
   cursor arriving after its click, things popping in or out at a visibility switch.
3. Score the six criteria 1–10 (see `rules.md`). Fix the three worst. Repeat until all are 8+.
4. Check audio: loudness, peak, and that every sound sits on a visible event.

## 7. Render and deliver (**STOP** for feedback)

- `node render.mjs` (≈ 6 min for 15 s on 4 cores). Verify frames, duration, loudness; look at a
  few frames from the encoded file at full resolution.
- Send the video with one line of specs. Summarize what changed since the last version.
- Commit and push the source; never the video.
- Expect feedback on feel ("stiff", "not smooth"): that is almost always timing, see
  `motion-rules.md` before touching anything else.
