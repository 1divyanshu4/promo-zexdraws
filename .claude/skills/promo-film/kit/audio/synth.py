"""Synthesis primitives shared by the score: filters, envelopes, drums and UI sounds.

Everything is seeded, so a score built from these renders identically every time.
"""

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def saw(f, n, phase=0.0):
    # Band-limited enough for our register: a few-harmonic additive saw.
    t = np.arange(n) / SR
    out = np.zeros(n)
    k = 1
    while k * f < 12000 and k <= 40:
        out += np.sin(2 * np.pi * k * f * t + phase * k) / k
        k += 1
    return out * 0.6


def add(buf, sig, at):
    i = int(round(at * SR))
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


# ---------------------------------------------------------------- instruments

def kick():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_exp(n, 0.16)
    click = hp(rng.standard_normal(n), 3000) * env_exp(n, 0.002) * 0.25
    return (body + click) * 0.95


def clap():
    n = int(0.3 * SR)
    noise = bp(rng.standard_normal(n), 900, 2600)
    e = np.zeros(n)
    for d in (0.0, 0.009, 0.018):
        i = int(d * SR)
        e[i:] += env_exp(n - i, 0.006 if d < 0.018 else 0.07)
    return noise * e * 0.5


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    x = hp(rng.standard_normal(n), 7500, 4)
    return x * env_exp(n, 0.07 if open_ else 0.012) * (0.22 if open_ else 0.16)


# ---------------------------------------------------------------- UI sounds

def ui(kind):
    if kind == "click":
        n = int(0.06 * SR)
        t = np.arange(n) / SR
        blip = np.sin(2 * np.pi * 2300 * t) * env_exp(n, 0.006)
        tick = bp(rng.standard_normal(n), 2500, 9000) * env_exp(n, 0.0015)
        return (blip * 0.35 + tick * 0.6) * 0.8
    if kind == "tick":
        n = int(0.04 * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * 3400 * t) * env_exp(n, 0.004) * 0.22
    if kind == "swish":
        n = int(0.22 * SR)
        x = bp(rng.standard_normal(n), 1800, 6500)
        e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
        return x * e * 0.12
    if kind == "whoosh":
        n = int(0.32 * SR)
        x = rng.standard_normal(n)
        lo = lp(x, 900)
        hi = bp(x, 1500, 5000)
        k = np.linspace(0, 1, n)
        e = np.sin(np.pi * k) ** 1.5
        return (lo * (1 - k) + hi * k) * e * 0.2
    return np.zeros(1)
