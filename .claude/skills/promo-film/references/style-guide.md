# Style guide

The reference film's look, generalised. Values are for a 1920×1080 frame. Swap the brand
tokens (accent, faces, logo) for the product's; keep the structure.

## Palette

| Token | Value | Use |
|---|---|---|
| `--bg` | `#08070A` | Stage. Never pure black. |
| `--bg-mid` | `#18171A` | Centre of the radial light behind everything (62%×70% ellipse). |
| `--win` | `#1C1B1F` | Window bodies and title bars. |
| `--text` | `#FFFFFF` | Active text, values. |
| `--muted` | `#9F9EA1` | Eyebrows, labels, second line of a pair. |
| `--faint` | `#5B5A5E` | Separators, inactive. |
| `--hair` | `#2A292D` | 1 px rules, window outlines, inner borders. |
| `--accent` | brand colour | One accent only: the headline rule, the selection ring, the click highlight, the lockup accent. |

Light the stage, don't fade it: a radial light behind everything, a darker scrim or a brighter
spot as lighting changes. Seeded grain on top (8 pre-rendered 256 px tiles, value 0–6, screen
blend, tile picked by frame number).

## Type

One display face (the brand's expressive face; ours is a script) and one UI face (ours is
Inter 500/600/700). Hierarchy, top to bottom, used in every text block:

| Level | Spec | Example |
|---|---|---|
| Eyebrow | UI 500, 17 px, uppercase, 0.2 em tracking, muted; active part in white (`<b>`) | `LOOK  01/05`, `EVERY STROKE · SAVED` |
| Statement | Display, 100–112 px | *You just draw.*, *Neubrutalism* |
| Rule | 3 px, radius 2, accent (or the item's own colour), drawn left to right | under the statement |
| Supporting | UI 600, 38 px, -0.01 em; first line white, second muted | "No complicated setup." / "No camera pressure." |
| Tokens | UI 500, 21 px, muted label + white value | `skin  Neubrutalism`, `colour  #E83E77` |
| Heading (rare) | UI 600, 46 px, centred, second half muted | "Export once. Post anywhere." |
| Tagline | UI 600, 52 px, centred | "Every stroke, replayable." |
| Pill | UI 500, 15 px, uppercase, 0.12 em, muted, 34 px tall, dark fill + hair outline | `REPLAY BUILT IN` |

Supporting lines sit **below** the rule, not above the statement. Separators are `  ·  `
(non-breaking spaces around a middle dot).

## Layout

- **Balance the frame.** Text block and object form one group centred on the frame, with equal
  outer margins (~250 px in shot 2). Vertically centre both on 540.
- **Mirror on alternate shots.** Panel shots alternate sides (right, left, right) with the label
  opposite, so consecutive shots don't stack on one side.
- **Left block / object / right tokens** for showcase shots: label block at x≈92–98, the object
  slightly right of centre (centre x≈1000), small tokens at x≈1496.
- Masks, not fades, for text: every line enters by rolling up through a mask and leaves by
  lifting up through an outer mask.

## UI captures

- Show real panels near their native size (≤ 640×860 on screen), turned 14° toward centre, with
  a deep soft shadow (`0 50px 120px rgba(0,0,0,.7)`) and a 1 px hair outline. 12 px corners.
- Behind panel shots: the product's workspace, pre-blurred and darkened (blur 9 px at 1280 wide,
  brightness 0.55), slowly scaling. Never a CSS blur on a moving layer (cost and shimmer).
- The work surface (page/canvas) is cut out of the workspace capture and becomes the carried
  object, so it never appears twice.
- The click target gets an accent highlight: 16% fill on hover, +22% when pressed, 2 px inset
  ring, a press dip in scale.

## Windows

Every framed piece of product output is a window, not a card:

- Flat title bar 40 px, `--win`, a 1 px hair line at its bottom. Title left (UI 600 14 px muted,
  dim separators), minimise / maximise / close as 1.3 px line icons on the right.
- 6 px corners. 16 px padding of window colour around the content, which has its own hair outline.
- Shadow `0 34px 90px rgba(0,0,0,.65)` plus a 1 px hair outline.
- No traffic lights, no large radii, no glass.

## Phones

A phone mockup must read as real hardware: a camera cutout over the screen, a status bar
(time, signal, battery), side buttons on the frame, a lit bezel (shine on the hardware, never on
the screen), 30 px outer and 20 px screen corners. Frame it so the **top of the phone is in shot**
(the cutout is what sells it); cropping the bottom is fine. In 3D, the transform origin is 50% 30%,
so solve the pose's y for a visible top edge rather than eyeballing it.

## Formats (post templates)

- Each destination gets its real layout inside a window: Instagram post 4:5 (header, media,
  like/comment/share/save row, likes, caption, comments link), TikTok 9:16 (Following / For You,
  right icon column with counts, handle, caption, sound line, progress), YouTube 16:9 (player
  with red progress and controls, title, channel row with Subscribe, like pill, description box).
- **Never crop the product's output to fit.** Fit the whole video (contain) and fill the rest of
  the format with the output's own edge colour, top to bottom (sample the first and last rows).
  The frame looks extended to the format, which is exactly what a customisable export implies.
- Each template plays a different variant, so the destinations also show range.

## Lockup

**Every film designs its own lockup and its own logo animation.** Do not reuse a previous film's
layout or move. Derive both from the brand: the mark's shape, what the product does, and the
film's carrying object. Shared constraints: the mark appears from the point where the last shot
converged; name, tagline and at most one pill; the group is centred on its **measured** width;
it holds to the end, with a slow drift so the hold is not frozen.

Two we have built, as range, not templates:
- ZexDraws (a drawing app): a rounded logo tile opens as a growing circle, moves left, an accent
  slash grows, the wordmark slides out from behind a mask; tagline and pill below, centred.
- GreenSage AI (energy audits, leaf mark): the tiles collapse into a seed that opens as a white
  circle with one ripple ring while the leaf turns upright; the mark steps left and the wordmark
  rises letter by letter beside it; tagline and pill left-aligned under the wordmark. No slash.
  (The user rejected the slash for this brand: "no need to add the /, try a different layout".)

Logo files often carry their own background (GreenSage's leaf sits on a white rounded square):
match the container colour to it, or the square shows.
