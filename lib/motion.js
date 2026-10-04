// lib/motion.js: closed-form springs. Every function here is a pure function of time.
//
// Nothing is integrated frame by frame and nothing is restarted: a spring that starts at time
// t0 is evaluated analytically at any t, so seek(t) can jump anywhere and get the same frame.
//
//   spring(tau, preset)          0 -> 1 step response, tau seconds after the change
//   track(t, keys, opts)         a value with several targets: one spring per change, summed
//   indicator(t, stops, opts)    [a, b] edges; the leading edge is stiffer, so it stretches
//   swapAlpha(t, tIn, tOut, o)   text inside a morphing box: in after the morph, out before the next
//   glide(t, keys, opts)         drift: velocity ramps on springs, position integrated exactly
//   loopT(t, dur)                wrap time so the last frame is pinned to the first
//
// Presets (overshoot = peak above target for a unit step):
//   snappy   ~1.1%  buttons, toggles, leading edges, digits
//   default  ~0.5%  cards, containers, camera
//   heavy     0%    big type, logo lockups (critically damped)
//   playful  ~16%   visible overshoot: mascots only
//
// Works as a browser <script> (window.Motion) and as a CommonJS module (require('./lib/motion.js')).
(function (root) {
  'use strict';

  const PRESETS = Object.freeze({
    snappy: Object.freeze({ omega: 34, zeta: 0.82 }),
    default: Object.freeze({ omega: 22, zeta: 0.86 }),
    heavy: Object.freeze({ omega: 20, zeta: 1.0 }),
    playful: Object.freeze({ omega: 16, zeta: 0.5 }),
  });

  function resolve(p) {
    if (!p) return PRESETS.default;
    if (typeof p === 'string') {
      const r = PRESETS[p];
      if (!r) throw new Error(`motion: unknown preset "${p}"`);
      return r;
    }
    return p;
  }

  // Unit step response of a damped harmonic oscillator, starting at rest.
  function spring(tau, preset) {
    if (!(tau > 0)) return 0;
    const { omega: w, zeta: z } = resolve(preset);
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + ((z * w) / wd) * Math.sin(wd * tau));
    }
    if (z === 1) return 1 - Math.exp(-w * tau) * (1 + w * tau);
    const s = Math.sqrt(z * z - 1);
    const r1 = -w * (z - s), r2 = -w * (z + s);
    return 1 + (r2 * Math.exp(r1 * tau) - r1 * Math.exp(r2 * tau)) / (r1 - r2);
  }

  // Seconds until a preset stays within 2% of its target (the usual envelope estimate).
  function settle(preset) {
    const { omega: w, zeta: z } = resolve(preset);
    return z >= 1 ? 5.8 / w : 4 / (z * w);
  }

  function loopT(t, dur) {
    return ((t % dur) + dur) % dur;
  }

  // keys: [[time, value], ...] or [[time, value, preset], ...], sorted by time.
  //   Plain: the first key is the starting value; every later key starts one spring from
  //   the previous target to its own. Before keys[0] the value is keys[0]'s.
  //   opts.loop = duration: the sequence repeats forever. The last target flows into the first,
  //   and springs still settling from the previous pass are included, so value AND velocity
  //   are continuous across the wrap. Key times must lie in [0, loop).
  // Values may be numbers or arrays of numbers (e.g. [x, y]).
  function track(t, keys, opts = {}) {
    if (!keys.length) throw new Error('motion.track: no keys');
    const preset = opts.preset;
    const vec = Array.isArray(keys[0][1]);
    const sub = (a, b) => (vec ? a.map((x, i) => x - b[i]) : a - b);
    const addScaled = (acc, d, k) => {
      if (vec) for (let i = 0; i < acc.length; i++) acc[i] += d[i] * k;
      else acc[0] += d * k;
    };
    const L = opts.loop;
    let acc, start;
    if (L) {
      t = loopT(t, L);
      const last = keys[keys.length - 1][1];
      acc = vec ? last.slice() : [last];
      start = 0;
      for (let k = 0; k < keys.length; k++) {
        const prev = k ? keys[k - 1][1] : last;
        const d = sub(keys[k][1], prev);
        const p = keys[k][2] || preset;
        addScaled(acc, d, spring(t - keys[k][0], p) + spring(t - keys[k][0] + L, p));
      }
    } else {
      const first = keys[0][1];
      acc = vec ? first.slice() : [first];
      start = 1;
      for (let k = start; k < keys.length; k++) {
        const d = sub(keys[k][1], keys[k - 1][1]);
        addScaled(acc, d, spring(t - keys[k][0], keys[k][2] || preset));
      }
    }
    return vec ? acc : acc[0];
  }

  // stops: [[time, a, b], ...]: an indicator spanning a..b (e.g. left and right edge).
  // On each change, whichever edge sits in the direction of travel leads on `lead` (snappy)
  // and the other trails on `trail` (default), so the bar stretches toward the target and
  // the far edge catches up. Supports opts.loop like track().
  function indicator(t, stops, opts = {}) {
    const lead = opts.lead || 'snappy';
    const trail = opts.trail || 'default';
    const L = opts.loop;
    const n = stops.length;
    const keysA = [], keysB = [];
    for (let k = 0; k < n; k++) {
      const prev = k ? stops[k - 1] : L ? stops[n - 1] : stops[k];
      const dir = stops[k][1] + stops[k][2] - (prev[1] + prev[2]);
      keysA.push([stops[k][0], stops[k][1], dir < 0 ? lead : trail]);
      keysB.push([stops[k][0], stops[k][2], dir > 0 ? lead : trail]);
    }
    return [track(t, keysA, { loop: L }), track(t, keysB, { loop: L })];
  }

  // 0..1 visibility for content inside a morphing container whose morph starts at tIn and
  // whose next morph starts at tOut. It enters `delay` after the morph begins and has fully
  // left `lead` before the next one, so text never rides a resize. With a loop, tOut may wrap.
  function swapAlpha(t, tIn, tOut, opts = {}) {
    const preset = opts.preset || 'snappy';
    const delay = opts.delay ?? 0.06;
    const lead = opts.lead ?? 0.03;
    const L = opts.loop;
    if (L) {
      t = loopT(t, L);
      if (tOut <= tIn) tOut += L;
      if (t < tIn) t += L;
    }
    const exitStart = tOut - lead - settle(preset);
    if (t < tIn || t >= tOut) return 0;
    const a = spring(t - tIn - delay, preset) * (1 - spring(t - exitStart, preset));
    return Math.min(1, Math.max(0, a));
  }

  // Integral of spring() from 0 to tau, in closed form.
  function springIntegral(tau, preset) {
    if (!(tau > 0)) return 0;
    const { omega: w, zeta: z } = resolve(preset);
    if (z === 1) return tau - 2 / w + (Math.exp(-w * tau) * (2 + w * tau)) / w;
    if (z < 1) {
      const wd = w * Math.sqrt(1 - z * z), a = z * w;
      // integral of e^{-a u}(cos(wd u) + (a/wd) sin(wd u)) du from 0 to tau
      const e = Math.exp(-a * tau), c = Math.cos(wd * tau), sn = Math.sin(wd * tau);
      const d = a * a + wd * wd;
      const ic = (a - e * (a * c - wd * sn)) / d; // integral of e^{-au} cos
      const is = (wd - e * (a * sn + wd * c)) / d; // integral of e^{-au} sin
      return tau - (ic + (a / wd) * is);
    }
    // Overdamped: integrate numerically on a fixed grid (still a pure function of tau).
    let acc = 0; const n = 200, h = tau / n;
    for (let i = 0; i < n; i++) acc += spring((i + 0.5) * h, preset) * h;
    return acc;
  }

  // A drift: keys [[time, velocity], ...] set a velocity (units per second) that ramps in on
  // a spring, and the position is that velocity integrated, in closed form. Use it for slow
  // constant-speed camera moves (dolly, drift) that must start and stop without a jolt.
  // The position before keys[0] is 0; after the last key it keeps moving at the last
  // velocity, so end a drift with a [time, 0] key.
  function glide(t, keys, opts = {}) {
    const preset = opts.preset || 'heavy';
    let x = 0;
    for (let k = 0; k < keys.length; k++) {
      const dv = keys[k][1] - (k ? keys[k - 1][1] : 0);
      x += dv * springIntegral(t - keys[k][0], keys[k][2] || preset);
    }
    return x;
  }

  // Discrete state at time t (no easing): the value of the last key at or before t.
  function pick(t, keys, opts = {}) {
    if (opts.loop) t = loopT(t, opts.loop);
    let v = opts.loop ? keys[keys.length - 1][1] : keys[0][1];
    for (const k of keys) if (k[0] <= t) v = k[1];
    return v;
  }

  // A playhead, not an easing: constant-rate segments between [time, position] keys. Use for
  // footage clocks, where the source must run at a steady speed.
  function clock(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const k = (t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
        return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * k;
      }
    }
    return keys[keys.length - 1][1];
  }

  const Motion = Object.freeze({ PRESETS, spring, springIntegral, settle, track, indicator, swapAlpha, glide, loopT, pick, clock });
  if (typeof module === 'object' && module.exports) module.exports = Motion;
  else root.Motion = Motion;
})(typeof globalThis !== 'undefined' ? globalThis : this);
