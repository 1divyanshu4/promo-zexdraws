# AuditSage launch film v2: follow one compressor (storyboard, for approval)

15 s, 16:9, 1920×1080, 60 fps, 128 BPM, 8 bars (32 beats, 0.469 s each).

**Idea:** follow one real-world thing through the whole product. Air compressor **AC-01** in
Compressor Room B goes from a nameplate on site to a paragraph in the ASHRAE report, joined by one
green line, and the film ends on what the whole audit found. Specific to energy audits; nothing a
generic SaaS film could say.

**Screens** are rebuilt in HTML to match the real AuditSage / GreenSage UI (layouts, type, colours
and components taken from the gs-doc screenshots), so every screen shows **one consistent audit**:

| Thing | Value used on every screen |
|---|---|
| Audit | Bengaluru Office Energy Audit · ASHRAE Level 2 |
| Equipment | AC-01 · Compressor Room B · Atlas Copco GA55 · 55 kW / 75 HP · 10 bar · 95.2% motor efficiency · no VFD |
| Observation | Runs loaded at part demand; discharge line insulation worn (GPS-stamped photo) |
| Recommendation | Fit a VFD to AC-01 and replace the discharge line insulation |
| ECM 3 | VFD retrofit, AC-01 · 41,600 kWh/yr · $4,820/yr · $8,600 · 1.8 yr payback |
| Audit total | 15 ECMs · 171,889 kWh · $28,363 a year · 112 t CO₂ |

**Look:** a light engineering board (`#E9EDE9` with a fine dot grid), product green `#047857` as the one
accent and the thread, Inter Bold / Inter Medium, white flat windows (title left, line controls right,
6 px corners, 16 px padding). One continuous camera travels along the line; nothing cuts.

| # | Beats | Time | On screen | Motion | Sound |
|---|---|---|---|---|---|
| 1 | 0–5 | 0.0–2.3 | **Nameplate, read by AI.** Close on AC-01's plate. Green dots land on asset tag, rated power, max pressure; lines pull out tags "AC-01 · Atlas Copco GA55", "55 kW · 75 HP", "10 bar · max pressure". | Already drifting on frame 0; one tag per beat (1, 2, 3). | Hit 0, tick per tag |
| 2 | 5–9 | 2.3–4.2 | **Captured once.** Camera pulls right along the line; the plate shrinks, the AuditSage phone arrives with those values in its Data tab. "On site · Compressor Room B". | Values fly from tags into fields on the 16th grid. | Whoosh 5, ticks |
| 3 | 9–13 | 4.2–6.1 | **Photo, note, recommendation.** Photos tab (GPS overlay on AC-01), then Notes (observation + recommendation). | Screens slide in step; line runs off right. Sync badge clears on 12.5. | Ticks, click 12.5 |
| 4 | 13–19 | 6.1–8.9 | **AC-01 → ECM 3.** The line enters the ASHRAE Analysis window; the ECM 3 row highlights, its bar rises in the chart; "$4,820 a year · 1.8 yr payback". Cursor clicks Approve Analysis on 18. | Boom 13 as the window lands; row highlight on 14; bar on 15. | Boom 13, click 18 |
| 5 | 19–24 | 8.9–11.3 | **Written into the report.** Report editor, 4.1 ECM Details, the AC-01 paragraph highlighted. Cursor clicks Generate Word on 22.5; "Word document downloaded". | Window morphs from analysis to editor; paragraph highlight sweeps. | Click 22.5 |
| 6 | 24–28 | 11.3–13.1 | **Pull back: $28,363 a year.** Everything shrinks onto one line (plate → phone → notes → analysis → report) and the audit total counts up above it. "Bengaluru Office · one audit · 15 ECMs". | Camera pull-back; number counts up on heavy. | Riser into 28 |
| 7 | 28–32 | 13.1–15.0 | **Lockup.** The line pulls into the GreenSage mark; **AuditSage**; "Site visit to final report."; pill "by GreenSage AI". Holds. | Mark opens, wordmark slides, tagline rolls. | Crash 28, fade |

## Open questions (default in brackets)
1. The numbers are a plausible demo audit, consistent across screens. Use real figures from a real
   audit instead? [demo numbers, consistent]
2. Tagline [Site visit to final report.]
3. Lockup [AuditSage, "by GreenSage AI"]
