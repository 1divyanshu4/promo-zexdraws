# Reference film: ZexDraws studio launch

ZexDraws is a drawing app whose difference is that **every stroke is recorded and can be replayed
and exported as a styled timelapse** (frame skins, colours, lengths). 15 s, 1920×1080, 60 fps,
128 BPM, 8 bars. Source: the promo-zexdraws repo (`film.html`, `film.js`, `docs/shotlist.md`,
storyboard in `docs/storyboard/`). Use it as a worked example of the approach, not as a template.

## Shots

| # | Beats | What | Carried object |
|---|---|---|---|
| 1a–1c | 0–4.5 | Three real panels (Brushes, Colours, Layers), one per 1.5 beats, alternating sides, each with eyebrow "0N/03 Studio" → script name → detail line. Handovers overlap. | — |
| 1d | 4.5–6 | The last panel folds into its toolbar button as the real studio comes up, upright and turned, then flattens to full frame. Blank white page. | the page (in the studio) |
| 2 | 6–12 | The page lifts into a window (title bar grows, padding grows) and plays the drawing footage. Left: "Every stroke · saved" → *You just draw.* → accent rule → "No complicated setup." / "No camera pressure." Studio blurred and dimmed behind. | the window |
| 3 | 12–14 | The window docks back into the page as the camera zooms to the toolbar; the cursor clicks Replay (accent highlight, press dip). Drums drop on 13. | the page |
| 4 | 14–21.5 | Boom. The page lifts off, the studio falls away, the page becomes the replay preview cycling five skins every 1.5 beats. HUD: Look 0N/05 → skin name (rolls only when it changes) → coloured rule; dots with a stretching selection ring; tokens on the right. | the preview |
| 5 | 21.5–23 | HUD lifts out as the preview rises; the real "Export video" button pops in below; the cursor clicks it. | the preview |
| 6 | 23–27 | The preview becomes the TikTok window (9:16); Instagram (4:5) slides in left, YouTube (16:9) right. Each plays a different skin, whole and padded, never cropped. Counts tick up; players progress. Heading "Export once. Post anywhere." | the TikTok window |
| 7 | 27–32 | Anticipation, then everything folds to the centre; the logo opens from that point, moves left; slash, wordmark, tagline, "Replay built in" pill. Crash on 27; holds to the end; music fades. | the logo's seed |

## How the user steered it (and the rule each note became)

| Their note | What we changed | Rule |
|---|---|---|
| "We are not selling this as a drawing app; replay and customised export are the point." | Restructured around Replay → skins → Export → destinations. | Find the real selling point first. |
| "Don't redraw the UI." | Every UI element is a capture from a Linux build. | Real UI only. |
| "First two shots look unprofessional; no need for the infinite card shot." | Dropped the typing intro and the endless floor of cards. | Every shot must earn its time. |
| "Exploded panels meant the layer/brush/colour panels." Then: "too much, divide it into short shots." | Re-captured those panels; three 0.7 s panel shots instead of one busy exploded view. | One idea per shot; split busy shots. |
| "Make it more vertical." | The studio stands near-upright, turned ~20°, instead of lying flat. | Prefer upright, readable angles over steep isometric. |
| "Looks very basic; give it frame design and hierarchy like the skin showcase." | Eyebrow → display statement → rule → supporting lines. | One hierarchy for every text block. |
| "Record adds pressure." | Removed REC, recorder, recorded. | No pressure words. |
| "Lines should be below the rule." "Remove the badge and the stats." | Supporting lines under the rule; no chip, no stats column. | No decoration without meaning. |
| "Balance the frame; add a window around the drawing." "Not a Mac window, less rounded." "A little padding so we see it as a window." | Centred group, equal margins; flat window chrome, 6 px corners, 16 px padding. | Window spec in the style guide. |
| "Look at each platform's actual post template and make a window out of it." "Expand, don't crop the video." | Real Instagram/TikTok/YouTube layouts in windows; contain + edge-colour padding. | Formats spec in the style guide. |
| "Transitions feel stiff, not flowing into each other." | Slower beat-tuned presets; overlapping handovers; exits lead; cursor settles before clicks. | Motion rules: flow. |

## Numbers worth reusing

- Panel shots 1.5 beats each; showcase variants 7.5 beats ÷ count; hero copy lines on beats
  6.5 / 8 / 9.5; clicks on 13 and 22.5; lockup on 27–28.
- Window for portrait footage: inner ≤ 700×758, centre (1368, 540). Showcase preview ≤ 902×638,
  centre (1000, 540). TikTok window 432×783 at (654, 188).
- Camera: studio reveal from s 0.6 / rotY -24° / rotX 8° → flat s 1.0 by beat 5; zoom to the click
  target at s 1.9 placing it at screen (1356, 288); pull back to s 0.62 as the studio falls away.
