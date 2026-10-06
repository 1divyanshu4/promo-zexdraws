// Studio launch film (docs/shotlist.md, storyboard in docs/storyboard/). The product is data:
// everything brand- or product-specific comes from product/product.json and footage.json, so a
// different product renders by swapping those (and the files they point at), not this code.
//
// DOM + CSS 3D, driven only by window.seek(t): every property is a pure function of t built
// from lib/motion.js. No CSS transitions, no timers, no state carried between frames.
//
// One object carries the film: the box. It is the blank page in the studio, the window the
// product plays in, the page again when the click target is pressed, the preview in the look
// showcase, and the TikTok window among the post templates, before it folds into the logo.
(async () => {
  'use strict';
  const { spring, settle, track, indicator, pick, clock } = Motion;
  const RENDER = new URLSearchParams(location.search).has('render');
  const $ = (id) => document.getElementById(id);
  const load = (u) => fetch(u).then((r) => r.json());
  const [BT, MAN, P] = await Promise.all([load('beats.json'), load('build/manifest.json'), load('product/product.json')]);

  // ------------------------------------------------------------------ time
  const LOOP = BT.duration;
  const G = BT.sixteenths, NG = G.length;
  const at16 = (j) => (j < NG ? G[Math.max(0, j)] : G[NG - 1] + (j - NG + 1) * (LOOP - G[NG - 1]));
  // Fractional beat -> seconds on the measured grid (16ths are measured peaks).
  const B = (x) => { const q = x * 4, i = Math.floor(q), f = q - i; return at16(i) + (at16(i + 1) - at16(i)) * f; };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const between = (t, a, b) => t >= a && t < b;
  const tr = (t, keys, preset = 'default') => track(t, keys, { preset });
  // Copy from product.json: runs of spaces are kept (they space the "a  ·  b" separators).
  const h = (s) => String(s).replace(/ {2,}/g, (m) => '&nbsp;'.repeat(m.length));

  // ------------------------------------------------------------------ brand
  const BR = P.brand;
  const root = document.documentElement.style;
  root.setProperty('--accent', BR.accent);
  root.setProperty('--display', `'${BR.fonts.display.family}'`);
  root.setProperty('--ui', `'${BR.fonts.ui[0].family}', sans-serif`);
  root.setProperty('--logo', `url(${BR.logo})`);
  const ACC = BR.accent.match(/\w\w/g).map((x) => parseInt(x, 16));
  const accA = (a) => `rgba(${ACC[0]},${ACC[1]},${ACC[2]},${a.toFixed(3)})`;
  const DISPLAY = 'var(--display)', UI = 'var(--ui)';
  const fonts = [new FontFace(BR.fonts.display.family, `url(${BR.fonts.display.src})`),
    ...BR.fonts.ui.map((f) => new FontFace(f.family, `url(${f.src})`, { weight: String(f.weight || 400) }))];
  await Promise.all(fonts.map((f) => f.load().then((ff) => document.fonts.add(ff))));

  // ------------------------------------------------------------------ assets
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
  const STILLS = ['build/studio/nopage.png', 'build/studio/nopage_blur.jpg', P.studio.capture, P.export.button, BR.logo, ...P.panels.map((p) => p.image)];
  await Promise.all(STILLS.map((s) => image(s).ready));
  const natural = (src) => [image(src).img.naturalWidth, image(src).img.naturalHeight];

  // ------------------------------------------------------------------ footage
  const RP = MAN.replay;
  const skip = RP.skip || [Infinity, Infinity];
  const skipLen = Number.isFinite(skip[0]) ? skip[1] - skip[0] : 0;
  const replaySeconds = (u) => { let s = RP.useFrom + u * (RP.useTo - RP.useFrom - skipLen); if (s > skip[0]) s += skipLen; return s; };
  const frameOf = (key, sec) => { const c = MAN.clips[key]; return `${c.dir}/${clamp(Math.round(sec * c.fps), 0, c.frames - 1)}.jpg`; };
  // Replay playhead (a clock, not an easing): every look shares it, so a switch keeps the moment.
  const replayU = (t) => clock(t, [[B(14), 0.06], [B(23), 0.47], [B(27.5), 0.62]]);
  const heroSec = (t) => clamp((t - B(6.3)) / (B(11.8) - B(6.3)), 0, 1) * MAN.clips.hero.duration;
  const LOOK = Object.fromEntries(P.showcase.looks.map((l) => [l.key, l]));
  // When a template's shape differs from the footage, the frame is extended with its own edge
  // colour (top -> bottom), never cropped.
  function paintFootage(c, key, t, W, H) {
    const pad = LOOK[key].pad || ['#000', '#000'];
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pad[0]); g.addColorStop(1, pad[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const f = image(frameOf(key, replaySeconds(replayU(t))));
    if (!f.ok) return;
    const iw = f.img.naturalWidth, ih = f.img.naturalHeight, k = Math.min(W / iw, H / ih);
    c.drawImage(f.img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  }

  // ------------------------------------------------------------------ world (the studio)
  // World units: the capture scaled to 1920 wide, centred on 0. The page is the box's home.
  const [CW, CH] = natural(P.studio.capture), WK = 1920 / CW, WH = CH * WK;
  const wx = (x) => (x - CW / 2) * WK, wy = (y) => (y - CH / 2) * WK;
  const pg = P.studio.page;
  const PAGE = { x0: wx(pg[0]), y0: wy(pg[1]), x1: wx(pg[2]), y1: wy(pg[3]) };
  const PAGE_AR = (pg[2] - pg[0]) / (pg[3] - pg[1]);
  for (const id of ['studio', 'studioBlur', 'studioDim']) Object.assign($(id).style, { left: '-960px', top: `${-WH / 2}px`, width: '1920px', height: `${WH}px` });
  Object.assign($('page').style, { left: `${PAGE.x0}px`, top: `${PAGE.y0}px`, width: `${PAGE.x1 - PAGE.x0}px`, height: `${PAGE.y1 - PAGE.y0}px`, background: P.studio.pageColor || '#fff' });
  Object.assign($('dockMark').style, { left: `${wx(P.studio.dock[0]) - 2}px`, top: `${wy(P.studio.dock[1]) - 2}px` });
  const ck = P.studio.click, CLICK = { x: wx((ck[0] + ck[2]) / 2), y: wy((ck[1] + ck[3]) / 2) };
  Object.assign($('clickHi').style, { left: `${wx(ck[0]) - 2}px`, top: `${wy(ck[1]) - 2}px`, width: `${(ck[2] - ck[0]) * WK + 4}px`, height: `${(ck[3] - ck[1]) * WK + 4}px` });
  // Shot 3 frames the click target at this screen point, at this zoom.
  const FOCUS = [1356, 288], FOCUS_S = 1.9;
  const CAM = [
    // b, s, ry, rx, fx, fy
    [4.5, 0.6, -24, 8, 0, 0],
    [4.6, 0.74, -14, 6, 0, 0],
    [5.0, 1.0, 0, 0, 0, 0],
    [6.0, 1.06, 0, 0, 0, 0],
    [11.75, FOCUS_S, 0, 0, CLICK.x - (FOCUS[0] - 960) / FOCUS_S, CLICK.y - (FOCUS[1] - 540) / FOCUS_S],
    [14.0, 0.62, 0, 0, 0, 0],
  ];
  const camK = ['s', 'ry', 'rx', 'fx', 'fy'];
  const camTrack = camK.map((_, i) => CAM.map((c) => [B(c[0]), c[i + 1]]));
  const cam = (t) => { const o = {}; camK.forEach((k, i) => (o[k] = tr(t, camTrack[i]))); return o; };
  // The page's screen rect under a flat camera (valid once rotations have settled, from beat 5.5).
  const projPage = (c) => ({
    x: 960 + c.s * (PAGE.x0 - c.fx), y: 540 + c.s * (PAGE.y0 - c.fy),
    w: c.s * (PAGE.x1 - PAGE.x0), h: c.s * (PAGE.y1 - PAGE.y0),
  });

  // ------------------------------------------------------------------ the box
  // Free targets (screen rects, outer edge including chrome). Docking to the page is a weight
  // on top, because the page moves with the camera.
  const R = (cx, cy, w, h) => [cx - w / 2, cy - h / 2, w, h];
  const fit = (ar, mw, mh) => (ar > mw / mh ? [mw, mw / ar] : [mh * ar, mh]);
  const [wiw, wih] = fit(PAGE_AR, 700, 758);
  const W2 = R(1368, 540, wiw + 32, wih + 72);       // the product window (shot 2): inner + 16px pad + 40px bar
  const look0 = MAN.clips[P.showcase.looks[0].key];
  const [siw, sih] = fit(look0.width / look0.height, 902, 638);
  const S4 = R(1000, 540, siw, sih);                 // the preview in the showcase
  const E5 = R(960, 470, siw * 0.925, sih * 0.925);  // lifted for the Export button
  const TT = [654, 188, 432, 783];                   // the TikTok window (inner 400 x 711)
  const TTup = R(TT[0] + TT[2] / 2, TT[1] + TT[3] / 2, TT[2] * 1.03, TT[3] * 1.03);
  const CONV = R(960, 540, TT[2] * 0.03, TT[3] * 0.03);
  const BOX_FREE = [[0, W2], [B(14), S4], [B(21.5), E5], [B(23), TT], [B(26.4), TTup], [B(26.75), CONV]];
  const dockW = (t) => tr(t, [[0, 1], [B(6), 0], [B(11.75), 1], [B(14), 0]]);
  const chromeK = (t) => clamp(tr(t, [[0, 0], [B(6), 1], [B(11.75), 0], [B(23), 1]]), 0, 1.02);
  const radius = (t) => Math.max(0, tr(t, [[0, 0], [B(6), 6], [B(11.75), 0], [B(14), 15], [B(23), 6]]));
  const titleAt = (t) => (t < B(18) ? h(P.studio.windowTitle) : 'TikTok');
  const CONV_AT = B(26.75);
  const BOX_ON = [B(6) - 1e-4, CONV_AT + settle('default') + 0.05];

  const LOOKS = P.showcase.looks.map((l, i) => [B(14 + (7.5 * i) / P.showcase.looks.length), l.key]);
  const CONTENT = [[0, 'blank'], [B(6.3), 'hero'], ...LOOKS.map(([b, k]) => [b, 'look:' + k])];
  function paintKey(c, key, t, W, H) {
    if (key === 'blank') { c.fillStyle = P.studio.pageColor || '#fff'; c.fillRect(0, 0, W, H); }
    else if (key === 'hero') {
      c.fillStyle = P.studio.pageColor || '#fff'; c.fillRect(0, 0, W, H);
      const f = image(frameOf('hero', heroSec(t)));
      if (f.ok) c.drawImage(f.img, 0, 0, W, H);
    } else if (key.startsWith('look:')) paintFootage(c, key.slice(5), t, W, H);
  }
  // Content swaps cross behind a short blur (the outgoing look stays under the incoming one).
  function paintFace(canvas, t, w, hh) {
    const W = Math.max(2, Math.round(w)), H = Math.max(2, Math.round(hh));
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const c = canvas.getContext('2d');
    let ci = CONTENT.length - 1;
    while (ci > 0 && CONTENT[ci][0] > t) ci--;
    const since = t - CONTENT[ci][0], cur = CONTENT[ci][1], prev = ci ? CONTENT[ci - 1][1] : cur;
    const k = ci ? spring(since, 'snappy') : 1;
    if (prev !== cur && k < 0.999) { c.save(); c.filter = `blur(${(k * 16).toFixed(1)}px)`; paintKey(c, prev, t, W, H); c.restore(); }
    c.save();
    if (k < 0.97) { c.globalAlpha = k; c.filter = `blur(${((1 - k) * 12).toFixed(1)}px)`; }
    paintKey(c, cur, t, W, H);
    c.restore();
  }

  // ------------------------------------------------------------------ HUD helpers
  const hud = $('hud');
  function el(tag, cls, style, html, parent = hud) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) Object.assign(e.style, style);
    if (html !== undefined) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  }
  // Rendered width of a line of text (layout read once, at load).
  function measure(html, font, cls = '') {
    const m = el('span', cls, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', ...(font ? { font } : {}) }, html);
    const w = m.getBoundingClientRect().width; m.remove(); return w;
  }
  // A masked vertical strip. pos -1 = blank (below), 0.. = lines; exit 0..1 lifts the whole
  // line up and out through an outer mask, so nothing behind it is revealed on the way out.
  function strip(parent, x, y, w, hh, lines, cls) {
    const outer = el('div', 'mask', { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px` }, undefined, parent);
    const inner = el('div', 'mask', { left: '0', top: '0', width: `${w}px`, height: `${hh}px` }, undefined, outer);
    const col = el('div', cls, { position: 'absolute', left: '0', top: '0' }, undefined, inner);
    for (const l of ['', ...lines]) el('div', '', { height: `${hh}px`, lineHeight: `${hh}px`, whiteSpace: 'nowrap' }, String(l), col);
    return ([pos, exit]) => {
      col.style.transform = `translateY(${(-(pos + 1) * hh).toFixed(2)}px)`;
      inner.style.transform = `translateY(${(-exit * hh * 1.05).toFixed(2)}px)`;
    };
  }
  // Enter from below at tIn, roll through `steps` ([time, pos]), lift out by tOut (or never).
  function stripTrack(tIn, steps, tOut, preset = 'heavy', exitPreset = preset) {
    const keys = [[-1, -1], [tIn, 0], ...steps];
    const exitAt = tOut === undefined ? Infinity : tOut - settle(exitPreset) - 0.01;
    return (t) => [track(t, keys, { preset }), clamp(spring(t - exitAt, exitPreset), 0, 1)];
  }
  const block = () => el('div', '', { position: 'absolute', inset: '0' });

  // ------------------------------------------------------------------ shots 1a-1c: panels
  // Three panels, alternating sides: right, left, right. Each is shown at its capture size,
  // capped to 640 x 860 so it fits the frame beside its label.
  const pcam = $('pcam');
  const SLOT = [{ cx: 1365, ry: -14, side: 1, lx: 150 }, { cx: 576, ry: 14, side: -1, lx: 1130 }, { cx: 1356, ry: -14, side: 1, lx: 150 }];
  const PANELS = P.panels.slice(0, 3).map((cfg, i) => {
    const [nw, nh] = natural(cfg.image), k = Math.min(1, 640 / nw, 860 / nh);
    const w = nw * k, hh = nh * k, s = SLOT[i];
    return { src: cfg.image, x: s.cx - w / 2, y: 540 - hh / 2, w, h: hh, ry: s.ry, side: s.side, lx: s.lx, b0: 1.5 * i, b1: 1.5 * (i + 1), name: cfg.name, sub: h(cfg.detail) };
  });
  PANELS.forEach((p, i) => {
    p.el = el('img', 'panel', { left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.h}px` }, undefined, pcam);
    p.el.src = p.src;
    // Shots overlap: each panel arrives a hair before its beat (the first is already moving on
    // frame 0) and the previous one leaves on the same instant, outward to its own side.
    p.t0 = i ? B(p.b0) - 0.08 : -0.12;
    p.tOut = i < 2 ? B(p.b1) - 0.08 : Infinity;
    p.dx = [[-1, (i ? 760 : 260) * p.side], [p.t0, 0], ...(i < 2 ? [[p.tOut, 1150 * p.side, 'snappy']] : [])];
    p.ryK = [[-1, p.ry * 3.4], [p.t0, p.ry], ...(i < 2 ? [[p.tOut, p.ry * 3, 'snappy']] : [])];
    p.on = [i ? p.t0 : 0, i < 2 ? p.tOut + settle('heavy') + 0.02 : B(p.b1) + settle('heavy') + 0.02];
    p.hud = block();
    p.eyebrow = strip(p.hud, p.lx, 380, 400, 24, [`<span class="eyebrow"><b>0${i + 1}</b>/03&nbsp;&nbsp;&nbsp;&nbsp;${h(P.panelEyebrow)}</span>`], '');
    p.title = strip(p.hud, p.lx - 6, 408, 640, 150, [p.name], 'name');
    p.subl = strip(p.hud, p.lx, 566, 640, 32, [`<span class="row">${p.sub}</span>`], '');
    // Labels stay on screen longer and lift out cleanly with the handover at p.tOut.
    const tin = Math.max(0, p.t0), out = (i < 2 ? p.tOut : B(p.b1) - 0.08) - 0.03 + settle('snappy') + 0.01;
    p.ePos = stripTrack(tin + 0.02, [], out, 'snappy', 'snappy');
    p.tPos = stripTrack(tin + 0.04, [], out + 0.02, 'snappy', 'snappy');
    p.sPos = stripTrack(tin + 0.08, [], out + 0.04, 'snappy', 'snappy');
  });
  const RAIL_T = B(4.5);

  // ------------------------------------------------------------------ shot 2 copy
  const HC = P.hero;
  const s2 = block();
  const s2eyebrow = strip(s2, 258, 385, 600, 24, [`<span class="eyebrow">${h(HC.eyebrow)}</span>`], '');
  const s2title = strip(s2, 250, 406, 760, 150, [`<span style="font:112px/150px ${DISPLAY}">${h(HC.title)}</span>`], '');
  const ruleW = Math.min(620, Math.max(360, measure(h(HC.title), `112px ${DISPLAY}`) + 90));
  const s2rule = el('div', '', { position: 'absolute', left: '258px', top: '561px', width: `${ruleW}px`, height: '3px', borderRadius: '2px', background: 'var(--accent)', transformOrigin: '0 50%' }, undefined, s2);
  const s2lines = HC.lines.slice(0, 2).map((l, i) => strip(s2, 256, 585 + 54 * i, 700, 54, [`<span style="font:600 38px/54px ${UI};letter-spacing:-.01em${i ? ';color:var(--muted)' : ''}">${h(l)}</span>`], ''));
  const S2_OUT = B(12); // the camera leaves for the click target a sixteenth earlier (beat 11.75)
  const s2Pos = [stripTrack(B(6.25), [], S2_OUT + 0.12, 'snappy'), stripTrack(B(6.5), [], S2_OUT + 0.08, 'heavy', 'snappy'),
    stripTrack(B(8), [], S2_OUT + 0.14, 'heavy', 'snappy'), stripTrack(B(9.5), [], S2_OUT + 0.18, 'heavy', 'snappy')];
  const s2RuleK = (t) => tr(t, [[0, 0], [B(6.75), 1], [S2_OUT - 0.2, 0, 'snappy']]);

  // ------------------------------------------------------------------ shot 4 showcase HUD
  const SC = P.showcase, NL = SC.looks.length;
  const lookAt = (t) => pick(t, [[0, SC.looks[0].key], ...LOOKS]);
  const S4_IN = B(14), S4_OUT = B(21.5);
  // Names roll only when the name changes (several looks may share one frame name).
  const NAMES = [], nameIdx = SC.looks.map((l) => { if (NAMES.at(-1) !== l.name) NAMES.push(l.name); return NAMES.length - 1; });
  const nameSteps = LOOKS.slice(1).map((l, i) => [l[0], nameIdx[i + 1]]).filter((s, i) => nameIdx[i + 1] !== nameIdx[i]);
  const lookName = strip(hud, 92, 462, 640, 120, NAMES.map(h), 'name');
  const lookNamePos = stripTrack(S4_IN + 0.06, nameSteps, S4_OUT + 0.06, 'heavy', 'snappy');
  const eyebrow = strip(hud, 98, 430, 300, 24, [`<span class="eyebrow">${h(SC.eyebrow)}</span>`], '');
  const eyebrowPos = stripTrack(S4_IN + 0.04, [], S4_OUT + 0.04, 'heavy', 'snappy');
  const cx0 = 98 + measure(h(SC.eyebrow), null, 'eyebrow') + 18;
  const counter = strip(hud, cx0, 430, 90, 24, SC.looks.map((_, n) => `<span class="eyebrow"><b>${String(n + 1).padStart(2, '0')}</b>/${String(NL).padStart(2, '0')}</span>`), '');
  const counterPos = stripTrack(S4_IN + 0.04, LOOKS.slice(1).map((l, i) => [l[0], i + 1]), S4_OUT + 0.04, 'snappy');
  const nameW = NAMES.map((n) => measure(h(n), `100px ${DISPLAY}`) + 50);
  const underline = el('div', '', { position: 'absolute', left: '98px', top: '596px', height: '3px', borderRadius: '2px' });
  const DOT_X = (i) => 106 + i * 38, DOT_Y = 640;
  const dots = SC.looks.map((l, i) => el('div', '', { position: 'absolute', left: `${DOT_X(i) - 7}px`, top: `${DOT_Y - 7}px`, width: '14px', height: '14px', borderRadius: '7px', background: l.hex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)' }));
  const ring = el('div', '', { position: 'absolute', top: `${DOT_Y - 13}px`, height: '26px', border: '2px solid var(--accent)', borderRadius: '13px', boxSizing: 'border-box' });
  const RING_STOPS = LOOKS.map((l, i) => [l[0], DOT_X(i) - 13, DOT_X(i) + 13]);
  const RX = 1496;
  const tokEyebrow = strip(hud, RX, 470, 300, 24, [`<span class="eyebrow">${h(SC.tokens)}</span>`], '');
  const tokFrame = strip(hud, RX, 508, 400, 38, NAMES.map((n) => `<span class="row">${h(SC.tokenName)}&nbsp;&nbsp;<span class="v">${h(n)}</span></span>`), '');
  const tokColour = strip(hud, RX, 550, 400, 38, SC.looks.map((l) => `<span class="row"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;background:${l.hex};box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)"></span>&nbsp;&nbsp;${h(SC.tokenColour)}&nbsp;&nbsp;<span class="v">${l.hex}</span></span>`), '');
  const tokEyebrowPos = stripTrack(S4_IN + 0.06, [], S4_OUT + 0.04, 'snappy');
  const tokFramePos = stripTrack(S4_IN + 0.12, nameSteps, S4_OUT + 0.07, 'snappy');
  const tokColourPos = stripTrack(S4_IN + 0.18, LOOKS.slice(1).map((l, i) => [l[0], i + 1]), S4_OUT + 0.1, 'snappy');
  const ulKeys = [[0, 0], [S4_IN + 0.1, nameW[0]], ...nameSteps.map(([tt, n]) => [tt, nameW[n]]), [S4_OUT - settle('snappy'), 0]];

  // ------------------------------------------------------------------ shot 6 post windows
  const PO = P.posts;
  const posts = $('posts');
  const CTL = '<svg width="96" height="12" viewBox="0 0 96 12" fill="none" stroke="#9F9EA1" stroke-width="1.3"><path d="M2 6h10"/><rect x="42.5" y=".5" width="11" height="11"/><path d="M84 .5l11 11M95 .5l-11 11"/></svg>';
  function win(parent, rect, title) {
    const w = el('div', 'win', { left: `${rect[0]}px`, top: `${rect[1]}px`, width: `${rect[2]}px`, height: `${rect[3]}px`, borderRadius: '6px' }, undefined, parent);
    el('div', 'tb', null, `<span class="title">${title}</span>${CTL}`, w);
    const inner = el('div', 'inner', { left: '16px', top: '56px', width: `${rect[2] - 32}px`, height: `${rect[3] - 72}px`, background: '#000' }, undefined, w);
    return { el: w, inner, rect };
  }
  $('box').querySelector('.tb').insertAdjacentHTML('beforeend', CTL);
  const handle = h(BR.handle), nm = h(BR.name);

  // Instagram post (4:5).
  const IG = win(posts, [154, 180, 452, 799], 'Instagram');
  IG.inner.innerHTML = `
    <div class="plat" style="left:0;top:0;width:420px;height:56px;background:#000">
      <span class="av" style="left:12px;top:10px;width:36px;height:36px;box-shadow:0 0 0 2px #000,0 0 0 4px #5b5a5e"></span>
      <span class="plat" style="left:60px;top:10px;font:600 14px ${UI}">${handle}</span>
      <span class="plat" style="left:60px;top:29px;font:500 12px ${UI};color:#d6d6d6">Original audio</span>
      <svg class="plat" style="left:386px;top:25px" width="20" height="6" viewBox="0 0 20 6" fill="#fff"><circle cx="3" cy="3" r="2"/><circle cx="10" cy="3" r="2"/><circle cx="17" cy="3" r="2"/></svg>
    </div>
    <canvas class="plat" id="igMedia" style="left:0;top:56px;width:420px;height:525px"></canvas>
    <div class="plat" style="left:0;top:581px;width:420px;height:146px;background:#000">
      <svg class="plat" style="left:12px;top:12px" width="400" height="26" viewBox="0 0 400 26" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
        <path d="M13 23S2 16 2 9a5.5 5.5 0 0 1 11-2 5.5 5.5 0 0 1 11 2c0 7-11 14-11 14z"/><path d="M58 22.5l-6 1.5 1.5-5A10 10 0 1 1 58 22.5z"/><path d="M84 3l22 0-12 21-2-9z M92 15l14-12"/><path d="M380 3h14v21l-7-6-7 6z"/></svg>
      <div class="plat" style="left:14px;top:48px;font:600 14px ${UI}"><span id="igLikes"></span> likes</div>
      <div class="plat" style="left:14px;top:70px;width:392px;font:500 14px/19px ${UI}"><b style="font-weight:600">${handle}</b> ${h(PO.instagram.caption)}</div>
      <div class="plat" style="left:14px;top:112px;font:500 13px ${UI};color:#a8a8a8">View all ${PO.instagram.comments} comments</div>
    </div>`;
  // YouTube watch page (16:9).
  const YT = win(posts, [1134, 238, 632, 604], 'YouTube');
  YT.inner.style.background = '#0f0f0f';
  YT.inner.innerHTML = `
    <canvas class="plat" id="ytMedia" style="left:0;top:0;width:600px;height:338px"></canvas>
    <div class="plat" style="left:0;top:258px;width:600px;height:80px;background:linear-gradient(transparent,rgba(0,0,0,.7))"></div>
    <div class="plat" style="left:12px;top:302px;width:576px;height:3px;background:rgba(255,255,255,.3)"><div id="ytBar" style="width:47%;height:3px;background:#f00"></div></div>
    <div class="plat" id="ytDot" style="left:279px;top:297px;width:13px;height:13px;border-radius:7px;background:#f00"></div>
    <svg class="plat" style="left:14px;top:314px" width="190" height="18" viewBox="0 0 190 18" fill="#fff"><path d="M2 1v16h4V1zM10 1v16h4V1z"/><path d="M28 2l10 7-10 7z M40 2h2.5v14H40z"/><path d="M54 6h4l5-4v14l-5-4h-4z"/></svg>
    <div class="plat" style="left:94px;top:314px;font:500 13px/18px ${UI}"><span id="ytTime">0:14</span> / 0:30</div>
    <svg class="plat" style="left:506px;top:314px" width="80" height="18" viewBox="0 0 80 18" fill="none" stroke="#fff" stroke-width="2"><circle cx="9" cy="9" r="3"/><path d="M9 1v3M9 14v3M1 9h3M14 9h3"/><path d="M62 2h-5v5M74 2h5v5M62 16h-5v-5M74 16h5v-5"/></svg>
    <div class="plat" style="left:14px;top:350px;width:572px;font:700 18px/24px ${UI};color:#f1f1f1">${h(PO.youtube.title)}</div>
    <div class="plat" style="left:14px;top:408px;width:572px;height:40px">
      <span class="av" style="left:0;top:2px;width:36px;height:36px"></span>
      <span class="plat" style="left:48px;top:2px;font:600 15px ${UI};color:#f1f1f1;white-space:nowrap">${nm}</span>
      <span class="plat" style="left:48px;top:22px;font:500 12px ${UI};color:#aaa;white-space:nowrap">${h(PO.youtube.subscribers)} subscribers</span>
      <span class="plat" style="left:176px;top:2px;height:36px;padding:0 16px;border-radius:18px;background:#f1f1f1;color:#0f0f0f;font:600 14px/36px ${UI}">Subscribe</span>
      <span class="plat" style="left:446px;top:2px;width:126px;height:36px;border-radius:18px;background:#272727;color:#f1f1f1;font:600 14px/36px ${UI};text-align:center;white-space:nowrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" stroke-width="2" style="vertical-align:-3px"><path d="M7 10v11H3V10zM7 10l4-8c2 0 3 1 3 3v4h6c1.2 0 2 1 1.8 2.2l-1.6 8A2 2 0 0 1 18.2 21H7"/></svg>&nbsp; <span id="ytLikes"></span>&nbsp;&nbsp;<span style="color:#555">|</span>&nbsp;&nbsp;<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" stroke-width="2" style="vertical-align:-5px;transform:scaleY(-1)"><path d="M7 10v11H3V10zM7 10l4-8c2 0 3 1 3 3v4h6c1.2 0 2 1 1.8 2.2l-1.6 8A2 2 0 0 1 18.2 21H7"/></svg></span>
    </div>
    <div class="plat" style="left:14px;top:460px;width:572px;height:58px;border-radius:12px;background:#272727;padding:10px 12px;box-sizing:border-box;font:600 13px/19px ${UI};color:#f1f1f1;white-space:nowrap;overflow:hidden">${h(PO.youtube.views)}<br><span style="font-weight:500;color:#d0d0d0">${h(PO.youtube.description)}</span></div>`;
  // TikTok UI over the box (the box is the video). Laid out for a 400 x 711 inner.
  const ttui = $('ttui');
  ttui.style.width = '400px'; ttui.style.height = '711px'; ttui.style.transformOrigin = '0 0';
  const ttc = PO.tiktok.counts;
  ttui.innerHTML = `
    <div class="plat" style="left:0;top:0;width:400px;height:110px;background:linear-gradient(rgba(0,0,0,.45),transparent)"></div>
    <div class="plat" style="left:0;top:541px;width:400px;height:170px;background:linear-gradient(transparent,rgba(0,0,0,.65))"></div>
    <div class="plat" style="left:0;width:400px;top:18px;text-align:center;font:600 16px ${UI};color:rgba(255,255,255,.65)">Following&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#fff">For You</span></div>
    <div class="plat" style="left:226px;top:44px;width:26px;height:3px;border-radius:2px;background:#fff"></div>
    <svg class="plat" style="left:364px;top:18px" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="2.2"><circle cx="8.5" cy="8.5" r="6.5"/><path d="M13.5 13.5L19 19"/></svg>
    <div class="plat" style="left:338px;top:330px;width:50px;text-align:center;font:600 12px ${UI}">
      <div style="width:46px;height:46px;margin:0 auto;border-radius:23px;box-shadow:0 0 0 2px #fff;background:var(--logo) center/cover"></div>
      <div style="width:20px;height:20px;margin:-10px auto 0;border-radius:10px;background:#FE2C55;font:700 16px/20px ${UI};position:relative">+</div>
      <svg style="margin-top:14px" width="36" height="32" viewBox="0 0 24 22" fill="#fff"><path d="M12 21S1 14 1 7a5.5 5.5 0 0 1 11-2 5.5 5.5 0 0 1 11 2c0 7-11 14-11 14z"/></svg><div id="ttLikes" style="margin-top:2px"></div>
      <svg style="margin-top:12px" width="34" height="32" viewBox="0 0 24 22" fill="#fff"><path d="M12 1C5.9 1 1 5.2 1 10.3c0 3 1.6 5.6 4.2 7.3L4.5 21l4.4-2.2c1 .3 2 .4 3.1.4 6.1 0 11-4.2 11-9.3S18.1 1 12 1z"/></svg><div>${ttc[0]}</div>
      <svg style="margin-top:12px" width="28" height="32" viewBox="0 0 18 22" fill="#fff"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h13A1.5 1.5 0 0 1 17 2.5V21l-8-5.5L1 21z"/></svg><div>${ttc[1]}</div>
      <svg style="margin-top:12px" width="34" height="30" viewBox="0 0 24 20" fill="#fff"><path d="M13 1l10 9-10 9v-5.5C6 13.5 3 16 1 19c.5-7 4.5-12 12-12.5z"/></svg><div>${ttc[2]}</div>
    </div>
    <div class="plat" style="left:16px;top:610px;width:310px">
      <div style="font:600 16px ${UI}">@${handle}</div>
      <div style="font:500 14px/19px ${UI};margin-top:6px">${h(PO.tiktok.caption)}</div>
      <div style="font:500 13px ${UI};margin-top:8px">&#9835;&nbsp; original sound - ${handle}</div>
    </div>
    <div class="plat" style="left:0;top:708px;width:400px;height:3px;background:rgba(255,255,255,.25)"><div id="ttBar" style="width:46%;height:3px;background:#fff"></div></div>`;
  const POST_IN = { ig: B(23.25), yt: B(23.5) };
  const postHead = strip(hud, 0, 52, 1920, 70, [`<div style="width:1920px;text-align:center;font:600 46px/70px ${UI};letter-spacing:-.01em">${h(PO.heading)}</div>`], '');
  const postHeadPos = stripTrack(B(23.2), [], CONV_AT + 0.05, 'heavy', 'snappy');
  const count = (t, [from, to], fmt) => fmt(tr(t, [[0, from], [B(23.4), to]], 'heavy'));
  // Player progress is a playhead (constant speed), not an easing.
  const playU = (t) => clock(t, [[B(23), 0], [B(27), 1]]);
  const kfmt = (v) => `${v.toFixed(1)}K`;
  const nfmt = (v) => Math.round(v).toLocaleString('en-US');

  // ------------------------------------------------------------------ export button
  const [bw, bh] = natural(P.export.button).map((v) => v * 0.6); // a 2x capture at 1.2x UI size
  const btn = $('exportBtn');
  btn.src = P.export.button;
  Object.assign(btn.style, { width: `${bw}px`, height: `${bh}px` });

  // ------------------------------------------------------------------ cursor
  const CUR = [
    // [time, x, y] tip positions; the cursor is shown inside its spans.
    // Each glide settles (one default spring, ~0.47 s) just before its click.
    [B(11.85), 1560, 760], [B(11.95), FOCUS[0], FOCUS[1]],
    [B(21.4), 1420, 1010], [B(21.5), 960 + bw * 0.13, 840 + bh * 0.56],
  ];
  const curX = (t) => tr(t, CUR.map((c) => [c[0], c[1]]), 'default');
  const curY = (t) => tr(t, CUR.map((c) => [c[0], c[2]]), 'default');
  const CUR_ON = [[B(11.85), B(14) + 0.05], [B(21.4), B(23) + 0.1]];
  const press = (t, at) => tr(t, [[0, 1], [at, 0.86], [at + 0.09, 1]], 'snappy');

  // ------------------------------------------------------------------ lockup
  // Logo tile, accent slash, wordmark: one group, centred on its measured width.
  const wmW = measure(nm, `150px ${DISPLAY}`), L0 = 960 - (242 + wmW) / 2;
  const logo = el('img', '', { position: 'absolute', left: '0', top: '0', width: '300px', borderRadius: '23%' });
  logo.src = BR.logo;
  const WM = el('div', 'mask', { left: `${L0 + 242}px`, top: '360px', width: `${wmW + 60}px`, height: '210px' });
  const wmText = el('div', '', { position: 'absolute', left: 0, top: 0, font: `150px/210px ${DISPLAY}`, whiteSpace: 'nowrap' }, nm, WM);
  const slash = el('div', '', { position: 'absolute', left: `${L0 + 191}px`, top: '388px', width: '10px', height: '150px', background: 'var(--accent)', borderRadius: '5px', transformOrigin: '50% 100%' });
  const tagline = strip(hud, 260, 600, 1400, 70, [`<div style="font:600 52px/70px ${UI};letter-spacing:-0.01em;text-align:center;width:1400px">${h(BR.tagline)}</div>`], '');
  const pill = BR.pill ? strip(hud, 660, 694, 600, 44, [`<div style="width:600px;text-align:center"><span style="display:inline-block;font:500 15px/34px ${UI};letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);padding:0 18px;border-radius:17px;background:#141316;box-shadow:inset 0 0 0 1px var(--hair)">${h(BR.pill)}</span></div>`], '') : null;
  const L_IN = B(27) + 0.12;
  const logoReveal = (t) => tr(t, [[0, 0], [L_IN, 1]], 'heavy');
  const logoMove = (t) => tr(t, [[0, 0], [B(28), 1]], 'heavy');
  const wmK = (t) => tr(t, [[0, 0], [B(28) + 0.06, 1]], 'heavy');
  const slashK = (t) => tr(t, [[0, 0], [B(28), 1]], 'snappy');
  const taglinePos = stripTrack(B(28) + 0.2, []);
  const pillPos = BR.pill ? stripTrack(B(28) + 0.36, []) : null;
  const spotK = (t) => tr(t, [[0, 0], [B(27), 1]], 'heavy');

  // ------------------------------------------------------------------ grain (seeded, per frame)
  const rng = (seed) => () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32
  const grainTiles = Array.from({ length: 8 }, (_, i) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d'), id = g.createImageData(256, 256), r = rng(1000 + i);
    for (let p = 0; p < 256 * 256; p++) { const v = Math.floor(r() * 7); id.data[p * 4] = id.data[p * 4 + 1] = id.data[p * 4 + 2] = v; id.data[p * 4 + 3] = 255; }
    g.putImageData(id, 0, 0);
    return cv;
  });
  const grainCtx = $('grain').getContext('2d');

  // ------------------------------------------------------------------ seek
  const show = (e, on) => { e.style.visibility = on ? 'visible' : 'hidden'; };
  function setRect(e, x, y, w, hh) { e.style.left = `${x}px`; e.style.top = `${y}px`; e.style.width = `${w}px`; e.style.height = `${hh}px`; }
  // Converge: everything on screen at the end of the posts folds into the centre (the logo's seed).
  const convK = (t) => clamp(spring(t - CONV_AT, 'default'), 0, 1);
  const anticip = (t) => tr(t, [[0, 1], [B(26.4), 1.03], [CONV_AT, 1]]);

  function seek(tRaw) {
    const t = clamp(tRaw, 0, LOOP);

    // The studio (world).
    const c = cam(t);
    const rig = $('rig');
    show(rig, between(t, RAIL_T - 1e-4, B(14) + settle('heavy')));
    rig.style.transform = `translate(960px, 540px) scale(${c.s.toFixed(5)}) rotateY(${c.ry.toFixed(3)}deg) rotateX(${c.rx.toFixed(3)}deg) translate(${(-c.fx).toFixed(2)}px, ${(-c.fy).toFixed(2)}px)`;
    show($('page'), between(t, RAIL_T - 1e-4, BOX_ON[0]));
    const blurK = tr(t, [[0, 0], [B(6), 1], [B(11.75), 0], [B(14), 1]]);
    $('studioBlur').style.opacity = clamp(blurK, 0, 1).toFixed(3);
    $('studioDim').style.opacity = clamp(tr(t, [[0, 0], [B(6), 0.45], [B(11.75), 0], [B(14), 1]], 'heavy'), 0, 1).toFixed(3);
    const hiK = clamp(tr(t, [[0, 0], [B(12.6), 1], [B(14), 0]], 'snappy'), 0, 1), prK = clamp(spring(t - B(13), 'snappy'), 0, 1);
    const hi = $('clickHi');
    hi.style.background = accA(0.16 * hiK + 0.22 * prK * hiK);
    hi.style.boxShadow = `inset 0 0 0 ${(2 * hiK).toFixed(2)}px ${accA(hiK)}`;
    hi.style.transform = `scale(${press(t, B(13)).toFixed(4)})`;

    // Shots 1a-1c: one panel per shot, each handing over to the next on the beat.
    const back = $('backdrop');
    const backK = t >= RAIL_T ? 1 - spring(t - RAIL_T, 'snappy') : 1;
    show(back, backK > 0.002);
    back.style.opacity = backK.toFixed(3);
    back.style.transform = `scale(${(1 + 0.012 * t).toFixed(4)})`;
    PANELS.forEach((p, i) => {
      const last = i === PANELS.length - 1;
      const on = between(t, p.on[0], p.on[1]);
      show(p.el, on); show(p.hud, on);
      if (!on) return;
      const drift = (t - p.t0) * 3 * p.side; // constant-speed drift while the panel holds
      let ry = tr(t, p.ryK) + drift, dx = tr(t, p.dx), sc = tr(t, [[-1, 0.9], [p.t0, 1]]), tx = 0, ty = 0;
      if (last && t >= RAIL_T) {
        // The last panel folds into its button in the studio as the studio comes up.
        const m = $('dockMark').getBoundingClientRect(), st = $('stage').getBoundingClientRect(), f = 1920 / st.width;
        const q = spring(t - RAIL_T, 'default');
        tx = ((m.left + m.width / 2 - st.left) * f - (p.x + p.w / 2)) * q;
        ty = ((m.top + m.height / 2 - st.top) * f - (p.y + p.h / 2)) * q;
        sc *= lerp(1, 0.04, q); ry = lerp(ry, 0, q);
      }
      p.el.style.transform = `translate(${(dx + tx).toFixed(1)}px, ${ty.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
      p.eyebrow(p.ePos(t)); p.title(p.tPos(t)); p.subl(p.sPos(t));
    });

    // The box.
    const box = $('box');
    const boxOn = between(t, BOX_ON[0], BOX_ON[1]);
    show(box, boxOn);
    if (boxOn) {
      const free = tr(t, BOX_FREE);
      const pp = projPage(c), dw = clamp(dockW(t), 0, 1);
      const [x, y, w, hh] = [lerp(free[0], pp.x, dw), lerp(free[1], pp.y, dw), lerp(free[2], pp.w, dw), lerp(free[3], pp.h, dw)];
      const k = chromeK(t), tb = 40 * k, pad = 16 * k;
      setRect(box, x, y, w, hh);
      box.style.borderRadius = `${radius(t).toFixed(2)}px`;
      box.style.transform = `scale(${anticip(t).toFixed(4)})`;
      box.style.background = k > 0.01 ? 'var(--win)' : 'transparent';
      const bar = box.querySelector('.tb');
      bar.style.height = `${tb.toFixed(2)}px`;
      bar.style.opacity = clamp(k, 0, 1).toFixed(3);
      bar.querySelector('.title').innerHTML = titleAt(t);
      const inner = box.querySelector('.inner');
      const iw = Math.max(2, w - 2 * pad), ih = Math.max(2, hh - tb - 2 * pad);
      setRect(inner, pad, tb + pad, iw, ih);
      inner.style.boxShadow = k > 0.01 ? '0 0 0 1px var(--hair)' : 'none';
      paintFace($('face'), t, iw, ih);
      // TikTok UI rides the box's inner rect.
      const ttK = clamp(tr(t, [[0, 0], [B(23.3), 1], [CONV_AT, 0]], 'snappy'), 0, 1);
      show(ttui, ttK > 0.002);
      if (ttK > 0.002) {
        ttui.style.transform = `translate(${(x + pad).toFixed(1)}px, ${(y + tb + pad + (1 - ttK) * 18).toFixed(1)}px) scale(${(iw / 400).toFixed(4)}, ${(ih / 711).toFixed(4)})`;
        ttui.style.opacity = ttK.toFixed(3);
        $('ttLikes').textContent = count(t, PO.tiktok.likes, kfmt);
        $('ttBar').style.width = `${(46 + 30 * playU(t)).toFixed(1)}%`;
      }
    } else show(ttui, false);

    // Shot 2 copy.
    show(s2, between(t, B(6), S2_OUT + 0.2));
    [s2eyebrow, s2title, ...s2lines].forEach((f, i) => f(s2Pos[i](t)));
    s2rule.style.transform = `scaleX(${clamp(s2RuleK(t), 0, 1).toFixed(4)})`;

    // Shot 4 showcase HUD.
    lookName(lookNamePos(t)); eyebrow(eyebrowPos(t)); counter(counterPos(t));
    const info = LOOK[lookAt(t)];
    const carouselOn = between(t, S4_IN, S4_OUT);
    const ulW = carouselOn ? track(t, ulKeys, { preset: 'snappy' }) : 0;
    underline.style.width = `${Math.max(0, ulW).toFixed(1)}px`;
    underline.style.background = info.rule || info.hex;
    const dotK = (i) => (carouselOn ? tr(t, [[0, 0], [S4_IN + 0.08 + i * 0.04, 1], [S4_OUT - settle('snappy') - 0.02, 0]], 'snappy') : 0);
    dots.forEach((d, i) => { d.style.transform = `scale(${Math.max(0, dotK(i)).toFixed(3)})`; });
    const [ra, rb] = indicator(t, RING_STOPS);
    ring.style.left = `${ra}px`; ring.style.width = `${Math.max(0, rb - ra)}px`;
    ring.style.transform = `scale(${Math.max(0, dotK(0)).toFixed(3)})`;
    tokEyebrow(tokEyebrowPos(t)); tokFrame(tokFramePos(t)); tokColour(tokColourPos(t));

    // Shot 5 Export button.
    const bK = clamp(tr(t, [[0, 0], [B(21.75), 1], [B(23), 0]], 'snappy'), 0, 1.02);
    show(btn, bK > 0.002);
    btn.style.transform = `translate(${960 - bw / 2}px, ${840 - bh / 2}px) scale(${(bK * press(t, B(22.5))).toFixed(4)})`;

    // Shot 6 post windows.
    postHead(postHeadPos(t));
    const cv = convK(t), an = anticip(t);
    for (const [PW, key, from, look, W, H] of [[IG, 'ig', -760, PO.instagram.look, 420, 525], [YT, 'yt', 820, PO.youtube.look, 600, 338]]) {
      const on = between(t, POST_IN[key] - 0.01, BOX_ON[1]);
      show(PW.el, on);
      if (!on) continue;
      const k = spring(t - POST_IN[key], 'default');
      const cx = PW.rect[0] + PW.rect[2] / 2, cy = PW.rect[1] + PW.rect[3] / 2;
      const dx = (1 - k) * from + cv * (960 - cx), dy = cv * (540 - cy);
      PW.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(an * lerp(1, 0.03, cv)).toFixed(4)})`;
      const m = $(key === 'ig' ? 'igMedia' : 'ytMedia');
      if (m.width !== W) { m.width = W; m.height = H; }
      paintFootage(m.getContext('2d'), look, t, W, H);
    }
    $('igLikes').textContent = count(t, PO.instagram.likes, nfmt);
    $('ytLikes').textContent = count(t, PO.youtube.likes, kfmt);
    { const u = playU(t); $('ytBar').style.width = `${47 + 20 * u}%`; $('ytDot').style.left = `${279 + 115 * u}px`; $('ytTime').textContent = `0:${String(14 + Math.floor(u * 6)).padStart(2, '0')}`; }

    // Cursor.
    const cur = $('cursor');
    const curOn = CUR_ON.some(([a, b]) => between(t, a, b));
    show(cur, curOn);
    if (curOn) {
      const pr = t < B(16) ? press(t, B(13)) : press(t, B(22.5));
      cur.style.transform = `translate(${(curX(t) - 7.7).toFixed(1)}px, ${(curY(t) - 3.8).toFixed(1)}px) scale(${pr.toFixed(4)})`;
    }

    // Lockup.
    const rv = clamp(logoReveal(t), 0, 1), mv = logoMove(t);
    const lw = lerp(260, 168, mv);
    logo.style.width = `${lw}px`;
    logo.style.transform = `translate(${lerp(960, L0 + 84, mv) - lw / 2}px, ${lerp(540, 466, mv) - lw / 2}px)`;
    logo.style.clipPath = `circle(${(rv * 72).toFixed(2)}% at 50% 50%)`;
    show(logo, rv > 0.002);
    wmText.style.transform = `translateX(${(-(1 - clamp(wmK(t), 0, 1)) * (wmW + 200)).toFixed(1)}px)`;
    slash.style.transform = `rotate(18deg) scaleY(${clamp(slashK(t), 0, 1).toFixed(3)})`;
    tagline(taglinePos(t)); if (pill) pill(pillPos(t));
    $('spot').style.opacity = clamp(spotK(t), 0, 1).toFixed(3);

    // Grain: tile chosen by frame number (seeded), drawn unscaled.
    const fi = Math.floor(t * 60 + 1e-6);
    const tile = grainTiles[fi % 8], ox = (fi * 97) % 256, oy = (fi * 53) % 256;
    grainCtx.clearRect(0, 0, 1920, 1080);
    for (let y = -oy; y < 1080; y += 256) for (let x = -ox; x < 1920; x += 256) grainCtx.drawImage(tile, x, y);
  }

  // ------------------------------------------------------------------ API
  function needs(tRaw) {
    const t = clamp(tRaw, 0, LOOP), out = [];
    let ci = CONTENT.length - 1;
    while (ci > 0 && CONTENT[ci][0] > t) ci--;
    for (const k of [CONTENT[ci][1], CONTENT[Math.max(0, ci - 1)][1]]) {
      if (k === 'hero') out.push(frameOf('hero', heroSec(t)));
      if (k.startsWith('look:')) out.push(frameOf(k.slice(5), replaySeconds(replayU(t))));
    }
    if (t >= POST_IN.ig - 0.05) for (const s of [PO.instagram.look, PO.youtube.look]) out.push(frameOf(s, replaySeconds(replayU(t))));
    return out;
  }
  window.prepare = async (times) => {
    await Promise.all([...new Set(times.flatMap(needs))].map((s) => image(s).ready));
    // A decoded footage frame is ~4.6 MB and renders walk forward in time, so keep only a short
    // window; a large cache is what made parallel render workers run out of RAM.
    if (cache.size > 80) for (const [k] of cache) { if (cache.size <= 56) break; if (k.startsWith('build/frames')) cache.delete(k); }
  };
  window.seek = seek;
  window.LOOP = LOOP;
  window.BEAT_TIMES = BT.beats.slice();
  window.filmReady = true;

  if (!RENDER) {
    const fitStage = () => { $('stage').style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
    addEventListener('resize', fitStage); fitStage();
    const t0 = performance.now();
    const tick = async () => { const t = ((performance.now() - t0) / 1000) % LOOP; await window.prepare([t]); seek(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
})();
