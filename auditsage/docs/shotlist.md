# AuditSage launch film (storyboard, for approval)

Redesign of the 63 s LinkedIn walkthrough as a 15 s film: 16:9, 1920×1080, 60 fps, 128 BPM,
8 bars (32 beats, 0.469 s each). All UI comes from the current product screenshots in the
`gs-doc` manual (`docs/media/...`), cropped and composited, never redrawn. Logo from the web frontend.

**Selling point:** site visit to finished ASHRAE report, with AI doing the reading and the analysis.
**Look:** light, from the product itself: stage `#F4F6F3` (the app background), ink `#0F1A14`, one
accent `#047857` (the app's button green). Inter Bold for statements, Inter Medium for UI text.
White flat windows (title left, line controls right, 6 px corners, 16 px padding).
**Carried object:** the phone becomes the platform window, which carries every web shot and
finally folds into the logo.

| # | Beats | Time | On screen | Motion | Sound |
|---|---|---|---|---|---|
| 1 | 0–6 | 0.0–2.8 | **On site.** The AuditSage phone, tilted, beside "AuditSage · On site" → **Capture it once.** → rule → "Equipment data, GPS-stamped photos, notes. Works offline." | Phone already rising on frame 0. Its screen steps Data → Photos (location overlay on) → Notes on beats 1.5 / 3 / 4.5, with the tab list on the right lighting up in step. | Hit on 0, tick per screen |
| 2 | 6–9 | 2.8–4.2 | **Sync.** The phone shows the dashboard ("05 needs sync") and hands over: it shrinks into the corner of a platform window that opens behind it. "Sync · Platform" → **No re-typing.** | Phone scales down and docks into the window (one object handing over); window chrome grows. | Whoosh on 6, click on 8 |
| 3 | 9–14 | 4.2–6.6 | **AI reads the bills.** The window shows a utility bill PDF and its extracted fields. "02 · Utility bills" → statement → "Every field extracted, reviewed in one table." | Field rows reveal top to bottom on the 16th grid; the bill preview drifts. | Ticks on the rows, riser into 14 |
| 4 | 14–21.5 | 6.6–10.1 | **AI finds the savings.** The ASHRAE Analysis review: KPI cards, priority tiers, ECM Opportunity chart. "03 · ASHRAE analysis" → **AI finds the savings.** → "$28,363 a year / 171,889 kWh saved / ECMs ranked by payback" (numbers from the screen). | Boom on 14. KPI cards wipe in left to right, chart bars reveal upward (masks over the real capture). Copy numbers count up. Cursor clicks **Approve Analysis** on 21. | Boom 14, ticks, click 21 |
| 5 | 21.5–27 | 10.1–12.7 | **Report, drafted.** The report editor (navigator, Executive Summary). "04 · Report" → **Report, drafted.** → "Edit any section. Export to Word." | Window morphs from the analysis to the editor; cursor clicks **Generate Word** on 24.5 and the product's own "Word document downloaded" toast drops in. | Click 24.5, swish |
| 6 | 27–32 | 12.7–15.0 | **Lockup.** GreenSage mark, accent slash, **AuditSage**; tagline "Site visit to final report."; pill "by GreenSage AI". | Window folds to the centre, the mark opens from that point, wordmark slides out, tagline and pill roll up. Holds to the end. | Crash 27, music fades |

## What changed from the original (and why)
- 63 s → 15 s. Five modules become four beats of one story; the 7 s problem intro is cut (the
  hook is the product, moving, on frame 0).
- One object carries the film instead of the same left-number/right-screenshot slide five times.
- Long paragraphs → one statement and one short supporting line per shot, readable on a phone.
- 1252×640 → 1920×1080 from full-resolution screenshots; audio mastered to -14 LUFS (was -28.7).

## Open questions (default in brackets)
1. Selling point and tagline: [Site visit to final report.]
2. Name in the lockup: [AuditSage, with "by GreenSage AI"] or GreenSage AI as the lead brand?
3. Light look from the product UI [yes] or a dark stage like our reference film?
4. Extra 1:1 / 4:5 cut for the feed? [16:9 only for now]
