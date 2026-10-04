# GreenSage AI launch film v4 (storyboard, for approval)

22.5 s, 16:9, 1920×1080, 60 fps, 128 BPM, 12 bars (48 beats, 0.469 s each).
Board: `docs/storyboard/board-v4.png` (source `docs/storyboard/v4.html?f=0..7`; screens in `ui.html`).

**Names.** GreenSage AI is the company. **AuditSage** is the mobile app for data collection on site; the
**GreenSage platform** (web) is where the audit is managed. Window titles read "GreenSage · …".

**Tone.** Technical and concise. The film walks the workflow in six numbered steps. Each step has a
two-line statement and one line saying what the product does mechanically (schema-driven
sheets, offline-first sync, GPS overlay, AI extraction, ASHRAE Level 2, formula trail,
confidence scores, .docx). It names steps and mechanisms, not results.

**Structure.** A workflow rail runs along the top through every step. The current step is lit and its bar fills while the
step plays; finished steps stay lit. Each step has two **sub-scenes** (◆ / ◆◆), each about 1.5 s.
The copy stays put and the screen changes, with a small caption naming what the sub-scene shows.

**Look.** As v3: forest stage `#0D2A20`, mint accent `#4ADE9A`, Inter. The product UI keeps its own colours.
Formulas use the platform's monospace. Mockups have tight corners and shine on the hardware only.

**Sample dataset.** This is the one dataset everywhere; numbers never drift between screens:
- Sample Office · Energy Audit; air compressor AC-01, Compressor Room B.
- Atlas Copco GA55, 55 kW / 75 HP, 10 bar (145 psi), 2024, serial AC-2024-0117.
- ECM 3, VFD on AC-01:
  - Baseline: 55 × 0.78 × 6,000 = 257,400 kWh/yr.
  - Savings: × 0.16 = 41,184 kWh/yr.
  - At $0.117/kWh: $4,819/yr.
  - Investment $8,600, payback 1.8 yrs.

| # | Beats | Time | Statement / line | Sub-scenes (◆ ◆◆) | Motion and sound |
|---|---|---|---|---|---|
| 0 | 0–4 | 0.0–1.9 | **Streamline your audit workflow.** Six step cards: Data collection · Evidence collection · Utility uploads · Combined analysis · ECM generation · Report generation. | (a) Cards snap in one per 16th, connectors draw. | Hit 0, ticks. The cards fly up and shrink into the top rail as step 01 opens. |
| 1 | 4–10.5 | 1.9–4.9 | **01 Structured field data.** "Schema-driven equipment sheets in the AuditSage app. Offline-first, synced to the platform." | ◆ Equipment sheet: fields type in, Save. ◆◆ Sync: Pending 4 → 0, outbox rows tick to ✓ SYNCED. | Phone glides in with a bezel glint; the screen swaps under the glass. Ticks per field, click on Sync now. |
| 2 | 10.5–17 | 4.9–8.0 | **02 Evidence, geotagged.** "Photos linked to each entry. AI reads nameplates straight into the sheet." | ◆ Camera: shutter on the beat, flash, GPS overlay, session strip counts 1 → 2. ◆◆ Nameplate review: a scan line runs down the plate; extracted values fill (10 BAR → 145 psi); Apply changes. | Shutter clicks; phone hands off to the window (pan). |
| 3 | 17–23.5 | 8.0–11.0 | **03 Bills in, data out.** "Electricity, gas and water PDFs, field-extracted by AI. Coverage gaps flagged." | ◆ File table: statuses step Queued → Processing → ✓ Extracted. ◆◆ Extracted fields fill row by row; the coverage gap card lights. | Rows on 16ths; riser into 24. |
| 4 | 23.5–30 | 11.0–14.1 | **04 One model of the site.** "Field data, evidence, bills and assumptions, analysed together to ASHRAE Level 2." | ◆ Four input cards; dashed links draw and pulse into AI Analysis & Strategy; Run AI Analysis clicks. ◆◆ Workflow stage 2: status rail steps Queued → Generating observations → Generating ECMs. | Boom on 24. Click 26. |
| 5 | 30–36.5 | 14.1–17.1 | **05 ECMs, with the math.** "Savings, investment and payback per measure. Every formula traceable and editable." | ◆ ECM cards land, tiered; ECM 3 lights. ◆◆ Calculation trail: camera pushes in on formula 1, Load factor field focuses, values tick; Approve Analysis click. | Push-in; click 36. |
| 6 | 36.5–43 | 17.1–20.2 | **06 Report, drafted.** "Confidence-scored AI sections, reviewed in the editor, exported to .docx." | ◆ The ECM 3 paragraph drafts in word by word; Confidence 92% badge and reasoning tooltip. ◆◆ Generate Word → Generating… → ".docx downloaded". | Click 41. |
| 7 | 43–48 | 20.2–22.5 | **Lockup.** GreenSage AI · "Streamline your audit workflow." · AuditSage app · GreenSage platform. | The full rail collapses into the mark. | Crash 43, fade. |

## Build

`node render.mjs --contact --out greensage-launch` (contact sheet), `node tools/strip.mjs A B 8`
(transition strips), `node render.mjs --out greensage-launch` (film, `out/greensage-launch.mp4`).
Score: `python3 audio/score.py` (arrangement and UI sounds in `timeline.json`).
