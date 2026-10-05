"""Score for the film: 128 BPM, 8 bars, synthesized in code (audio/synth.py).

    python3 audio/score.py

The arrangement (where the groove, drops, risers and impacts sit) and the UI sounds come from
timeline.json. Swapping the product does not touch this file.

Writes:
  audio/music.wav   the track alone (used for measurement)
  beats.json        measured times for every 16th of the 8 bars (the film's clock)
  audio/score.wav   music + UI sounds on measured peaks, -14 LUFS / -1 dBTP

The track renders twice and keeps the second pass, so tails wrap and the film loops cleanly.
"""

import json
import pathlib
import subprocess
import sys

import librosa
import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from synth import SR, add, bp, env_exp, hat, hp, kick, clap, lp, midi, saw, ui  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "timeline.json").read_text())
MUSIC = TL["music"]
inr = lambda b, spans: any(a <= b < z for a, z in spans)
BPM = TL["bpm"]
BEAT = 60.0 / BPM
NBEATS = TL["bars"] * TL["beatsPerBar"]
LOOP = NBEATS * BEAT
N = int(round(LOOP * SR))
SOUND = MUSIC.get("sound", {})
rng = np.random.default_rng(SOUND.get("seed", 23))


def sub(note, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(note)
    x = np.sin(2 * np.pi * f * t)
    x = np.tanh(2.2 * x) * 0.6 + 0.4 * np.sin(4 * np.pi * f * t) * 0.15
    a = np.minimum(1, np.arange(n) / (0.01 * SR))
    r = np.minimum(1, (n - np.arange(n)) / (0.05 * SR))
    return x * a * r * 0.34


def bell(note, dur=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(note)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * env_exp(n, 0.12)
    return np.sin(2 * np.pi * f * t + mod) * env_exp(n, 0.28) * 0.07


def marimba(note, dur=0.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(note)
    x = np.zeros(n)
    for ratio, amp, tau in ((1, 1.0, 0.32), (3.93, 0.35, 0.07), (9.24, 0.12, 0.025)):
        x += amp * np.sin(2 * np.pi * f * ratio * t) * env_exp(n, tau)
    return x * np.minimum(1, np.arange(n) / (0.002 * SR)) * 0.06


def keys(note, dur=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(note)
    mod = np.sin(2 * np.pi * f * t) * 1.2 * env_exp(n, 0.25)
    tine = np.sin(2 * np.pi * f * 14 * t) * env_exp(n, 0.012) * 0.15
    return (np.sin(2 * np.pi * f * t + mod) + tine) * env_exp(n, 0.5) * 0.06


def warm_pad(notes, dur, cutoff=1400):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for note in notes:
        f = midi(note)
        for det in (-0.003, 0.004):
            x += np.sin(2 * np.pi * f * (1 + det) * t) + 0.3 * np.sin(4 * np.pi * f * (1 + det) * t)
    x = lp(x, cutoff) * (1 + 0.15 * np.sin(2 * np.pi * 0.5 * t))
    a = np.minimum(1, np.arange(n) / (0.5 * SR))
    r = np.minimum(1, (n - np.arange(n)) / (0.4 * SR))
    return x * a * r * 0.018


def glass_pad(notes, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for note in notes:
        for det in (-0.004, 0.0, 0.005):
            x += np.sin(2 * np.pi * midi(note + 12) * (1 + det) * t)
    a = np.minimum(1, np.arange(n) / (0.3 * SR))
    r = np.minimum(1, (n - np.arange(n)) / (0.4 * SR))
    return x * a * r * 0.008


def dark_pad(notes, dur):
    n = int(dur * SR)
    x = np.zeros(n)
    for k, note in enumerate(notes):
        for det in (-0.005, 0.0, 0.006):
            x += saw(midi(note) * (1 + det), n, k + det * 100)
    x = lp(x, 700)
    a = np.minimum(1, np.arange(n) / (0.4 * SR))
    r = np.minimum(1, (n - np.arange(n)) / (0.4 * SR))
    return x * a * r * 0.03


# Fm | Db | Bbm | C | Fm | Db | Bbm | C(sus -> resolves into the loop)
DEFAULT_CHORDS = [
    (41, [56, 60, 63, 67]), (37, [56, 60, 65, 68]), (46, [58, 61, 65, 68]), (36, [55, 60, 64, 67]),
    (41, [56, 60, 63, 67]), (37, [56, 60, 65, 68]), (46, [58, 61, 65, 68]), (36, [55, 60, 65, 67]),
]
BELL_POS = [0, 0.75, 1.5, 2.5, 3.25]

# A project's own sound (timeline.json music.sound). Every key is optional; the defaults are the
# reference film's sound, so give each new film its own key, progression, voices and UI tone.
CHORDS = SOUND.get("progression", DEFAULT_CHORDS)
LEAD = {"voice": "bell", "pattern": BELL_POS, "octave": 12, "gain": 1.0, **SOUND.get("lead", {})}
PAD = {"voice": "dark", "cutoff": 1400, "gain": 1.0, **SOUND.get("pad", {})}
DRUMS = {"kick": "punchy", "snare": "clap", "hats": "16ths", "swing": 0.0, **SOUND.get("drums", {})}
UI = {"tone": "digital", "pitch": 1.0, "gain": 1.0, **SOUND.get("ui", {})}
# Mix: stereo spreads the lead and hats and decorrelates the reverb; duck is the sidechain depth
# (lower = smoother, less pump); hatsLP softens the hats (Hz, 0 = off).
MIX = {"stereo": False, "width": 0.35, "duck": 0.6, "reverb": 0.4, "hatsLP": 0, **SOUND.get("mix", {})}
STEREO = MIX["stereo"]


def pan_gains(p):
    a = (p + 1) * np.pi / 4
    return np.cos(a) * np.sqrt(2), np.sin(a) * np.sqrt(2)


def lead(note):
    v = LEAD["voice"]
    return {"bell": bell, "marimba": marimba, "keys": keys}[v](note) * LEAD["gain"]


def pad(notes, dur):
    v = PAD["voice"]
    if v == "warm":
        return warm_pad(notes, dur, PAD["cutoff"]) * PAD["gain"]
    if v == "glass":
        return glass_pad(notes, dur) * PAD["gain"]
    return dark_pad(notes, dur) * PAD["gain"]


def render_music():
    loop = MUSIC["loop"]
    total = 2 * N if loop else N + int(3 * SR)
    drums = np.zeros(total)
    music = np.zeros(total)
    send = np.zeros(total)
    side = np.ones(total)
    K, C, HC = kick(DRUMS["kick"]) * 1.1, clap(DRUMS["snare"]) * 0.8, hat() * 0.8
    if MIX["hatsLP"]:
        HC = lp(HC, MIX["hatsLP"]) * 1.4
    leadL, leadR, hatL, hatR = (np.zeros(total) for _ in range(4)) if STEREO else (None,) * 4
    HATS = {"16ths": (0, 1, 2, 3), "8ths": (0, 2), "offbeat": (2,)}[DRUMS["hats"]]
    swing = DRUMS["swing"] * BEAT / 4

    def duck(t, depth=MIX["duck"]):
        i = int(t * SR)
        d = 1 - depth * env_exp(int(0.32 * SR), 0.1)
        side[i : i + len(d)] = np.minimum(side[i : i + len(d)], d[: total - i])

    for p in range(2 if loop else 1):
        base = p * LOOP
        for b in range(NBEATS):
            t = base + b * BEAT
            groove = inr(b, MUSIC["groove"])
            pulse = inr(b, MUSIC["pulse"])
            drop = b in MUSIC["drop"]
            hold = b >= MUSIC["holdFrom"]
            if (groove or pulse) and not drop:
                add(drums, K, t)
                duck(t)
            if groove and b % 2 == 1:
                add(drums, C, t)
                add(send, C * 0.4, t)
            if groove:
                for s in HATS:
                    h = HC * (0.9 if s == 2 else 0.45)
                    at = t + s * BEAT / 4 + (swing if s % 2 else 0)
                    if STEREO:
                        gl, gr = pan_gains(MIX["width"] * (0.6 if s == 2 else -0.4))
                        add(hatL, h * gl, at)
                        add(hatR, h * gr, at)
                    else:
                        add(drums, h, at)
            elif b < 4 or pulse:
                add(drums, HC * 0.35, t + BEAT / 2)
        for bar in range(TL["bars"]):
            b0 = base + bar * 4 * BEAT
            # The progression repeats every 8 bars; the last bar always takes the turnaround chord.
            root, ch = CHORDS[-1] if bar == TL["bars"] - 1 else CHORDS[bar % len(CHORDS)]
            held = bar == TL["bars"] - 1 and loop
            # Sub: half-bar notes, an octave hop on the 'and' of 2 when the groove runs.
            add(music, sub(root, 2 * BEAT - 0.02), b0)
            add(music, sub(root + (12 if 2 <= bar <= 6 else 0), 2 * BEAT - 0.02), b0 + 2 * BEAT)
            for k, pos in enumerate(LEAD["pattern"]):
                if held and pos > 1.5:
                    continue
                note = ch[(k + bar) % len(ch)] + LEAD["octave"]
                sig = lead(note) * (0.6 if bar == 0 else 1.0)
                if STEREO:
                    gl, gr = pan_gains(MIX["width"] * (1 if k % 2 else -1))
                    add(leadL, sig * gl, b0 + pos * BEAT)
                    add(leadR, sig * gr, b0 + pos * BEAT)
                else:
                    add(music, sig, b0 + pos * BEAT)
                add(send, sig * 0.9, b0 + pos * BEAT)
            add(music, pad(ch, 4 * BEAT + 0.4), b0)
        # Risers into the pull-back (beat 18) and the lockup (beat 28).
        for start, end, amt in MUSIC["risers"]:
            n = int((end - start) * BEAT * SR)
            k = np.linspace(0, 1, n)
            add(music, bp(rng.standard_normal(n), 1500, 8000) * k**2.5 * amt, base + start * BEAT)
        # Impacts: a low thump + noise burst on 18, a crash on 28.
        n = int(0.9 * SR)
        tt = np.arange(n) / SR
        boom = np.sin(2 * np.pi * (38 + 60 * np.exp(-tt / 0.05)) * tt) * env_exp(n, 0.35) * 0.9
        crash = hp(rng.standard_normal(int(2.0 * SR)), 3500) * env_exp(int(2.0 * SR), 0.6) * 0.16
        for b in MUSIC["boom"]:
            add(drums, boom, base + b * BEAT)
            duck(base + b * BEAT, 0.8)
        for b in MUSIC["crash"]:
            add(drums, crash, base + b * BEAT)
            add(send, crash * 0.5, base + b * BEAT)
    ir_n = int(2.2 * SR)
    ir = rng.standard_normal(ir_n) * env_exp(ir_n, 0.5)
    ir = lp(ir, 5000) / np.sqrt(np.sum(ir**2))
    verb = fftconvolve(send, ir)[:total] * MIX["reverb"]
    if STEREO:
        ir2 = rng.standard_normal(ir_n) * env_exp(ir_n, 0.5)
        ir2 = lp(ir2, 5000) / np.sqrt(np.sum(ir2**2))
        verbR = fftconvolve(send, ir2)[:total] * MIX["reverb"]
        L = drums + hatL + (music + leadL + verb) * side
        R = drums + hatR + (music + leadR + verbR) * side
        mix = np.stack([L, R], axis=1)
    else:
        mix = drums + (music + verb) * side
    if loop:
        return mix[N:]
    # A film that ends (no loop): keep the first pass and let the last half second fade out.
    out = mix[:N].copy()
    f = int(0.5 * SR)
    fade = np.linspace(1, 0, f) ** 2
    out[-f:] *= fade[:, None] if out.ndim == 2 else fade
    return out


def sfx(kind):
    if kind == "key":
        n = int(0.035 * SR)
        x = bp(rng.standard_normal(n), 3000, 9000) * env_exp(n, 0.003)
        return x * 0.35 + np.sin(2 * np.pi * 1700 * np.arange(n) / SR) * env_exp(n, 0.004) * 0.08
    if kind == "odo":
        out = np.zeros(int(0.12 * SR))
        for k in range(3):
            add(out, ui("tick") * (0.6 + 0.2 * k), k * 0.03)
        return out
    if kind == "flip":
        return ui("whoosh") * 1.2
    if kind == "hit":
        return ui("whoosh") * 0.6
    if kind == "crash":
        return ui("tick", UI["tone"], UI["pitch"]) * 0.5
    if kind == "rewind":
        return ui("whoosh")[::-1] * 0.9
    return ui(kind, UI["tone"], UI["pitch"]) * UI["gain"]


def measure(y):
    hop = 128
    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=hop, aggregate=np.median)
    peaks = librosa.util.peak_pick(env, pre_max=3, post_max=3, pre_avg=10, post_avg=10, delta=0.15, wait=4)
    pt = librosa.frames_to_time(peaks, sr=SR, hop_length=hop)
    grid = []
    for i in range(NBEATS * 4):
        g = i * BEAT / 4
        near = pt[np.abs(pt - g) < 0.03]
        grid.append(float(near[np.argmin(np.abs(near - g))]) if len(near) else g)
    return grid


def main():
    music = render_music()
    music /= np.max(np.abs(music)) * 1.05
    sf.write(ROOT / "audio/music.wav", music, SR, subtype="FLOAT")
    grid = measure(music.mean(axis=1) if music.ndim == 2 else music)
    beats = grid[::4]
    errs = [abs(g - i * BEAT / 4) for i, g in enumerate(grid)]
    out = {
        "bpm": BPM,
        "duration": LOOP,
        "beats": [round(b, 4) for b in beats],
        "sixteenths": [round(g, 4) for g in grid],
        "maxGridErrorMs": round(1000 * max(errs), 2),
    }
    (ROOT / "beats.json").write_text(json.dumps(out) + "\n")

    mix = music.copy()
    for beat, kind in TL["events"]:
        at, sig = grid[int(round(beat * 4)) % len(grid)], sfx(kind)
        if mix.ndim == 2:
            add(mix[:, 0], sig, at)
            add(mix[:, 1], sig, at)
        else:
            add(mix, sig, at)
    mix /= np.max(np.abs(mix)) * 1.05
    tmp = ROOT / "audio/premaster.wav"
    sf.write(tmp, mix, SR, subtype="FLOAT")
    probe = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    m = json.loads(probe[probe.rindex("{") : probe.rindex("}") + 1])
    af = (
        f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
        f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
        "alimiter=limit=0.8:attack=1:release=40:level=false"
    )
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(tmp), "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le",
                    str(ROOT / "audio/score.wav")], check=True)
    tmp.unlink()
    print(json.dumps({k: v for k, v in out.items() if k not in ("beats", "sixteenths")}))


if __name__ == "__main__":
    main()
