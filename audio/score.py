"""Synthesize the ZexDraws launch score, measure its beat grid, and lay UI sounds on it.

    python3 audio/score.py

Writes:
  audio/music.wav   the track alone (used for beat measurement)
  beats.json        measured beat times (seconds), one per grid beat
  audio/score.wav   music + UI sounds, loudness-normalised to -14 LUFS

Everything is seeded; running it twice gives identical files. The track is rendered twice in a
row and the second pass is kept, so reverb and release tails from the end wrap into the start
and the film loops without a click.
"""

import json
import pathlib
import subprocess

import librosa
import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt

ROOT = pathlib.Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "timeline.json").read_text())
SR = 48000
BPM = TL["bpm"]
BEAT = 60.0 / BPM
NBEATS = TL["bars"] * TL["beatsPerBar"]
LOOP = NBEATS * BEAT  # 15.0 s at 128 BPM
N = int(round(LOOP * SR))
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


def bass(note, dur):
    n = int(dur * SR)
    f = midi(note)
    x = saw(f, n) + 0.5 * np.sin(2 * np.pi * f / 2 * np.arange(n) / SR)
    x = lp(x, 520)
    a = np.minimum(1, np.arange(n) / (0.004 * SR))
    r = np.minimum(1, (n - np.arange(n)) / (0.02 * SR))
    return x * a * r * 0.42


def pluck(note, dur=0.32):
    n = int(dur * SR)
    f = midi(note)
    x = saw(f, n) + saw(f * 1.004, n, 1.3)
    # Filter envelope approximated by mixing a bright and a dark copy.
    e = env_exp(n, 0.05)
    x = lp(x, 5200) * e + lp(x, 900) * (1 - e)
    return x * env_exp(n, 0.11) * 0.12


def pad(notes, dur):
    n = int(dur * SR)
    x = np.zeros(n)
    for k, note in enumerate(notes):
        for det in (-0.006, 0.0, 0.007):
            x += saw(midi(note) * (1 + det), n, k + det * 100)
    x = lp(x, 1400)
    a = np.minimum(1, np.arange(n) / (0.25 * SR))
    r = np.minimum(1, (n - np.arange(n)) / (0.3 * SR))
    return x * a * r * 0.022


# F minor: i  VI  III  VII | i  VI  iv  V
CHORDS = [
    (53, [65, 68, 72]),  # Fm
    (49, [65, 68, 73]),  # Db
    (56, [63, 68, 72]),  # Ab
    (51, [63, 67, 70]),  # Eb
    (53, [65, 68, 72]),  # Fm
    (49, [65, 68, 73]),  # Db
    (46, [65, 70, 73]),  # Bbm
    (48, [64, 67, 72]),  # C
]
BASS_RHYTHM = [0, 0.5, 0.75, 1.5, 2, 2.5, 2.75, 3.5]  # beats within the bar
ARP_ORDER = [0, 1, 2, 1, 2, 0, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1]


def render_music():
    total = 2 * N  # two passes: tails of pass 1 wrap into pass 2
    drums = np.zeros(total)
    music = np.zeros(total)
    send = np.zeros(total)
    sidechain = np.ones(total)
    K, C, HC, HO = kick(), clap(), hat(), hat(True)
    for p in range(2):
        base = p * LOOP
        for bar in range(TL["bars"]):
            b0 = base + bar * 4 * BEAT
            root, ch = CHORDS[bar]
            breakdown = bar == 1  # "you just draw": lighter bar
            for beat in range(4):
                t = b0 + beat * BEAT
                if not breakdown or beat == 0:
                    add(drums, K, t)
                    i = int(t * SR)
                    duck = 1 - 0.55 * env_exp(int(0.3 * SR), 0.09)
                    sidechain[i : i + len(duck)] = np.minimum(sidechain[i : i + len(duck)], duck[: total - i])
                if beat in (1, 3):
                    add(drums, C * (0.6 if breakdown else 1), t)
                    add(send, C * 0.5, t)
                for s in range(4):
                    ts = t + s * BEAT / 4
                    if s == 2:
                        add(drums, HO if not breakdown else HC, ts)
                    else:
                        add(drums, HC * (1.0 if s == 0 else 0.6), ts)
            for r in BASS_RHYTHM:
                note = root - 12 + (12 if r in (0.75, 2.75) else 0)
                add(music, bass(note, BEAT * 0.45), b0 + r * BEAT)
            for s in range(16):
                note = ch[ARP_ORDER[s]] + (12 if s % 8 >= 4 else 0)
                sig = pluck(note) * (0.55 if breakdown else 1)
                add(music, sig, b0 + s * BEAT / 4)
                add(send, sig * 0.6, b0 + s * BEAT / 4)
            add(music, pad(ch, 4 * BEAT + 0.3), b0)
        # Riser across bar 7 into bar 8, crash on the loop point.
        n = int(4 * BEAT * SR)
        tt = np.linspace(0, 1, n)
        rise = bp(rng.standard_normal(n), 2000, 9000) * tt**2 * 0.09
        add(music, rise, base + 24 * BEAT)
        crash = hp(rng.standard_normal(int(1.6 * SR)), 4000) * env_exp(int(1.6 * SR), 0.45) * 0.16
        add(drums, crash, base)
        add(send, crash * 0.4, base)
    # Synthetic room: exponentially decaying stereo-ish noise IR.
    ir_n = int(1.3 * SR)
    ir = rng.standard_normal(ir_n) * env_exp(ir_n, 0.28)
    ir = lp(ir, 6000) / np.sqrt(np.sum(ir**2))
    verb = fftconvolve(send, ir)[:total] * 0.35
    mix = drums + (music + verb) * sidechain
    return mix[N:]  # keep the second pass


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


# ---------------------------------------------------------------- beat measurement

def measure_beats(y):
    hop = 128
    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=hop, aggregate=np.median)
    tempo, _ = librosa.beat.beat_track(onset_envelope=env, sr=SR, hop_length=hop, start_bpm=BPM, units="time")
    peaks = librosa.util.peak_pick(env, pre_max=3, post_max=3, pre_avg=10, post_avg=10, delta=0.2, wait=8)
    peak_t = librosa.frames_to_time(peaks, sr=SR, hop_length=hop)
    beats = []
    for i in range(NBEATS):
        grid = i * BEAT
        near = peak_t[np.abs(peak_t - grid) < 0.04]
        beats.append(float(near[np.argmin(np.abs(near - grid))]) if len(near) else grid)
    return float(np.atleast_1d(tempo)[0]), beats


def main():
    music = render_music()
    music /= np.max(np.abs(music)) * 1.05
    sf.write(ROOT / "audio/music.wav", music, SR, subtype="FLOAT")

    tempo, beats = measure_beats(music)
    err = [b - i * BEAT for i, b in enumerate(beats)]
    out = {
        "bpm": BPM,
        "measuredTempo": round(tempo, 2),
        "duration": LOOP,
        "beats": [round(b, 4) for b in beats],
        "maxGridErrorMs": round(1000 * max(abs(e) for e in err), 2),
    }
    (ROOT / "beats.json").write_text(json.dumps(out, indent=2) + "\n")

    mix = music.copy()
    for i, kind in enumerate(TL["sfx"]):
        if kind != "none":
            add(mix, ui(kind), beats[i])
    mix /= np.max(np.abs(mix)) * 1.05
    tmp = ROOT / "audio/premaster.wav"
    sf.write(tmp, mix, SR, subtype="FLOAT")

    # Two-pass EBU R128 normalisation to -14 LUFS, -1 dBTP.
    probe = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    m = json.loads(probe[probe.rindex("{") :])
    af = (
        f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
        f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
        "alimiter=limit=0.85:attack=1:release=40:level=false"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(tmp), "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le", str(ROOT / "audio/score.wav")],
        check=True,
    )
    tmp.unlink()
    print(json.dumps({k: v for k, v in out.items() if k != "beats"}))


if __name__ == "__main__":
    main()
