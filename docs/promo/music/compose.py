"""Original music for the Wanlly promo, synthesized from scratch (no samples, no licences needed).

A 140 BPM trap/afro beat in F minor (Fm - Db - Eb - C): 808s, hard kicks, claps, rolling hats, a
bell hook and wide saw chords, with every impact, riser, whoosh and coin sound placed on the same
beats as the cuts in docs/promo.html. The intro opens up through a filter sweep into the drop.
Run: python3 compose.py out.wav   (numpy only)
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 140
B = 60 / BPM          # one beat, seconds
S16 = B / 4           # one sixteenth
DUR = 32.0
N = int(SR * DUR)
rng = np.random.default_rng(140)


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


# ---------- arrangement ----------

drums, bass, music, fx, verb_send = Bus(), Bus(), Bus(), Bus(), Bus()

CHORDS = [  # per bar: 808 root, pad voicing
    (41, [53, 56, 60, 65]),   # F minor
    (37, [49, 53, 56, 61]),   # D flat
    (39, [51, 55, 58, 63]),   # E flat
    (36, [48, 52, 55, 60]),   # C major (pulls back to F minor)
]
KICKS = [0, 6, 10, 16, 19, 22, 26]          # sixteenths in a 2-bar loop
HOOK = [(0, 77), (3, 80), (6, 79), (8, 75), (10, 77), (14, 72),
        (16, 77), (19, 80), (22, 84), (24, 82), (26, 80), (28, 79), (30, 75)]

# Where the full beat plays (beats), and the breaks the video cuts to.
FULL = [(8, 44), (48, 63.5), (64, 72)]


def full_at(beat):
    return any(a <= beat < b for a, b in FULL)


# Pads, every bar from the top (filtered in the intro), sidechained later
for bar in range(18):
    root, voicing = CHORDS[bar % 4]
    b0 = bar * 4
    if 44 <= b0 < 48 or b0 >= 72:
        continue
    music.add(at(b0), chord_pad(voicing, 4 * B, bright=1.0 if b0 >= 8 else 0.8), gain=0.32, pan=-0.15)
    music.add(at(b0) + 0.004, chord_pad(voicing, 4 * B, bright=1.0 if b0 >= 8 else 0.8), gain=0.32, pan=0.15)

# Bell hook over every 2 bars; brighter octave in the final section
for start in range(0, 72, 8):
    for s16, note in HOOK:
        beat = start + s16 / 4
        if 7.5 <= beat < 8 or 44 <= beat < 48 or 63.5 <= beat < 64:
            continue
        g = 0.2 if beat >= 8 else 0.16
        music.add(at(beat), bell(note + (12 if beat >= 64 else 0)), gain=g, pan=0.25 if s16 % 2 else -0.25)
        verb_send.add(at(beat), bell(note), gain=0.08)

# Kicks, 808s, claps and hats in the full sections
for bar in range(18):
    root, _ = CHORDS[bar % 4]
    for i, s16 in enumerate(KICKS):
        abs16 = (bar // 2) * 32 + s16
        if abs16 // 16 != bar:
            continue
        beat = abs16 / 4
        if not full_at(beat):
            continue
        drums.add(at(beat), kick(), gain=0.95)
        nxt = [k for k in KICKS if k > s16]
        length = ((nxt[0] if nxt else 32) - s16) * S16
        glide = root + 12 if s16 in (19, 26) else None
        bass.add(at(beat), bass808(root, min(length, 4 * B), glide), gain=0.62)
    for clap_beat in (2,):
        beat = bar * 4 + clap_beat
        if full_at(beat):
            drums.add(at(beat), clap(), gain=0.62)
            verb_send.add(at(beat), clap(), gain=0.18)

# Hats: 8ths everywhere the beat plays (16ths in the intro, quiet), rolls at bar ends
beat = 0.0
while beat < 72:
    if full_at(beat):
        drums.add(at(beat), hat(vel=0.9 if beat % 1 == 0 else 0.6), gain=0.32, pan=0.2)
        bar_pos = beat % 8
        if bar_pos == 7.5 or (beat >= 54 and beat % 2 == 1.5):   # 32nd and triplet rolls
            for k in range(1, 4):
                drums.add(at(beat) + k * B / 6, hat(vel=0.5 + 0.12 * k), gain=0.3, pan=-0.2)
        if beat % 4 == 3.5:
            drums.add(at(beat), hat(open_=True, vel=0.6), gain=0.28, pan=-0.3)
    elif beat < 7.5:
        drums.add(at(beat), hat(vel=0.5), gain=0.22, pan=0.2)
        drums.add(at(beat) + S16, hat(vel=0.3), gain=0.22, pan=-0.2)
    beat += 0.5

# ---------- sound design on the cuts ----------
fx.add(at(0), impact(0.6), gain=0.5)
fx.add(at(0), kick(), gain=0.8)
fx.add(at(2), whoosh(0.3), gain=0.6, pan=-0.4)
fx.add(at(2.05), clap(), gain=0.5)
fx.add(at(4), kick(), gain=0.8)
fx.add(at(4), impact(0.5), gain=0.35)
fx.add(at(6), stab([53, 60, 65]), gain=0.6)
fx.add(at(6.5), stab([56, 63, 68]), gain=0.6)
fx.add(at(4), riser(3.5 * B), gain=0.5)

for big in (8, 32, 48, 64):                         # drops
    fx.add(at(big), impact(1.0), gain=0.85)
    verb_send.add(at(big), impact(0.6), gain=0.3)
fx.add(at(14), impact(0.55), gain=0.45)              # FREE.
for b in (16, 18, 20, 22):                           # colour flips
    fx.add(at(b), whoosh(0.28), gain=0.5, pan=0.5 if b % 4 else -0.5)
    fx.add(at(b), stab(CHORDS[(b // 4) % 4][1][:3]), gain=0.35)
fx.add(at(16) - 2 * B, reverse_cymbal(2 * B), gain=0.45)
for b in (24, 26, 28, 30):                           # montage cards
    fx.add(at(b) - 0.08, whoosh(0.4), gain=0.65, pan=-0.6 if b in (24, 28) else 0.6)
for k in range(16):                                  # snare roll into 32
    beat = 30 + k * 0.125
    drums.add(at(beat), clap(), gain=0.18 + 0.025 * k)
fx.add(at(30), riser(2 * B), gain=0.5)
fx.add(at(33), whoosh(0.4), gain=0.4, pan=-0.5)      # video card
for b, big in ((36, False), (38, False), (40, True)):
    fx.add(at(b), coin(big), gain=0.55, pan=0.3)
    verb_send.add(at(b), coin(big), gain=0.15)
for b, ch in ((44, [53, 60, 65, 68]), (45, [49, 56, 61, 65]), (46, [51, 58, 63, 67])):   # NO CARD / SUB / STRESS
    fx.add(at(b), stab(ch), gain=0.8)
    fx.add(at(b), kick(1.3), gain=0.9)
    bass.add(at(b), bass808(CHORDS[(b - 44) % 4][0], B * 0.9), gain=0.62)
    fx.add(at(b), impact(0.4), gain=0.3)
fx.add(at(46.5), riser(1.5 * B), gain=0.55)
for c in range(42):                                  # prompt typing
    fx.add(at(48.6) + c * (1.3 * B / 42) + rng.uniform(-0.004, 0.004), type_click(), gain=0.22, pan=rng.uniform(-0.3, 0.3))
fx.add(at(50) - 0.1, whoosh(0.45), gain=0.6, pan=0.5)   # phone slides in
fx.add(at(52), impact(0.7), gain=0.6)                   # SHIPPED stamp
fx.add(at(52), stab([53, 60, 65, 72]), gain=0.5)
for i, b in enumerate((55, 55.5, 56, 56.5, 57)):        # model names
    fx.add(at(b), blip(900 + i * 220), gain=0.32, pan=-0.3 + i * 0.15)
fx.add(at(57), impact(0.45), gain=0.35)
for i, b in enumerate((58, 58.25, 58.5, 58.75, 59)):    # chips pop
    fx.add(at(b), bell(84 + [0, 3, 5, 7, 10][i], 0.4), gain=0.18)
for k in range(24):                                     # roll through the cities
    beat = 60 + k * 0.125
    drums.add(at(beat), clap(), gain=0.12 + 0.02 * k)
for i, b in enumerate((60, 60.5, 61, 61.5, 62, 62.5)):
    fx.add(at(b), blip(600 + i * 160), gain=0.25)
fx.add(at(60), riser(3 * B), gain=0.55)
fx.add(at(63), impact(0.5), gain=0.5)                    # "You."
fx.add(at(63), power_down(0.5 * B), gain=0.5)
fx.add(at(66), stab([53, 60, 65, 72]), gain=0.45)        # Watch. Earn. Build.
fx.add(at(68), coin(True), gain=0.45)                    # Join the beta
fx.add(at(72), impact(1.0), gain=0.8)                    # last hit
fx.add(at(72), stab([41, 53, 60, 65, 68, 72]), gain=0.7)
verb_send.add(at(72), stab([53, 60, 65, 68, 72]), gain=0.5)

# ---------- mix ----------
# Intro: the music opens up from a muffled filter into the drop.
for ch in range(2):
    music.x[ch] = sweep_filter(music.x[ch], lambda s: 450 + 5000 * min(1, s / at(7.5)) ** 2.5 if s < at(8) else 20000)

# Sidechain: pads and hook duck under every kick in the full sections
duck = np.ones(N)
for bar in range(18):
    for s16 in KICKS:
        abs16 = (bar // 2) * 32 + s16
        if abs16 // 16 != bar or not full_at(abs16 / 4):
            continue
        i = int(at(abs16 / 4) * SR)
        L = int(0.28 * SR)
        seg = 1 - 0.65 * np.exp(-np.arange(L) / (0.07 * SR))
        duck[i:i + L] = np.minimum(duck[i:i + L], seg[: max(0, min(L, N - i))])
music.x *= duck

# Reverb on the send
ir_len = int(1.8 * SR)
ir = rng.normal(0, 1, ir_len) * np.exp(-np.arange(ir_len) / (0.35 * SR))
ir = fft_filter(ir, 200, 7000)
ir /= np.sqrt(np.sum(ir ** 2))
size = 1 << int(np.ceil(np.log2(N + ir_len)))
wet = np.zeros((2, N))
for ch in range(2):
    irc = np.roll(ir, ch * 97)
    wet[ch] = np.fft.irfft(np.fft.rfft(verb_send.x[ch], size) * np.fft.rfft(irc, size), size)[:N]

mix = drums.x * 1.0 + bass.x * 1.0 + music.x * 0.9 + fx.x * 1.0 + wet * 0.55

# The gap before each drop: half a beat of silence (only the riser tail and fx survive)
for gap_from, gap_to in ((7.5, 8), (47.5, 48), (63.5, 64)):
    i0, i1 = int(at(gap_from) * SR), int(at(gap_to) * SR)
    keep = fx.x[:, i0:i1] + wet[:, i0:i1] * 0.55
    mix[:, i0:i1] = keep * 0.8

# Master: gentle low cut, glue, soft clip, fade
for ch in range(2):
    mix[ch] = fft_filter(mix[ch], 28)
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 2.0) / np.tanh(2.0)
t = np.arange(N) / SR
mix *= np.clip((DUR - t) / 0.9, 0, 1)
mix *= 0.97 / np.max(np.abs(mix))

pcm = (mix.T * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "promo-music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", mix.shape)
