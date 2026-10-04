// ZexDraws dark launch film (docs/shotlist.md, docs/style_guide.md).
// DOM + CSS 3D, driven only by window.seek(t): every property below is a pure function of t
// built from lib/motion.js. No CSS transitions, no timers, no state carried between frames.
(async () => {
  'use strict';
  const { spring, settle, track, indicator, glide, loopT, pick, clock } = Motion;
  const RENDER = new URLSearchParams(location.search).has('render');
  const $ = (id) => document.getElementById(id);
  const load = (u) => fetch(u).then((r) => r.json());
  const [BT, MAN, UI] = await Promise.all([load('beats-dark.json'), load('build/manifest.json'), load('ui/ui.json')]);

  // ------------------------------------------------------------------ time
  const LOOP = BT.duration;
  const G = BT.sixteenths, NG = G.length;
  const at16 = (j) => G[((j % NG) + NG) % NG] + LOOP * Math.floor(j / NG);
  // Fractional beat -> seconds on the measured grid (16ths are measured peaks).
  const B = (x) => { const q = x * 4, i = Math.floor(q), f = q - i; return at16(i) + (at16(i + 1) - at16(i)) * f; };
  const mod = (t) => loopT(t, LOOP);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;

  // ------------------------------------------------------------------ assets
  const fonts = [
    new FontFace('Southern Beach', 'url(assets/fonts/SouthernBeach.otf)'),
    new FontFace('Inter', 'url(assets/fonts/Inter-Medium.ttf)', { weight: '500' }),
    new FontFace('Inter', 'url(assets/fonts/Inter-SemiBold.ttf)', { weight: '600' }),
    new FontFace('Inter', 'url(assets/fonts/Inter-Bold.ttf)', { weight: '700' }),
  ];
  await Promise.all(fonts.map((f) => f.load().then((ff) => document.fonts.add(ff))));

  const cache = new Map();
  function image(src) {
    let e = cache.get(src);
    if (!e) {
      const img = new Image();
      img.src = src;
      e = { img, ok: false };
      e.ready = img.decode().then(() => (e.ok = true)).catch(() => (e.ok = false));
      cache.set(src, e);
    }
    return e;
  }
  const TYPING = Array.from({ length: 10 }, (_, i) => `ui/typing/${String(i).padStart(2, '0')}.png`);
  const SKINS = Object.keys(MAN.replay.skins);
  const THUMBS = SKINS.flatMap((k) => MAN.clips[k].thumbs);
  await Promise.all([...TYPING, 'ui/studio.png', 'assets/logo.png', ...THUMBS].map((s) => image(s).ready));

  // ------------------------------------------------------------------ footage
  const RP = MAN.replay;
  const skip = RP.skip || [Infinity, Infinity];
  const skipLen = Number.isFinite(skip[0]) ? skip[1] - skip[0] : 0;
  const replaySeconds = (u) => { let s = RP.useFrom + u * (RP.useTo - RP.useFrom - skipLen); if (s > skip[0]) s += skipLen; return s; };
  const frameOf = (key, sec) => { const c = MAN.clips[key]; return `${c.dir}/${clamp(Math.round(sec * c.fps), 0, c.frames - 1)}.jpg`; };
  // Replay playhead (a clock, not an easing): the looks share it, so a switch keeps the moment.
  const replayU = (t) => clock(t, [[B(9), 0.06], [B(16), 0.5], [B(17), 0.5], [B(27), 0.82]]);
  const LOOKS = [[B(9), 'pink'], [B(10.5), 'yellow'], [B(12), 'orange'], [B(13.5), 'manga'], [B(15), 'fantasy']];
  const LOOK_INFO = {
    pink: { frame: 'Neubrutalism', hex: '#E83E77' },
    yellow: { frame: 'Neubrutalism', hex: '#F0D442' },
    orange: { frame: 'Neubrutalism', hex: '#E2572C' },
    manga: { frame: 'Manga', hex: '#FBFBF6' },
    fantasy: { frame: 'Fantasy', hex: '#201E1A' },
  };
  const lookAt = (t) => pick(t, [[0, 'pink'], ...LOOKS]);

  // ------------------------------------------------------------------ the box (one object, many states)
  const RES = 1.8; // face canvas pixels per world pixel (the camera reaches 1.8x in the open)
  const BOX = [
    // The open is a strip of the dialog: title, both fields and the orientation row. The app's
    // own 'Each side must be 64-4096 px' hint sits below the cut while the fields are empty.
    { b: 0, w: 860, h: 360, r: 24, front: 'typing' },
    { b: 4, w: 820, h: 1047, r: 22, front: 'slab' },
    { b: 5, front: 'studio' },
    { b: 9, w: 980, h: 694, r: 16, front: 'look' },
    { b: 16, w: 928, h: 694, front: 'still' },
    { b: 17, w: 980, h: 694 },
    { b: 31, w: 860, h: 360, r: 24, front: 'slab' },
  ];
  BOX.forEach((s, i) => { s.t = B(s.b); for (const k of ['w', 'h', 'r', 'front']) if (s[k] === undefined) s[k] = BOX[i - 1][k]; });
  const boxTrack = (k) => BOX.filter((s, i) => i === 0 || s[k] !== BOX[i - 1][k]).map((s) => [s.t, s[k]]);
  const BW = boxTrack('w'), BH = boxTrack('h'), BR = boxTrack('r');
  const loopTrack = (keys, preset) => (t) => track(t, keys, { loop: LOOP, preset });
  const boxW = loopTrack(BW, 'default'), boxH = loopTrack(BH, 'default'), boxR = loopTrack(BR, 'default');
  const boxFlip = loopTrack([[B(17), 180], [B(31), 360]], 'default');
  // Lift, converge, re-emerge: one spring per change, periodic.
  const boxLift = {
    z: loopTrack([[B(26), 520], [B(27), 260], [B(31), 0]], 'default'),
    rx: loopTrack([[B(26), -24], [B(27), 0], [B(31), 0]], 'default'),
    rz: loopTrack([[B(26), 14], [B(27), 0], [B(31), 0]], 'default'),
    s: loopTrack([[B(26), 0.9], [B(27), 0.03], [B(31), 1]], 'default'),
  };

  // Content key at t (changes swap behind a short blur).
  function frontKey(t) {
    const k = pick(t, BOX.map((s) => [s.t, s.front]), { loop: LOOP });
    return k === 'look' ? `look:${lookAt(t)}` : k;
  }
  const FRONT_CHANGES = (() => {
    const pts = [...BOX.map((s) => s.t), ...LOOKS.map((l) => l[0])].sort((a, b) => a - b);
    const out = [];
    for (const p of pts) { const k = frontKey(p + 1e-6); if (!out.length || out[out.length - 1][1] !== k) out.push([p, k]); }
    return out;
  })();

  const STUDIO_CROP = (() => { const r = UI.rects.studioCanvas, m = 64; return [r[0] - m, r[1] - m, r[2] + m, r[3] + m]; })();
  function paintKey(c, key, t, W, H) {
    if (key === 'typing') {
      const idx = pick(mod(t), [[0, 0], [B(0.5), 1], [B(0.75), 2], [B(1), 3], [B(1.25), 4], [B(1.75), 5], [B(2), 6], [B(2.25), 7], [B(2.5), 8], [B(2.75), 9]]);
      const e = image(TYPING[idx]);
      if (e.ok) c.drawImage(e.img, 0, 0, 860, 360, 0, 0, W, H);
    } else if (key === 'slab') {
      c.fillStyle = '#262626'; c.fillRect(0, 0, W, H);
    } else if (key === 'studio') {
      const e = image('ui/studio.png'), cr = STUDIO_CROP, rr = UI.rects.studioCanvas;
      const sx = W / (cr[2] - cr[0]), sy = H / (cr[3] - cr[1]);
      if (e.ok) c.drawImage(e.img, cr[0], cr[1], cr[2] - cr[0], cr[3] - cr[1], 0, 0, W, H);
      const cl = MAN.clips.canvas;
      const sec = clamp((mod(t) - B(5)) / (B(9) - B(5)), 0, 1) * cl.duration;
      const f = image(frameOf('canvas', sec));
      if (f.ok) c.drawImage(f.img, (rr[0] - cr[0]) * sx, (rr[1] - cr[1]) * sy, (rr[2] - rr[0]) * sx, (rr[3] - rr[1]) * sy);
    } else if (key.startsWith('look:') || key === 'replay') {
      const skin = key === 'replay' ? 'fantasy' : key.slice(5);
      const f = image(frameOf(skin, replaySeconds(replayU(mod(t)))));
      if (f.ok) c.drawImage(f.img, 0, 0, W, H);
    } else if (key === 'still') {
      // The finished drawing alone: the canvas cut out of the last usable frame.
      const f = image(frameOf('pink', RP.useTo - 0.1));
      const cr = RP.canvasRect, k = f.ok ? f.img.naturalWidth / MAN.clips.pink.width : 1;
      if (f.ok) c.drawImage(f.img, cr[0] * k, cr[1] * k, (cr[2] - cr[0]) * k, (cr[3] - cr[1]) * k, 0, 0, W, H);
    }
  }
  function paintFace(canvas, keyAt, changes, t, w, h) {
    const W = Math.max(2, Math.round(w * RES)), H = Math.max(2, Math.round(h * RES));
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, W, H);
    const tm = mod(t);
    const cur = keyAt(tm);
    let ci = changes.length - 1;
    while (ci > 0 && changes[ci][0] > tm) ci--;
    if (tm < changes[0][0]) ci = changes.length - 1;
    const since = mod(tm - changes[ci][0]);
    const prev = changes[(ci - 1 + changes.length) % changes.length][1];
    const k = spring(since, 'snappy');
    c.save();
    if (k < 0.97) c.filter = `blur(${((1 - k) * 12 * RES).toFixed(1)}px)`;
    paintKey(c, cur, t, W, H);
    c.restore();
    if (prev !== cur && since < settle('snappy')) {
      c.save();
      c.globalAlpha = 1 - k;
      c.filter = `blur(${(k * 16 * RES).toFixed(1)}px)`;
      paintKey(c, prev, t, W, H);
      c.restore();
    }
  }

  // ------------------------------------------------------------------ camera
  // Spring targets per shot plus closed-form drifts (glide). Drifts are balanced by one
  // counter-drift hidden in the scatter, so they sum to zero and the loop closes exactly.
  const CAM = [
    { b: 0, s: 1.75, rx: 14, rz: -6, fx: 0, fy: 10 },
    { b: 4, s: 1.0, rx: 0, rz: 0, fx: 0, fy: 0 },
    { b: 5, s: 1.35, rx: 0, rz: 0, fx: 0, fy: -130 },
    { b: 9, s: 0.92, rx: 6, rz: 0, fx: -44, fy: 0 },
    { b: 18, s: 0.3, rx: 55, rz: -18, fx: 0, fy: 0 },
    { b: 27, s: 1.0, rx: 0, rz: 0, fx: 0, fy: 0 },
    { b: 31, s: 1.75, rx: 14, rz: -6, fx: 0, fy: 10 },
  ];
  // Drift segments [start, end, velocity] per axis; glide() ramps each in and out on springs.
  const DRIFT = {
    fx: [[B(0), B(3.6), 34], [B(18.5), B(26), 150]],
    fy: [[B(5), B(8.6), 150]],
    s: [[B(0), B(3.6), 0.025]],
  };
  const segAt = (seg, t) => glide(t, [[seg[0], seg[2]], [seg[1], 0]]);
  // One counter-drift inside the scatter (beats 26.2-27) cancels each axis's net travel.
  for (const ax of Object.keys(DRIFT)) {
    const net = DRIFT[ax].reduce((a, seg) => a + segAt(seg, LOOP + 5), 0);
    const unit = segAt([B(26.2), B(27), 1], LOOP + 5);
    DRIFT[ax].push([B(26.2), B(27), -net / unit]);
  }
  const driftAt = (ax, t) => DRIFT[ax].reduce((a, seg) => a + segAt(seg, t), 0);
  const camTrack = {};
  for (const k of ['s', 'rx', 'rz', 'fx', 'fy']) {
    camTrack[k] = loopTrack(CAM.map((c) => {
      // Spring target = intended framing minus the drift already travelled once it settles.
      const d = DRIFT[k] ? driftAt(k, B(c.b) + settle('default')) : 0;
      return [B(c.b), c[k] - d];
    }), 'default');
  }
  const cam = (k, t) => camTrack[k](t) + (DRIFT[k] ? driftAt(k, mod(t)) : 0);

  // ------------------------------------------------------------------ floor
  const rng = (seed) => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32
  const R = rng(7);
  const PITCH_X = 1050, PITCH_Y = 764, NC = 11, NR = 11;
  const floorEl = $('floor');
  const CARDS = [];
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    if (r === 5 && c === 5) continue;
    const x = (c - 5) * PITCH_X, y = (r - 5) * PITCH_Y;
    const ring = Math.max(Math.abs(c - 5), Math.abs(r - 5));
    const el = document.createElement('div');
    el.className = 'card';
    const img = document.createElement('img');
    img.src = THUMBS[Math.floor(R() * THUMBS.length)];
    el.appendChild(img);
    floorEl.appendChild(el);
    const d1 = 0.035 * ring + R() * 0.04, d2 = R() * 0.12, d3 = R() * 0.1;
    const lz = 300 + R() * 700, lr = () => (R() - 0.5) * 70;
    const t18 = B(18) + d1, t26 = B(26) + d2, t27 = B(27) + d3;
    CARDS.push({
      el, dim: 0.5 + 0.2 * R(),
      x: [[0, x], [t26, x * 1.12], [t27, 0]],
      y: [[0, y], [t26, y * 1.12], [t27, 0]],
      z: [[0, -2200], [t18, 0], [t26, lz], [t27, 300]],
      rx: [[0, 0], [t26, lr()], [t27, lr() * 2]],
      ry: [[0, 0], [t26, lr()], [t27, lr() * 2]],
      rz: [[0, 0], [t26, lr()], [t27, lr() * 2]],
      s: [[0, 1], [t27, 0.02]],
    });
  }
  const FLOOR_ON = [B(18) - 0.02, B(27) + 0.36];

  // ------------------------------------------------------------------ HUD
  const hud = $('hud');
  function el(tag, cls, style, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) Object.assign(e.style, style);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  // A masked vertical strip. pos -1 = blank (below), 0.. = lines; exit 0..1 lifts the whole
  // line up and out through an outer mask, so nothing behind it is revealed on the way out.
  function strip(parent, x, y, w, h, lines, cls) {
    const outer = el('div', 'mask', { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    const inner = el('div', 'mask', { left: '0', top: '0', width: `${w}px`, height: `${h}px` });
    const col = el('div', cls, { position: 'absolute', left: '0', top: '0' });
    for (const l of ['', ...lines]) col.appendChild(el('div', '', { height: `${h}px`, lineHeight: `${h}px`, whiteSpace: 'nowrap' }, String(l)));
    inner.appendChild(col); outer.appendChild(inner); parent.appendChild(outer);
    return ([pos, exit]) => {
      col.style.transform = `translateY(${(-(pos + 1) * h).toFixed(2)}px)`;
      inner.style.transform = `translateY(${(-exit * h * 1.05).toFixed(2)}px)`;
    };
  }
  // Lifecycle: enter from below at tIn, roll through `steps` ([time, pos]), lift out by tOut.
  function stripTrack(tIn, steps, tOut, _unused, preset) {
    const keys = [[0, -1], [tIn, 0], ...steps];
    const exitAt = tOut - settle(preset) - 0.01;
    return (t) => { t = mod(t); return [track(t, keys, { preset }), Math.min(1, Math.max(0, spring(t - exitAt, preset)))]; };
  }

  // Carousel (beats 9-16): left block.
  const LOOK_NAMES = ['Neubrutalism', 'Manga', 'Fantasy'];
  const lookName = strip(hud, 96, 470, 520, 100, LOOK_NAMES, 'name');
  const lookNamePos = stripTrack(B(9) + 0.06, [[B(13.5), 1], [B(15), 2]], B(16), 3, 'heavy');
  const eyebrow = strip(hud, 98, 430, 300, 24, ['<span class="eyebrow">Look</span>'], '');
  const eyebrowPos = stripTrack(B(9) + 0.04, [], B(16), 1, 'heavy');
  const counter = strip(hud, 168, 430, 80, 24, [1, 2, 3, 4, 5].map((n) => `<span class="eyebrow"><b>0${n}</b>/05</span>`), '');
  const counterPos = stripTrack(B(9) + 0.04, LOOKS.slice(1).map((l, i) => [l[0], i + 1]), B(16), 5, 'snappy');
  const underline = el('div', '', { position: 'absolute', left: '98px', top: '584px', height: '3px', borderRadius: '2px' });
  hud.appendChild(underline);
  const DOT_X = (i) => 104 + i * 34, DOT_Y = 622;
  const dots = SKINS.map((k, i) => {
    const d = el('div', '', { position: 'absolute', left: `${DOT_X(i) - 7}px`, top: `${DOT_Y - 7}px`, width: '14px', height: '14px', borderRadius: '7px', background: LOOK_INFO[k].hex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)' });
    hud.appendChild(d);
    return d;
  });
  const ring = el('div', '', { position: 'absolute', top: `${DOT_Y - 13}px`, height: '26px', border: '2px solid var(--accent)', borderRadius: '13px', boxSizing: 'border-box' });
  hud.appendChild(ring);
  const RING_STOPS = LOOKS.map((l, i) => [l[0], DOT_X(i) - 13, DOT_X(i) + 13]);

  // Carousel: right block (tokens).
  const RX = 1508;
  const tokEyebrow = strip(hud, RX, 470, 300, 24, ['<span class="eyebrow">Frame</span>'], '');
  const tokFrame = strip(hud, RX, 506, 330, 34, LOOK_NAMES.map((n) => `<span class="row">skin&nbsp;&nbsp;<span class="v">${n}</span></span>`), '');
  const tokColour = strip(hud, RX, 544, 330, 34, SKINS.map((k) => `<span class="row"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;background:${LOOK_INFO[k].hex};box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)"></span>&nbsp;&nbsp;colour&nbsp;&nbsp;<span class="v">${LOOK_INFO[k].hex}</span></span>`), '');
  const tokEyebrowPos = stripTrack(B(9) + 0.06, [], B(16), 1, 'snappy');
  const tokFramePos = stripTrack(B(9) + 0.12, [[B(13.5), 1], [B(15), 2]], B(16), 3, 'snappy');
  const tokColourPos = stripTrack(B(9) + 0.18, LOOKS.slice(1).map((l, i) => [l[0], i + 1]), B(16), 5, 'snappy');

  // Toggle (beats 16-18): the words never move; only their brightness swaps.
  const toggle = strip(hud, 710, 96, 500, 48, ['<div style="width:500px;text-align:center;font:600 34px/48px Inter"><span id="tgA">Canvas</span><span style="color:var(--faint)">&nbsp;&nbsp;·&nbsp;&nbsp;</span><span id="tgB">Replay</span></div>'], '');
  const toggleRoll = stripTrack(B(16) + 0.05, [], B(18), 0, 'heavy');
  const toggleK = (t) => track(mod(t), [[0, 0], [B(17), 1]], { preset: 'snappy' });

  // Stats (beats 21-26).
  const STATS = [[5, 'Frame skins'], [6, 'Colours'], [5, 'Speeds'], [2, 'Lengths']];
  const STAT_X = (i) => 960 + (i - 1.5) * 300;
  const statDigits = [], statLabels = [];
  STATS.forEach(([n, label], i) => {
    const x = STAT_X(i) - 60;
    statDigits.push(strip(hud, x, 360, 120, 160, Array.from({ length: 10 }, (_, d) => d), 'num'));
    statLabels.push(strip(hud, STAT_X(i) - 110, 530, 220, 24, [`<div class="eyebrow" style="text-align:center;width:220px">${label}</div>`], ''));
    if (i) hud.appendChild(el('div', '', { position: 'absolute', left: `${STAT_X(i) - 150}px`, top: '380px', width: '1px', height: '170px', background: 'var(--hair)' }));
  });
  const statLines = [...hud.children].filter((e) => e.style.width === '1px');
  const STAT_START = [21, 21.5, 22, 22.5].map(B);
  const statPos = STATS.map(([n], i) => stripTrack(STAT_START[i], [[STAT_START[i] + 0.02, n]], B(26), 0, 'heavy'));
  const statLabelPos = STATS.map((_, i) => stripTrack(STAT_START[i] + 0.06, [], B(26), 1, 'heavy'));
  const caption = strip(hud, 460, 610, 1000, 30, ['<div class="row" style="text-align:center;width:1000px;letter-spacing:0.04em">Neutral · Neubrutalism · Fantasy · Manga · Sketchbook</div>'], '');
  const captionPos = stripTrack(B(24), [], B(26), 1, 'heavy');

  // Lockup (beats 27-31).
  // The logo on its own white ground (the mark's black pen is drawn for white): an app-icon tile.
  const logo = el('img', '', { position: 'absolute', left: '0', top: '0', width: '300px', borderRadius: '23%' });
  logo.src = 'assets/logo.png';
  hud.appendChild(logo);
  const LOGO_AR = 1;
  const WM = el('div', 'mask', { left: '822px', top: '360px', width: '700px', height: '210px' });
  const wmText = el('div', '', { position: 'absolute', left: 0, top: 0, font: "150px/210px 'Southern Beach'", whiteSpace: 'nowrap' }, 'ZexDraws');
  WM.appendChild(wmText);
  hud.appendChild(WM);
  const slash = el('div', '', { position: 'absolute', left: '771px', top: '388px', width: '10px', height: '150px', background: 'var(--accent)', borderRadius: '5px', transformOrigin: '50% 100%' });
  hud.appendChild(slash);
  const tagline = strip(hud, 460, 600, 1000, 70, ['<div style="font:600 52px/70px Inter;letter-spacing:-0.01em;text-align:center;width:1000px">Every stroke, replayable.</div>'], '');
  const pill = strip(hud, 810, 694, 300, 44, ['<div style="width:300px;text-align:center"><span style="display:inline-block;font:500 15px/34px Inter;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);padding:0 18px;border-radius:17px;background:#141316;box-shadow:inset 0 0 0 1px var(--hair)">Recorder built in</span></div>'], '');
  const L_IN = B(27) + 0.12;
  const logoReveal = (t) => track(mod(t), [[0, 0], [L_IN, 1], [B(31), 0]], { preset: 'heavy' });
  const logoMove = (t) => track(mod(t), [[0, 0], [B(28), 1]], { preset: 'heavy' });
  const wmK = (t) => track(mod(t), [[0, 0], [B(28) + 0.06, 1], [B(31) - settle('heavy'), 0]], { preset: 'heavy' });
  const slashK = (t) => track(mod(t), [[0, 0], [B(28), 1], [B(31) - settle('snappy'), 0]], { preset: 'snappy' });
  const taglinePos = stripTrack(B(28) + 0.2, [], B(31), 1, 'heavy');
  const pillPos = stripTrack(B(28) + 0.36, [], B(31), 1, 'heavy');
  const spotK = loopTrack([[B(27), 1], [B(31), 0]], 'heavy');

  // ------------------------------------------------------------------ grain (seeded, per frame)
  const grainTiles = Array.from({ length: 8 }, (_, i) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d'), id = g.createImageData(256, 256), r = rng(1000 + i);
    for (let p = 0; p < 256 * 256; p++) { const v = Math.floor(r() * 7); id.data[p * 4] = id.data[p * 4 + 1] = id.data[p * 4 + 2] = v; id.data[p * 4 + 3] = 255; }
    g.putImageData(id, 0, 0);
    return cv;
  });
  const grainCtx = $('grain').getContext('2d');

  // ------------------------------------------------------------------ seek
  const ACTIVE = '#FFFFFF', FAINT = [0x5b, 0x5a, 0x5e];
  const mix = (k) => `rgb(${Math.round(lerp(255, FAINT[0], k))},${Math.round(lerp(255, FAINT[1], k))},${Math.round(lerp(255, FAINT[2], k))})`;
  const between = (t, a, b) => t >= a && t < b;

  function seek(tRaw) {
    const t = mod(tRaw);
    // Camera rig.
    const s = cam('s', t), rx = cam('rx', t), rz = cam('rz', t), fx = cam('fx', t), fy = cam('fy', t);
    $('rig').style.transform = `translate(960px, 540px) scale(${s}) rotateX(${rx}deg) rotateZ(${rz}deg) translate3d(${-fx}px, ${-fy}px, 0)`;

    // Box.
    const w = boxW(t), h = boxH(t), r = boxR(t);
    const box = $('box');
    const hidden = between(t, B(27) + 0.36, B(31) - 0.02);
    box.style.visibility = hidden ? 'hidden' : 'visible';
    box.style.width = `${w}px`; box.style.height = `${h}px`;
    box.style.transform = `translate3d(${-w / 2}px, ${-h / 2}px, ${boxLift.z(t)}px) rotateX(${boxLift.rx(t)}deg) rotateZ(${boxLift.rz(t)}deg) rotateY(${boxFlip(t)}deg) scale(${boxLift.s(t)})`;
    for (const f of box.children) f.style.borderRadius = `${r}px`;
    if (!hidden) {
      paintFace($('front'), frontKey, FRONT_CHANGES, t, w, h);
      const showBack = between(t, B(16), B(31) + 0.2);
      if (showBack) paintFace($('back'), () => 'replay', [[0, 'replay']], t, w, h);
    }

    // Floor.
    const floorOn = between(t, FLOOR_ON[0], FLOOR_ON[1]);
    floorEl.style.display = floorOn ? 'block' : 'none';
    if (floorOn) for (const c of CARDS) {
      const v = (k) => track(t, c[k], { preset: 'default' });
      c.el.style.opacity = c.dim;
      c.el.style.transform = `translate3d(${v('x') - 490}px, ${v('y') - 347}px, ${v('z')}px) rotateX(${v('rx')}deg) rotateY(${v('ry')}deg) rotateZ(${v('rz')}deg) scale(${v('s')})`;
    }

    // Carousel.
    lookName(lookNamePos(t)); eyebrow(eyebrowPos(t)); counter(counterPos(t));
    const look = lookAt(t), info = LOOK_INFO[look];
    const carouselOn = between(t, B(9), B(16));
    const nameW = { Neubrutalism: 410, Manga: 230, Fantasy: 270 }[info.frame];
    const ulW = carouselOn ? track(t, [[0, 0], [B(9) + 0.1, 410], [B(13.5), 230], [B(15), 270], [B(16) - settle('snappy'), 0]], { preset: 'snappy' }) : 0;
    underline.style.width = `${Math.max(0, ulW).toFixed(1)}px`;
    underline.style.background = info.hex === '#201E1A' ? '#D9B26A' : info.hex;
    const dotK = (i) => (carouselOn ? spring(t - (B(9) + 0.08 + i * 0.04), 'snappy') * (1 - spring(t - (B(16) - settle('snappy') - 0.02), 'snappy')) : 0);
    dots.forEach((d, i) => { d.style.transform = `scale(${Math.max(0, dotK(i)).toFixed(3)})`; });
    const [ra, rb] = indicator(t, RING_STOPS);
    const ringK = dotK(0);
    ring.style.left = `${ra}px`; ring.style.width = `${Math.max(0, rb - ra)}px`;
    ring.style.transform = `scale(${Math.max(0, ringK).toFixed(3)})`;
    tokEyebrow(tokEyebrowPos(t)); tokFrame(tokFramePos(t)); tokColour(tokColourPos(t));

    // Toggle.
    toggle(toggleRoll(t));
    { const k = clamp(toggleK(t), 0, 1); $('tgA').style.color = mix(k); $('tgB').style.color = mix(1 - k); }

    // Stats.
    statDigits.forEach((f, i) => f(statPos[i](t)));
    statLabels.forEach((f, i) => f(statLabelPos[i](t)));
    caption(captionPos(t));
    const linesK = spring(t - B(21), 'default') * (1 - spring(t - (B(26) - settle('default')), 'default'));
    statLines.forEach((l) => { l.style.transform = `scaleY(${clamp(linesK, 0, 1).toFixed(3)})`; });
    // Lighting, not a fade: the floor darkens behind the numbers while they're up.
    $('scrim').style.opacity = clamp(track(t, [[0, 0], [B(20.5), 1], [B(26), 0]], { preset: 'heavy' }), 0, 1).toFixed(3);

    // Lockup.
    const rv = clamp(logoReveal(t), 0, 1), mv = logoMove(t);
    const lw = lerp(260, 168, mv), lh = lw / LOGO_AR;
    const lcx = lerp(960, 664, mv), lcy = lerp(540, 466, mv);
    logo.style.width = `${lw}px`;
    logo.style.transform = `translate(${lcx - lw / 2}px, ${lcy - lh / 2}px)`;
    logo.style.clipPath = `circle(${(rv * 72).toFixed(2)}% at 50% 50%)`;
    logo.style.visibility = rv > 0.002 ? 'visible' : 'hidden';
    const wk = clamp(wmK(t), 0, 1);
    wmText.style.transform = `translateX(${(-(1 - wk) * 720).toFixed(1)}px)`;
    slash.style.transform = `rotate(18deg) scaleY(${clamp(slashK(t), 0, 1).toFixed(3)})`;
    tagline(taglinePos(t)); pill(pillPos(t));
    $('spot').style.opacity = clamp(spotK(t), 0, 1).toFixed(3);

    // Grain: tile chosen by frame number (seeded), drawn unscaled.
    const fi = Math.floor(t * 60 + 1e-6);
    const tile = grainTiles[fi % 8], ox = (fi * 97) % 256, oy = (fi * 53) % 256;
    grainCtx.clearRect(0, 0, 1920, 1080);
    for (let y = -oy; y < 1080; y += 256) for (let x = -ox; x < 1920; x += 256) grainCtx.drawImage(tile, x, y);
  }

  // ------------------------------------------------------------------ API
  function needs(tRaw) {
    const t = mod(tRaw), out = [];
    const keys = [frontKey(t)];
    const ci = FRONT_CHANGES.findLastIndex((c) => c[0] <= t);
    keys.push(FRONT_CHANGES[(ci - 1 + FRONT_CHANGES.length) % FRONT_CHANGES.length][1]);
    if (between(t, B(16), B(31) + 0.2)) keys.push('replay');
    for (const k of keys) {
      if (k.startsWith('look:') || k === 'replay') out.push(frameOf(k === 'replay' ? 'fantasy' : k.slice(5), replaySeconds(replayU(t))));
      if (k === 'studio') { const cl = MAN.clips.canvas; out.push(frameOf('canvas', clamp((t - B(5)) / (B(9) - B(5)), 0, 1) * cl.duration)); }
      if (k === 'still') out.push(frameOf('pink', RP.useTo - 0.1));
    }
    return out;
  }
  window.prepare = async (times) => {
    await Promise.all([...new Set(times.flatMap(needs))].map((s) => image(s).ready));
    if (cache.size > 500) for (const [k] of cache) { if (cache.size <= 380) break; if (k.startsWith('build/frames')) cache.delete(k); }
  };
  window.seek = seek;
  window.LOOP = LOOP;
  window.BEAT_TIMES = BT.beats.slice();
  window.filmReady = true;

  if (!RENDER) {
    const fit = () => { $('stage').style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
    addEventListener('resize', fit); fit();
    const t0 = performance.now();
    const tick = async () => { const t = ((performance.now() - t0) / 1000) % LOOP; await window.prepare([t]); seek(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
})();
