"""Score for the dark launch films. Same tools as score.py, darker arrangement.

    python3 audio/score_dark.py            dark film   (timeline-dark.json)
    python3 audio/score_dark.py studio     studio film (timeline-studio.json)

The arrangement (where the groove, drops, risers and impacts sit) comes from the timeline's
"music" block; files are named after the film.

Writes:
  audio/music-<film>.wav   the track alone (used for measurement)
  beats-<film>.json        measured times for every 16th of the 8 bars (the film's clock)
  audio/score-<film>.wav   music + UI sounds on measured peaks, -14 LUFS / -1 dBTP

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
from score import SR, add, bp, env_exp, hat, hp, kick, clap, lp, midi, saw, ui  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILM = sys.argv[1] if len(sys.argv) > 1 else "dark"
TL = json.loads((ROOT / f"timeline-{FILM}.json").read_text())
# Defaults reproduce the dark film's arrangement.
MUSIC = {
    "groove": [[8, 16], [18, 28]], "pulse": [[4, 8]], "drop": [16, 17], "holdFrom": 28,
    "risers": [[14, 18, 0.07], [24, 28, 0.08]], "boom": [18], "crash": [28], "loop": True,
    **TL.get("music", {}),
}
inr = lambda b, spans: any(a <= b < z for a, z in spans)
BPM = TL["bpm"]
BEAT = 60.0 / BPM
NBEATS = TL["bars"] * TL["beatsPerBar"]
LOOP = NBEATS * BEAT
N = int(round(LOOP * SR))
rng = np.random.default_rng(23)


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
CHORDS = [
    (41, [56, 60, 63, 67]), (37, [56, 60, 65, 68]), (46, [58, 61, 65, 68]), (36, [55, 60, 64, 67]),
    (41, [56, 60, 63, 67]), (37, [56, 60, 65, 68]), (46, [58, 61, 65, 68]), (36, [55, 60, 65, 67]),
]
BELL_POS = [0, 0.75, 1.5, 2.5, 3.25]


def render_music():
    loop = MUSIC["loop"]
    total = 2 * N if loop else N + int(3 * SR)
    drums = np.zeros(total)
    music = np.zeros(total)
    send = np.zeros(total)
    side = np.ones(total)
    K, C, HC = kick() * 1.1, clap() * 0.8, hat() * 0.8

    def duck(t, depth=0.6):
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
                for s in range(4):
                    add(drums, HC * (0.9 if s == 2 else 0.45), t + s * BEAT / 4)
            elif b < 4 or pulse:
                add(drums, HC * 0.35, t + BEAT / 2)
        for bar in range(TL["bars"]):
            b0 = base + bar * 4 * BEAT
            root, ch = CHORDS[bar]
            held = bar == 7 and loop
            # Sub: half-bar notes, an octave hop on the 'and' of 2 when the groove runs.
            add(music, sub(root, 2 * BEAT - 0.02), b0)
            add(music, sub(root + (12 if 2 <= bar <= 6 else 0), 2 * BEAT - 0.02), b0 + 2 * BEAT)
            for k, pos in enumerate(BELL_POS):
                if held and pos > 1.5:
                    continue
                note = ch[(k + bar) % len(ch)] + 12
                sig = bell(note) * (0.6 if bar == 0 else 1.0)
                add(music, sig, b0 + pos * BEAT)
                add(send, sig * 0.9, b0 + pos * BEAT)
            add(music, dark_pad(ch, 4 * BEAT + 0.4), b0)
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
    verb = fftconvolve(send, ir)[:total] * 0.4
    mix = drums + (music + verb) * side
    if loop:
        return mix[N:]
    # A film that ends (no loop): keep the first pass and let the last half second fade out.
    out = mix[:N].copy()
    f = int(0.5 * SR)
    out[-f:] *= np.linspace(1, 0, f) ** 2
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
        return ui("tick") * 0.5
    if kind == "rewind":
        return ui("whoosh")[::-1] * 0.9
    return ui(kind)


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
    sf.write(ROOT / f"audio/music-{FILM}.wav", music, SR, subtype="FLOAT")
    grid = measure(music)
    beats = grid[::4]
    errs = [abs(g - i * BEAT / 4) for i, g in enumerate(grid)]
    out = {
        "bpm": BPM,
        "duration": LOOP,
        "beats": [round(b, 4) for b in beats],
        "sixteenths": [round(g, 4) for g in grid],
        "maxGridErrorMs": round(1000 * max(errs), 2),
    }
    (ROOT / f"beats-{FILM}.json").write_text(json.dumps(out) + "\n")

    mix = music.copy()
    for beat, kind in TL["events"]:
        add(mix, sfx(kind), grid[int(round(beat * 4)) % len(grid)])
    mix /= np.max(np.abs(mix)) * 1.05
    tmp = ROOT / f"audio/premaster-{FILM}.wav"
    sf.write(tmp, mix, SR, subtype="FLOAT")
    probe = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True,
    ).stderr
    m = json.loads(probe[probe.rindex("{") :])
    af = (
        f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
        f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,"
        "alimiter=limit=0.8:attack=1:release=40:level=false"
    )
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(tmp), "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le",
                    str(ROOT / f"audio/score-{FILM}.wav")], check=True)
    tmp.unlink()
    print(json.dumps({k: v for k, v in out.items() if k not in ("beats", "sixteenths")}))


if __name__ == "__main__":
    main()
