# Shot list: 15 s, 16:9 launch film, in the reference's style

> **Product check, please confirm.** The brief names **MagicPath (magicpath.ai)** but also says
> to use the **ZexDraws** screenshots and logo. Showing ZexDraws UI and its logo under
> MagicPath's name would misrepresent both, so this list is written for **ZexDraws**: every
> asset we have is ZexDraws. If you meant a MagicPath film, I'd need MagicPath's own UI and
> logo, and none of the ZexDraws material below would be used.

**Format:** 1920×1080, 60 fps, 15.0 s. Score synthesized at 128 BPM (one beat = 0.469 s,
32 beats = 8 bars). Cuts: none. One continuous camera, as in the reference.

**Look:** near-black vignette (`#18171A` → `#08070A`), barely-there seeded grain, Southern Beach
for names and wordmark, wide-tracked Inter for labels, one accent `#8B5CF6`. Full rules are in
`docs/style_guide.md`.

**Assets (all real):** ZexDraws UI captured from the Linux build (`ui/`), plus the New Canvas
dialog captured in the same session. The replay exports are Pink, Yellow, Orange, Manga and
Fantasy. Then the canvas painting clip and `assets/logo-mark.png`. No UI is redrawn.

**Real numbers used on screen** (from the ZexDraws source):
- 5 frame skins: Neutral, Neubrutalism, Fantasy, Manga, Sketchbook (`replay_skins.dart`)
- 6 colour presets: the Frame colour dialog swatches
- 5 playback speeds: 0.5x, 1.0x, 2.0x, 4.0x, 30s (`replay_screen.dart`)
- 2 export lengths: Full and Short (`TimelapseLength`)

---

| # | Beats | Time | Reference grammar | ZexDraws shot | Text in / out | Motion preset | Sound |
|---|---|---|---|---|---|---|---|
| 1 | 1–4 | 0.00–1.88 | Tilted close-up, live typing | Real **New Canvas** dialog, tilted about 12° X and -6° Z, very close on the Width/Height fields. The digits **1600 × 1200** appear one at a time from the real capture (masked left to right, about 70 ms per digit), with its real caret. Camera drifts right and in about 3%. | Only the captured UI's own text | camera `default`; caret `snappy` | soft key ticks per digit; pad swells in |
| 2 | 5 | 1.88–2.34 | Morph: strip → slab → surface | The dialog collapses into a grey `#262626` slab. The slab un-tilts and stretches to portrait, then turns into the white canvas. | n/a | container `default` | low whoosh on beat 5 |
| 3 | 6–9 | 2.34–4.22 | Build: dolly down the surface | The canvas fills with your **canvas painting clip** inside the real studio canvas frame. The camera dollies down the illustration, top to bottom, about 25% of its height. | n/a | camera `default` | brush swishes on beats 6 and 8 |
| 4 | 10–16 | 4.22–7.50 | Carousel: same object, 5 looks | The canvas becomes the **replay card**, about 1100 px wide and tilted 6°, playing the replay continuously. One timeline, five looks, one per 1.5 beats: **Pink → Yellow → Orange → Manga → Fantasy**. Left: eyebrow `FRAME 01/05`, the look's name in Southern Beach, and an underline that takes that frame's colour, plus a dot row with an accent ring on the active dot. Right: eyebrow `COLOUR` and a token row showing the real hex (`#E83E77`, `#F0D442`, `#E2572C`); Manga/Fantasy show the skin name. | Names roll up inside a mask. The counter ticks. Token rows stagger in at 60 ms | names `heavy`; underline width `indicator()` (leading edge `snappy`, trailing `default`); card `default` | a click on every look change |
| 5 | 17–18 | 7.50–8.44 | Flip: the other side of the same thing | Toggle above the card: **Canvas · Replay**. The card turns 180° on Y. The front is the still finished drawing; the back is the replay **with the hand overlay** drawing it. The inactive word dims to `#5B5A5E`. | The toggle words never move, only their brightness | flip `default`; dim `snappy` | whoosh at mid-flip |
| 6 | 19–21 | 8.44–9.84 | Whip pull-back into a collection | The camera pulls back about 4× in about 0.5 s. The card lands in a **floor of about 60 real replay frames** (all five looks, different moments), tilted 55° on X and fading into the dark. | n/a | camera `default` with 4-subframe motion blur | big downbeat hit on beat 19 |
| 7 | 22–26 | 9.84–12.19 | Stats over the drifting floor | Four numbers count up like an odometer, starting 0.1 s apart: **5** FRAME SKINS · **6** COLOURS · **5** SPEEDS · **2** LENGTHS. Under them: `Neutral · Neubrutalism · Fantasy · Manga · Sketchbook`. The floor keeps drifting. | Digits roll; labels are already placed; the caption row staggers in | digits `snappy`; numerals `heavy` | an odometer tick per digit settle, on beats 22–25 |
| 8 | 27–28 | 12.19–13.13 | Scatter → implode | Floor cards lift, tumble and converge on the centre. Where they meet, the **real ZexDraws logo** is revealed (masked open, not rebuilt). | Stats roll up and out as the cards lift | cards `default`; logo `heavy` | riser into a hit on beat 28 |
| 9 | 29–31 | 13.13–14.53 | Lockup, then stillness | The logo slides left; **ZexDraws** (Southern Beach, about 150 px) wipes in from behind it with an accent `/` between. Tagline below: **"Every stroke, replayable."** (Inter SemiBold 52 px). Then a small pill: `Recorder built in`. Vignette brightens behind the lockup. **Hold still.** | Wordmark wipes in; tagline rises 0.15 s later; pill last | `heavy`, 0% overshoot | crash on beat 29, then the tail rings out |
| 10 | 32 | 14.53–15.00 | (loop) | The lockup collapses into the grey slab, which tilts back into the New Canvas dialog of frame 0. `loopT()` pins the last frame to the first. | Lockup text leaves before the collapse starts (`swapAlpha`) | `default` | reverse whoosh into the loop |

**Something new every 2–4 s?** Yes. The longest stretch without a new element is the final
hold (beats 29–31, 1.4 s), which the reference also uses on purpose.

**Hook in the first 2 s:** a tilted, close, drifting UI shot with live typing, plus the morph on
beat 5, as in the reference.

**What the reference contributes:** pacing, the morph/flip/pull-back/implode transitions, the
rolling name and odometer text grammar, the tilted camera, the dark vignette and grain.
**What it doesn't:** its product, documents, theme names, tokens, logo, copy and corner chrome.

---

## Open questions for you

1. **MagicPath or ZexDraws?** See the note at the top.
2. **Tagline.** "Every stroke, replayable." is a placeholder. Or use your line: "A replayable
   drawing app for artists."
3. **Lockup pill.** Do you have a URL or store link to show (the reference shows its domain)?
   If not, it stays `Recorder built in`.
4. **The loop.** The reference ends on a still hold. `loopT` and the loop rule mean the last
   0.47 s morphs back to the opening frame. Do you want that, or a plain hold to the end?
