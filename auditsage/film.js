// GreenSage AI launch film (docs/shotlist.md, storyboard in docs/storyboard/v3.html).
// One audit, end to end: the AuditSage app on site, then the GreenSage platform reads the bills,
// finds the savings and drafts the report. The screens carry one sample dataset only.
//
// DOM + CSS 3D, driven only by window.seek(t): every property is a pure function of t built
// from lib/motion.js on the measured beat grid. No transitions, no timers, no frame state.
(async () => {
  'use strict';
  const { spring, track, glide } = Motion;
  const $ = (id) => document.getElementById(id);
  const BT = await fetch('beats.json').then((r) => r.json());
  await document.fonts.load('700 120px Inter'); await document.fonts.load('600 17px Inter'); await document.fonts.load('500 15px Inter');
  await document.fonts.ready;
  await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));

  // ------------------------------------------------------------------ time
  const LOOP = BT.duration;
  const G = BT.sixteenths, NG = G.length;
  const at16 = (j) => (j < NG ? G[Math.max(0, j)] : G[NG - 1] + (j - NG + 1) * (LOOP - G[NG - 1]));
  // Fractional beat -> seconds on the measured grid.
  const B = (x) => { const q = x * 4, i = Math.floor(q), f = q - i; return at16(i) + (at16(i + 1) - at16(i)) * f; };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const s = (t, b, p = 'default') => spring(t - B(b), p);
  const show = (el, on) => { el.style.visibility = on ? 'visible' : 'hidden'; };
  const mixHex = (a, b, k) => {
    const A = a.match(/\w\w/g).map((x) => parseInt(x, 16)), C = b.match(/\w\w/g).map((x) => parseInt(x, 16));
    return `rgb(${A.map((v, i) => Math.round(lerp(v, C[i], clamp(k)))).join(',')})`;
  };
  // Quick press: 0 -> 1 -> 0 around a click.
  const press = (t, b) => clamp(spring(t - B(b) + 0.06, 'snappy') - spring(t - B(b) - 0.07, 'snappy'));

  // ------------------------------------------------------------------ build
  for (const host of document.querySelectorAll('[data-t]')) host.appendChild($(host.dataset.t).content.cloneNode(true));
  for (const m of document.querySelectorAll('#copy .mask')) {
    if (!m.firstElementChild) { const d = document.createElement('div'); d.innerHTML = m.innerHTML; m.textContent = ''; m.appendChild(d); }
  }
  // Report paragraphs are "drafted" word by word.
  const words = (p) => {
    const out = [];
    p.innerHTML = p.textContent.split(' ').map((w) => `<span>${w}</span>`).join(' ');
    for (const w of p.children) out.push(w);
    return out;
  };
  const P2 = words($('p2')), P3 = words($('p3'));
  const fields = [...document.querySelectorAll('#phone .m-in')];
  const billRows = [...document.querySelectorAll('#billFields .r')].slice(1);
  for (const r of billRows) {
    const sk = document.createElement('div'); sk.className = 'sk'; r.appendChild(sk);
    sk.style.width = Math.max(60, r.querySelector('b').offsetWidth) + 'px';
  }
  const bars = [...document.querySelectorAll('#chart .bar')];
  const chips = [...document.querySelectorAll('#chips .chip')];

  // ------------------------------------------------------------------ poses
  // A pose: translate, rotateY, rotateX, rotateZ, scale, opacity, in the storyboard's order.
  const P = (o) => [o.x ?? 0, o.y ?? 0, o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, o.s ?? 1, o.o ?? 1];
  const poses = (t, keys) => track(t, keys.map(([b, p, pr]) => [b === 0 ? 0 : B(b), P(p), pr]));
  const place = (el, v, dx = 0, dy = 0, dry = 0) => {
    el.style.transform = `translate(${(v[0] + dx).toFixed(2)}px,${(v[1] + dy).toFixed(2)}px) rotateY(${(v[3] + dry).toFixed(3)}deg) rotateX(${v[2].toFixed(3)}deg) rotateZ(${v[4].toFixed(3)}deg) scale(${v[5].toFixed(4)})`;
    const o = clamp(v[6]);
    el.style.opacity = o.toFixed(3);
    show(el, o > 0.003);
  };

  // Tiles: in from slightly below, out on a camera move (dive or collapse).
  const HID = { y: 70, s: 0.94, o: 0 }, ON = {}, DIVE = (dx, dy) => ({ x: dx, y: dy, s: 1.22, o: 0 }), ZOOMED = { s: 1.12, o: 0 };
  // Collapse: each tile heads for the frame centre, where the logo lands.
  const IN = (cx, cy) => ({ x: (960 - cx) * 0.6, y: (540 - cy) * 0.6, s: 0.5, o: 0 });
  const tile = (el, t, keys) => {
    const v = poses(t, keys);
    // Opacity runs on its own stiff spring: it leads the slide in and clears early on the way out,
    // so a tile never reads as "fading" and never ghosts behind the next shot.
    v[6] = clamp(track(t, keys.map(([b, p]) => [b === 0 ? 0 : B(b), p.o ?? 1]), { preset: 'snappy' }));
    place(el, v);
  };

  // Copy lines roll up through their masks and leave upward before the next move crosses them.
  const roll = (el, t, tin, tout) => {
    const p = track(t, [[0, 0], [B(tin), 1, 'heavy'], [B(tout), 2, 'snappy']]);
    const y = p <= 1 ? (1 - p) * 112 : -(p - 1) * 112;
    el.firstElementChild.style.transform = `translateY(${y.toFixed(2)}%)`;
    show(el, t >= B(tin) - 0.01 && t < B(tout) + 0.4);
  };
  const copy = (id, t, tin, tout) => [...$(id).children].forEach((m, i) => roll(m, t, tin + [0, 0.25, 0.5, 0.625][i], tout + [0, 0.0625, 0.125, 0.125][i]));

  // ------------------------------------------------------------------ shots
  const PH = {
    hid: { x: 85, y: 160, s: 0.94, o: 0 }, bento: { x: 85, y: 100 },
    macro: { x: 1080, y: 40, ry: -24, rx: 10, rz: 4, s: 1.45 }, out: { x: -1150, y: 40, ry: -12, rx: 10, rz: 4, s: 1.3 },
    gone: { x: 485, y: 100, s: 0.5, o: 0 },
  };
  const BI = { r: { x: 2500, y: 220, ry: -16, rx: 5 }, m: { x: 740, y: 210, ry: -16, rx: 5, s: 0.97 }, up: { x: 760, y: -1050, ry: -16, rx: 22, s: 0.95 } };
  const AN = { d: { x: 420, y: 1500, rx: 28, rz: -6, s: 1.4 }, m: { x: 420, y: 330, rx: 28, rz: -6, s: 1.4 }, top: { x: 390, y: 200, rx: 8, rz: -2, s: 1.08 }, l: { x: -1700, y: 200, rx: 8, rz: -2, s: 1 } };
  const RE = { r: { x: 2400, y: 170, ry: -14, rx: 4, s: 0.98 }, m: { x: 780, y: 170, ry: -14, rx: 4, s: 0.98 }, tile: { x: 1210, y: 425, s: 0.58 } };

  function typeField(el, t, i) {
    const ts = B(6 + 0.5 * i), te = B(6 + 0.5 * i + 0.3125);
    const v = el.dataset.v;
    const n = Math.floor(clamp((t - ts) / (te - ts)) * v.length + 1e-6);
    const focus = t >= ts - 0.12 && t < te + 0.18;
    const f = clamp(spring(t - ts + 0.12, 'snappy')) * (1 - clamp(spring(t - te - 0.18, 'snappy')));
    el.style.boxShadow = `0 0 0 ${(1 + f).toFixed(2)}px ${mixHex('D2DAD5', '047857', f)}`;
    const caret = focus && (t < te || Math.floor((t - te) * 4) % 2 === 0) ? '<span class="caret"></span>' : '';
    el.innerHTML = n ? v.slice(0, n) + caret : caret + `<span class="ph">${el.dataset.p}</span>`;
  }

  function seek(t) {
    // Backdrop drifts with the camera, so every move reads as one continuous space.
    const g = track(t, [[0, [0, 0]], [B(4.25), [0, -90]], [B(10.5), [-320, -90]], [B(15), [-320, -400]], [B(22.25), [-640, -400]], [B(26.5), [-640, -310]]]);
    $('grid').style.transform = `translate(${g[0].toFixed(1)}px,${(g[1] - 6 * t).toFixed(1)}px)`;

    // 1 · Bento: tiles land on the beat, then the camera dives into the phone.
    tile($('b1head'), t, [[0, HID], [0, ON], [4.0, DIVE(420, -260)]]);
    tile($('b1bill'), t, [[0, HID], [1, ON], [4.125, DIVE(900, -320)]]);
    tile($('b1anal'), t, [[0, HID], [1.5, ON], [4.25, DIVE(420, 330)]]);
    tile($('b1rep'), t, [[0, HID], [2, ON], [4.375, DIVE(900, 330)]]);
    tile($('b1phone'), t, [[0, HID], [0.5, ON], [4.25, ZOOMED], [26.75, ON], [28.375, IN(295, 540)]]);
    $('b1head').querySelectorAll('.mask').forEach((m, i) => roll(m, t, 0.125 + 0.25 * i, 99));

    // The phone: one object from the bento tile to the macro, out left, and home again.
    const ph = poses(t, [[0, PH.hid], [0.5, PH.bento], [4.25, PH.macro, 'heavy'], [10.5, PH.out], [26.375, PH.bento], [28.375, PH.gone]]);
    place($('phone'), ph, 0, glide(t, [[B(5), -9], [B(10.5), 0]]), glide(t, [[B(5), 2.2], [B(10.5), 0]]));
    fields.forEach((el, i) => typeField(el, t, i));
    $('saveBtn').style.transform = `scale(${(1 - 0.05 * press(t, 9)).toFixed(4)})`;
    const bd = clamp(spring(t - B(9.25), 'snappy'), 0, 1.2);
    $('badge').style.transform = `scale(${bd.toFixed(3)})`;
    show($('badge'), t >= B(9.25));
    const sweep = t < B(9.25) ? s(t, 4.75, 'heavy') : s(t, 9.25, 'heavy');
    $('glint').style.transform = `translateX(${(-300 + 1000 * sweep).toFixed(1)}px) rotate(22deg)`;
    copy('c2', t, 5, 10);

    // 3 · Bills: the window pans in from the right; each field is read in turn.
    place($('bills'), poses(t, [[0, BI.r], [10.5, BI.m], [15, BI.up]]), glide(t, [[B(11), -14], [B(15), 0]]));
    billRows.forEach((r, i) => {
      const a = clamp(s(t, 11.5 + 0.25 * i, 'snappy'));
      const b = r.querySelector('b');
      b.style.opacity = a.toFixed(3);
      b.style.transform = `translateX(${((1 - a) * 14).toFixed(2)}px)`;
      r.querySelector('.sk').style.opacity = (1 - a).toFixed(3);
    });
    const hu = clamp(s(t, 13.75, 'snappy'));
    $('unitsRow').style.background = `rgba(230,244,238,${hu.toFixed(3)})`;
    const ex = clamp(s(t, 14.5, 'snappy'));
    $('exing').style.opacity = (1 - ex).toFixed(3);
    $('exdone').style.opacity = ex.toFixed(3);
    $('exdone').style.transform = `scale(${(0.6 + 0.4 * ex).toFixed(3)})`;
    copy('c3', t, 11, 14.75);

    // 4 · Analysis: rises on the boom, low across the table; then the camera lifts to Approve.
    const an = poses(t, [[0, AN.d], [14.875, AN.m], [20.5, AN.top], [22.25, AN.l]]);
    place($('analysis'), an, 0, glide(t, [[B(16), -18], [B(20.5), 0]]));
    ['ecm1', 'ecm3', 'ecm5'].forEach((id, i) => {
      const a = clamp(s(t, 17 + 0.5 * i));
      $(id).style.opacity = a.toFixed(3);
      $(id).style.transform = `translateY(${((1 - a) * 18).toFixed(2)}px)`;
    });
    const hi = clamp(s(t, 19, 'snappy'));
    $('ecm3').style.boxShadow = `0 0 0 ${(1 + hi).toFixed(2)}px ${mixHex('E3E8E5', '047857', hi)}`;
    $('ecm3').style.background = mixHex('FFFFFF', 'F1FAF6', hi);
    bars.forEach((b, i) => {
      b.style.height = (Number(b.dataset.h) * clamp(spring(t - B(17.25) - i * 0.045), 0, 1.05)).toFixed(2) + '%';
      if (i === 2) b.style.background = mixHex('9FD3BE', '047857', hi);
    });
    const ap = $('approve');
    const approved = t >= B(22) + 0.04;
    ap.textContent = approved ? '✓  Approved' : 'Approve Analysis';
    ap.style.background = approved ? '#065F46' : '';
    ap.style.transform = `scale(${(1 - 0.06 * press(t, 22)).toFixed(4)})`;
    const tf = clamp(s(t, 14.875, 'snappy')) * (1 - clamp(s(t, 20.125)));
    $('topfade').style.opacity = tf.toFixed(3);
    show($('topfade'), tf > 0.003);
    copy('c4', t, 16, 19.875);

    // 5 · Report: drafted in, then exported.
    const re = poses(t, [[0, RE.r], [22.25, RE.m], [26.25, RE.tile]]);
    re[6] = 1 - clamp(s(t, 27.25, 'snappy'));
    place($('report'), re);
    const draft = (ws, b0, b1) => ws.forEach((w, i) => {
      const a = clamp(spring(t - lerp(B(b0), B(b1), i / ws.length), 'snappy'));
      w.style.opacity = a.toFixed(3);
    });
    draft(P2, 23, 24.25);
    draft(P3, 24.25, 24.75);
    const hl = clamp(s(t, 24.5, 'snappy'));
    $('p2').style.background = `rgba(227,244,236,${hl.toFixed(3)})`;
    $('p2').style.boxShadow = `0 0 0 6px rgba(227,244,236,${hl.toFixed(3)})`;
    const gw = press(t, 25);
    $('genWord').style.transform = `scale(${(1 - 0.06 * gw).toFixed(4)})`;
    $('genWord').style.background = t >= B(25) ? mixHex('F3EEFF', 'FFFFFF', clamp(s(t, 25.5))) : '';
    const ty = track(t, [[0, -90], [B(25.25), 100], [B(26.25), -90, 'snappy']]);
    $('toast').style.transform = `translate(1440px,${ty.toFixed(2)}px)`;
    show($('toast'), t >= B(25.2) && t < B(27));
    copy('c5', t, 22.75, 25.75);

    // Cursor: one hand across both clicks.
    const cp = track(t, [[0, [1760, 1180]], [B(20.85), CUR.approve], [B(23.75), CUR.word], [B(25.9), [2060, 980]]]);
    const cs = 1 - 0.16 * (press(t, 22) + press(t, 25));
    $('cursor').style.transform = `translate(${(cp[0] - 7).toFixed(2)}px,${(cp[1] - 4).toFixed(2)}px) scale(${cs.toFixed(4)})`;
    show($('cursor'), t >= B(20.75) && t < B(26.75));

    // 6 · Pull back: the tiles return around the report, the four steps light in order.
    tile($('b6head'), t, [[0, ZOOMED], [26.5, ON], [28.5, IN(1205, 295)]]);
    tile($('b6anal'), t, [[0, ZOOMED], [26.75, ON], [28.625, IN(870, 785)]]);
    tile($('b6rep'), t, [[0, { o: 0 }], [27.125, ON, 'snappy'], [28.75, IN(1535, 785)]]);
    $('b6head').querySelectorAll('.mask').forEach((m, i) => roll(m, t, 26.625 + 0.25 * i, 99));
    chips.forEach((c, i) => {
      const a = clamp(s(t, 27.25 + 0.25 * i, 'snappy'));
      c.style.background = `rgba(74,222,154,${a.toFixed(3)})`;
      c.style.color = mixHex('F2F7F3', '0D2A20', a);
      c.style.transform = `scale(${(1 + 0.06 * press(t, 27.25 + 0.25 * i)).toFixed(4)})`;
    });

    // 7 · Lockup.
    const lk = $('lockup');
    show(lk, t >= B(28.9));
    const drift = 1 + 0.006 * Math.max(0, t - B(29));
    lk.style.transform = `scale(${drift.toFixed(5)})`;
    const lg = clamp(s(t, 29, 'heavy'), 0, 1.02);
    $('lkLogo').style.transform = `translate(${LK.logo}px,386px) scale(${(0.6 + 0.4 * lg).toFixed(4)})`;
    $('lkLogo').style.opacity = clamp(s(t, 29, 'snappy') * 1.6).toFixed(3);
    $('lkSlash').style.transform = `translate(${LK.slash}px,390px) rotate(14deg) scaleY(${clamp(s(t, 29.125, 'snappy')).toFixed(4)})`;
    $('lkWordMask').style.transform = `translate(${LK.word}px,386px)`;
    $('lkWord').style.transform = `translateX(${((1 - clamp(s(t, 29.25, 'heavy'), 0, 1.01)) * -105).toFixed(2)}%)`;
    $('lkTag').style.transform = `translateY(${((1 - s(t, 29.75, 'heavy')) * 112).toFixed(2)}%)`;
    const pl = clamp(s(t, 30.25));
    $('lkPill').style.opacity = clamp(pl * 1.6).toFixed(3);
    $('lkPill').style.transform = `translateY(${((1 - pl) * 18).toFixed(2)}px)`;
  }

  // ------------------------------------------------------------------ measured once at load
  const W = $('lkWord').getBoundingClientRect().width;
  const total = 188 + 52 + W;
  const LK = { logo: Math.round((1920 - total) / 2) };
  LK.slash = LK.logo + 188 + 24; LK.word = LK.logo + 188 + 52;
  $('lkWordMask').style.width = Math.ceil(W + 20) + 'px';
  // Click targets: where each button sits at the moment it is clicked.
  const CUR = {};
  const centre = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + r.height * 0.55]; };
  CUR.approve = [0, 0]; CUR.word = [0, 0];
  seek(B(22)); CUR.approve = centre($('approve'));
  seek(B(25)); CUR.word = centre($('genWord'));

  window.prepare = async () => {};
  window.seek = seek;
  window.LOOP = LOOP;
  window.BEAT_TIMES = BT.beats.slice();
  window.B = B;
  window.filmReady = true;
  seek(0);

  if (!new URLSearchParams(location.search).has('render')) {
    const q = new URLSearchParams(location.search).get('t');
    if (q !== null) seek(Number(q));
    else {
      const fit = () => { $('stage').style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
      fit(); addEventListener('resize', fit);
      const t0 = performance.now();
      const tick = () => { seek(((performance.now() - t0) / 1000) % LOOP); requestAnimationFrame(tick); };
      tick();
    }
  }
})();
