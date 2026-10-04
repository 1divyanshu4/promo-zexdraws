// GreenSage AI launch film (docs/shotlist.md, storyboard in docs/storyboard/v3.html + two added scenes).
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
    macro: { x: 1080, y: 175, ry: -24, rx: 10, rz: 4, s: 1.42 }, cam: { x: 1120, y: 165, ry: -15, rx: 8, rz: 2, s: 1.42 }, out: { x: -1150, y: 175, ry: -12, rx: 10, rz: 4, s: 1.3 },
    gone: { x: 485, y: 100, s: 0.5, o: 0 },
  };
  const BI = { r: { x: 2500, y: 220, ry: -16, rx: 5 }, m: { x: 740, y: 210, ry: -16, rx: 5, s: 0.97 }, up: { x: 760, y: -1050, ry: -16, rx: 22, s: 0.95 } };
  const AN = { d: { x: 420, y: 1500, rx: 28, rz: -6, s: 1.4 }, m: { x: 420, y: 330, rx: 28, rz: -6, s: 1.4 }, top: { x: 390, y: 200, rx: 8, rz: -2, s: 1.08 }, l: { x: -1700, y: 200, rx: 8, rz: -2, s: 1 } };
  const RE = { r: { x: 2400, y: 170, ry: -14, rx: 4, s: 0.98 }, m: { x: 780, y: 170, ry: -14, rx: 4, s: 0.98 }, tile: { x: 1210, y: 425, s: 0.58 } };

  // Combined analysis: one link per input card into the analysis node (built once, drawn per frame).
  const convCards = [...document.querySelectorAll('#conv .src')];
  const NS = 'http://www.w3.org/2000/svg';
  const links = convCards.map((c) => {
    const y = c.offsetTop + c.offsetHeight / 2, ny = $('node').offsetTop + $('node').offsetHeight / 2;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M1240 ${y} C1320 ${y}, 1320 ${ny}, 1400 ${ny}`);
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#4ADE9A'); path.setAttribute('stroke-width', '2');
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', '5'); dot.setAttribute('fill', '#4ADE9A');
    $('convLines').append(path, dot);
    const L = path.getTotalLength();
    path.style.strokeDasharray = `${L} ${L}`;
    return { path, dot, L };
  });

  function typeField(el, t, i) {
    const ts = B(5.75 + 0.375 * i), te = B(5.75 + 0.375 * i + 0.25);
    const v = el.dataset.v;
    const n = Math.floor(clamp((t - ts) / (te - ts)) * v.length + 1e-6);
    const focus = t >= ts - 0.05 && t < te + 0.05;
    const f = clamp(spring(t - ts + 0.05, "snappy")) * (1 - clamp(spring(t - te - 0.05, "snappy")));
    el.style.boxShadow = `0 0 0 ${(1 + f).toFixed(2)}px ${mixHex('D2DAD5', '047857', f)}`;
    const caret = focus && (t < te || Math.floor((t - te) * 4) % 2 === 0) ? '<span class="caret"></span>' : '';
    el.innerHTML = n ? v.slice(0, n) + caret : caret + `<span class="ph">${el.dataset.p}</span>`;
  }

  function seek(t) {
    // Backdrop drifts with the camera, so every move reads as one continuous space.
    const g = track(t, [[0, [0, 0]], [B(4.25), [0, -90]], [B(9.75), [-120, -90]], [B(14.5), [-440, -90]], [B(19), [-440, -300]], [B(24.5), [-440, -560]], [B(32.25), [-760, -560]], [B(36.5), [-760, -470]]]);
    $('grid').style.transform = `translate(${g[0].toFixed(1)}px,${(g[1] - 6 * t).toFixed(1)}px)`;

    // Bento: tiles land on the beat, then the camera dives into the phone.
    tile($('b1head'), t, [[0, HID], [0, ON], [4.0, DIVE(420, -260)]]);
    tile($('b1bill'), t, [[0, HID], [1, ON], [4.125, DIVE(900, -320)]]);
    tile($('b1anal'), t, [[0, HID], [1.5, ON], [4.25, DIVE(420, 330)]]);
    tile($('b1rep'), t, [[0, HID], [2, ON], [4.375, DIVE(900, 330)]]);
    tile($('b1phone'), t, [[0, HID], [0.5, ON], [4.25, ZOOMED], [36.75, ON], [39, IN(295, 540)]]);
    $('b1head').querySelectorAll('.mask').forEach((m, i) => roll(m, t, 0.125 + 0.25 * i, 99));

    // The phone: from the bento tile to the macro, a turn for the camera, out left, and home again.
    const ph = poses(t, [[0, PH.hid], [0.5, PH.bento], [4.25, PH.macro, 'heavy'], [9.75, PH.cam], [14.5, PH.out], [36.375, PH.bento], [39, PH.gone]]);
    place($('phone'), ph, 0, glide(t, [[B(5), -9], [B(14.5), 0]]), glide(t, [[B(5), 2.2], [B(9.75), -1.5], [B(14.5), 0]]));
    // 01 Data collection.
    fields.forEach((el, i) => typeField(el, t, i));
    $('saveBtn').style.transform = `scale(${(1 - 0.05 * press(t, 8)).toFixed(4)})`;
    const bd = clamp(spring(t - B(8.25), 'snappy'), 0, 1.2);
    $('badge').style.transform = `scale(${bd.toFixed(3)})`;
    show($('badge'), t >= B(8.25));
    const sweep = t < B(9.75) ? s(t, 4.75, 'heavy') : s(t, 9.75, 'heavy');
    $('glint').style.transform = `translateX(${(-300 + 1000 * sweep).toFixed(1)}px) rotate(22deg)`;
    copy('c2', t, 5, 9.25);
    // 02 Evidence collection: the camera wipes up over the sheet; two shots on the beat.
    const ck = clamp(track(t, [[0, 0], [B(9.75), 1], [B(30), 0, 'snappy']]), 0, 1);
    $('camScr').style.clipPath = `inset(${((1 - ck) * 100).toFixed(2)}% 0 0 0 round 20px)`;
    show($('camScr'), ck > 0.002);
    const SHOTS = [11.25, 12.25];
    const fl = Math.max(...SHOTS.map((b) => (t >= B(b) ? 1 - clamp(spring(t - B(b), 'snappy')) : 0)));
    $('flash').style.opacity = (0.75 * fl).toFixed(3);
    $('shutter').style.transform = `scale(${(1 - 0.12 * (press(t, 11.25) + press(t, 12.25))).toFixed(4)})`;
    $('camCount').textContent = SHOTS.filter((b) => t >= B(b) + 0.05).length;
    ['th1', 'th2'].forEach((id, i) => {
      const a = clamp(s(t, SHOTS[i] + 0.125, 'snappy'), 0, 1.1);
      $(id).style.transform = `scale(${a.toFixed(3)})`;
      show($(id), t >= B(SHOTS[i] + 0.125));
    });
    copy('cEv', t, 10.25, 13.75);

    // 03 Utility uploads: the window pans in from the right; each field is read in turn.
    place($('bills'), poses(t, [[0, BI.r], [14.5, BI.m], [18.75, BI.up]]), glide(t, [[B(15), -14], [B(18.75), 0]]));
    billRows.forEach((r, i) => {
      const a = clamp(s(t, 15.5 + 0.25 * i, 'snappy'));
      const b = r.querySelector('b');
      b.style.opacity = a.toFixed(3);
      b.style.transform = `translateX(${((1 - a) * 14).toFixed(2)}px)`;
      r.querySelector('.sk').style.opacity = (1 - a).toFixed(3);
    });
    const hu = clamp(s(t, 17.75, 'snappy'));
    $('unitsRow').style.background = `rgba(230,244,238,${hu.toFixed(3)})`;
    const ex = clamp(s(t, 18.25, 'snappy'));
    $('exing').style.opacity = (1 - ex).toFixed(3);
    $('exdone').style.opacity = ex.toFixed(3);
    $('exdone').style.transform = `scale(${(0.6 + 0.4 * ex).toFixed(3)})`;
    copy('c3', t, 15, 18.25);

    // 04 Combined analysis: the inputs land, link up and feed one analysis.
    show($('conv'), t >= B(18.8) && t < B(25.75));
    convCards.forEach((c, i) => {
      const k = track(t, [[0, 0], [B(19.125 + 0.25 * i), 1], [B(24.25 + 0.0625 * i), 2, 'snappy']]);
      const x = k <= 1 ? (1 - k) * -90 : (k - 1) * 260;
      c.style.transform = `translateX(${x.toFixed(2)}px)`;
      c.style.opacity = clamp(k <= 1 ? k * 1.8 : 1 - (k - 1) * 2.5).toFixed(3);
      const ln = links[i];
      const d = clamp(s(t, 19.625 + 0.25 * i)) * (1 - clamp(s(t, 24.25, 'snappy')));
      ln.path.style.strokeDashoffset = (ln.L * (1 - d)).toFixed(2);
      const u = (t - B(21.25) + i * 0.17) * 0.9;
      const live = t >= B(21.25) && t < B(24.25);
      const pt = ln.path.getPointAtLength(ln.L * (((u % 1) + 1) % 1));
      ln.dot.setAttribute('cx', pt.x.toFixed(1)); ln.dot.setAttribute('cy', pt.y.toFixed(1));
      ln.dot.style.visibility = live ? 'visible' : 'hidden';
    });
    const nk = track(t, [[0, 0], [B(20.25), 1, 'heavy'], [B(24.5), 2, 'snappy']]);
    $('node').style.transform = nk <= 1 ? `translateY(${((1 - nk) * 40).toFixed(2)}px) scale(${(0.92 + 0.08 * nk).toFixed(4)})` : `translateY(${((nk - 1) * -180).toFixed(2)}px)`;
    $('node').style.opacity = clamp(nk <= 1 ? nk * 1.8 : 2 - nk).toFixed(3);
    const ran = t >= B(23.25) + 0.04;
    $('runAI').innerHTML = ran ? '⟳&nbsp;&nbsp;Generating ECMs…' : '⟳&nbsp;&nbsp;Run AI Analysis';
    $('runAI').style.transform = `scale(${(1 - 0.06 * press(t, 23.25)).toFixed(4)})`;
    copy('cCo', t, 19.5, 23.75);

    // 05 ECM generation: rises on the boom, low across the table; then the camera lifts to Approve.
    const an = poses(t, [[0, AN.d], [24.875, AN.m], [30.5, AN.top], [32.25, AN.l]]);
    place($('analysis'), an, 0, glide(t, [[B(26), -18], [B(30.5), 0]]));
    ['ecm1', 'ecm3', 'ecm5'].forEach((id, i) => {
      const a = clamp(s(t, 27 + 0.5 * i));
      $(id).style.opacity = a.toFixed(3);
      $(id).style.transform = `translateY(${((1 - a) * 18).toFixed(2)}px)`;
    });
    const hi = clamp(s(t, 29, 'snappy'));
    $('ecm3').style.boxShadow = `0 0 0 ${(1 + hi).toFixed(2)}px ${mixHex('E3E8E5', '047857', hi)}`;
    $('ecm3').style.background = mixHex('FFFFFF', 'F1FAF6', hi);
    bars.forEach((b, i) => {
      b.style.height = (Number(b.dataset.h) * clamp(spring(t - B(27.25) - i * 0.045), 0, 1.05)).toFixed(2) + '%';
      if (i === 2) b.style.background = mixHex('9FD3BE', '047857', hi);
    });
    const ap = $('approve');
    const approved = t >= B(32) + 0.04;
    ap.textContent = approved ? '✓  Approved' : 'Approve Analysis';
    ap.style.background = approved ? '#065F46' : '';
    ap.style.transform = `scale(${(1 - 0.06 * press(t, 32)).toFixed(4)})`;
    const tf = clamp(s(t, 24.875, 'snappy')) * (1 - clamp(s(t, 30.125)));
    $('topfade').style.opacity = tf.toFixed(3);
    show($('topfade'), tf > 0.003);
    copy('c4', t, 26, 29.875);

    // 06 Report generation: drafted in, then exported.
    const re = poses(t, [[0, RE.r], [32.25, RE.m], [36.25, RE.tile]]);
    re[6] = 1 - clamp(s(t, 37.25, 'snappy'));
    place($('report'), re);
    const draft = (ws, b0, b1) => ws.forEach((w, i) => {
      const a = clamp(spring(t - lerp(B(b0), B(b1), i / ws.length), 'snappy'));
      w.style.opacity = a.toFixed(3);
    });
    draft(P2, 33, 34.25);
    draft(P3, 34.25, 34.75);
    const hl = clamp(s(t, 34.5, 'snappy'));
    $('p2').style.background = `rgba(227,244,236,${hl.toFixed(3)})`;
    $('p2').style.boxShadow = `0 0 0 6px rgba(227,244,236,${hl.toFixed(3)})`;
    const gw = press(t, 35);
    $('genWord').style.transform = `scale(${(1 - 0.06 * gw).toFixed(4)})`;
    $('genWord').style.background = t >= B(35) ? mixHex('F3EEFF', 'FFFFFF', clamp(s(t, 35.5))) : '';
    // The .docx jumps out of the button that made it: from the click point, on an arc, to rest below-left.
    const dk = clamp(s(t, 35.0625), 0, 1.02), ds = clamp(s(t, 35.0625, 'snappy'), 0, 1.03), dx = clamp(s(t, 36, 'snappy'));
    const D0 = CUR.word, D1 = [CUR.word[0] - 400, CUR.word[1] + 64];
    const ddx = lerp(D0[0], D1[0], dk), ddy = lerp(D0[1], D1[1], dk) - 110 * Math.sin(Math.PI * clamp(dk));
    $('docx').style.transform = `translate(${ddx.toFixed(2)}px,${ddy.toFixed(2)}px) scale(${(0.15 + 0.85 * ds - 0.1 * dx).toFixed(4)})`;
    $('docx').style.opacity = (clamp(ds * 3) * (1 - dx)).toFixed(3);
    show($('docx'), t >= B(35.0625) && t < B(36.75));
    copy('c5', t, 32.75, 35.75);

    // Cursor: one hand across both clicks.
    const cp = track(t, [[0, [1760, 1180]], [B(30.85), CUR.approve], [B(33.75), CUR.word], [B(35.9), [2060, 980]]]);
    const cs = 1 - 0.16 * (press(t, 32) + press(t, 35));
    $('cursor').style.transform = `translate(${(cp[0] - 7).toFixed(2)}px,${(cp[1] - 4).toFixed(2)}px) scale(${cs.toFixed(4)})`;
    show($('cursor'), t >= B(30.75) && t < B(36.75));

    // Pull back: the tiles return around the report, the six steps light in order.
    tile($('b6head'), t, [[0, ZOOMED], [36.5, ON], [39, IN(1205, 295)]]);
    tile($('b6anal'), t, [[0, ZOOMED], [36.75, ON], [39.125, IN(870, 785)]]);
    tile($('b6rep'), t, [[0, { o: 0 }], [37.125, ON, 'snappy'], [39.25, IN(1535, 785)]]);
    $('b6head').querySelectorAll('.mask').forEach((m, i) => roll(m, t, 36.625 + 0.25 * i, 99));
    chips.forEach((c, i) => {
      const a = clamp(s(t, 37.25 + 0.25 * i, 'snappy'));
      c.style.background = `rgba(74,222,154,${a.toFixed(3)})`;
      c.style.color = mixHex('F2F7F3', '0D2A20', a);
      c.style.transform = `scale(${(1 + 0.06 * press(t, 37.25 + 0.25 * i)).toFixed(4)})`;
    });

    // Lockup.
    const L0 = 40;
    const lk = $('lockup');
    show(lk, t >= B(L0 - 0.1));
    lk.style.transform = `scale(${(1 + 0.006 * Math.max(0, t - B(L0))).toFixed(5)})`;
    // The seed opens into the mark, a ring ripples out, the leaf turns upright.
    const open = clamp(s(t, L0, 'heavy'), 0, 1);
    const step = s(t, L0 + 0.375, 'heavy');
    const mx = lerp(LK.seed, LK.mark, step);
    $('lkMark').style.transform = `translate(${mx.toFixed(2)}px,${LK.y}px)`;
    $('lkMark').style.clipPath = `circle(${(open * 71).toFixed(2)}% at 50% 50%)`;
    $('lkLeaf').style.transform = `rotate(${((1 - s(t, L0 + 0.125, 'heavy')) * -24).toFixed(2)}deg) scale(${(0.7 + 0.3 * clamp(s(t, L0 + 0.125, 'heavy'), 0, 1.02)).toFixed(4)})`;
    const rp = clamp(s(t, L0 + 0.0625, 'heavy'));
    $('lkRing').style.transform = `translate(${mx.toFixed(2)}px,${LK.y}px) scale(${(1 + 0.7 * rp).toFixed(4)})`;
    $('lkRing').style.opacity = (t >= B(L0) ? 0.9 * (1 - rp) : 0).toFixed(3);
    // The wordmark rises letter by letter beside the mark; tagline and pill follow, left-aligned.
    $('lkWordMask').style.transform = `translate(${LK.text}px,${LK.y - 6}px)`;
    WORD.forEach((c, i) => { c.style.transform = `translateY(${((1 - clamp(spring(t - B(L0 + 0.875) - i * 0.03, 'heavy'), 0, 1.01)) * 105).toFixed(2)}%)`; });
    $('lkTagMask').style.transform = `translate(${LK.text + 4}px,${LK.y + 160}px)`;
    $('lkTag').style.transform = `translateY(${((1 - s(t, L0 + 1.25, 'heavy')) * 110).toFixed(2)}%)`;
  }

  // ------------------------------------------------------------------ measured once at load
  // Lockup: wordmark split into letters; the group (mark + text) is centred on the frame.
  const word = $('lkWord');
  word.innerHTML = [...word.textContent].map((c) => `<span style="display:inline-block">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  const WORD = [...word.children];
  const W = word.getBoundingClientRect().width;
  $('lkWordMask').style.width = Math.ceil(W + 24) + 'px';
  $('lkTagMask').style.width = '1200px';
  const LK = { mark: Math.round((1920 - (200 + 52 + W)) / 2), seed: 860, y: 432 };
  LK.text = LK.mark + 252;
  // Click targets: where each button sits at the moment it is clicked.
  const CUR = {};
  const centre = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + r.height * 0.55]; };
  CUR.approve = [0, 0]; CUR.word = [0, 0];
  seek(B(32)); CUR.approve = centre($('approve'));
  seek(B(35)); CUR.word = centre($('genWord'));

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
