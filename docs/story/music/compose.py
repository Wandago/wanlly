"""Original score for the Wanlly story film (docs/story.html), synthesized from scratch.

A launch-ad arc at 72 BPM: a lone, hesitant piano in D minor for the student and her idea; low
strings under the price; a held breath of near-silence after "Access isn't"; a single high note
on "Until now" opening into F major; a soft heartbeat pulse and rising strings under the models
and "Free."; the fullest, warmest moment under her work; a quiet resolved chord on the end card.
Run: python3 compose.py out.wav   (numpy only)
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 58.0
N = int(SR * DUR)
B = 60 / 72
rng = np.random.default_rng(72)


def tt(length):
    return np.arange(int(length * SR)) / SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, start, sig, gain=1.0, pan=0.0):
        i = int(round(start * SR))
        if i >= N or i < 0:
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


def piano(note, length=3.5, vel=1.0):
    """A soft felt piano: slightly stretched harmonics, each fading at its own rate, a little hammer."""
    t = tt(length)
    f = hz(note)
    out = np.zeros(len(t))
    for k, amp in enumerate((1.0, 0.42, 0.22, 0.12, 0.07, 0.04), start=1):
        fk = f * k * (1 + 0.0004 * k * k)
        if fk > 12000:
            break
        decay = 0.9 + 0.55 * k + f / 900
        out += amp * np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28)) * np.exp(-t * decay)
    hammer = fft_filter(rng.normal(0, 1, len(t)), 200, 2500) * np.exp(-t * 90) * 0.04
    env = np.minimum(1, t * 300) * np.minimum(1, (length - t) * 4)
    soft = 0.55 + 0.45 * vel
    return fft_filter((out + hammer) * env, 0, 1800 + 2600 * vel) * soft


def strings(notes, length, attack=2.0, bright=1400):
    t = tt(length)
    out = np.zeros(len(t))
    for n in notes:
        for d in (-0.003, 0.0, 0.0035):
            vib = 1 + 0.002 * np.sin(2 * np.pi * 5.2 * t + rng.uniform(0, 6))
            ph = np.cumsum(hz(n) * (1 + d) * vib) / SR
            out += 2 * (ph % 1.0) - 1
    env = np.minimum(1, t / attack) * np.minimum(1, (length - t) / 1.8)
    return fft_filter(out * env, 70, bright) / (len(notes) * 3)


def pulse():
    t = tt(0.6)
    f = 44 + 50 * np.exp(-t * 22)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5.5)


def bloom(size=1.0):
    t = tt(4.0)
    f = 34 + 40 * np.exp(-t * 3)
    low = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.1)
    air = fft_filter(rng.normal(0, 1, len(t)), 2500, 9000) * np.exp(-t * 1.6) * 0.08 * np.minimum(1, t * 20)
    return (low + air) * size


def chime(note, length=3.5):
    t = tt(length)
    f = hz(note)
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3)) * np.exp(-t * 1.5) * np.minimum(1, t * 900)


keys, strs, fx, verb = Bus(), Bus(), Bus(), Bus()


def play(start, note, vel=0.6, length=3.5, pan=0.0):
    keys.add(start, piano(note, length, vel), gain=0.5 * (0.6 + 0.4 * vel), pan=pan)
    verb.add(start, piano(note, length, vel), gain=0.22)


# 1–2 (0–9.5 s): the idea. A hesitant broken D minor 9, sparse, with space between phrases.
for at, n, v in ((0.6, 50, 0.5), (1.4, 57, 0.4), (2.2, 62, 0.45), (3.0, 64, 0.4), (3.8, 65, 0.5), (5.4, 57, 0.4), (6.2, 62, 0.4), (7.0, 69, 0.5), (7.8, 67, 0.4), (8.6, 65, 0.4)):
    play(at, n, v, pan=(n - 60) / 20)
play(4.7, 38, 0.35, 5.0)

# 3 (9.8–17.6 s): the price. Lower, heavier: Bb – F/A – Gm – A, with low strings creeping in.
for i, (bass, top) in enumerate(((46, [58, 62, 65]), (45, [57, 60, 65]), (43, [58, 62, 67]), (45, [57, 61, 64]))):
    at = 9.8 + i * 2 * B * 1.2
    play(at, bass - 12, 0.5, 4.0)
    for j, n in enumerate(top):
        play(at + 0.18 * j, n, 0.35)
strs.add(10.5, strings([34, 46, 53], 7.4, attack=3.0, bright=900), gain=0.5)

# 4 (18–23 s): "Talent is everywhere. Access isn't." A simple rising line, then a held breath.
for at, n, v in ((18.0, 62, 0.55), (18.8, 65, 0.5), (19.6, 69, 0.55), (20.4, 67, 0.45), (21.2, 65, 0.4)):
    play(at, n, v)
play(18.0, 38, 0.4, 5.0)
strs.add(18.0, strings([50, 57, 62], 5.0, attack=2.0, bright=1200), gain=0.45)
# 23–24.3 s: near silence; only the reverb tails remain.

# 5 (24.3 s): "Until now." One high note, then F major opens; a warm bloom under the logo.
play(24.3, 81, 0.75, 5.0)
fx.add(24.3, chime(93, 4.0), gain=0.06)
for j, n in enumerate((41, 53, 57, 60, 64, 69)):
    play(25.6 + 0.12 * j, n, 0.5, 4.5)
strs.add(25.6, strings([41, 53, 60, 64], 5.0, attack=1.2, bright=1800), gain=0.5)
fx.add(27.0, bloom(0.6), gain=0.6)
fx.add(27.0, chime(84, 4.0), gain=0.08)
verb.add(27.0, chime(84, 4.0), gain=0.1)

# 6–7 (30–43 s): the models, "Free.", how it works. A heartbeat pulse and a gentle ostinato
# (F – C/E – Dm – Bb), strings rising.
prog = [(41, [60, 65, 69]), (40, [60, 64, 67]), (38, [57, 62, 65]), (34, [58, 62, 65])]
beat, k = 30.0, 0
while beat < 43.2:
    bass, top = prog[int((beat - 30.0) // (4 * B)) % 4]
    fx.add(beat, pulse(), gain=0.32 if beat < 34.6 else 0.42)
    play(beat, top[k % 3] + 12, 0.32, 1.8, pan=0.3 if k % 2 else -0.3)
    if abs(((beat - 30.0) / B) % 4) < 0.01:
        play(beat, bass, 0.45, 4.0)
    k += 1
    beat += B / 2 if beat >= 37.6 else B
for i, (bass, top) in enumerate(prog):
    strs.add(30.0 + i * 4 * B, strings([bass + 12] + top, 4 * B + 0.6, attack=1.0, bright=1600 + 400 * i), gain=0.4)
# "Free." lands.
fx.add(34.6, bloom(0.8), gain=0.7)
for j, n in enumerate((53, 60, 65, 69, 72)):
    play(34.6 + 0.05 * j, n, 0.7, 4.0)
fx.add(34.6, chime(89, 3.5), gain=0.07)

# 8 (43.6–51 s): her work. The warmest, fullest moment: Bb – F – C – Dm/F, arpeggios and strings.
work = [(46, [58, 62, 65, 70]), (41, [57, 60, 65, 69]), (48, [55, 60, 64, 67]), (41, [57, 62, 65, 69])]
for i, (bass, top) in enumerate(work):
    at = 43.6 + i * 1.85
    play(at, bass - 12, 0.55, 3.0)
    play(at, bass, 0.5, 3.0)
    for j in range(8):
        play(at + j * 1.85 / 8, top[j % 4] + 12, 0.38 + 0.04 * (j % 2), 1.6, pan=-0.35 + 0.1 * j)
    strs.add(at, strings([bass] + top, 2.3, attack=0.5, bright=2400), gain=0.42)
    fx.add(at, pulse(), gain=0.38)

# 9 (51.2 s – end): resolve. F major add9, a last high phrase, a soft chime.
for j, n in enumerate((29, 41, 53, 57, 60, 67, 72)):
    play(51.2 + 0.1 * j, n, 0.5, 6.0)
strs.add(51.2, strings([41, 53, 57, 60, 67], 6.5, attack=1.5, bright=1600), gain=0.4)
for at, n in ((53.0, 77), (53.8, 79), (54.6, 81), (55.6, 84)):
    play(at, n, 0.45, 3.0)
fx.add(54.0, chime(89, 4.0), gain=0.06)

# Mix: a big soft hall, gentle compression, fades.
ir_len = int(4.0 * SR)
ir = rng.normal(0, 1, ir_len) * np.exp(-np.arange(ir_len) / (1.1 * SR))
ir = fft_filter(ir, 120, 5000)
ir /= np.sqrt(np.sum(ir ** 2))
size = 1 << int(np.ceil(np.log2(N + ir_len)))
wet = np.zeros((2, N))
for ch in range(2):
    src = verb.x[ch] + 0.35 * strs.x[ch] + 0.15 * fx.x[ch]
    wet[ch] = np.fft.irfft(np.fft.rfft(src, size) * np.fft.rfft(np.roll(ir, ch * 157), size), size)[:N]
mix = keys.x + strs.x + fx.x + wet * 0.8
for ch in range(2):
    mix[ch] = fft_filter(mix[ch], 28)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
t = np.arange(N) / SR
mix *= np.minimum(1, t / 0.4) * np.clip((DUR - t) / 2.5, 0, 1)
mix *= 0.95 / np.max(np.abs(mix))

with wave.open(sys.argv[1] if len(sys.argv) > 1 else "story-music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
print("ok")
