"""Original score for the Wanlly case study film, synthesized from scratch (no samples, no licences).

Slow and reflective at 72 BPM: Am9 - Fmaj7 - Cmaj7 - G6 on soft pads, a sparse piano-like motif,
a low cello-ish bass from chapter two, and a quiet chime on every chapter change (docs/story-film.html).
Run: python3 compose.py out.wav
"""
import sys
import wave

import numpy as np

SR = 44100
DUR = 72.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(72)


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
BEAT = 60 / 72
BAR = BEAT * 4

CHORDS = [
    (45, [57, 60, 64, 67, 71]),   # A minor 9
    (41, [57, 60, 64, 65]),       # F major 7
    (48, [55, 60, 64, 71]),       # C major 7
    (43, [55, 59, 62, 64]),       # G6
]
seg = BAR  # one chord per bar

# Pads: the whole film, slow attacks, wide
k, start = 0, 0.0
while start < DUR:
    _, notes = CHORDS[k % 4]
    for j, n in enumerate(notes):
        for det, pan in ((-0.0012, -0.6), (0.0012, 0.6)):
            sig = tone(hz(n), seg + 2.5, harmonics=((1, 1.0), (2, 0.18), (3, 0.05)), detune=det)
            e = env_adsr(len(sig), 2.2, 0.8, 0.7, 2.5, max(0.0, seg - 2.6))[: len(sig)]
            e = np.pad(e, (0, max(0, len(sig) - len(e))))
            add(mix, start, sig * e, pan=pan * (0.35 + 0.12 * j), gain=0.03)
    k += 1
    start += seg


def piano(freq, length=2.4):
    tt = np.arange(int(length * SR)) / SR
    s = sum(a * np.sin(2 * np.pi * freq * m * tt) * np.exp(-tt * (1.6 + m * 0.9)) for m, a in ((1, 1.0), (2, 0.35), (3, 0.12), (4, 0.05)))
    return s * np.minimum(1, tt * 300)


# A sparse motif: two or three notes a bar, quieter in the opening and the close
MOTIF = [(0, 0), (1.5, 2), (2.5, 1)]
bar = 0
tm = BAR * 1
while tm < DUR - 6:
    _, notes = CHORDS[int(tm // seg) % 4]
    for off, idx in MOTIF:
        at = tm + off * BEAT
        g = 0.07 if 7 < at < 64 else 0.045
        add(mix, at, piano(hz(notes[idx % len(notes)] + 12)), pan=0.2 if idx % 2 else -0.2, gain=g)
    tm += BAR
    bar += 1

# Bass from chapter two (25 s) to the close: long, soft, bowed
tm = BAR * round(25 / BAR)
while tm < 66:
    root, _ = CHORDS[int(tm // seg) % 4]
    sig = tone(hz(root - 12), BAR + 0.6, harmonics=((1, 1.0), (2, 0.3), (3, 0.1)))
    e = env_adsr(len(sig), 0.5, 0.6, 0.7, 0.6, BAR - 1.7)[: len(sig)]
    e = np.pad(e, (0, max(0, len(sig) - len(e))))
    add(mix, tm, sig * e, gain=0.08)
    tm += BAR


def chime(base):
    sig = np.zeros(int(3.5 * SR))
    tt = np.arange(len(sig)) / SR
    for mult, amp in ((1, 1.0), (2.0, 0.4), (2.76, 0.25), (5.4, 0.08)):
        sig += amp * np.sin(2 * np.pi * base * mult * tt) * np.exp(-tt * (1.6 + mult * 0.5))
    return sig


# A chime on every chapter change, and a resolving pair on the close
for at, n in ((7.0, 81), (17.0, 79), (25.0, 84), (37.0, 81), (47.0, 79), (57.0, 84)):
    add(mix, at, chime(hz(n)), pan=0.1, gain=0.05)
add(mix, 64.0, chime(hz(76)), pan=-0.15, gain=0.05)
add(mix, 64.3, chime(hz(81)), pan=0.15, gain=0.05)
add(mix, 66.4, chime(hz(88)), pan=0.0, gain=0.045)

# Price strike (9.4 s): a soft falling tone
tt = np.arange(int(0.7 * SR)) / SR
add(mix, 9.4, np.sin(2 * np.pi * np.cumsum(520 * np.exp(-tt * 2.5)) / SR) * np.exp(-tt * 6), gain=0.04)

# Reverb: convolve with a decaying noise tail (FFT), mixed in softly
ir_len = int(3.2 * SR)
ir = rng.normal(0, 1, ir_len) * np.exp(-np.arange(ir_len) / (0.7 * SR))
ir /= np.sqrt(np.sum(ir ** 2))
size = 1 << int(np.ceil(np.log2(N + ir_len)))
wet = np.zeros_like(mix)
IR = np.fft.rfft(ir, size)
for ch in range(2):
    wet[ch] = np.fft.irfft(np.fft.rfft(mix[ch], size) * IR, size)[:N]
out = mix + 0.5 * wet

# Fades and level
fade_in = np.minimum(1, t / 2.5)
fade_out = np.clip((DUR - t) / 4.0, 0, 1)
out *= fade_in * fade_out
out /= np.max(np.abs(out)) / 0.89

pcm = (out.T * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "story-music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", out.shape)
