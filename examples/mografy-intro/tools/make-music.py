"""
Synthesize the Mografy intro music (12 s, 120 BPM, A minor) to match the scene.

    python3 tools/make-music.py            # writes assets/intro-music.wav
    ffmpeg -i assets/intro-music.wav -c:a libmp3lame -b:a 192k assets/intro-music.mp3

The beat grid is offset by -0.1 s so bars land on the scene's cuts:
  -0.1 | 1.9 | 3.9 | 5.9 | 7.9 | 9.9 (wordmark hit)
Cues taken from scenes/main.ts:
  0.35–1.55  typing clicks          8.6  "Updated" chime
  7.9–9.8    riser into the logo    9.9  hit, then a held chord to 12 s
Deterministic: fixed seed, no external samples.
"""
import os
import wave
import numpy as np

SR = 44100
DUR = 12.0
BPM = 120
BEAT = 60 / BPM
OFFSET = -0.1
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))


def note(name):
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    return 440 * 2 ** ((names[name[0]] + 12 * (int(name[-1]) - 4)) / 12)


def place(sig, start, gain=1.0, pan=0.0):
    i = int(round(start * SR))
    if i >= N:
        return
    j = min(N, i + len(sig))
    if i < 0:
        sig, i = sig[-i:], 0
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i:j, 0] += sig[: j - i] * gain * left * 1.414
    mix[i:j, 1] += sig[: j - i] * gain * right * 1.414


def onepole(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for k, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[k] = acc
    return y


def env(length, attack, release):
    n = int(length * SR)
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


# ------------------------------------------------------------ pad (warm detuned saws)
CHORDS = [  # (start, end, notes)
    (0.0, 1.9, ['A2', 'C3', 'E3', 'G3']),
    (1.9, 3.9, ['F2', 'A2', 'C3', 'E3']),
    (3.9, 5.9, ['C3', 'E3', 'G3', 'B3']),
    (5.9, 7.9, ['G2', 'B2', 'D3', 'F3']),
    (7.9, 9.9, ['A2', 'C3', 'E3', 'G3']),
    (9.9, 12.0, ['F2', 'C3', 'E3', 'G3', 'A3']),
]


def saw(freq, length, detune=0.0):
    n = int(length * SR)
    ph = (np.arange(n) * freq * (1 + detune) / SR) % 1.0
    return 2 * ph - 1


for start, end, notes in CHORDS:
    length = end - start + 0.35
    voice = np.zeros(int(length * SR))
    for name in notes:
        f = note(name)
        for d in (-0.004, 0.0, 0.0045):
            voice += saw(f, length, d)
    voice = onepole(voice / (len(notes) * 3), 900 if start < 9.9 else 1400)
    voice *= env(length, 0.25 if start > 0 else 0.6, 0.45)
    place(voice, start, 0.22, -0.15)
    place(voice, start + 0.012, 0.22, 0.15)

# ------------------------------------------------------------ drums
def kick(gain=1.0):
    n = int(0.45 * SR)
    tt = np.arange(n) / SR
    freq = 45 + 95 * np.exp(-tt * 28)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-tt * 7.5)
    click = rng.standard_normal(n) * np.exp(-tt * 300) * 0.25
    return (body + click) * gain


def hat(gain=1.0):
    n = int(0.08 * SR)
    noise = rng.standard_normal(n)
    hp = noise - onepole(noise, 7000)
    return hp * np.exp(-np.arange(n) / SR * 60) * gain


beats = [OFFSET + k * BEAT for k in range(0, int(DUR / BEAT) + 2)]
for b in beats:
    if 1.85 <= b < 9.4:
        place(kick(0.9 if (round((b - OFFSET) / BEAT) % 4 == 0) else 0.6), b, 0.55)
    if 3.85 <= b < 9.4:
        place(hat(0.5), b + BEAT / 2, 0.22, 0.35)

# ------------------------------------------------------------ pluck arpeggio (eighths, 3.9–9.4)
for start, end, notes in CHORDS[2:5]:
    pattern = [note(n) * 2 for n in notes]
    k = 0
    s = start
    while s < min(end, 9.4):
        f = pattern[k % len(pattern)] * (2 if k % 8 >= 6 else 1)
        n = int(0.35 * SR)
        tt = np.arange(n) / SR
        pl = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 11)
        place(pl, s, 0.12, 0.4 if k % 2 else -0.4)
        s += BEAT / 2
        k += 1

# ------------------------------------------------------------ typing clicks (matches the code being typed)
text = 'export function renderFrame(ctx, t) {'
for i in range(1, len(text) + 1):
    when = 0.35 + (1.55 - 0.35) * i / len(text)
    n = int(0.03 * SR)
    noise = rng.standard_normal(n)
    clk = (noise - onepole(noise, 2500)) * np.exp(-np.arange(n) / SR * 180)
    place(clk, when, 0.18 + 0.05 * rng.random(), rng.uniform(-0.3, 0.3))

# ------------------------------------------------------------ riser into the wordmark (7.9–9.8)
n = int(1.9 * SR)
tt = np.arange(n) / SR
noise = rng.standard_normal(n)
sweep = np.zeros(n)
acc = 0.0
for k in range(n):  # rising one-pole cutoff
    cutoff = 300 + 6000 * (k / n) ** 2
    a = np.exp(-2 * np.pi * cutoff / SR)
    acc = (1 - a) * noise[k] + a * acc
    sweep[k] = acc
rise = sweep * (tt / 1.9) ** 2 * 0.9
tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * (tt / 1.9) ** 2) / SR) * (tt / 1.9) ** 3 * 0.25
place(rise + tone, 7.9, 0.5)

# ------------------------------------------------------------ "Updated" chime (8.6)
for f, d, g in ((note('E5'), 0.0, 0.25), (note('B5'), 0.09, 0.2)):
    n = int(1.2 * SR)
    tt = np.arange(n) / SR
    bell = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt * 4.5)
    place(bell, 8.6 + d, g, 0.2)

# ------------------------------------------------------------ the hit (9.9)
place(kick(1.3), 9.9, 0.8)
n = int(2.0 * SR)
tt = np.arange(n) / SR
crash = rng.standard_normal(n)
crash = (crash - onepole(crash, 3000)) * np.exp(-tt * 2.2)
place(crash, 9.9, 0.18, -0.2)
place(crash, 9.905, 0.18, 0.2)
sub = np.sin(2 * np.pi * note('F1') * tt) * np.exp(-tt * 1.6)
place(sub, 9.9, 0.45)

# ------------------------------------------------------------ master
mix -= mix.mean(axis=0)
fade = np.ones(N)
fade[: int(0.02 * SR)] = np.linspace(0, 1, int(0.02 * SR))
fade[-int(0.8 * SR):] = np.linspace(1, 0, int(0.8 * SR)) ** 1.5
mix *= fade[:, None]
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix *= 0.7 / np.max(np.abs(mix))  # about -3 dBFS, headroom for AAC

out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'intro-music.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', os.path.normpath(out), f'{DUR}s')
