// ZexDraws studio launch film (docs/shotlist-studio.md, storyboard in docs/storyboard/).
// DOM + CSS 3D, driven only by window.seek(t): every property is a pure function of t built
// from lib/motion.js. No CSS transitions, no timers, no state carried between frames.
//
// One object carries the film: the box. It is the blank page in the studio, the window the
// drawing plays in, the page again when Replay is clicked, the replay preview in the skin
// showcase, and the TikTok window among the post templates, before it folds into the logo.
(async () => {
  'use strict';
  const { spring, settle, track, indicator, glide, pick, clock } = Motion;
  const RENDER = new URLSearchParams(location.search).has('render');
  const $ = (id) => document.getElementById(id);
  const load = (u) => fetch(u).then((r) => r.json());
  const [BT, MAN] = await Promise.all([load('beats-studio.json'), load('build/manifest.json')]);

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
  const STILLS = ['ui/studio/nopage.png', 'ui/studio/nopage_blur.jpg', 'ui/studio/p_brush.png', 'ui/studio/p_colour.png',
    'ui/studio/p_layers.png', 'ui/studio/export_btn.png', 'assets/logo.png'];
  await Promise.all(STILLS.map((s) => image(s).ready));

  // ------------------------------------------------------------------ footage
  const RP = MAN.replay;
  const skip = RP.skip || [Infinity, Infinity];
  const skipLen = Number.isFinite(skip[0]) ? skip[1] - skip[0] : 0;
  const replaySeconds = (u) => { let s = RP.useFrom + u * (RP.useTo - RP.useFrom - skipLen); if (s > skip[0]) s += skipLen; return s; };
  const frameOf = (key, sec) => { const c = MAN.clips[key]; return `${c.dir}/${clamp(Math.round(sec * c.fps), 0, c.frames - 1)}.jpg`; };
  // Replay playhead (a clock, not an easing): every skin shares it, so a switch keeps the moment.
  const replayU = (t) => clock(t, [[B(14), 0.06], [B(23), 0.47], [B(27.5), 0.62]]);
  const canvasSec = (t) => clamp((t - B(6.3)) / (B(11.8) - B(6.3)), 0, 1) * MAN.clips.canvas.duration;
  // Edge colours of each skin: when a template's shape differs from the video, the frame is
  // extended with its own colour (top -> bottom), never cropped.
  const PAD = {
    pink: ['#DB2A78', '#DB2A78'], yellow: ['#EDDB49', '#ECDC49'], orange: ['#D74B30', '#D74C2F'],
    manga: ['#FCFDF8', '#FCFDF8'], fantasy: ['#2C2B27', '#161513'],
  };
  function paintFootage(c, skin, t, W, H) {
    const pad = PAD[skin] || ['#000', '#000'];
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pad[0]); g.addColorStop(1, pad[1]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const f = image(frameOf(skin, replaySeconds(replayU(t))));
    if (!f.ok) return;
    const iw = f.img.naturalWidth, ih = f.img.naturalHeight, k = Math.min(W / iw, H / ih);
    c.drawImage(f.img, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  }

  // ------------------------------------------------------------------ world (the studio)
  // World units: the 2x capture at 0.75, centred on 0. The page is the box's home.
  const PAGE = { x0: -316.5, y0: -403.5, x1: 322.5, y1: 439.5 };
  const CAM = [
    // b, s, ry, rx, fx, fy
    [4.5, 0.6, -24, 8, 0, 0],
    [4.6, 0.74, -14, 6, 0, 0],
    [5.0, 1.0, 0, 0, 0, 0],
    [6.0, 1.06, 0, 0, 0, 0],
    [12.0, 1.9, 0, 0, 640, -330],
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
  const W2 = [1065, 125, 606, 830];                 // the drawing window (shot 2)
  const S4 = R(1000, 540, 902, 638);                // replay preview in the showcase
  const E5 = R(960, 470, 834, 590);                 // lifted for the Export button
  const TT = [654, 188, 432, 783];                  // the TikTok window
  const TTup = R(TT[0] + TT[2] / 2, TT[1] + TT[3] / 2, TT[2] * 1.03, TT[3] * 1.03);
  const CONV = R(960, 540, TT[2] * 0.03, TT[3] * 0.03);
  const BOX_FREE = [[0, W2], [B(14), S4], [B(21.5), E5], [B(23), TT], [B(26.4), TTup], [B(26.75), CONV]];
  const dockW = (t) => (t < B(6) ? 1 : 1 - spring(t - B(6), 'default')) + spring(t - B(12), 'default') * (1 - spring(t - B(14), 'default'));
  const chromeK = (t) => clamp(tr(t, [[0, 0], [B(6), 1], [B(12), 0], [B(23), 1]]), 0, 1.02);
  const radius = (t) => Math.max(0, tr(t, [[0, 0], [B(6), 6], [B(12), 0], [B(14), 15], [B(23), 6]]));
  const titleAt = (t) => (t < B(18) ? 'Untitled<span class="dim">&nbsp;&nbsp;·&nbsp;&nbsp;</span>1200 × 1584' : 'TikTok');
  const BOX_ON = [B(6) - 1e-4, B(27) + 0.36];

  const LOOKS = [[B(14), 'pink'], [B(15.5), 'yellow'], [B(17), 'orange'], [B(18.5), 'manga'], [B(20), 'fantasy']];
  const CONTENT = [[0, 'blank'], [B(6.3), 'canvas'], ...LOOKS.map(([b, k]) => [b, 'look:' + k])];
  const contentAt = (t) => pick(t, CONTENT);
  function paintKey(c, key, t, W, H) {
    if (key === 'blank') { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); }
    else if (key === 'canvas') {
      c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
      const f = image(frameOf('canvas', canvasSec(t)));
      if (f.ok) c.drawImage(f.img, 0, 0, W, H);
    } else if (key.startsWith('look:')) paintFootage(c, key.slice(5), t, W, H);
  }
  // Content swaps cross behind a short blur (the outgoing look stays under the incoming one).
  function paintFace(canvas, t, w, h) {
    const W = Math.max(2, Math.round(w)), H = Math.max(2, Math.round(h));
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
  // A masked vertical strip. pos -1 = blank (below), 0.. = lines; exit 0..1 lifts the whole
  // line up and out through an outer mask, so nothing behind it is revealed on the way out.
  function strip(parent, x, y, w, h, lines, cls) {
    const outer = el('div', 'mask', { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }, undefined, parent);
    const inner = el('div', 'mask', { left: '0', top: '0', width: `${w}px`, height: `${h}px` }, undefined, outer);
    const col = el('div', cls, { position: 'absolute', left: '0', top: '0' }, undefined, inner);
    for (const l of ['', ...lines]) el('div', '', { height: `${h}px`, lineHeight: `${h}px`, whiteSpace: 'nowrap' }, String(l), col);
    return ([pos, exit]) => {
      col.style.transform = `translateY(${(-(pos + 1) * h).toFixed(2)}px)`;
      inner.style.transform = `translateY(${(-exit * h * 1.05).toFixed(2)}px)`;
    };
  }
  // Enter from below at tIn, roll through `steps` ([time, pos]), lift out by tOut (or never).
  function stripTrack(tIn, steps, tOut, preset = 'heavy') {
    const keys = [[-1, -1], [tIn, 0], ...steps];
    const exitAt = tOut === undefined ? Infinity : tOut - settle(preset) - 0.01;
    return (t) => [track(t, keys, { preset }), clamp(spring(t - exitAt, preset), 0, 1)];
  }
  const block = () => el('div', '', { position: 'absolute', inset: '0' });

  // ------------------------------------------------------------------ shots 1a-1c: panels
  const pcam = $('pcam');
  const PANELS = [
    { src: 'ui/studio/p_brush.png', x: 1080, y: 111, w: 570, h: 858, ry: -14, side: 1, b0: 0, b1: 1.5,
      lx: 150, name: 'Brushes', sub: '<span class="v">5</span> sets&nbsp;&nbsp;·&nbsp;&nbsp;pressure dynamics' },
    { src: 'ui/studio/p_colour.png', x: 300, y: 137, w: 552, h: 806, ry: 14, side: -1, b0: 1.5, b1: 3,
      lx: 1130, name: 'Colours', sub: '<span class="v">HSV</span>&nbsp;&nbsp;·&nbsp;&nbsp;sliders&nbsp;&nbsp;·&nbsp;&nbsp;swatches' },
    { src: 'ui/studio/p_layers.png', x: 1060, y: 122, w: 592, h: 835, ry: -14, side: 1, b0: 3, b1: 4.5,
      lx: 150, name: 'Layers', sub: 'blend modes&nbsp;&nbsp;·&nbsp;&nbsp;<span class="v">opacity</span>&nbsp;&nbsp;·&nbsp;&nbsp;lock' },
  ];
  PANELS.forEach((p, i) => {
    p.el = el('img', 'panel', { left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.h}px` }, undefined, pcam);
    p.el.src = p.src;
    p.t0 = i ? B(p.b0) : -0.12; // the first shot is already moving on frame 0
    p.hud = block();
    p.eyebrow = strip(p.hud, p.lx, 380, 400, 24, [`<span class="eyebrow"><b>0${i + 1}</b>/03&nbsp;&nbsp;&nbsp;&nbsp;Studio</span>`], '');
    p.title = strip(p.hud, p.lx - 6, 408, 640, 150, [p.name], 'name');
    p.subl = strip(p.hud, p.lx, 566, 640, 32, [`<span class="row">${p.sub}</span>`], '');
    const tin = Math.max(0, p.t0);
    p.ePos = stripTrack(tin + 0.03, [], undefined, 'snappy');
    p.tPos = stripTrack(tin + 0.07, [], undefined, 'heavy');
    p.sPos = stripTrack(tin + 0.13, [], undefined, 'heavy');
  });
  const RAIL_T = B(4.5);

  // ------------------------------------------------------------------ shot 2 copy
  const s2 = block();
  const s2eyebrow = strip(s2, 258, 385, 500, 24, ['<span class="eyebrow">Every stroke&nbsp;&nbsp;·&nbsp;&nbsp;<b>saved</b></span>'], '');
  const s2title = strip(s2, 250, 406, 720, 150, ['<span style="font:112px/150px \'Southern Beach\'">You just draw.</span>'], '');
  const s2rule = el('div', '', { position: 'absolute', left: '258px', top: '561px', width: '520px', height: '3px', borderRadius: '2px', background: 'var(--accent)', transformOrigin: '0 50%' }, undefined, s2);
  const s2l1 = strip(s2, 256, 585, 600, 54, ['<span style="font:600 38px/54px Inter;letter-spacing:-.01em">No complicated setup.</span>'], '');
  const s2l2 = strip(s2, 256, 639, 600, 54, ['<span style="font:600 38px/54px Inter;letter-spacing:-.01em;color:var(--muted)">No camera pressure.</span>'], '');
  const S2_OUT = B(12);
  const s2Pos = [stripTrack(B(6.25), [], S2_OUT, 'snappy'), stripTrack(B(6.5), [], S2_OUT), stripTrack(B(8), [], S2_OUT), stripTrack(B(9.5), [], S2_OUT)];
  const s2RuleK = (t) => spring(t - B(6.75), 'default') * (1 - spring(t - (S2_OUT - settle('default')), 'default'));

  // ------------------------------------------------------------------ shot 4 showcase HUD
  const LOOK_INFO = {
    pink: { frame: 'Neubrutalism', hex: '#E83E77' }, yellow: { frame: 'Neubrutalism', hex: '#F0D442' },
    orange: { frame: 'Neubrutalism', hex: '#E2572C' }, manga: { frame: 'Manga', hex: '#FBFBF6' },
    fantasy: { frame: 'Fantasy', hex: '#201E1A' },
  };
  const SKINS = Object.keys(LOOK_INFO);
  const lookAt = (t) => pick(t, [[0, 'pink'], ...LOOKS]);
  const S4_IN = B(14), S4_OUT = B(21.5);
  const LOOK_NAMES = ['Neubrutalism', 'Manga', 'Fantasy'];
  const lookName = strip(hud, 92, 462, 560, 120, LOOK_NAMES, 'name');
  const lookNamePos = stripTrack(S4_IN + 0.06, [[B(18.5), 1], [B(20), 2]], S4_OUT);
  const eyebrow = strip(hud, 98, 430, 300, 24, ['<span class="eyebrow">Look</span>'], '');
  const eyebrowPos = stripTrack(S4_IN + 0.04, [], S4_OUT);
  const counter = strip(hud, 168, 430, 80, 24, [1, 2, 3, 4, 5].map((n) => `<span class="eyebrow"><b>0${n}</b>/05</span>`), '');
  const counterPos = stripTrack(S4_IN + 0.04, LOOKS.slice(1).map((l, i) => [l[0], i + 1]), S4_OUT, 'snappy');
  const underline = el('div', '', { position: 'absolute', left: '98px', top: '596px', height: '3px', borderRadius: '2px' });
  const DOT_X = (i) => 106 + i * 38, DOT_Y = 640;
  const dots = SKINS.map((k, i) => el('div', '', { position: 'absolute', left: `${DOT_X(i) - 7}px`, top: `${DOT_Y - 7}px`, width: '14px', height: '14px', borderRadius: '7px', background: LOOK_INFO[k].hex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)' }));
  const ring = el('div', '', { position: 'absolute', top: `${DOT_Y - 13}px`, height: '26px', border: '2px solid var(--accent)', borderRadius: '13px', boxSizing: 'border-box' });
  const RING_STOPS = LOOKS.map((l, i) => [l[0], DOT_X(i) - 13, DOT_X(i) + 13]);
  const RX = 1496;
  const tokEyebrow = strip(hud, RX, 470, 300, 24, ['<span class="eyebrow">Frame</span>'], '');
  const tokFrame = strip(hud, RX, 508, 400, 38, LOOK_NAMES.map((n) => `<span class="row">skin&nbsp;&nbsp;<span class="v">${n}</span></span>`), '');
  const tokColour = strip(hud, RX, 550, 400, 38, SKINS.map((k) => `<span class="row"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;background:${LOOK_INFO[k].hex};box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)"></span>&nbsp;&nbsp;colour&nbsp;&nbsp;<span class="v">${LOOK_INFO[k].hex}</span></span>`), '');
  const tokEyebrowPos = stripTrack(S4_IN + 0.06, [], S4_OUT, 'snappy');
  const tokFramePos = stripTrack(S4_IN + 0.12, [[B(18.5), 1], [B(20), 2]], S4_OUT, 'snappy');
  const tokColourPos = stripTrack(S4_IN + 0.18, LOOKS.slice(1).map((l, i) => [l[0], i + 1]), S4_OUT, 'snappy');

  // ------------------------------------------------------------------ shot 6 post windows
  const posts = $('posts');
  const ICON = {
    heart: '<path d="M13 23S2 16 2 9a5.5 5.5 0 0 1 11-2 5.5 5.5 0 0 1 11 2c0 7-11 14-11 14z"/>',
  };
  function win(parent, rect, title) {
    const w = el('div', 'win', { left: `${rect[0]}px`, top: `${rect[1]}px`, width: `${rect[2]}px`, height: `${rect[3]}px`, borderRadius: '6px' }, undefined, parent);
    el('div', 'tb', null, `<span class="title">${title}</span>${CTL}`, w);
    const inner = el('div', 'inner', { left: '16px', top: '56px', width: `${rect[2] - 32}px`, height: `${rect[3] - 72}px`, background: '#000' }, undefined, w);
    return { el: w, inner, rect };
  }
  const CTL = '<svg width="96" height="12" viewBox="0 0 96 12" fill="none" stroke="#9F9EA1" stroke-width="1.3"><path d="M2 6h10"/><rect x="42.5" y=".5" width="11" height="11"/><path d="M84 .5l11 11M95 .5l-11 11"/></svg>';
  $('box').querySelector('.tb').insertAdjacentHTML('beforeend', CTL);

  // Instagram post (4:5) - Manga.
  const IG = win(posts, [154, 180, 452, 799], 'Instagram');
  IG.inner.innerHTML = `
    <div class="plat" style="left:0;top:0;width:420px;height:56px;background:#000">
      <span class="av" style="left:12px;top:10px;width:36px;height:36px;box-shadow:0 0 0 2px #000,0 0 0 4px #5b5a5e"></span>
      <span class="plat" style="left:60px;top:10px;font:600 14px Inter">zexdraws</span>
      <span class="plat" style="left:60px;top:29px;font:500 12px Inter;color:#d6d6d6">Original audio</span>
      <svg class="plat" style="left:386px;top:25px" width="20" height="6" viewBox="0 0 20 6" fill="#fff"><circle cx="3" cy="3" r="2"/><circle cx="10" cy="3" r="2"/><circle cx="17" cy="3" r="2"/></svg>
    </div>
    <canvas class="plat" id="igMedia" style="left:0;top:56px;width:420px;height:525px"></canvas>
    <div class="plat" style="left:0;top:581px;width:420px;height:146px;background:#000">
      <svg class="plat" style="left:12px;top:12px" width="400" height="26" viewBox="0 0 400 26" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
        ${ICON.heart}<path d="M58 22.5l-6 1.5 1.5-5A10 10 0 1 1 58 22.5z"/><path d="M84 3l22 0-12 21-2-9z M92 15l14-12"/><path d="M380 3h14v21l-7-6-7 6z"/></svg>
      <div class="plat" style="left:14px;top:48px;font:600 14px Inter"><span id="igLikes">12,408</span> likes</div>
      <div class="plat" style="left:14px;top:70px;width:392px;font:500 14px/19px Inter"><b style="font-weight:600">zexdraws</b> Every stroke, replayable. Exported from ZexDraws with the Manga frame</div>
      <div class="plat" style="left:14px;top:112px;font:500 13px Inter;color:#a8a8a8">View all 214 comments</div>
    </div>`;
  // YouTube watch page (16:9) - Pink.
  const YT = win(posts, [1134, 238, 632, 604], 'YouTube');
  YT.inner.style.background = '#0f0f0f';
  YT.inner.innerHTML = `
    <canvas class="plat" id="ytMedia" style="left:0;top:0;width:600px;height:338px"></canvas>
    <div class="plat" style="left:0;top:258px;width:600px;height:80px;background:linear-gradient(transparent,rgba(0,0,0,.7))"></div>
    <div class="plat" style="left:12px;top:302px;width:576px;height:3px;background:rgba(255,255,255,.3)"><div id="ytBar" style="width:47%;height:3px;background:#f00"></div></div>
    <div class="plat" id="ytDot" style="left:279px;top:297px;width:13px;height:13px;border-radius:7px;background:#f00"></div>
    <svg class="plat" style="left:14px;top:314px" width="190" height="18" viewBox="0 0 190 18" fill="#fff"><path d="M2 1v16h4V1zM10 1v16h4V1z"/><path d="M28 2l10 7-10 7z M40 2h2.5v14H40z"/><path d="M54 6h4l5-4v14l-5-4h-4z"/></svg>
    <div class="plat" style="left:94px;top:314px;font:500 13px/18px Inter"><span id="ytTime">0:14</span> / 0:30</div>
    <svg class="plat" style="left:506px;top:314px" width="80" height="18" viewBox="0 0 80 18" fill="none" stroke="#fff" stroke-width="2"><circle cx="9" cy="9" r="3"/><path d="M9 1v3M9 14v3M1 9h3M14 9h3"/><path d="M62 2h-5v5M74 2h5v5M62 16h-5v-5M74 16h5v-5"/></svg>
    <div class="plat" style="left:14px;top:350px;width:572px;font:700 18px/24px Inter;color:#f1f1f1">Drawing an explosion, every stroke replayed | ZexDraws timelapse</div>
    <div class="plat" style="left:14px;top:408px;width:572px;height:40px">
      <span class="av" style="left:0;top:2px;width:36px;height:36px"></span>
      <span class="plat" style="left:48px;top:2px;font:600 15px Inter;color:#f1f1f1">ZexDraws</span>
      <span class="plat" style="left:48px;top:22px;font:500 12px Inter;color:#aaa;white-space:nowrap">128K subscribers</span>
      <span class="plat" style="left:176px;top:2px;height:36px;padding:0 16px;border-radius:18px;background:#f1f1f1;color:#0f0f0f;font:600 14px/36px Inter">Subscribe</span>
      <span class="plat" style="left:446px;top:2px;width:126px;height:36px;border-radius:18px;background:#272727;color:#f1f1f1;font:600 14px/36px Inter;text-align:center;white-space:nowrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" stroke-width="2" style="vertical-align:-3px"><path d="M7 10v11H3V10zM7 10l4-8c2 0 3 1 3 3v4h6c1.2 0 2 1 1.8 2.2l-1.6 8A2 2 0 0 1 18.2 21H7"/></svg>&nbsp; <span id="ytLikes">8.4K</span>&nbsp;&nbsp;<span style="color:#555">|</span>&nbsp;&nbsp;<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" stroke-width="2" style="vertical-align:-5px;transform:scaleY(-1)"><path d="M7 10v11H3V10zM7 10l4-8c2 0 3 1 3 3v4h6c1.2 0 2 1 1.8 2.2l-1.6 8A2 2 0 0 1 18.2 21H7"/></svg></span>
    </div>
    <div class="plat" style="left:14px;top:460px;width:572px;height:58px;border-radius:12px;background:#272727;padding:10px 12px;box-sizing:border-box;font:600 13px/19px Inter;color:#f1f1f1">128K views&nbsp; 2 days ago<br><span style="font-weight:500;color:#d0d0d0">Every stroke replayed, exported with the Neubrutalism frame in pink.</span></div>`;
  // TikTok UI over the box (the box is the video). Laid out for a 400 x 711 inner.
  const ttui = $('ttui');
  ttui.style.width = '400px'; ttui.style.height = '711px'; ttui.style.transformOrigin = '0 0';
  ttui.innerHTML = `
    <div class="plat" style="left:0;top:0;width:400px;height:110px;background:linear-gradient(rgba(0,0,0,.45),transparent)"></div>
    <div class="plat" style="left:0;top:541px;width:400px;height:170px;background:linear-gradient(transparent,rgba(0,0,0,.65))"></div>
    <div class="plat" style="left:0;width:400px;top:18px;text-align:center;font:600 16px Inter;color:rgba(255,255,255,.65)">Following&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#fff">For You</span></div>
    <div class="plat" style="left:226px;top:44px;width:26px;height:3px;border-radius:2px;background:#fff"></div>
    <svg class="plat" style="left:364px;top:18px" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="2.2"><circle cx="8.5" cy="8.5" r="6.5"/><path d="M13.5 13.5L19 19"/></svg>
    <div class="plat" style="left:338px;top:330px;width:50px;text-align:center;font:600 12px Inter">
      <div style="width:46px;height:46px;margin:0 auto;border-radius:23px;box-shadow:0 0 0 2px #fff;background:url(assets/logo.png) center/cover"></div>
      <div style="width:20px;height:20px;margin:-10px auto 0;border-radius:10px;background:#FE2C55;font:700 16px/20px Inter;position:relative">+</div>
      <svg style="margin-top:14px" width="36" height="32" viewBox="0 0 24 22" fill="#fff"><path d="M12 21S1 14 1 7a5.5 5.5 0 0 1 11-2 5.5 5.5 0 0 1 11 2c0 7-11 14-11 14z"/></svg><div id="ttLikes" style="margin-top:2px">48.2K</div>
      <svg style="margin-top:12px" width="34" height="32" viewBox="0 0 24 22" fill="#fff"><path d="M12 1C5.9 1 1 5.2 1 10.3c0 3 1.6 5.6 4.2 7.3L4.5 21l4.4-2.2c1 .3 2 .4 3.1.4 6.1 0 11-4.2 11-9.3S18.1 1 12 1z"/></svg><div>1,204</div>
      <svg style="margin-top:12px" width="28" height="32" viewBox="0 0 18 22" fill="#fff"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h13A1.5 1.5 0 0 1 17 2.5V21l-8-5.5L1 21z"/></svg><div>9,830</div>
      <svg style="margin-top:12px" width="34" height="30" viewBox="0 0 24 20" fill="#fff"><path d="M13 1l10 9-10 9v-5.5C6 13.5 3 16 1 19c.5-7 4.5-12 12-12.5z"/></svg><div>3,112</div>
    </div>
    <div class="plat" style="left:16px;top:610px;width:310px">
      <div style="font:600 16px Inter">@zexdraws</div>
      <div style="font:500 14px/19px Inter;margin-top:6px">Every stroke, replayable. Fantasy frame <b style="font-weight:600">#timelapse #digitalart</b></div>
      <div style="font:500 13px Inter;margin-top:8px">&#9835;&nbsp; original sound - zexdraws</div>
    </div>
    <div class="plat" style="left:0;top:708px;width:400px;height:3px;background:rgba(255,255,255,.25)"><div id="ttBar" style="width:46%;height:3px;background:#fff"></div></div>`;
  const POST_IN = { ig: B(23.25), yt: B(23.5) };
  const CONV_AT = B(26.75);
  const postHead = strip(hud, 0, 52, 1920, 70, ['<div style="width:1920px;text-align:center;font:600 46px/70px Inter;letter-spacing:-.01em">Export once. <span style="color:var(--muted)">Post anywhere.</span></div>'], '');
  const postHeadPos = stripTrack(B(23.2), [], B(26.6));
  const count = (t, from, to, fmt) => fmt(lerp(from, to, clamp(spring(t - B(23.4), 'heavy'), 0, 1) * clamp((t - B(23.4)) / (B(26.5) - B(23.4)), 0, 1)));
  const kfmt = (v) => `${v.toFixed(1)}K`;
  const nfmt = (v) => Math.round(v).toLocaleString('en-US');

  // ------------------------------------------------------------------ cursor
  const CUR = [
    // [time, x, y] tip positions; the cursor is shown inside its spans.
    [B(12.15), 1560, 760], [B(12.35), 1356, 288],
    [B(21.85), 1420, 1010], [B(22.05), 1002, 878],
  ];
  const curX = (t) => tr(t, CUR.map((c) => [c[0], c[1]]), 'default');
  const curY = (t) => tr(t, CUR.map((c) => [c[0], c[2]]), 'default');
  const CUR_ON = [[B(12.1), B(14) + 0.05], [B(21.8), B(23) + 0.1]];
  const press = (t, at) => 1 - 0.14 * (spring(t - at, 'snappy') - spring(t - at - 0.09, 'snappy'));

  // ------------------------------------------------------------------ lockup
  const logo = el('img', '', { position: 'absolute', left: '0', top: '0', width: '300px', borderRadius: '23%' });
  logo.src = 'assets/logo.png';
  const WM = el('div', 'mask', { left: '822px', top: '360px', width: '700px', height: '210px' });
  const wmText = el('div', '', { position: 'absolute', left: 0, top: 0, font: "150px/210px 'Southern Beach'", whiteSpace: 'nowrap' }, 'ZexDraws', WM);
  const slash = el('div', '', { position: 'absolute', left: '771px', top: '388px', width: '10px', height: '150px', background: 'var(--accent)', borderRadius: '5px', transformOrigin: '50% 100%' });
  const tagline = strip(hud, 460, 600, 1000, 70, ['<div style="font:600 52px/70px Inter;letter-spacing:-0.01em;text-align:center;width:1000px">Every stroke, replayable.</div>'], '');
  const pill = strip(hud, 810, 694, 300, 44, ['<div style="width:300px;text-align:center"><span style="display:inline-block;font:500 15px/34px Inter;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);padding:0 18px;border-radius:17px;background:#141316;box-shadow:inset 0 0 0 1px var(--hair)">Replay built in</span></div>'], '');
  const L_IN = B(27) + 0.12;
  const logoReveal = (t) => tr(t, [[0, 0], [L_IN, 1]], 'heavy');
  const logoMove = (t) => tr(t, [[0, 0], [B(28), 1]], 'heavy');
  const wmK = (t) => tr(t, [[0, 0], [B(28) + 0.06, 1]], 'heavy');
  const slashK = (t) => tr(t, [[0, 0], [B(28), 1]], 'snappy');
  const taglinePos = stripTrack(B(28) + 0.2, []);
  const pillPos = stripTrack(B(28) + 0.36, []);
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
  function setRect(e, x, y, w, h) { e.style.left = `${x}px`; e.style.top = `${y}px`; e.style.width = `${w}px`; e.style.height = `${h}px`; }
  // Converge: everything on screen at the end of the posts folds into the centre (the logo's seed).
  const convK = (t) => clamp(spring(t - CONV_AT, 'default'), 0, 1);
  const anticip = (t) => 1 + 0.03 * spring(t - B(26.4), 'default') * (1 - spring(t - CONV_AT, 'default'));

  function seek(tRaw) {
    const t = clamp(tRaw, 0, LOOP);

    // The studio (world).
    const c = cam(t);
    const rig = $('rig');
    show(rig, between(t, RAIL_T - 1e-4, B(15.5)));
    rig.style.transform = `translate(960px, 540px) scale(${c.s.toFixed(5)}) rotateY(${c.ry.toFixed(3)}deg) rotateX(${c.rx.toFixed(3)}deg) translate(${(-c.fx).toFixed(2)}px, ${(-c.fy).toFixed(2)}px)`;
    show($('page'), between(t, RAIL_T - 1e-4, BOX_ON[0]));
    const blurK = tr(t, [[0, 0], [B(6), 1], [B(12), 0], [B(14), 1]]);
    $('studioBlur').style.opacity = clamp(blurK, 0, 1).toFixed(3);
    $('studioDim').style.opacity = clamp(tr(t, [[0, 0], [B(6), 0.45], [B(12), 0], [B(14), 1]], 'heavy'), 0, 1).toFixed(3);
    const hiK = clamp(spring(t - B(12.6), 'snappy') * (1 - spring(t - B(14), 'snappy')), 0, 1), prK = clamp(spring(t - B(13), 'snappy'), 0, 1);
    const hi = $('replayHi');
    hi.style.background = `rgba(139,92,246,${(0.16 * hiK + 0.22 * prK * hiK).toFixed(3)})`;
    hi.style.boxShadow = `inset 0 0 0 ${(2 * hiK).toFixed(2)}px rgba(139,92,246,${hiK.toFixed(3)})`;
    hi.style.transform = `scale(${press(t, B(13)).toFixed(4)})`;

    // Shots 1a-1c: one panel per shot, hard cuts on the beat.
    const back = $('backdrop');
    const studioOn = t >= RAIL_T;
    const backK = studioOn ? 1 - spring(t - RAIL_T, 'snappy') : 1;
    show(back, backK > 0.002);
    back.style.opacity = backK.toFixed(3);
    back.style.transform = `scale(${(1 + 0.012 * t).toFixed(4)})`;
    PANELS.forEach((p, i) => {
      const last = i === PANELS.length - 1;
      const on = between(t, i ? B(p.b0) : 0, B(p.b1) + (last ? 0.32 : 0));
      show(p.el, on); show(p.hud, on && t < B(p.b1));
      if (!on) return;
      const k = spring(t - p.t0, 'default');
      const drift = (t - p.t0) * 3 * p.side;
      let ry = lerp(p.ry * 3.4, p.ry, k) + drift, dx = lerp(170 * p.side, 0, k), sc = lerp(0.9, 1, k), tx = 0, ty = 0;
      if (last && t >= RAIL_T) {
        // The Layers panel folds into its button on the rail as the studio comes up.
        const m = $('railMark').getBoundingClientRect(), st = $('stage').getBoundingClientRect(), f = 1920 / st.width;
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
      let [x, y, w, h] = [lerp(free[0], pp.x, dw), lerp(free[1], pp.y, dw), lerp(free[2], pp.w, dw), lerp(free[3], pp.h, dw)];
      const k = chromeK(t), tb = 40 * k, pad = 16 * k;
      setRect(box, x, y, w, h);
      box.style.borderRadius = `${radius(t).toFixed(2)}px`;
      box.style.transform = `scale(${anticip(t).toFixed(4)})`;
      box.style.background = k > 0.01 ? 'var(--win)' : 'transparent';
      const bar = box.querySelector('.tb');
      bar.style.height = `${tb.toFixed(2)}px`;
      bar.style.opacity = clamp(k, 0, 1).toFixed(3);
      bar.querySelector('.title').innerHTML = titleAt(t);
      const inner = box.querySelector('.inner');
      const iw = Math.max(2, w - 2 * pad), ih = Math.max(2, h - tb - 2 * pad);
      setRect(inner, pad, tb + pad, iw, ih);
      inner.style.boxShadow = k > 0.01 ? '0 0 0 1px var(--hair)' : 'none';
      paintFace($('face'), t, iw, ih);
      // TikTok UI rides the box's inner rect.
      const ttK = clamp(spring(t - B(23.3), 'snappy'), 0, 1) * (1 - convK(t));
      show(ttui, ttK > 0.002);
      if (ttK > 0.002) {
        const sx = iw / 400;
        ttui.style.transform = `translate(${(x + pad).toFixed(1)}px, ${(y + tb + pad + (1 - ttK) * 18).toFixed(1)}px) scale(${sx.toFixed(4)}, ${(ih / 711).toFixed(4)})`;
        ttui.style.opacity = ttK.toFixed(3);
        $('ttLikes').textContent = count(t, 31.6, 48.2, kfmt);
        $('ttBar').style.width = `${(46 + 30 * clamp((t - B(23)) / (B(27) - B(23)), 0, 1)).toFixed(1)}%`;
      }
    } else show(ttui, false);

    // Shot 2 copy.
    show(s2, between(t, B(6), B(12) + 0.1));
    [s2eyebrow, s2title, s2l1, s2l2].forEach((f, i) => f(s2Pos[i](t)));
    s2rule.style.transform = `scaleX(${clamp(s2RuleK(t), 0, 1).toFixed(4)})`;

    // Shot 4 showcase HUD.
    lookName(lookNamePos(t)); eyebrow(eyebrowPos(t)); counter(counterPos(t));
    const info = LOOK_INFO[lookAt(t)];
    const carouselOn = between(t, S4_IN, S4_OUT);
    const ulW = carouselOn ? track(t, [[0, 0], [S4_IN + 0.1, 470], [B(18.5), 260], [B(20), 310], [S4_OUT - settle('snappy'), 0]], { preset: 'snappy' }) : 0;
    underline.style.width = `${Math.max(0, ulW).toFixed(1)}px`;
    underline.style.background = info.hex === '#201E1A' ? '#D9B26A' : info.hex;
    const dotK = (i) => (carouselOn ? spring(t - (S4_IN + 0.08 + i * 0.04), 'snappy') * (1 - spring(t - (S4_OUT - settle('snappy') - 0.02), 'snappy')) : 0);
    dots.forEach((d, i) => { d.style.transform = `scale(${Math.max(0, dotK(i)).toFixed(3)})`; });
    const [ra, rb] = indicator(t, RING_STOPS);
    ring.style.left = `${ra}px`; ring.style.width = `${Math.max(0, rb - ra)}px`;
    ring.style.transform = `scale(${Math.max(0, dotK(0)).toFixed(3)})`;
    tokEyebrow(tokEyebrowPos(t)); tokFrame(tokFramePos(t)); tokColour(tokColourPos(t));

    // Shot 5 Export button.
    const btn = $('exportBtn');
    const bK = clamp(spring(t - B(21.75), 'snappy') * (1 - spring(t - B(23), 'snappy')), 0, 1.02);
    show(btn, bK > 0.002);
    btn.style.transform = `translate(${960 - 162}px, ${840 - 34}px) scale(${(bK * press(t, B(22.5))).toFixed(4)})`;

    // Shot 6 post windows.
    postHead(postHeadPos(t));
    const cv = convK(t), an = anticip(t);
    for (const [P, key, from] of [[IG, 'ig', -760], [YT, 'yt', 820]]) {
      const on = between(t, POST_IN[key] - 0.01, BOX_ON[1]);
      show(P.el, on);
      if (!on) continue;
      const k = spring(t - POST_IN[key], 'default');
      const cx = P.rect[0] + P.rect[2] / 2, cy = P.rect[1] + P.rect[3] / 2;
      const dx = (1 - k) * from + cv * (960 - cx), dy = cv * (540 - cy);
      P.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(an * lerp(1, 0.03, cv)).toFixed(4)})`;
      const m = $(key === 'ig' ? 'igMedia' : 'ytMedia');
      const W = key === 'ig' ? 420 : 600, H = key === 'ig' ? 525 : 338;
      if (m.width !== W) { m.width = W; m.height = H; }
      paintFootage(m.getContext('2d'), key === 'ig' ? 'manga' : 'pink', t, W, H);
    }
    $('igLikes').textContent = count(t, 8120, 12408, nfmt);
    $('ytLikes').textContent = count(t, 5.1, 8.4, kfmt);
    { const u = clamp((t - B(23)) / (B(27) - B(23)), 0, 1); $('ytBar').style.width = `${47 + 20 * u}%`; $('ytDot').style.left = `${279 + 115 * u}px`; $('ytTime').textContent = `0:${String(14 + Math.floor(u * 6)).padStart(2, '0')}`; }
    // The box converges with the windows: its free target already lands at CONV.

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
    logo.style.transform = `translate(${lerp(960, 664, mv) - lw / 2}px, ${lerp(540, 466, mv) - lw / 2}px)`;
    logo.style.clipPath = `circle(${(rv * 72).toFixed(2)}% at 50% 50%)`;
    show(logo, rv > 0.002);
    wmText.style.transform = `translateX(${(-(1 - clamp(wmK(t), 0, 1)) * 720).toFixed(1)}px)`;
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
    const t = clamp(tRaw, 0, LOOP), out = [];
    let ci = CONTENT.length - 1;
    while (ci > 0 && CONTENT[ci][0] > t) ci--;
    for (const k of [CONTENT[ci][1], CONTENT[Math.max(0, ci - 1)][1]]) {
      if (k === 'canvas') out.push(frameOf('canvas', canvasSec(t)));
      if (k.startsWith('look:')) out.push(frameOf(k.slice(5), replaySeconds(replayU(t))));
    }
    if (t >= POST_IN.ig - 0.05) for (const s of ['manga', 'pink']) out.push(frameOf(s, replaySeconds(replayU(t))));
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
