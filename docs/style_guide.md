# Style guide: from the reference film

Source: `refs/reference.mp4`, a 15.06 s, 1920×1080, 60 fps launch film for a PDF component library.
Frames sampled every 0.5 s are in `refs/frames/`. This guide records the reference's **grammar**:
color, type, pacing, camera and transitions. None of its content, logos, characters or copy
carries over.

Where the reference conflicts with our studio rules (`CLAUDE.md`), the studio rules win. The
rows marked **Not used** show where.

---

## 1. Palette

The reference is near-black and close to monochrome. Color comes from the product content
(themes, tokens), never from the chrome.

| Role | Reference (sampled) | Ours |
|---|---|---|
| Background, frame edge | `#08070A` (faint violet cast) | `#08070A` |
| Background, centre (vignette peak) | `#18171A` | `#18171A` |
| Raised plate (grid floor, slabs) | `#242326` / `#272629` | `#262626` (the app's own panel grey) |
| Paper / product surface | `#FFFFFF` | Real app captures and footage, untouched |
| Primary text | `#FFFFFF` | `#FFFFFF` |
| Secondary text (token names, captions) | `#9F9EA1` | `#9F9EA1` |
| Faint text (inactive state) | ≈ `#5B5A5E` | `#5B5A5E` |
| Hairlines / dividers | ≈ `#2A292D` | `#2A292D` |
| Accent | Each theme brings its own; the chrome has none | **One:** `#8B5CF6`, the ZexDraws app accent. Used only for the active underline, the active ring, and the lockup's slash |

The vignette is a large radial falloff from `#18171A` at the centre to `#08070A` at the corners.
It follows the subject (it brightens behind the lockup at the end), but stays soft, with no
visible edge. It's lighting on the background, not a glow on UI.

## 2. Type

The reference uses three voices:

| Voice | Reference | Ours (brand faces only) |
|---|---|---|
| Display: names, big numbers, lockup | Neutral geometric sans, Bold, tracking about -2%. Theme names are set in each theme's own face (serif, slab, mono…) | **Southern Beach** for names and the wordmark. **Inter Bold** for numerals, with tabular figures and -2% tracking. Studio rule: one display face, so no per-item faces |
| Eyebrow / label | Monospace, uppercase, about 13 px at 1080p, tracking +18–22%, `#9F9EA1`, with the counter in white (`THEME 04/09`) | **Inter Medium**, uppercase, 15 px, tracking +20%. The brand has no mono, so wide-tracked Inter stands in |
| Data rows: token / hex | Mono, sentence case, 17 px, name in `#9F9EA1`, value in white | Inter Medium, 17 px, `tnum` on for the hex values |
| Tagline | Sans SemiBold, about 52 px, tracking -1%, top-lit grey-to-white gradient | Inter SemiBold, 52 px, flat `#FFFFFF`. No gradient text |

Sizes (1080p): eyebrows 13–15 px; data rows 17 px; names 90–110 px; stat numerals about 120 px;
the lockup wordmark about 150 px.

## 3. Shot lengths and pacing

There are no hard cuts in the whole film. Scene detection at threshold 0.18 finds nothing.
It's one continuous camera, with objects turning into other objects.

| Segment | Time | Length | What happens |
|---|---|---|---|
| Open: tilted close-up, live typing | 0.0–1.7 | 1.7 s | Slow drift on a perspective-tilted UI strip while a command types |
| Morph | 1.7–2.3 | 0.6 s | The strip collapses into a grey slab, and the slab becomes the product surface |
| Build | 2.3–4.1 | 1.8 s | Camera dollies down the surface as its parts land |
| Carousel | 4.3–7.4 | 3.1 s | Same object, 5 looks, one about every 0.6 s |
| Flip | 7.4–8.1 | 0.7 s | The object turns 180° on Y to show an alternate rendering. A two-word toggle swaps brightness |
| Pull-back | 8.7–9.6 | 0.9 s | Camera rips back and the object joins a tilted floor of dozens of siblings. This is the biggest motion in the film |
| Stats | 9.7–11.6 | 1.9 s | Floor drifts while 4 numbers count up |
| Scatter, then implode | 11.6–12.4 | 0.8 s | Cards lift, tumble and converge on the centre |
| Logo, then lockup | 12.4–13.3 | 0.9 s | The mark resolves, then slides left as the wordmark arrives |
| Hold | 13.3–15.0 | 1.7 s | Complete stillness. The only static stretch in the film |

Rhythm: a slow open, a fast middle, then an absolute stop. Motion energy (mean frame
difference) peaks at the pull-back (110) and the scatter (75). It's under 10 everywhere else.

## 4. Transitions

1. **Object morph.** One element becomes the next one (strip → slab → page). This is the
   default, and there are no cuts.
2. **Card flip.** A 180° Y rotation with real perspective shows the "other side" of the same
   thing.
3. **Pull-back into a collection.** The hero card shrinks into its place in a grid of siblings.
4. **Implosion.** Many objects converge into one (cards → logo).
5. **In-place content swap.** In the carousel only the content changes. The frame, position
   and labels stay put.

## 5. Camera

- Constant perspective. Hero planes tilt about 8–14° on X and about -6° on Z in the open. The
  grid floor is rotated about 55° on X, so it reads as a table top.
- Continuous slow drift: about 2–4% scale or 20–40 px per second. The frame is only ever
  still in the final hold.
- A dolly down the product surface during the build.
- A whip pull-back of about 4× zoom-out in about 0.5 s.
- Depth of field is suggested only through the grid's falloff into darkness. There's no actual
  blur on the hero.

## 6. Texture and grain

- Grain is barely there: standard deviation about 0.9 levels in flat dark areas. You feel it
  rather than see it, and it stops the vignette from banding. Ours: seeded (mulberry32) luma
  noise, ±1.5 levels, a new seed per frame.
- Motion blur on fast moves (pull-back, scatter, rolling digits). Ours: the existing
  4-subframe blend.
- No film dust, no chromatic aberration, no scanlines.

## 7. How text enters and exits

- **Names roll vertically inside a mask.** The old word slides up and out while the new word
  rises from below, with a hint of motion blur. Never a fade. The eyebrow counter ticks
  (`04/09` → `05/09`) on the same beat, and the underline changes to the new item's color.
- **Numbers roll like an odometer.** Each digit column spins up to its value with vertical
  blur. The four stats start about 0.1 s apart, left to right. Labels sit still under them.
- **Data rows stagger in** top to bottom, about 60 ms apart, with a short rise.
- **Active vs inactive:** a two-option toggle never moves. The inactive word dims from white
  to `#5B5A5E`.
- **Exit = the next entrance.** Text leaves at the moment its replacement arrives, not before.
  Nothing lingers.
- The lockup: the mark arrives first, then slides left as the wordmark wipes in from behind
  it. The tagline rises in 0.15 s later, and the small URL/pill row comes last.

## 8. Not used (studio rules override the reference)

| Reference element | Why it's dropped |
|---|---|
| Corner labels (`01 — Install`, a URL top-right), corner crop marks, dashed guide lines | Banned: "corner labels and frame borders" |
| Each theme name in its own typeface | One display face, one UI face |
| Gradient fill on the tagline | No gradients on chrome or type |
| Rebuilding the logo out of pixels | We don't redraw the brand mark. The real ZexDraws logo is revealed, not rebuilt |

## 9. Motion presets (maps to `lib/motion.js`, to be written after sign-off)

| Preset | Feel | Used for |
|---|---|---|
| `snappy` | Stiff, about 1% overshoot | Toggles, odometer digits, leading edges of indicators, data rows |
| `default` | Medium, about 0.5% overshoot | Cards, the container, camera, carousel content |
| `heavy` | Slow, critically damped, 0% overshoot | Big type (names, numerals, wordmark), lockup |
| `playful` | Visible overshoot | Not used in this film (mascots only) |
