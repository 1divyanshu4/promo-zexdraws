# GreenSage AI launch film (built: `film.html` + `film.js`)

20.6 s, 16:9, 1920×1080, 60 fps, 128 BPM, 11 bars (44 beats, 0.469 s each). The v3 film
(`docs/storyboard/v3.html`) plus two added scenes: evidence collection and combined analysis.
(`docs/storyboard/v4.html` was a more detailed alternative; the user asked for less detail.)

**Names.** GreenSage AI is the company. **AuditSage** is the mobile app for data collection on site; the
**GreenSage platform** (web) is where the audit is managed. Window titles read "GreenSage · …".

**Copy.** "Streamline your audit workflow." The six steps are named plainly: the statement is the step
name, and one short line says how it works. No results quoted; the screens carry sample data only.

| # | Beats | Statement | Line | Screen and motion | Sound |
|---|---|---|---|---|---|
| 0 | 0–4.25 | Streamline your audit workflow. | (bento tile) | Bento tiles land on the beat; camera dives into the phone. | Hit, ticks |
| 1 | 4.25–9.75 | 01 Data collection. | Equipment data, logged on site, offline. | AuditSage sheet: fields type in, Save, sync badge. | Whoosh, ticks, click |
| 2 | 9.75–14.5 | 02 Evidence collection. | Geotagged photos, linked to each entry. | Phone turns; the camera wipes up over the sheet; two shutter shots with flash; session strip fills. | Swish, two clicks |
| 3 | 14.5–18.75 | 03 Utility uploads. | Bill PDFs, read field by field by AI. | Bills window pans in; values extract row by row; last bill ticks ✓. | Whoosh, ticks |
| 4 | 18.75–24.75 | 04 Combined analysis. | Field data, evidence and bills, together. | Four input cards land and link into "AI Analysis & Strategy"; pulses run the links; Run AI Analysis → Generating ECMs…. | Ticks, click, riser |
| 5 | 24.75–32.25 | 05 ECM generation. | Measures ranked by cost and payback. | Analysis rises on the boom (26); rows land, bars rise, ECM 3 lights; camera lifts; Approve click (32). | Boom 26, click 32 |
| 6 | 32.25–36.5 | 06 Report generation. | ASHRAE Level 2, exported to Word. | Report drafts in; Generate Word click (35); toast. | Click 35 |
| 7 | 36.5–40 | (bento) Streamline your audit workflow. | Data · Evidence · Bills · Analysis · ECMs · Report | Pull back to the bento; six chips light in order; tiles collapse into the centre. | Ticks, riser |
| 8 | 40–44 | Lockup: GreenSage AI | Streamline your audit workflow. · AuditSage app · GreenSage platform | Mark lands, wordmark slides, tagline rolls. | Crash 40, fade |

## Build

`node render.mjs --contact --out greensage-launch` (contact sheet), `node tools/strip.mjs A B 8`
(transition strips), `node render.mjs --out greensage-launch` (film, `out/greensage-launch.mp4`).
Score: `python3 audio/score.py` (arrangement and UI sounds in `timeline.json`).
