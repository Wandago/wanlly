"""Original music for the Wanlly teaser, synthesized from scratch (no samples, no licences needed).

Calm, warm progression at 90 BPM: Cmaj7 - Am9 - Fmaj7 - G6, with soft pads, a plucked arpeggio,
a bass line, and sound cues synced to the video (logo chime, credit pops, typing, scene changes).
Run: python3 compose.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 40.5
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def hz(note):
    """MIDI note number to frequency."""
    return 440.0 * 2 ** ((note - 69) / 12)


def env_adsr(n, a, d, s, r, sus_len):
    total = int((a + d + sus_len + r) * SR)
    e = np.zeros(total)
    ia, idd, isus = int(a * SR), int(d * SR), int(sus_len * SR)
    e[:ia] = np.linspace(0, 1, ia, endpoint=False)
    e[ia:ia + idd] = np.linspace(1, s, idd, endpoint=False)
    e[ia + idd:ia + idd + isus] = s
    e[ia + idd + isus:] = np.linspace(s, 0, total - (ia + idd + isus))
    return e


def add(buf, start, sig, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + len(sig)] += sig * left
    buf[1, i:i + len(sig)] += sig * right


def tone(freq, length, harmonics=((1, 1.0), (2, 0.25), (3, 0.08)), detune=0.0):
    tt = np.arange(int(length * SR)) / SR
    out = np.zeros_like(tt)
    for h, amp in harmonics:
        f = freq * h * (1 + detune)
        out += amp * np.sin(2 * np.pi * f * tt + rng.uniform(0, 6.28))
    return out


mix = np.zeros((2, N))
BEAT = 60 / 90
BAR = BEAT * 4

# C major 7, A minor 9, F major 7, G6 (two bars each)
CHORDS = [
    (48, [60, 64, 67, 71]),
    (45, [57, 60, 64, 67, 71]),
    (41, [57, 60, 64, 65]),
    (43, [59, 62, 64, 67]),
]

# Pads: whole progression, long soft attacks, slight detune for width
seg = BAR * 2
k = 0
start = 0.0
while start < DUR:
    root, notes = CHORDS[k % 4]
    for j, n in enumerate(notes):
        for det, pan in ((-0.0015, -0.5), (0.0015, 0.5)):
            sig = tone(hz(n), seg + 1.6, detune=det)
            e = env_adsr(len(sig), 1.2, 0.6, 0.75, 1.6, max(0.0, seg - 1.8))[: len(sig)]
            if len(e) < len(sig):
                e = np.pad(e, (0, len(sig) - len(e)))
            add(mix, start, sig * e, pan=pan * (0.4 + 0.15 * j), gain=0.035)
    k += 1
    start += seg

# Arpeggio: plucked 8th notes from the logo reveal (9 s) to the end card
def pluck(freq, length=0.6, decay=4.5):
    tt = np.arange(int(length * SR)) / SR
    return (np.sin(2 * np.pi * freq * tt) + 0.35 * np.sin(4 * np.pi * freq * tt)) * np.exp(-decay * tt) * np.minimum(1, tt * 400)

step = BEAT / 2
s0 = 9.0
i = 0
tm = s0
while tm < 35.0:
    chord_idx = int(tm // seg) % 4
    _, notes = CHORDS[chord_idx]
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    n = notes[pattern[i % 8] % len(notes)] + 12
    vel = 0.075 if i % 2 == 0 else 0.05
    add(mix, tm, pluck(hz(n)), pan=-0.3 if i % 2 else 0.3, gain=vel)
    i += 1
    tm += step

# Bass: soft root note each bar from 13 s
tm = 13.0
while tm < 37.0:
    chord_idx = int(tm // seg) % 4
    root, _ = CHORDS[chord_idx]
    sig = tone(hz(root - 12), BAR, harmonics=((1, 1.0), (2, 0.15)))
    e = env_adsr(len(sig), 0.03, 0.4, 0.55, 0.5, BAR - 0.95)[: len(sig)]
    e = np.pad(e, (0, max(0, len(sig) - len(e))))
    add(mix, tm, sig * e, gain=0.11)
    tm += BAR

# Scene-change pulses: a soft low thump
def thump():
    tt = np.arange(int(0.35 * SR)) / SR
    f = 110 * np.exp(-tt * 9) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 10)

for at in (4.2, 9.0, 13.0, 19.0, 26.0, 30.5, 35.0):
    add(mix, at, thump(), gain=0.22)

# Chimes: logo lands and end card
def chime(base):
    sig = np.zeros(int(2.5 * SR))
    for mult, amp in ((1, 1.0), (2.0, 0.4), (2.76, 0.25), (5.4, 0.08)):
        tt = np.arange(len(sig)) / SR
        sig += amp * np.sin(2 * np.pi * base * mult * tt) * np.exp(-tt * (2.2 + mult * 0.6))
    return sig

add(mix, 10.2, chime(hz(84)), pan=0.1, gain=0.06)
add(mix, 35.2, chime(hz(79)), pan=-0.1, gain=0.06)
add(mix, 35.45, chime(hz(84)), pan=0.1, gain=0.05)

# Price strike (5.7 s): a short falling tone
tt = np.arange(int(0.5 * SR)) / SR
add(mix, 5.7, np.sin(2 * np.pi * np.cumsum(660 * np.exp(-tt * 3)) / SR) * np.exp(-tt * 8), gain=0.05)

# Credit pops at each +4
for at, n in ((14.65, 88), (15.95, 91), (17.25, 96)):
    add(mix, at, pluck(hz(n), 0.4, 9), pan=0.2, gain=0.09)

# Typing clicks while the prompt types (19.5 to 21.7 s)
chars = 42
for c in range(chars):
    at = 19.5 + c * (2.2 / chars) + rng.uniform(-0.01, 0.01)
    click = rng.normal(0, 1, int(0.012 * SR)) * np.exp(-np.arange(int(0.012 * SR)) / (0.002 * SR))
    add(mix, at, click, pan=rng.uniform(-0.3, 0.3), gain=0.018)

# Reverb: convolve with a decaying noise tail (FFT), mixed in softly
ir_len = int(2.2 * SR)
ir = rng.normal(0, 1, ir_len) * np.exp(-np.arange(ir_len) / (0.45 * SR))
ir /= np.sqrt(np.sum(ir ** 2))
size = 1 << int(np.ceil(np.log2(N + ir_len)))
wet = np.zeros_like(mix)
IR = np.fft.rfft(ir, size)
for ch in range(2):
    wet[ch] = np.fft.irfft(np.fft.rfft(mix[ch], size) * IR, size)[:N]
out = mix + 0.35 * wet

# Fades and level
fade_in = np.minimum(1, t / 0.8)
fade_out = np.clip((DUR - t) / 3.0, 0, 1)
out *= fade_in * fade_out
out /= np.max(np.abs(out)) / 0.89

pcm = (out.T * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "teaser-music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", out.shape)
