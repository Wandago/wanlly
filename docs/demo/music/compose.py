"""Original music for the Wanlly product demo (docs/demo.html), synthesized from scratch: no samples,
no licences needed.

A warm 120 BPM afro-house groove in A minor (Am - F - C - G): log-drum bass, four-on-the-floor kick,
shakers, claps on 2 and 4, soft piano-bell chords. A tense intro under the price lines, the groove
when the app flies in, a short filtered breath before the earning section and a big last hit on the
logo. Every typing run, click, coin and cut in the film has its sound on the same beat.
Run: python3 compose.py out.wav   (numpy only)
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 120
B = 60 / BPM          # one beat, seconds
S16 = B / 4
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(120)


def at(beat):
    return beat * B


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(length):
    return np.arange(int(length * SR)) / SR


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, start, sig, gain=1.0, pan=0.0):
        i = int(round(start * SR))
        if i >= N or i + len(sig) <= 0:
            return
        if i < 0:
            sig, i = sig[-i:], 0
        sig = sig[: N - i] * gain
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.x[0, i:i + len(sig)] += sig * l * 1.414
        self.x[1, i:i + len(sig)] += sig * r * 1.414


def fft_filter(x, lo=0.0, hi=None):
    """Static band filter for a mono signal (soft edges)."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, n)


def sweep_filter(x, cutoff, kind="lp", win=2048):
    """Time-varying filter (overlap-add). cutoff(t_seconds) -> Hz."""
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


# ---------- instruments ----------

def kick(punch=1.0):
    t = tt(0.45)
    f = 52 + 170 * np.exp(-t * 32) * punch
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = rng.normal(0, 1, len(t)) * np.exp(-t * 380) * 0.5
    return np.tanh((body + click) * 2.2) * 0.9


def bass808(note, length, glide_from=None):
    t = tt(length + 0.05)
    f = np.full(len(t), hz(note))
    if glide_from is not None:
        f = hz(note) + (hz(glide_from) - hz(note)) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t * 300) * np.exp(-t * 1.1)
    env[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return np.tanh(np.sin(ph) * env * 2.6) * 0.8


def clap():
    t = tt(0.4)
    n = rng.normal(0, 1, len(t))
    e = np.zeros(len(t))
    for d in (0.0, 0.011, 0.022):
        e += np.where(t >= d, np.exp(-(t - d) * 90), 0)
    e += np.exp(-t * 16) * 0.5
    body = fft_filter(n * e, 900, 5200)
    snap = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 40) * 0.4
    return np.tanh((body * 2.4 + snap) * 1.3) * 0.75


def hat(open_=False, vel=1.0):
    t = tt(0.22 if open_ else 0.05)
    n = fft_filter(rng.normal(0, 1, len(t)), 7000)
    return n * np.exp(-t * (14 if open_ else 110)) * vel * 1.8


def saw(f, length, detune=0.0):
    t = tt(length)
    ph = (f * (1 + detune) * t + rng.uniform()) % 1.0
    return 2 * ph - 1


def chord_pad(notes, length, bright=1.0):
    out = np.zeros(int(length * SR))
    for n in notes:
        for d in (-0.012, -0.005, 0.0, 0.006, 0.013):
            out += saw(hz(n), length, d)[: len(out)]
    t = tt(length)[: len(out)]
    env = np.minimum(1, t / 0.02) * (0.65 + 0.35 * np.exp(-t * 3))
    env[-int(0.04 * SR):] *= np.linspace(1, 0, int(0.04 * SR))
    return fft_filter(out * env, 120, 2400 * bright) / (len(notes) * 5)


def stab(notes):
    t = tt(0.5)
    out = np.zeros(len(t))
    for n in notes:
        for d in (-0.01, 0, 0.01):
            out += saw(hz(n), 0.5, d)
    return fft_filter(out * np.exp(-t * 7), 150, 5000) / (len(notes) * 3)


def bell(note, length=0.9):
    t = tt(length)
    f = hz(note)
    mod = 2.4 * np.exp(-t * 6) * np.sin(2 * np.pi * f * 3.5 * t)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 4.2) * np.minimum(1, t * 600)


def impact(size=1.0):
    t = tt(2.8)
    f = 34 + 70 * np.exp(-t * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.8)
    crash = fft_filter(rng.normal(0, 1, len(t)), 2500) * np.exp(-t * 2.4) * 0.35
    thud = rng.normal(0, 1, len(t)) * np.exp(-t * 60) * 0.6
    return np.tanh((boom * 1.6 + crash + fft_filter(thud, 0, 1500)) * 1.4) * size


def riser(length):
    t = tt(length)
    k = t / length
    noise = rng.normal(0, 1, len(t)) * k ** 2
    noise = sweep_filter(noise, lambda s: 400 + 9000 * (s / length) ** 2, "hp")
    f = 180 + 1800 * k ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * k ** 2 * 0.25
    return (noise * 0.6 + tone) * np.minimum(1, (length - t) * 60)


def whoosh(length=0.5):
    t = tt(length)
    shape = np.sin(np.pi * t / length) ** 2
    n = rng.normal(0, 1, len(t)) * shape
    return sweep_filter(n, lambda s: 800 + 5000 * np.sin(np.pi * s / length), "lp") * 0.9


def reverse_cymbal(length):
    t = tt(length)
    n = fft_filter(rng.normal(0, 1, len(t)), 3000) * (t / length) ** 3
    return n * np.minimum(1, (length - t) * 80)


def coin(big=False):
    t = tt(0.5)
    out = np.zeros(len(t))
    for d, f in ((0.0, 1318.5), (0.07, 1975.5)) + (((0.14, 2637.0),) if big else ()):
        m = t >= d
        tt2 = t[m] - d
        out[m] += np.sign(np.sin(2 * np.pi * f * tt2)) * 0.25 * np.exp(-tt2 * 9) + np.sin(2 * np.pi * f * tt2) * np.exp(-tt2 * 7)
    return fft_filter(out, 300, 9000) * 0.6


def blip(f):
    t = tt(0.09)
    return np.sign(np.sin(2 * np.pi * f * t * (1 + t * 6))) * np.exp(-t * 40) * 0.5


def type_click():
    t = tt(0.018)
    return fft_filter(rng.normal(0, 1, len(t)), 2000) * np.exp(-t * 500)


def power_down(length):
    t = tt(length)
    f = 420 * np.exp(-t * 6) + 30
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - t / length) * 0.6


def log_drum(note, length=0.5):
    """Amapiano-style log drum: a pitched, gliding knock."""
    t = tt(length)
    f = hz(note) * (1 + 0.6 * np.exp(-t * 40))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.35 * np.sin(2 * ph) * np.exp(-t * 12)
    return np.tanh(tone * np.exp(-t * 6.5) * np.minimum(1, t * 900) * 2.0) * 0.8


def shaker(vel=1.0):
    t = tt(0.07)
    n = fft_filter(rng.normal(0, 1, len(t)), 5000, 12000)
    return n * np.sin(np.pi * np.minimum(1, t / 0.07)) ** 2 * vel


def piano(notes, length=1.6):
    out = np.zeros(int(length * SR))
    for n in notes:
        t = tt(length)
        f = hz(n)
        mod = 0.9 * np.exp(-t * 5) * np.sin(2 * np.pi * f * 2 * t)
        out += (np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 2.6) * np.minimum(1, t * 500)
    return out / len(notes)


# ---------- arrangement ----------

drums, bass, music, fx, verb_send = Bus(), Bus(), Bus(), Bus(), Bus()

CHORDS = [  # per bar: bass root, voicing
    (45, [57, 60, 64, 69]),   # A minor
    (41, [57, 60, 65, 69]),   # F major
    (48, [55, 60, 64, 67]),   # C major
    (43, [55, 59, 62, 67]),   # G major
]
END = 120
GROOVE = [(10, 41), (44, 102)]


def groove_at(beat):
    return any(a <= beat < b for a, b in GROOVE)


# Pads: thin and filtered in the intro, warm under the groove, alone in the breath and the tail
for bar in range(END // 4):
    root, voicing = CHORDS[bar % 4]
    b0 = bar * 4
    if 102 <= b0 < 104:
        continue
    bright = 0.55 if b0 < 10 else 1.0
    g = 0.22 if b0 < 10 else 0.26
    music.add(at(b0), chord_pad(voicing, 4 * B, bright=bright), gain=g, pan=-0.2)
    music.add(at(b0) + 0.005, chord_pad(voicing, 4 * B, bright=bright), gain=g, pan=0.2)

# Piano chords: off-beat stabs through the groove
for bar in range(END // 4):
    root, voicing = CHORDS[bar % 4]
    for off in (0.5, 1.5, 2.75, 3.5):
        beat = bar * 4 + off
        if groove_at(beat) or 104 <= beat < 118:
            music.add(at(beat), piano([n + 12 for n in voicing[1:]], 0.9), gain=0.16, pan=0.3 if off % 1 else -0.3)
            verb_send.add(at(beat), piano([n + 12 for n in voicing[1:]], 0.9), gain=0.05)

# Drums and log drum
LOG = [0, 3, 6, 10, 11, 14]  # sixteenths in a bar
for bar in range(END // 4):
    root, _ = CHORDS[bar % 4]
    for b in range(4):
        beat = bar * 4 + b
        if groove_at(beat):
            drums.add(at(beat), kick(0.8), gain=0.8)
            if b in (1, 3):
                drums.add(at(beat), clap(), gain=0.5)
                verb_send.add(at(beat), clap(), gain=0.14)
            drums.add(at(beat + 0.5), hat(open_=True, vel=0.5), gain=0.22, pan=-0.25)
    for s in LOG:
        beat = bar * 4 + s / 4
        if groove_at(beat):
            note = root + (12 if s in (10, 14) else 0)
            bass.add(at(beat), log_drum(note, 0.45), gain=0.55)
    s16 = 0
    while s16 < 16:
        beat = bar * 4 + s16 / 4
        if groove_at(beat):
            drums.add(at(beat), shaker(0.9 if s16 % 4 == 2 else 0.5), gain=0.22, pan=0.25)
        elif beat < 10 and s16 % 2 == 0:
            drums.add(at(beat), shaker(0.3), gain=0.14, pan=0.25)
        s16 += 1

# ---------- sound design on the cuts ----------
fx.add(at(0), impact(0.5), gain=0.45)                         # AI costs
fx.add(at(0), stab([57, 64, 69]), gain=0.45)
fx.add(at(1.5), stab([53, 60, 65]), gain=0.5)                 # $20 a month
fx.add(at(3), power_down(0.6), gain=0.4)                      # strike
for i, b in enumerate((4, 4.5, 5)):                           # local prices
    fx.add(at(b), blip(900 + i * 200), gain=0.3, pan=-0.3 + 0.3 * i)
fx.add(at(6), stab([55, 62, 67]), gain=0.5)                   # Wanlly costs
fx.add(at(7) - B, reverse_cymbal(B), gain=0.4)
fx.add(at(7), impact(1.0), gain=0.75)                         # $0
fx.add(at(7.5), riser(2.5 * B), gain=0.45)
fx.add(at(10), impact(0.9), gain=0.7)                         # the app flies in
verb_send.add(at(10), impact(0.6), gain=0.25)

CLICKS = (11.5, 18, 31, 35, 42, 46, 64.5, 78.5, 82, 90, 96)
for b in CLICKS:
    fx.add(at(b), blip(1400), gain=0.22)
for b, pan in ((19, 0.4), (31, -0.4), (37, 0.6), (43, 0), (55, -0.3), (60, 0.3), (78, -0.3), (94, 0.4), (104, 0)):
    fx.add(at(b) - 0.12, whoosh(0.4), gain=0.45, pan=pan)
for start, end, chars in ((12.5, 17, 54), (61, 64, 36), (79, 81.5, 31)):   # typing
    for c in range(chars):
        fx.add(at(start) + c * ((end - start) * B / chars) + rng.uniform(-0.004, 0.004), type_click(), gain=0.2, pan=rng.uniform(-0.3, 0.3))
for i, b in enumerate((21, 23, 25, 27)):                      # build steps tick
    fx.add(at(b), bell(76 + [0, 3, 7, 12][i], 0.5), gain=0.2)
fx.add(at(36), coin(True), gain=0.45)                         # live!
fx.add(at(36), stab([57, 64, 69, 72]), gain=0.4)
for i, b in enumerate((43.5, 44, 44.5)):                      # earn options
    fx.add(at(b), blip(1000 + i * 180), gain=0.25)
fx.add(at(53), coin(True), gain=0.55)                         # +4 credits
verb_send.add(at(53), coin(True), gain=0.15)
for i, b in enumerate((84, 85, 86, 87, 88)):                  # poster builds
    fx.add(at(b), bell(81 + [0, 2, 4, 7, 9][i], 0.4), gain=0.18)
fx.add(at(96.5), blip(1800), gain=0.2)                        # copied
for i, b in enumerate((98, 99, 100)):                         # friends join
    fx.add(at(b), coin(False), gain=0.32, pan=-0.4 + 0.4 * i)
fx.add(at(101), riser(3 * B), gain=0.5)
for b, ch in ((104, [57, 64, 69]), (105, [53, 60, 65]), (106, [48, 55, 60, 64])):   # Chat. Code. Design.
    fx.add(at(b), stab(ch), gain=0.7)
    fx.add(at(b), kick(1.2), gain=0.8)
    bass.add(at(b), log_drum(45 if b == 104 else (41 if b == 105 else 48), 0.6), gain=0.6)
fx.add(at(108), impact(1.0), gain=0.8)                        # FREE.
fx.add(at(108), stab([45, 57, 64, 69, 72]), gain=0.6)
fx.add(at(110), impact(0.7), gain=0.6)                        # logo
verb_send.add(at(110), stab([57, 64, 69, 72, 76]), gain=0.4)
fx.add(at(112), coin(True), gain=0.4)                         # Join the beta

# ---------- mix ----------
for ch in range(2):
    music.x[ch] = sweep_filter(music.x[ch], lambda s: (500 + 2500 * (s / at(10)) ** 2) if s < at(10) else ((900 if at(41) <= s < at(44) else 20000)))

duck = np.ones(N)
for beat in range(END):
    if not groove_at(beat):
        continue
    i = int(at(beat) * SR)
    L = int(0.24 * SR)
    seg = 1 - 0.5 * np.exp(-np.arange(L) / (0.06 * SR))
    duck[i:i + L] = np.minimum(duck[i:i + L], seg[: max(0, min(L, N - i))])
music.x *= duck

ir_len = int(2.0 * SR)
ir = rng.normal(0, 1, ir_len) * np.exp(-np.arange(ir_len) / (0.4 * SR))
ir = fft_filter(ir, 200, 7000)
ir /= np.sqrt(np.sum(ir ** 2))
size = 1 << int(np.ceil(np.log2(N + ir_len)))
wet = np.zeros((2, N))
for ch in range(2):
    wet[ch] = np.fft.irfft(np.fft.rfft(verb_send.x[ch], size) * np.fft.rfft(np.roll(ir, ch * 97), size), size)[:N]

mix = drums.x + bass.x + music.x * 0.9 + fx.x + wet * 0.5
for gap_from, gap_to in ((9.5, 10), (103.5, 104)):
    i0, i1 = int(at(gap_from) * SR), int(at(gap_to) * SR)
    mix[:, i0:i1] = (fx.x[:, i0:i1] + wet[:, i0:i1] * 0.5) * 0.8

for ch in range(2):
    mix[ch] = fft_filter(mix[ch], 28)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.8) / np.tanh(1.8)
t = np.arange(N) / SR
mix *= np.clip((DUR - t) / 2.5, 0, 1)
mix *= 0.97 / np.max(np.abs(mix))

pcm = (mix.T * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "demo-music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", mix.shape)
