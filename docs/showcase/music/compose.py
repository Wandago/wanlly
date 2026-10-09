"""Original music for the Wanlly showcase (docs/showcase.html), synthesized from scratch.

Cinematic and smooth, 90 BPM in D minor resolving to F major: a soft pad and typing for the
prompt, a shimmer as the site appears, a heartbeat pulse and glittering arpeggio under the wall
of designs, a chime on each of the four beats, a rising swell into a warm hit as the logo lands,
and a resolved chord under the end card. Cues are placed on the same times as the animation.
Run: python3 compose.py out.wav   (numpy only)
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 30.0
N = int(SR * DUR)
B = 60 / 90
rng = np.random.default_rng(30)


def tt(length):
    return np.arange(int(length * SR)) / SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, start, sig, gain=1.0, pan=0.0):
        i = int(round(start * SR))
        if i >= N:
            return
        sig = sig[: N - i] * gain
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.x[0, i:i + len(sig)] += sig * l * 1.414
        self.x[1, i:i + len(sig)] += sig * r * 1.414


def fft_filter(x, lo=0.0, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def sweep_filter(x, cutoff, kind="lp", win=2048):
    hop = win // 2
    w = np.hanning(win)
    out = np.zeros_like(x)
    f = np.fft.rfftfreq(win, 1 / SR)
    for s in range(0, len(x) - win, hop):
        c = cutoff((s + hop) / SR)
        X = np.fft.rfft(x[s:s + win] * w)
        m = 1 / (1 + (f / c) ** 4) if kind == "lp" else 1 / (1 + (c / np.maximum(f, 1)) ** 4)
        out[s:s + win] += np.fft.irfft(X * m, win)
    return out


def pad(notes, length, attack=1.2, bright=1800):
    t = tt(length)
    out = np.zeros(len(t))
    for n in notes:
        for d in (-0.004, 0.0, 0.005):
            ph = (hz(n) * (1 + d) * t + rng.uniform()) % 1.0
            out += (2 * ph - 1) * 0.6 + np.sin(2 * np.pi * hz(n) * (1 + d) * t) * 0.4
    env = np.minimum(1, t / attack) * np.minimum(1, (length - t) / 1.2)
    return fft_filter(out * env, 90, bright) / (len(notes) * 3)


def bell(note, length=2.4, decay=2.2):
    t = tt(length)
    f = hz(note)
    mod = 1.8 * np.exp(-t * 4) * np.sin(2 * np.pi * f * 3.5 * t)
    return (np.sin(2 * np.pi * f * t + mod) + 0.3 * np.sin(2 * np.pi * f * 2 * t)) * np.exp(-t * decay) * np.minimum(1, t * 800)


def pluck(note, length=0.5):
    t = tt(length)
    return (np.sin(2 * np.pi * hz(note) * t) + 0.3 * np.sin(4 * np.pi * hz(note) * t)) * np.exp(-t * 7) * np.minimum(1, t * 600)


def pulse():
    t = tt(0.5)
    f = 46 + 60 * np.exp(-t * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6)


def boom(size=1.0):
    t = tt(3.5)
    f = 30 + 55 * np.exp(-t * 4)
    low = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.3)
    air = fft_filter(rng.normal(0, 1, len(t)), 1500, 9000) * np.exp(-t * 2.2) * 0.18
    return np.tanh((low * 1.4 + air) * 1.2) * size


def whoosh(length=0.8, up=True):
    t = tt(length)
    shape = np.sin(np.pi * t / length) ** 2
    n = rng.normal(0, 1, len(t)) * shape
    return sweep_filter(n, (lambda s: 400 + 5000 * (s / length) ** 1.5) if up else (lambda s: 5400 - 5000 * (s / length) ** 0.7), "lp") * 0.8


def riser(length):
    t = tt(length)
    k = t / length
    n = sweep_filter(rng.normal(0, 1, len(t)) * k ** 2, lambda s: 300 + 7000 * (s / length) ** 2, "hp") * 0.5
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * k ** 2) / SR) * k ** 2 * 0.15
    return (n + tone) * np.minimum(1, (length - t) * 40)


def click():
    t = tt(0.016)
    return fft_filter(rng.normal(0, 1, len(t)), 2500) * np.exp(-t * 520)


music, fx, verb = Bus(), Bus(), Bus()

# Pads: D minor 9 under the prompt, opening up; then Dm - Bb - F - C under the wall; F add9 at the end.
music.add(0.0, pad([50, 57, 62, 64, 65], 4.6, attack=1.6, bright=900), gain=0.5)
music.add(3.9, pad([50, 57, 62, 65, 69], 5.4, attack=0.6, bright=1600), gain=0.5)
for i, ch in enumerate(([50, 57, 62, 65], [46, 53, 58, 62], [41, 53, 57, 60], [48, 55, 60, 64])):
    music.add(9.0 + i * 4 * B * 0.875, pad(ch, 2.9, attack=0.4, bright=2200), gain=0.5)
music.add(16.0, pad([46, 53, 58, 62, 65], 6.2, attack=0.3, bright=2600), gain=0.42)
music.add(22.0, pad([48, 55, 60, 64, 67], 2.6, attack=1.0, bright=3000), gain=0.42)
music.add(24.5, pad([41, 48, 57, 60, 64, 67], 5.5, attack=0.05, bright=3400), gain=0.6)

# A: typing, the send tap, a lift.
for c in range(52):
    fx.add(0.6 + c * (2.2 / 52) + rng.uniform(-0.006, 0.006), click(), gain=0.22, pan=rng.uniform(-0.3, 0.3))
fx.add(3.1, pluck(81, 0.4), gain=0.25)
fx.add(3.3, whoosh(0.8, up=True), gain=0.35)

# B: the window lands, skeleton blips, the shimmer of the reveal, a chord when it's done.
fx.add(3.9, boom(0.5), gain=0.45)
for i, n in enumerate((74, 77, 81, 79, 84)):
    fx.add(4.4 + i * 0.16, pluck(n, 0.35), gain=0.12, pan=-0.4 + i * 0.2)
fx.add(5.4, riser(1.5), gain=0.35)
for n, d in ((74, 0.0), (77, 0.06), (81, 0.12), (86, 0.18)):
    fx.add(7.0 + d, bell(n), gain=0.12)
    verb.add(7.0 + d, bell(n), gain=0.1)

# C: the wall. A heartbeat and a glittering arpeggio, swelling to the headline.
fx.add(8.7, whoosh(0.9, up=False), gain=0.4)
fx.add(9.0, boom(0.7), gain=0.55)
beat = 9.0
while beat < 16.0:
    fx.add(beat, pulse(), gain=0.5)
    beat += B
arp = [62, 65, 69, 74, 72, 69, 65, 69]
k, s = 0, 9.0
while s < 15.8:
    fx.add(s, pluck(arp[k % 8] + 12, 0.45), gain=0.07 + 0.03 * (s - 9) / 7, pan=0.3 if k % 2 else -0.3)
    verb.add(s, pluck(arp[k % 8] + 12, 0.45), gain=0.04)
    k += 1
    s += B / 4
fx.add(10.6, bell(81, 3.0), gain=0.14)

# D: four beats, a swipe and a chime each, climbing.
for i, at in enumerate((16.0, 17.5, 19.0, 20.5)):
    fx.add(at - 0.35, whoosh(0.5, up=True), gain=0.32, pan=0.5)
    fx.add(at, boom(0.25), gain=0.35)
    fx.add(at, bell(74 + [0, 3, 5, 7][i], 1.6), gain=0.16)
    verb.add(at, bell(74 + [0, 3, 5, 7][i], 1.6), gain=0.12)

# E: everything pulls in, then the logo lands.
fx.add(22.0, riser(2.5), gain=0.55)
fx.add(23.3, whoosh(1.2, up=True), gain=0.4)
fx.add(24.5, boom(1.0), gain=0.9)
for n, d in ((65, 0.0), (69, 0.02), (72, 0.04), (77, 0.06), (81, 0.08)):
    fx.add(24.5 + d, bell(n, 4.0, 1.4), gain=0.13)
    verb.add(24.5 + d, bell(n, 4.0, 1.4), gain=0.14)

# F: the end card, a last gentle motif.
for i, n in enumerate((77, 81, 84, 89)):
    fx.add(26.4 + i * 0.5, bell(n, 2.0, 2.6), gain=0.09, pan=-0.2 + i * 0.13)
    verb.add(26.4 + i * 0.5, bell(n, 2.0, 2.6), gain=0.08)

# Mix: a long, soft reverb, gentle glue, fade out.
ir_len = int(3.2 * SR)
ir = rng.normal(0, 1, ir_len) * np.exp(-np.arange(ir_len) / (0.8 * SR))
ir = fft_filter(ir, 150, 6000)
ir /= np.sqrt(np.sum(ir ** 2))
size = 1 << int(np.ceil(np.log2(N + ir_len)))
wet = np.zeros((2, N))
for ch in range(2):
    wet[ch] = np.fft.irfft(np.fft.rfft(verb.x[ch] + 0.25 * music.x[ch], size) * np.fft.rfft(np.roll(ir, ch * 131), size), size)[:N]
mix = music.x + fx.x + wet * 0.7
for ch in range(2):
    mix[ch] = fft_filter(mix[ch], 25)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
t = np.arange(N) / SR
mix *= np.minimum(1, t / 0.3) * np.clip((DUR - t) / 2.0, 0, 1)
mix *= 0.95 / np.max(np.abs(mix))

with wave.open(sys.argv[1] if len(sys.argv) > 1 else "showcase-music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
print("ok")
