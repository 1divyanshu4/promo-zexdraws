// ZexDraws launch film. One canvas, one container, every frame a pure function of time:
//   window.seek(t)   paints frame t (seconds, wraps at the loop length)
//   window.prepare(ts) loads every image the times in `ts` need (call before seek in render mode)
// No timers, no CSS transitions, no state carried between frames. All motion comes from the
// closed-form springs in lib/motion.js; looping tracks flow from the last frame into the first
// with matching position and velocity.
(async () => {
  'use strict';
  const W = 1920, H = 1080;
  const PAPER = '#F2EEE8', INK = '#1C1A17', MUTED = '#6F675E', ACCENT = '#8B5CF6';
  const RENDER = new URLSearchParams(location.search).has('render');

  const load = (u) => fetch(u).then((r) => r.json());
  const [BEATS, MAN, UI] = await Promise.all([load('beats.json'), load('build/manifest.json'), load('ui/ui.json')]);
  const LOOP = BEATS.duration;
  const NB = BEATS.beats.length;
  const B = (i) => BEATS.beats[((i % NB) + NB) % NB] + LOOP * Math.floor(i / NB);
  const { spring, settle, track, indicator, swapAlpha, loopT, clock } = Motion;
  const mod = (t) => loopT(t, LOOP);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  // Looping tracks, compiled once: a function of t.
  const loopTrack = (keys, preset) => (t) => track(t, keys, { loop: LOOP, preset });

  // ------------------------------------------------------------------ assets
  const fonts = [
    new FontFace('Southern Beach', 'url(assets/fonts/SouthernBeach.otf)'),
    new FontFace('Inter', 'url(assets/fonts/Inter-SemiBold.ttf)', { weight: '600' }),
    new FontFace('Inter', 'url(assets/fonts/Inter-Medium.ttf)', { weight: '500' }),
  ];
  await Promise.all(fonts.map((f) => f.load().then((ff) => document.fonts.add(ff))));
  const DISPLAY = 'Southern Beach', UIF = 'Inter';

  const imgCache = new Map();
  function image(src) {
    let e = imgCache.get(src);
    if (!e) {
      const img = new Image();
      img.src = src;
      e = { img, ready: img.decode().then(() => (e.ok = true)).catch(() => (e.ok = false)), ok: false };
      imgCache.set(src, e);
    }
    return e;
  }
  const uiImg = (key) => image(UI.images[key]);
  const LOGO = image('assets/logo-mark.png');
  await Promise.all([LOGO.ready, ...Object.keys(UI.images).map((k) => uiImg(k).ready)]);

  // ------------------------------------------------------------------ footage
  const RP = MAN.replay;
  const skip = RP.skip || [Infinity, Infinity];
  const skipLen = Number.isFinite(skip[0]) ? skip[1] - skip[0] : 0;
  // u in 0..1 over the usable replay range -> source seconds, jumping the skipped stretch.
  function replaySeconds(u) {
    let s = RP.useFrom + u * (RP.useTo - RP.useFrom - skipLen);
    if (s > skip[0]) s += skipLen;
    return s;
  }
  function clipFrame(key, seconds) {
    const c = MAN.clips[key];
    const n = clamp(Math.round(seconds * c.fps), 0, c.frames - 1);
    return `${c.dir}/${n}.jpg`;
  }

  // ------------------------------------------------------------------ layout
  const R = UI.rects, P = UI.points;
  const rw = (r) => r[2] - r[0], rh = (r) => r[3] - r[1];
  const rc = (r) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
  // A view shows capture-space rect `crop` in film-space box (cx, cy, w, h). Uniform scale.
  function fit(crop, cx, cy, maxW, maxH, radiusCap = 12 * UI.scale) {
    const s = Math.min(maxW / rw(crop), maxH / rh(crop));
    const [ccx, ccy] = rc(crop);
    return { cx, cy, w: rw(crop) * s, h: rh(crop) * s, s, ccx, ccy, r: radiusCap * s };
  }
  const ZONE = { cx: 1262, cy: 540, w: 1150, h: 860 };
  const grow = (r, m) => [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
  const V = {
    foot: fit(R.preview, ZONE.cx, ZONE.cy, ZONE.w, ZONE.h, 0),
    // Canvas plus the top-right toolbar (the Replay button lives there).
    studio: fit([700, 0, 2560, 1360], ZONE.cx, ZONE.cy, ZONE.w, ZONE.h, 0),
    studioTight: fit(grow(R.studioCanvas, 64), ZONE.cx, ZONE.cy, ZONE.w, ZONE.h, 0),
    panel: fit(R.panel, ZONE.cx, ZONE.cy, ZONE.w, ZONE.h),
    panelZoom: fit(grow(R.preview, 24), ZONE.cx, ZONE.cy, ZONE.w, ZONE.h, 0),
    // Preview + colour dialog: drop the panel's left gutter so the swatches read larger.
    panelDlg: fit([R.preview[0] - 40, R.panel[1], R.colourDialog[2] + 8, R.panel[3]], 960, 606, 1780, 830),
    exportDlg: fit(R.exportDialog, ZONE.cx, ZONE.cy, ZONE.w, 820),
    progress: fit(R.progressDialog, ZONE.cx, ZONE.cy, ZONE.w, 820),
    ready: fit(R.readyDialog, ZONE.cx, ZONE.cy, ZONE.w, ZONE.h),
  };
  V.foot.r = 26;
  V.panelZoom.r = 26;
  V.studio.r = 22;
  V.studioTight.r = 22;

  // Logo lockup: tile + wordmark, centred as a pair.
  const ctx = document.getElementById('film').getContext('2d');
  const WM_SIZE = 176;
  ctx.font = `${WM_SIZE}px "${DISPLAY}"`;
  const WM_W = ctx.measureText('ZexDraws').width;
  const TILE = 270, GAP = 54;
  const lockX = (W - (TILE + GAP + WM_W)) / 2;
  V.logo = { cx: lockX + TILE / 2, cy: H / 2, w: TILE, h: TILE, r: 66 };
  V.toast = { cx: ZONE.cx, cy: H / 2, w: 560, h: 116, r: 58 };

  // ------------------------------------------------------------------ the beat sheet
  // shot: from beat b, the container takes view `v` and shows content `c`.
  const SHOTS = [
    { b: 0, v: 'logo', c: { kind: 'logo' } },
    { b: 1, v: 'foot', c: { kind: 'ui', img: 'panel_pink', footage: true } },
    { b: 4, v: 'studioTight', c: { kind: 'studio' } },
    { b: 6, v: 'studio', same: true },
    { b: 8, v: 'panel', c: { kind: 'ui', img: 'panel_pink', footage: true, scrub: true } },
    { b: 10, v: 'panelZoom', same: true },
    { b: 11, v: 'panelDlg', c: { kind: 'ui', img: 'dlg_pink', footage: true, scrub: true, dim: true } },
    { b: 12, v: 'panelDlg', c: { kind: 'ui', img: 'dlg_yellow', footage: true, scrub: true, dim: true } },
    { b: 13, v: 'panelDlg', c: { kind: 'ui', img: 'dlg_orange', footage: true, scrub: true, dim: true } },
    { b: 14, v: 'panelDlg', c: { kind: 'ui', img: 'dlg_pink', footage: true, scrub: true, dim: true } },
    { b: 15, v: 'panel', c: { kind: 'ui', img: 'panel_pink', footage: true, scrub: true } },
    { b: 16, v: 'panel', c: { kind: 'ui', img: 'menu_neub_pink', footage: true, scrub: true, over: 'frameMenu' } },
    { b: 17, v: 'panel', c: { kind: 'ui', img: 'panel_manga', footage: true, scrub: true } },
    { b: 18, v: 'panelZoom', same: true },
    { b: 19, v: 'panel', c: { kind: 'ui', img: 'menu_manga', footage: true, scrub: true, over: 'frameMenu' } },
    { b: 20, v: 'panel', c: { kind: 'ui', img: 'panel_fantasy', footage: true, scrub: true } },
    { b: 21, v: 'panelZoom', same: true },
    { b: 22, v: 'panel', same: true },
    { b: 24, v: 'exportDlg', c: { kind: 'export' } },
    { b: 26, v: 'progress', c: { kind: 'progress' } },
    { b: 28, v: 'ready', c: { kind: 'ready' } },
    { b: 29, v: 'toast', c: { kind: 'toast' } },
    { b: 30, v: 'foot', c: { kind: 'ui', img: 'panel_fantasy', footage: true } },
    { b: 31, v: 'logo', c: { kind: 'logo' } },
  ];
  // Fill content forward through "same" shots.
  SHOTS.forEach((s, i) => { if (s.same) s.c = SHOTS[i - 1].c; s.t = B(s.b); s.view = V[s.v]; });
  SHOTS[0].c = SHOTS[SHOTS.length - 1].c; // the loop closes on the very state it opened with

  // Skin shown in the preview, by time.
  const SKIN = [[0, 'pink'], [B(12), 'yellow'], [B(13), 'orange'], [B(14), 'pink'], [B(17), 'manga'], [B(20), 'fantasy']];
  const skinAt = (t) => SKIN.filter((k) => k[0] <= t).pop()[1];
  // Replay clock, u in 0..1 of the usable range.
  const replayU = (t) => clock(t, [[B(1), 0], [B(4), 0.3], [B(8), 0.3], [B(11), 0.46], [B(16), 0.6], [B(24), 0.86], [B(28), 0.975], [B(31), 1]]);

  // Container geometry tracks.
  const geo = {};
  for (const k of ['cx', 'cy', 'w', 'h', 'r', 's', 'ccx', 'ccy']) {
    const keys = [];
    for (const s of SHOTS) if (s.view[k] !== undefined && !(keys.length && keys[keys.length - 1][1] === s.view[k])) keys.push([s.t, s.view[k]]);
    // Logo / toast have no capture transform: hold the previous one (dedupe above keeps it flat).
    geo[k] = loopTrack(keys, 'default');
  }
  const containerAt = (t) => Object.fromEntries(Object.entries(geo).map(([k, f]) => [k, f(t)]));

  // Content changes: index of the shot whose content shows, and swap timing.
  const CHANGES = SHOTS.filter((s, i) => s.c !== SHOTS[(i - 1 + SHOTS.length) % SHOTS.length].c);
  function contentAt(t) {
    let i = CHANGES.length - 1;
    while (i > 0 && CHANGES[i].t > t) i--;
    if (t < CHANGES[0].t) i = CHANGES.length - 1; // before the first change: the wrap's last state
    return i;
  }

  // ------------------------------------------------------------------ headlines
  const HEADS = [
    { b: 2, lines: ['Every stroke,'] },
    { b: 3, lines: ['Every stroke,', 'recorded.'], keep: 1 },
    { b: 4, lines: ['You just', 'draw.'] },
    { b: 8, lines: ['Then hit'] },
    { b: 9, lines: ['Then hit', 'replay.'], keep: 1 },
    { b: 11, lines: ['Pick a colour.'], top: true },
    { b: 15, lines: ['Pick a', 'colour.'] },
    { b: 16, lines: ['Pick a', 'skin.'], keep: 1 },
    { b: 24, lines: ['Export it', 'your way.'] },
    { b: 28, lines: ['Built in.', 'No setup.'] },
    { b: 31, lines: [] },
  ];
  HEADS.forEach((h, i) => { h.t = B(h.b); h.end = i + 1 < HEADS.length ? B(HEADS[i + 1].b) : LOOP; });
  const HEAD_SIZE = 138, HEAD_X = 96, HEAD_Y = 470, HEAD_LH = 146;

  // ------------------------------------------------------------------ cursor
  const pt = (view, p) => [view.cx + (p[0] - view.ccx) * view.s, view.cy + (p[1] - view.ccy) * view.s];
  const REST = [1540, 900];
  const studio = V.studio;
  const canvasMid = pt(studio, rc(R.studioCanvas));
  // [beat, x, y, click?]; the cursor is sent `lead` seconds before the beat so it lands on it.
  const MOVES = [
    [0, ...REST],
    [1.4, 1640, 820],
    [3.6, ...pt(V.studioTight, rc(R.studioCanvas))],
    [7, ...pt(studio, P.replayButton), true],
    [9.3, ...pt(V.panel, [1200, 1100])],
    [11, ...pt(V.panel, P.colourButton), true],
    [12, ...pt(V.panelDlg, P.swatchYellow), true],
    [13, ...pt(V.panelDlg, P.swatchOrange), true],
    [14, ...pt(V.panelDlg, P.swatchPink), true],
    [15, ...pt(V.panelDlg, P.colourClose), true],
    [16, ...pt(V.panel, P.frameButton), true],
    [17, ...pt(V.panel, P.menuManga), true],
    [17.6, ...pt(V.panel, [1500, 1120])],
    [19, ...pt(V.panel, P.frameButton), true],
    [20, ...pt(V.panel, P.menuFantasy), true],
    [20.6, ...pt(V.panel, [1650, 760])],
    [23, ...pt(V.panel, P.exportVideo), true],
    [25, ...pt(V.exportDlg, P.lengthFull), true],
    [26, ...pt(V.exportDlg, P.exportGo), true],
    [27.2, ...pt(V.progress, [1560, 820])],
    [29, ...pt(V.ready, P.save), true],
    [30.2, ...REST],
  ];
  const LEAD = 0.3;
  // The cursor is UI: default preset (tiny overshoot). One [x, y] track, one spring per move.
  const curKeys = MOVES.map((m) => [mod(B(Math.floor(m[0])) + (m[0] % 1) * (B(1) - B(0)) - (m[3] ? LEAD : 0)), [m[1], m[2]]]).sort((a, b) => a[0] - b[0]);
  const cursorAt = loopTrack(curKeys, 'default');
  const CLICKS = MOVES.filter((m) => m[3]).map((m) => B(m[0]));

  // ------------------------------------------------------------------ drawing helpers
  function rrect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function drawImg(c, src, x, y, w, h) {
    const e = image(src);
    if (e.ok) c.drawImage(e.img, x, y, w, h);
  }
  function drawCrop(c, key, r) {
    const e = uiImg(key);
    if (e.ok) c.drawImage(e.img, r[0], r[1], rw(r), rh(r), r[0], r[1], rw(r), rh(r));
  }
  // Cover-fit a footage frame into capture-space rect r.
  function drawFootage(c, src, r, aspect) {
    const ra = rw(r) / rh(r);
    let w = rw(r), h = rh(r);
    if (aspect > ra) w = h * aspect; else h = w / aspect;
    c.save();
    c.beginPath(); c.rect(r[0], r[1], rw(r), rh(r)); c.clip();
    drawImg(c, src, rc(r)[0] - w / 2, rc(r)[1] - h / 2, w, h);
    c.restore();
  }

  // Content in capture space (the caller has set up the view transform).
  function paintContent(c, content, t) {
    if (content.kind === 'ui') {
      const e = uiImg(content.img);
      if (e.ok) c.drawImage(e.img, 0, 0);
      if (content.footage) {
        const skin = skinAt(t), clip = MAN.clips[skin];
        const sec = replaySeconds(replayU(t));
        drawFootage(c, clipFrame(skin, sec), R.preview, clip.width / clip.height);
        if (content.over) drawCrop(c, content.img, R[content.over]);
        if (content.scrub) {
          const n = UI.scrub.steps - 1;
          const i = clamp(Math.round((sec / clip.duration) * n), 0, n);
          drawImg(c, `${UI.scrub.dir}/${i}.png`, UI.scrub.x, UI.scrub.y, UI.scrub.w, UI.scrub.h);
        }
        if (content.dim) {
          // The modal barrier darkens everything behind the dialog to 80%.
          c.fillStyle = `rgba(0,0,0,${1 - UI.dim})`;
          c.fillRect(R.preview[0], R.preview[1], rw(R.preview), rh(R.preview));
          if (content.scrub) c.fillRect(UI.scrub.x, UI.scrub.y, UI.scrub.w, UI.scrub.h);
        }
      }
    } else if (content.kind === 'studio') {
      const e = uiImg('studio');
      if (e.ok) c.drawImage(e.img, 0, 0);
      const cl = MAN.clips.canvas;
      const sec = clamp((t - B(4)) / (B(8) - B(4)), 0, 1) * cl.duration;
      drawFootage(c, clipFrame('canvas', sec), R.studioCanvas, cl.width / cl.height);
    } else if (content.kind === 'export') {
      const e = uiImg('export_short');
      if (e.ok) c.drawImage(e.img, 0, 0);
      paintLengthControl(c, t);
    } else if (content.kind === 'progress') {
      const k = clamp((t - B(26) - 0.06) / (B(28) - B(26) - 0.14), 0, 1);
      const list = UI.progress;
      const pick = list.reduce((best, p) => (Math.abs(p.pct / 100 - k) < Math.abs(best.pct / 100 - k) ? p : best), list[0]);
      const e = image(pick.img);
      if (e.ok) c.drawImage(e.img, pick.offset[0], pick.offset[1]);
    } else if (content.kind === 'ready') {
      const e = uiImg('ready');
      if (e.ok) c.drawImage(e.img, 0, 0);
    }
  }

  // Segmented "Length" control: the indicator's leading and trailing edges ride different
  // springs, so it stretches toward the click and the far edge catches up.
  const SEG = UI.segments;
  const SEG_STOPS = [[B(24), SEG.short[0], SEG.short[2]], [B(25), SEG.full[0], SEG.full[2]]];
  function paintLengthControl(c, t) {
    // Plate: both segments unselected (Full from the Short capture, Short from the Full one).
    drawCrop(c, 'export_short', SEG.full);
    drawCrop(c, 'export_full', SEG.short);
    const [x0, x1] = indicator(t, SEG_STOPS);
    c.save();
    rrect(c, x0, SEG.full[1], x1 - x0, rh(SEG.full), SEG.radius);
    c.fillStyle = SEG.color;
    c.fill();
    c.clip();
    drawCrop(c, 'export_full', SEG.full);
    drawCrop(c, 'export_short', SEG.short);
    c.restore();
  }

  function paintLogo(c, box) {
    const m = 0.74 * Math.min(box.w, box.h);
    const ar = LOGO.img.naturalWidth / LOGO.img.naturalHeight;
    if (LOGO.ok) c.drawImage(LOGO.img, box.cx - m / 2, box.cy - m / ar / 2 + 4, m, m / ar);
  }

  function paintToast(c, box, t, tin, tout) {
    // Text enters after the morph starts and leaves before the next one begins.
    const a = swapAlpha(t, tin, tout, { loop: LOOP });
    if (a <= 0) return;
    const rise = (1 - a) * 18;
    c.save();
    c.globalAlpha = a;
    c.fillStyle = ACCENT;
    c.beginPath(); c.arc(box.cx - 168, box.cy + rise, 22, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(box.cx - 178, box.cy + rise); c.lineTo(box.cx - 171, box.cy + 7 + rise); c.lineTo(box.cx - 157, box.cy - 8 + rise);
    c.stroke();
    c.fillStyle = '#fff';
    c.font = `600 40px "${UIF}"`;
    c.textBaseline = 'middle';
    c.fillText('Saved to Photos', box.cx - 128, box.cy + 2 + rise);
    c.restore();
  }

  function paintContainer(c, t) {
    const g = containerAt(t);
    const x = g.cx - g.w / 2, y = g.cy - g.h / 2;
    const ci = contentAt(t);
    const cur = CHANGES[ci], prev = CHANGES[(ci - 1 + CHANGES.length) % CHANGES.length];
    const next = CHANGES[(ci + 1) % CHANGES.length];
    const since = mod(t - cur.t);

    // Body + soft drop shadow (no glow: a single offset shadow, below the box).
    c.save();
    c.shadowColor = 'rgba(52, 38, 22, 0.20)';
    c.shadowBlur = 50; c.shadowOffsetY = 22;
    rrect(c, x, y, g.w, g.h, g.r);
    c.fillStyle = cur.c.kind === 'toast' ? INK : cur.c.kind === 'logo' ? '#FFFFFF' : '#1E1E1E';
    c.fill();
    c.restore();

    c.save();
    rrect(c, x, y, g.w, g.h, g.r);
    c.clip();
    // Content swaps behind a short blur: the outgoing state blurs away over the first 90 ms,
    // the incoming one sharpens in from 50 ms to 200 ms.
    // Incoming state is opaque underneath and sharpens; outgoing blurs and fades on top of it.
    const k = spring(since, 'snappy');
    const layers = [{ c: cur.c, alpha: 1, blur: (1 - k) * 12 }];
    if (since < settle('snappy') && prev !== cur) layers.push({ c: prev.c, alpha: 1 - k, blur: k * 16 });
    for (const L of layers) {
      if (L.alpha <= 0) continue;
      c.save();
      c.globalAlpha = L.alpha;
      if (L.blur > 0.3) c.filter = `blur(${L.blur.toFixed(1)}px)`;
      const kind = L.c.kind;
      if (kind === 'logo') {
        c.fillStyle = '#FFFFFF'; c.fillRect(x, y, g.w, g.h);
        paintLogo(c, g);
      } else if (kind === 'toast') {
        c.fillStyle = INK; c.fillRect(x, y, g.w, g.h);
        paintToast(c, g, t, cur.t, next.t);
      } else {
        c.translate(g.cx, g.cy); c.scale(g.s, g.s); c.translate(-g.ccx, -g.ccy);
        paintContent(c, L.c, t);
      }
      c.restore();
    }
    c.restore();
  }

  function paintHeadline(c, t) {
    for (const h of HEADS) {
      if (!h.lines.length) continue;
      h.lines.forEach((line, i) => {
        const kept = h.keep !== undefined && i < h.keep; // carried over from the previous head, no re-entry
        const tin = kept ? -Infinity : h.t + 0.04 + i * 0.07;
        const tout = h.end - 0.02;
        const nextKeeps = HEADS.find((n) => n.t === h.end)?.keep;
        const leaving = !(nextKeeps !== undefined && i < nextKeeps);
        const tm = mod(t);
        if (tm < (kept ? h.t : h.t) || tm >= h.end) return;
        // Type: heavy preset, no overshoot. The exit has fully settled by the next head.
        const enter = kept ? 1 : spring(tm - tin, 'heavy');
        const exit = leaving ? spring(tm - (tout - settle('heavy')), 'heavy') : 0;
        const size = h.top ? 104 : HEAD_SIZE;
        const bx = h.top ? 96 : HEAD_X;
        const by = h.top ? 150 : HEAD_Y + i * HEAD_LH - (h.lines.length - 1) * HEAD_LH * 0.5;
        const dy = (1 - enter) * size * 0.9 - exit * size * 0.9;
        c.save();
        c.beginPath();
        c.rect(bx - 20, by - size * 1.0, 1200, size * 1.5);
        c.clip();
        c.font = `${size}px "${DISPLAY}"`;
        c.fillStyle = INK;
        c.textBaseline = 'alphabetic';
        c.fillText(line, bx, by + dy);
        c.restore();
      });
    }
  }

  function paintWordmark(c, t) {
    // Visible in the logo state: enters after the closing morph starts, leaves on beat 1.
    const tin = B(31) + 0.08, tout = B(1);
    const tm = mod(t);
    const inK = spring(mod(tm - tin), 'heavy');
    const outK = tm < tin ? spring(tm - (tout - settle('heavy')), 'heavy') : 0;
    if (tm >= tout + 0.4 && tm < tin) return;
    const bx = V.logo.cx + V.logo.w / 2 + GAP, by = H / 2 + WM_SIZE * 0.3;
    const dy = (1 - inK) * WM_SIZE * 0.9 - outK * WM_SIZE * 0.9;
    c.save();
    c.beginPath(); c.rect(bx - 20, by - WM_SIZE * 1.05, WM_W + 60, WM_SIZE * 1.6); c.clip();
    c.font = `${WM_SIZE}px "${DISPLAY}"`;
    c.fillStyle = INK;
    c.fillText('ZexDraws', bx, by + dy);
    c.restore();
  }

  function paintCursor(c, t) {
    let [x, y] = cursorAt(t);
    // While painting in the studio the cursor rides the measured paint position.
    const tm = mod(t);
    const wgt = spring(tm - (B(4) + 0.08), 'default') * (1 - spring(tm - (B(7) - 0.12 - settle('default')), 'default'));
    if (wgt > 0) {
      const g = containerAt(t);
      const cl = MAN.clips.canvas;
      const sec = clamp((tm - B(4)) / (B(8) - B(4)), 0, 1) * cl.duration;
      const p = cl.paint[clamp(Math.round(sec * cl.fps), 0, cl.paint.length - 1)];
      const cap = [R.studioCanvas[0] + p[0] * rw(R.studioCanvas), R.studioCanvas[1] + p[1] * rh(R.studioCanvas)];
      const sx = g.cx + (cap[0] - g.ccx) * g.s, sy = g.cy + (cap[1] - g.ccy) * g.s;
      x = lerp(x, sx, wgt); y = lerp(y, sy, wgt);
    }
    // Press: a quick dip in scale plus a ring that expands from the tip.
    let press = 0, ring = null;
    for (const tc of CLICKS) {
      const d = mod(tm - tc + 0.5) - 0.5; // signed distance, wrapped
      press = Math.max(press, spring(d + 0.03, 'snappy') - spring(d - 0.07, 'snappy'));
      if (d >= 0 && d < 0.4) ring = d / 0.4;
    }
    press = Math.max(press, wgt * 0.6);
    if (ring !== null) {
      c.save();
      c.strokeStyle = ACCENT;
      c.globalAlpha = (1 - ring) * 0.9;
      c.lineWidth = 4 * (1 - ring) + 1;
      c.beginPath(); c.arc(x, y, 10 + 30 * Math.sqrt(ring), 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    const sc = 1.3 * (1 - 0.16 * press);
    c.save();
    c.translate(x, y); c.scale(sc, sc);
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(0, 30); c.lineTo(7.2, 23.4); c.lineTo(12, 34.2); c.lineTo(16.6, 32.2);
    c.lineTo(11.8, 21.6); c.lineTo(21.6, 21.6); c.closePath();
    c.fillStyle = INK; c.fill();
    c.lineWidth = 2.2; c.strokeStyle = '#FFFFFF'; c.lineJoin = 'round'; c.stroke();
    c.restore();
  }

  function paint(c, t) {
    t = mod(t);
    c.save();
    c.fillStyle = PAPER;
    c.fillRect(0, 0, W, H);
    paintHeadline(c, t);
    paintWordmark(c, t);
    paintContainer(c, t);
    paintCursor(c, t);
    c.restore();
  }

  // ------------------------------------------------------------------ public API
  // Everything an instant needs, so the renderer can load it before painting.
  function needs(t) {
    t = mod(t);
    const out = [];
    const ci = contentAt(t);
    for (const k of [ci, (ci - 1 + CHANGES.length) % CHANGES.length]) {
      const c = CHANGES[k].c;
      if (c.footage) {
        const skin = skinAt(t);
        const sec = replaySeconds(replayU(t));
        out.push(clipFrame(skin, sec));
        if (c.scrub) {
          const n = UI.scrub.steps - 1;
          out.push(`${UI.scrub.dir}/${clamp(Math.round((sec / MAN.clips[skin].duration) * n), 0, n)}.png`);
        }
      }
      if (c.kind === 'studio') {
        const cl = MAN.clips.canvas;
        out.push(clipFrame('canvas', clamp((mod(t) - B(4)) / (B(8) - B(4)), 0, 1) * cl.duration));
      }
      if (c.kind === 'progress') for (const p of UI.progress) out.push(p.img);
    }
    return out;
  }
  window.prepare = async (times) => {
    const srcs = new Set(times.flatMap((t) => needs(t)));
    await Promise.all([...srcs].map((s) => image(s).ready));
    if (imgCache.size > 400) for (const [k] of imgCache) { if (imgCache.size <= 300) break; if (k.startsWith('build/')) imgCache.delete(k); }
  };
  window.seek = (t) => paint(ctx, t);
  // Motion blur: average n subframes spread over a 180-degree shutter around frame f.
  const sub = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const sctx = sub.getContext('2d');
  window.subframeTimes = (f, fps, n) => Array.from({ length: n }, (_, k) => (f + ((k + 0.5) / n - 0.5) * 0.5) / fps);
  window.renderFrame = async (f, fps = 60, n = 4) => {
    const ts = window.subframeTimes(f, fps, n);
    await window.prepare(ts);
    ts.forEach((t, k) => {
      paint(sctx, t);
      ctx.globalAlpha = 1 / (k + 1);
      ctx.drawImage(sub, 0, 0);
    });
    ctx.globalAlpha = 1;
  };
  window.LOOP = LOOP;
  window.BEAT_TIMES = BEATS.beats.slice();
  window.filmReady = true;

  if (!RENDER) {
    // Preview only: play in real time. (Render mode never uses requestAnimationFrame.)
    const t0 = performance.now();
    const tick = async () => {
      const t = ((performance.now() - t0) / 1000) % LOOP;
      await window.prepare([t]);
      paint(ctx, t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
})();
