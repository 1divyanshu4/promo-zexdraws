// node test/motion.test.js
const M = require('../lib/motion.js');
const assert = require('node:assert');
let fails = 0;
const check = (name, fn) => { try { fn(); console.log('ok  ', name); } catch (e) { fails++; console.log('FAIL', name, '-', e.message); } };

const peak = (p) => { let m = 0; for (let t = 0; t < 3; t += 1e-4) m = Math.max(m, M.spring(t, p)); return m - 1; };
check('snappy overshoot ~1%', () => { const o = peak('snappy'); assert(o > 0.005 && o < 0.02, o); });
check('default overshoot ~0.5%', () => { const o = peak('default'); assert(o > 0.002 && o < 0.01, o); });
check('heavy has no overshoot', () => assert(peak('heavy') <= 1e-9, peak('heavy')));
check('playful overshoot visible', () => { const o = peak('playful'); assert(o > 0.1, o); });
check('spring starts at rest at 0', () => { assert.equal(M.spring(0, 'default'), 0); assert(M.spring(1e-4, 'default') < 1e-4); });
for (const p of Object.keys(M.PRESETS)) check(`${p} settles within settle()`, () => {
  for (let t = M.settle(p); t < 4; t += 0.01) assert(Math.abs(M.spring(t, p) - 1) < 0.021, `${t}`);
});

check('track: one spring per change, summed (not restarted)', () => {
  const keys = [[0, 0], [1, 10], [1.05, 20]];
  const v = M.track(1.2, keys, { preset: 'default' });
  const expect = 10 * M.spring(0.2, 'default') + 10 * M.spring(0.15, 'default');
  assert(Math.abs(v - expect) < 1e-12);
});
check('track: vector values', () => {
  const v = M.track(5, [[0, [0, 0]], [1, [3, 4]]]); assert(Math.abs(v[0] - 3) < 1e-6 && Math.abs(v[1] - 4) < 1e-6);
});
check('track loop: value and velocity continuous across the wrap', () => {
  const L = 3, keys = [[0.2, 0], [1.0, 100], [2.85, 40]];
  const f = (t) => M.track(t, keys, { loop: L });
  const h = 1e-5;
  const v0 = f(0), vL = f(L - 1e-9);
  // Second-order one-sided differences on each side of the wrap.
  const d0 = (-3 * f(0) + 4 * f(h) - f(2 * h)) / (2 * h);
  const e = L - 1e-9, dL = (3 * f(e) - 4 * f(e - h) + f(e - 2 * h)) / (2 * h);
  assert(Math.abs(v0 - vL) < 1e-6, `value ${v0} vs ${vL}`);
  assert(Math.abs(d0 - dL) < 1e-3 * Math.abs(d0), `velocity ${d0} vs ${dL}`);
});
check('indicator: leading edge moves first (stretch)', () => {
  const stops = [[0, 0, 100], [1, 300, 400]];
  const [a, b] = M.indicator(1.05, stops);
  const travelA = a - 0, travelB = b - 100;
  assert(travelB > travelA * 1.3, `${travelA} ${travelB}`);
  const [a2, b2] = M.indicator(3, stops); assert(Math.abs(a2 - 300) < 0.01 && Math.abs(b2 - 400) < 0.01);
});
check('swapAlpha: 0 before delay, ~1 mid, 0 by tOut - lead', () => {
  assert.equal(M.swapAlpha(1.0, 1, 2), 0);
  assert(M.swapAlpha(1.5, 1, 2) > 0.98);
  assert(M.swapAlpha(1.97, 1, 2) < 0.03);
  assert.equal(M.swapAlpha(2.0, 1, 2), 0);
});
check('loopT pins last frame to first', () => {
  assert.equal(M.loopT(15, 15), 0); assert.equal(M.loopT(-0.5, 15), 14.5);
});
for (const p of ['snappy', 'default', 'heavy', 'playful']) check(`springIntegral matches numeric (${p})`, () => {
  let acc = 0; const h = 1e-5; for (let u = h / 2; u < 0.7; u += h) acc += M.spring(u, p) * h;
  assert(Math.abs(acc - M.springIntegral(0.7, p)) < 1e-4, `${acc} vs ${M.springIntegral(0.7, p)}`);
});
check('glide: constant speed once ramped, stops cleanly', () => {
  const keys = [[0, 100], [2, 0]];
  const v = (t) => (M.glide(t + 1e-4, keys) - M.glide(t - 1e-4, keys)) / 2e-4;
  assert(Math.abs(v(1.5) - 100) < 0.5, v(1.5));
  assert(Math.abs(v(3)) < 0.5, v(3));
  assert(v(0.05) < 60, 'ramps in, no jolt');
});
process.exit(fails ? 1 : 0);
