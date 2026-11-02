# 海月公主 — original 72 s score, written as an anime ballad: one tune that grows from a music box to a full orchestra.
# 100 BPM, bar = 2.4 s, offset 0. D major, lifting to E major when the sea answers and staying there.
#   python3 music-src/compose.py assets/music.mp3 [--timeline storyboards/music-timeline.png]
# Deterministic (seeded). numpy only (ffmpeg for mp3). Every hit time below comes from scenes/main.ts.
#
#  0– 4.8  序  music box alone, first phrase of the tune; pearls light; velvet drapes
#  4.8–9.6     into the water; a harp falls with the moonlight; strings breathe
#  9.6–16.8 起 the tune on flute over canon chords: harp, piano, strings
# 16.8–24      her room: she takes the tune over, humming; she stops on the bar line when the fish pass
# 24–33.6  承  it never resolves: Em → Cmaj7 → a low B pedal; one tick per window
# 33.6–43.2    almost nothing: a child far away, the umbrella's glass note, her footsteps
# 43.2–48  轉  the tune again, unaccompanied, not quite steady; a bell for each ring of light; B7 lifts into E
# 48–62.4  合  chorus on IV–V–iii–vi: piano, strings, choir, flute, voice, soft drums; a bell for each district
# 60–62.4      the harp climbs as the camera rises over the city
# 62.4         E major lands on the city seen from above; rings of light cross it
# 64.8–72      music box takes the tune home; the harp that fell in S02 rises again, bubbles, the moon returns, the drapes close
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from score import Mix, SR, hz, lowpass, write

DUR, BPM = 72.0, 100
BEAT = 60 / BPM; BAR = BEAT * 4
T = lambda bar, beat=0.0: bar * BAR + beat * BEAT
LIFT = 48.0
tr = lambda t: 2 if t >= LIFT - 1e-6 else 0            # up a whole tone when the sea answers, and it stays up

mx = Mix(DUR, 2611)
STEMS: dict = {}
DELAY = Mix(DUR, 2)
def put(stem, sig, t0, gain=1.0, pan=0.0, send=.3, delay=0.0):
    mx.put(sig, t0, gain, pan, send)
    if delay: DELAY.put(sig, t0, gain * delay, pan, 0)
def tt(length): return np.arange(int(SR * length)) / SR
def env(t, a, r, length): return np.minimum(1, t / a) * np.clip((length - t) / r, 0, 1)
rng = np.random.default_rng(31)

def musicbox(m, vel=.5, length=2.6):
    t = tt(length); f = hz(m)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 1.5), (3.0, .3, 5), (5.98, .11, 11), (9.2, .04, 16)])
    s += np.sin(2 * np.pi * f * 12.1 * t) * np.exp(-t * 60) * .07
    return s * env(t, .002, .2, length) * vel * .22
def celesta(m, vel=.4, length=2.2):
    t = tt(length); f = hz(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2) + .35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 9) + .12 * np.sin(2 * np.pi * f * 10 * t) * np.exp(-t * 30)
    return s * env(t, .001, .15, length) * vel * .2
def pizz(m, vel=.5, length=.6):
    t = tt(length); f = hz(m)
    s = sum((1 / k ** 1.3) * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (8 + 6 * k)) for k in range(1, 7))
    return s * env(t, .003, .05, length) * vel * .32
def flute(m, length, vel=.5):
    t = tt(length); f = hz(m); vib = 1 + .004 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - .25) / .4, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    s = np.sin(ph) + .18 * np.sin(2 * ph) + .05 * np.sin(3 * ph) + lowpass(rng.standard_normal(len(t)), 2600) * .05
    return s * env(t, .09, .18, length) * vel * .2
FORMANTS = [(700, 110, 1.0), (1150, 140, .55), (2650, 200, .32), (3400, 260, .14)]   # a soft 'ah' leaning to 'oo'
def vox(m, length, vel=.5, det=0.0, shake=0.0):
    """Vocal synth: harmonics weighted by formant peaks, breath noise, delayed vibrato."""
    L = length + .14; t = tt(L); f = hz(m + det)
    vib = 1 + .0065 * np.sin(2 * np.pi * 5.4 * t + det * 9) * np.clip((t - .2) / .3, 0, 1) + shake * (.012 * np.sin(2 * np.pi * 6.7 * t + 1.3) + .009 * np.sin(2 * np.pi * 2.3 * t))
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    s = np.zeros_like(t)
    for k in range(1, 40):
        fk = f * k
        if fk > 9000: break
        a = sum(g / (1 + ((fk - F) / B) ** 2) for F, B, g in FORMANTS) / k ** .35
        s += a * np.sin(k * ph)
    s += (lowpass(rng.standard_normal(len(t)), 5000) - lowpass(rng.standard_normal(len(t)), 1800)) * .05
    return s * env(t, .03, .12, L) * vel * .09
def ensemble(notes, length, vel=.4, attack=1.0, bright=5.0, release=.9):
    """String ensemble: several detuned voices with slow vibrato, warm low-pass."""
    t = tt(length); s = np.zeros_like(t)
    for m in notes:
        for v, det in enumerate((-.09, -.03, .03, .09)):
            f = hz(m + det); ph = 2 * np.pi * np.cumsum(f * (1 + .003 * np.sin(2 * np.pi * (4.6 + v * .37) * t + v))) / SR
            for k in range(1, 16):
                if f * k > 6500: break
                s += np.exp(-k / bright) / k * np.sin(k * ph + v * 1.3)
    s = lowpass(s, 2200 + 500 * bright)
    return s * env(t, attack, min(release, length * .45), length) * vel * .05 / max(1, len(notes)) ** .5
def harp(m, vel=.4): return mx.pluck(m, vel * .9, 1.8)
def bell(m, vel=.4): return mx.bell(m, vel, 2.4)
def epiano(m, vel=.4, length=1.4):
    t = tt(length); f = hz(m); idx = 1.8 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t)) * np.exp(-t * 1.6) * (1 + .15 * np.sin(2 * np.pi * 4.5 * t))
    return s * env(t, .003, .15, length) * vel * .16
def tok(vel=.5):
    t = tt(.12); s = (np.sin(2 * np.pi * 820 * t) + .5 * np.sin(2 * np.pi * 1730 * t)) * np.exp(-t / .028)
    s += lowpass(rng.standard_normal(len(t)), 3000) * np.exp(-t / .006) * .4
    return s * vel * .3
def tick(m, vel=.3):
    t = tt(.2); return (np.sin(2 * np.pi * hz(m) * t) * np.exp(-t / .05) + np.sin(2 * np.pi * hz(m) * 2.7 * t) * np.exp(-t / .02) * .4) * vel * .18
def kick(vel=.8):
    t = tt(.5); f = 46 + 120 * np.exp(-t / .04); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .24)
    s += lowpass(rng.standard_normal(len(t)), 5000) * np.exp(-t / .003) * .35
    return np.tanh(s * 1.4) * vel * .5
def snare(vel=.6):
    t = tt(.32); n = rng.standard_normal(len(t)); n = lowpass(n, 8000) - lowpass(n, 1500)
    body = np.sin(2 * np.pi * (185 + 40 * np.exp(-t / .01)) * t) * np.exp(-t / .07)
    return (n * np.exp(-t / .12) * .85 + body * .55) * vel * .34
def clap(vel=.6):
    t = tt(.34); n = rng.standard_normal(len(t)); n = lowpass(n, 5200) - lowpass(n, 900)
    e = sum(np.exp(-np.clip(t - d, 0, None) / (.008 if d < .025 else .12)) * (t >= d) for d in (0, .011, .022, .03))
    return n * e * vel * .26
def hat(vel=.4, length=.06):
    t = tt(length); n = rng.standard_normal(len(t)); n = n - lowpass(n, 8000)
    return n * np.exp(-t / (length / 3)) * vel * .24
def shaker(vel=.3):
    t = tt(.09); n = rng.standard_normal(len(t)); n = lowpass(n, 11000) - lowpass(n, 5000)
    return n * np.sin(np.pi * t / .09) ** 2 * vel * .2
def tom(m, vel=.6):
    t = tt(.5); f = hz(m) * (1 + .5 * np.exp(-t / .03)); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .2) * vel * .4
def crash(vel=.6):
    t = tt(2.6); n = rng.standard_normal(len(t)); n = n - lowpass(n, 4200)
    return n * np.exp(-t / .9) * np.minimum(1, t / .002) * vel * .2
def bass(m, length, vel=.6):
    t = tt(length); f = hz(m)
    s = np.sin(2 * np.pi * f * t) + .35 * np.sin(4 * np.pi * f * t) + .12 * np.sin(6 * np.pi * f * t)
    return np.tanh(s * 1.2) * env(t, .004, .06, length) * np.exp(-t / .9) * vel * .32
def swish(length=.6, vel=.5, bright=3500, up=False):
    n = lowpass(rng.standard_normal(int(SR * length)), bright) - lowpass(rng.standard_normal(int(SR * length)), 400) * .3
    shape = np.linspace(0, 1, len(n)) ** 2 if up else np.sin(np.linspace(0, np.pi, len(n))) ** 2
    return n * shape * vel * .12
def whoosh(length, vel=.5, f0=300, f1=2400):
    t = tt(length); k = t / length; n = rng.standard_normal(len(t))
    lo, hi = lowpass(n, f1), lowpass(n, f0)
    s = (lo - hi) * np.sin(np.pi * k) ** 1.5
    return s * vel * .16
def riser(length, vel=.5):
    t = tt(length); k = t / length
    s = np.sin(2 * np.pi * np.cumsum(180 * 2 ** (k * 3)) / SR) * .25 + lowpass(rng.standard_normal(len(t)), 5000) * .35
    return s * k ** 2.2 * vel * .3

def breath(length=1.0, vel=.4):
    n = lowpass(rng.standard_normal(int(SR * length)), 2600) - lowpass(rng.standard_normal(int(SR * length)), 500)
    return n * np.sin(np.linspace(0, np.pi, len(n))) ** 1.5 * vel * .12

# ---------------------------------------------------------------- harmony: one chord per bar, written in D (the song sounds in E from bar 20)
CH = {'D': (50, [0, 4, 7, 14]), 'A/C#': (49, [8, 12, 15, 19]), 'Bm': (47, [0, 3, 7, 10]), 'F#m/A': (45, [3, 7, 12, 15]), 'G': (43, [0, 4, 7, 11]), 'D/F#': (42, [8, 12, 15, 20]), 'Em': (40, [0, 3, 7, 10]),
      'Asus': (45, [0, 5, 7, 12]), 'A': (45, [0, 4, 7, 10]), 'Cmaj': (48, [0, 4, 7, 11]), 'B7': (47, [0, 4, 7, 10]), 'F#m': (42, [0, 3, 7, 10])}
BARS = ['D', 'A/C#', 'Bm', 'G',                       # 0–3   序
        'D', 'A/C#', 'Bm', 'F#m/A', 'G', 'D/F#',      # 4–9   the tune, then her hum
        'Em', 'Cmaj', 'Bm', 'Bm', 'Bm', 'G', 'Em', 'Em',   # 10–17 the dark
        'D', 'B7',                                    # 18–19 her voice; B7 is V of E, sounding as written
        'G', 'A', 'F#m', 'Bm', 'G', 'A', 'D',         # 20–26 chorus (sounds in E)
        'D', 'G', 'D']                                # 27–29 reprise (sounds in E)
def chord_at(t):
    root, iv = CH[BARS[min(len(BARS) - 1, int(t // BAR))]]
    return root + tr(t), iv
def tones(t, octave=0):
    root, iv = chord_at(t); return [root + 12 + i + octave for i in iv[:3]]

# ---------------------------------------------------------------- the tune, written in D: (bar, beat, beats, midi)
E5, Fs5, G5, A5, B5, Cs6, D6, E6, Fs6, G6, A6 = 76, 78, 79, 81, 83, 85, 86, 88, 90, 91, 93
THEME = [(0, 0, .75, Fs5), (0, .75, .25, G5), (0, 1, 1, A5), (0, 2, 1.5, D6), (0, 3.5, .5, Cs6),
         (1, 0, .75, Cs6), (1, .75, .25, B5), (1, 1, 2, A5), (1, 3, 1, E5),
         (2, 0, .75, Fs5), (2, .75, .25, G5), (2, 1, 1, A5), (2, 2, 1, B5), (2, 3, 1, D6),
         (3, 0, 3, Cs6), (3, 3, 1, A5),
         (4, 0, .75, B5), (4, .75, .25, A5), (4, 1, 1, G5), (4, 2, 1, B5), (4, 3, 1, D6),
         (5, 0, .75, A5), (5, .75, .25, G5), (5, 1, 1, Fs5), (5, 2, 1, A5), (5, 3, 1, D6)]
CHORUS = [(20, 0, 1, D6), (20, 1, 1, E6), (20, 2, 1.5, Fs6), (20, 3.5, .5, E6),
          (21, 0, 1, E6), (21, 1, .5, D6), (21, 1.5, .5, E6), (21, 2, 2, A5),
          (22, 0, 1, Cs6), (22, 1, 1, D6), (22, 2, 1.5, E6), (22, 3.5, .5, D6),
          (23, 0, 1, D6), (23, 1, .5, Cs6), (23, 1.5, .5, D6), (23, 2, 2, Fs5),
          (24, 0, 1, D6), (24, 1, 1, E6), (24, 2, 1, Fs6), (24, 3, 1, G6),
          (25, 0, 1.5, A6), (25, 1.5, .5, G6), (25, 2, 1, Fs6), (25, 3, 1, E6)]
COUNTER = [(20, 0, 4, B5 - 12), (21, 0, 4, Cs6 - 12), (22, 0, 4, A5 - 12), (23, 0, 4, Fs5 - 12), (24, 0, 2, G5 - 12), (24, 2, 2, B5 - 12), (25, 0, 2, Cs6 - 12), (25, 2, 2, E6 - 12)]
def phrase(a, b, at, oct=0): return [(bar - a + at, beat, ln, m + oct) for bar, beat, ln, m in THEME if a <= bar < b]
def mel(seq, inst, stem, vel=.5, pan=0., send=.4, stretch=1., delay=0.):
    for bar, beat, ln, m in seq:
        t0 = T(bar, beat); put(stem, inst(m + tr(t0), ln * BEAT * stretch, vel), t0, pan=pan, send=send, delay=delay)

def voicing(t):
    root, iv = chord_at(t + .02); return root, [root + 12 + i for i in iv]
def pad(b0, b1, vel=.3, attack=1.1, bright=5., oct=0, stem='strings'):
    for b in range(b0, b1):
        t0 = T(b); root, up = voicing(t0); put(stem, ensemble([root - 12 + oct, root + oct] + [m + oct for m in up[:3]], BAR + 1.3, vel, attack=attack, bright=bright, release=1.3), t0, send=.6)
def harpbed(b0, b1, vel=.3, every=.5, oct=12):
    n = int((b1 - b0) * 4 / every)
    for i in range(n):
        t0 = T(b0) + i * every * BEAT; root, up = voicing(t0); pat = [root, up[1], up[2], up[1] + 12, up[3], up[1] + 12, up[2], up[1]]
        put('harp', harp(pat[i % 8] + oct - (12 if i % 8 == 0 else 0), vel * (1. if i % 4 == 0 else .72)), t0 + rng.uniform(0, .004), pan=float(np.sin(i * .45) * .45), send=.5)
def pianobed(b0, b1, vel=.32):            # left hand root and fifth, right hand a broken chord in eighths: the backbone of the chorus
    for b in range(b0, b1):
        t0 = T(b); root, up = voicing(t0)
        put('piano', mx.piano(root - 12, vel * 1.05, 3.2), t0, pan=-.15, send=.4); put('piano', mx.piano(root - 5, vel * .7, 2.8), T(b, 2), pan=-.1, send=.4)
        for i, m in enumerate([up[0], up[2], up[1] + 12, up[2], up[0] + 12, up[2], up[1] + 12, up[2]]):
            put('piano', mx.piano(m + 12, vel * (.62 if i % 2 else .78), 1.9), t0 + i * BEAT * .5 + rng.uniform(0, .006), pan=.15, send=.42)
def chordhit(b, vel=.34):
    root, up = voicing(T(b))
    for j, m in enumerate([root - 12, root, *up]): put('piano', mx.piano(m + 12 if j > 1 else m, vel, 3.4), T(b) + j * .014, pan=-.2 + j * .08, send=.5)
def bassline(b0, b1, vel=.3):
    for b in range(b0, b1):
        t0 = T(b); root, _ = chord_at(t0 + .02); put('bass', mx.sub(root - 12, vel, BAR, decay=1.4), t0, send=.08)

# ---------------------------------------------------------------- 序: the theatre
for j in range(13):
    put('fx', mx.grain([74, 78, 81, 86][j % 4] + 12, .12, .2), .2 + j * .1, pan=(1 if j % 2 else -1) * j * .06, send=.7)
mel(phrase(0, 2, 0), lambda m, ln, v: musicbox(m, v, 3.), 'musicbox', vel=.42, pan=-.08, send=.6)
for b in (0, 1):
    root, up = voicing(T(b)); put('musicbox', musicbox(root + 12, .16, 3.), T(b), pan=.2, send=.6); put('musicbox', musicbox(up[2] + 12, .13, 3.), T(b, 2), pan=.25, send=.6)
pad(0, 2, .1, attack=1.8, bright=2.6)
put('fx', swish(2.0, .4, 1800), 1.5, send=.3)
put('fx', whoosh(1.3, .55, 420, 2800), 4.1, send=.3)                                    # the paper waves wash past
put('fx', mx.sub(33, .5, 1.8, decay=.5), 4.8, send=.5); put('fx', lowpass(rng.standard_normal(int(SR * 1.3)), 620) * np.exp(-tt(1.3) / .3) * .3, 4.8, send=.8)
t = 4.85
while t < 7.2:                                                                          # bubbles
    f = rng.uniform(420, 1300); ln = rng.uniform(.05, .12); q = tt(ln)
    put('fx', np.sin(2 * np.pi * (f * q + f * .9 * q * q / ln)) * np.exp(-q / (ln * .35)) * rng.uniform(.025, .08), t, pan=float(rng.uniform(-.7, .7)), send=.8); t += rng.exponential(.11) * (1 + (t - 4.9) * .7)
# into the water
pad(2, 4, .2, attack=1.4, bright=3); bassline(2, 4, .13)
for j, m in enumerate([98, 95, 93, 90, 86, 83, 81, 78, 74, 71, 69, 66, 62]): put('harp', harp(m, .3), 4.95 + j * .19, pan=.5 - j * .08, send=.7)
chordhit(3, .16)

# ---------------------------------------------------------------- 起: the tune whole
pad(4, 8, .26, attack=.9, bright=3.6); bassline(4, 8, .22); harpbed(4, 8, .24)
for b in (4, 5, 6, 7): chordhit(b, .14)
mel(phrase(0, 3, 4), flute, 'flute', vel=.56, pan=.12, send=.5)
for k in range(18): put('fx', mx.grain([86, 90, 93, 98][k % 4] + 12, .03 + k * .004, .12), 13.5 + k * .17, pan=float(np.sin(k)) * .5, send=.8)     # the push to the window
put('fx', whoosh(1.2, .26, 300, 2600), 15.7, send=.6)
put('fx', bell(98, .2), 16.8, send=.9); put('fx', bell(105, .13), 16.85, send=.9)

# ---------------------------------------------------------------- her room: she takes the tune over
pad(8, 10, .13, attack=1.4, bright=2.4)
for b in range(7, 10):                                                                  # a music box keeps her company
    root, up = voicing(T(b))
    for i, m in enumerate([up[0], up[2], up[3], up[2]]): put('musicbox', musicbox(m + 12, .12, 2.6), T(b, i), pan=-.25 + i * .12, send=.55)
for bar, beat, ln, m in phrase(3, 5, 7, -12):
    t0 = T(bar, beat); put('voice', vox(m, ln * BEAT * .97, .85), t0, pan=-.04, send=.5); put('voice', vox(m, ln * BEAT * .97, .3, det=.07), t0 + .012, pan=.12, send=.5)
for k in range(14): put('fx', breath(.12, .1), 20.7 + k * .1, pan=-.6 + k * .09, send=.4)    # fish flutter past; she stops
for bar, beat, ln, m in [(9, 2.4, 1.1, A5 - 12), (9, 3.5, .5, G5 - 12)]: put('voice', vox(m, ln * BEAT, .5), T(bar, beat), send=.65)

# ---------------------------------------------------------------- 承: it never resolves
put('voice', vox(Fs5 - 12, 1.4 * BEAT, .46), 24.0, send=.7); put('voice', vox(E5 - 12, 2.6 * BEAT, .36), 24.0 + 1.4 * BEAT, send=.75)
pad(10, 12, .16, attack=1.5, bright=1.9, oct=-12)
sl = lowpass(rng.standard_normal(int(SR * 4.2)), 1100) - lowpass(rng.standard_normal(int(SR * 4.2)), 300)      # the paper disc, dragged by hand
gate = (np.floor(tt(4.2) * 12) % 2) * .5 + .5; put('fx', sl * gate * np.sin(np.linspace(0, np.pi, len(sl))) ** .7 * .035, 24.4, pan=.3, send=.35)
for t0, m, v in [(25.2, 66, .24), (26.4, 64, .22), (27.6, 59, .24), (28.2, 60, .16)]: put('piano', mx.piano(m, v, 3.6), t0, send=.7)
put('strings', ensemble([35, 47, 54], 9.6, .2, attack=2.2, bright=1.5, release=3), 28.8, send=.45)
tk = 29.1
while tk < 33.3:
    k = (tk - 29.1) / 4.2; put('fx', tick(86 - int(rng.integers(0, 12)) - k * 12, .3 - k * .12), tk, pan=float(rng.uniform(-.7, .7)) * (1 - k), send=.55); tk += max(.04, .3 * (1 - k) ** 2.2)
put('piano', mx.piano(47, .26, 4), 33.45, send=.75)

# ---------------------------------------------------------------- the dark: a child far away, the umbrella wakes
for t0, m, ln in [(34.3, 72, .55), (35.0, 71, .4), (35.55, 69, .85)]:
    put('fx', lowpass(vox(m, ln, .34, shake=1.5), 1100), t0, pan=.55, send=.95)
put('fx', mx.pad([98, 105, 110], 3.2, 8, .09, attack=1.5, release=1.3), 35.1, send=.9)
for k, m in enumerate([86, 90, 93, 98, 102, 105]): put('fx', celesta(m, .13 + k * .02), 35.3 + k * .2, pan=float(np.sin(k * 2)) * .4, send=.85)
pad(16, 18, .09, attack=2.2, bright=1.4, oct=-12)

# ---------------------------------------------------------------- 轉: she walks out
t0 = 38.56; i = 0
while t0 < 42.4:
    put('fx', tok(.15 + i * .01), t0, pan=-.3 + i * .05, send=.85); t0 += .476; i += 1
put('voice', breath(1.3, .75), 42.75, send=.7); put('voice', breath(1.05, .95), 43.45, send=.6)

# ---------------------------------------------------------------- she sings
for bar, beat, ln, m in phrase(0, 2, 18, -12):
    t0 = T(bar, beat) + .1; k = (t0 - 43.2) / 4.8; put('voice', vox(m, ln * BEAT * .97, .6 + k * .32, shake=1. - k * .8), t0, send=.7)
for n, m in enumerate([86, 93, 98]): put('fx', bell(m, .17), 44.5 + n * .62, pan=(-.4, .4, 0)[n], send=.9)
put('strings', ensemble([47, 59, 66, 69, 75], 2.6, .22, attack=1.6, bright=2.6, release=.5), 45.7, send=.6)     # B7 gathers under her
put('fx', riser(1.6, .34), 46.4, send=.5); put('voice', breath(.5, 1.1), 47.46, send=.5)
J = np.array(sorted(np.random.default_rng(2612).uniform(44.6, 51.5, 34)))
SCALE = [86, 88, 90, 93, 95, 98, 100, 102, 105]
for t0 in J: put('fx', celesta(SCALE[int(rng.integers(len(SCALE)))] + (2 if t0 >= LIFT else 0), .07 + .08 * (t0 - 44.6) / 7), t0, pan=float(rng.uniform(-.8, .8)), send=.85)

# ---------------------------------------------------------------- 合: the sea answers (sounds in E)
put('drums', crash(.3), 48, send=.7); put('fx', mx.sub(33, .36, 2.4, decay=.8), 48, send=.25)
pad(20, 26, .42, attack=.24, bright=6.5); pad(20, 26, .16, attack=.5, bright=4, oct=12); bassline(20, 26, .3); pianobed(20, 26, .3)
mel(CHORUS, flute, 'flute', vel=.6, pan=.1, send=.5, delay=.14)
mel(CHORUS, lambda m, ln, v: vox(m - 12, ln * .98, v), 'voice', vel=.62, send=.55)
mel(CHORUS, lambda m, ln, v: celesta(m + 12, v * .3, 1.4), 'glock', vel=.32, pan=-.2, send=.65)
mel(COUNTER, lambda m, ln, v: ensemble([m], ln, v, attack=.3, bright=5, release=.4), 'strings', vel=.42, pan=-.35, send=.55)
for b in range(20, 26):
    root, up = voicing(T(b))
    for m, p in ((up[1] + 12, -.4), (up[2] + 12, .4), (up[0] + 24, 0)): put('choir', vox(m, BAR, .26), T(b), pan=p, send=.75)
for b in range(22, 26):
    for beat in (0, 2): put('drums', kick(.26), T(b, beat), send=.12)
    for beat in (1, 3): put('drums', snare(.12), T(b, beat), send=.4)
    for i in range(8): put('drums', shaker(.2 if i % 2 else .12), T(b) + i * BEAT * .5, pan=.3, send=.2)
for k in range(5): put('fx', bell(88 + (0, 4, 7, 12, 16)[k], .22), 53.2 + k * 1.2, pan=-.6 + k * .3, send=.85)
tl = 53.3
while tl < 58.8:
    k = (tl - 53.3) / 5.5; put('fx', mx.grain(SCALE[int(rng.integers(len(SCALE)))] + 14, .02 + k * .05, .1), tl, pan=float(rng.uniform(-.9, .9)), send=.8); tl += rng.exponential(.12 * (1.2 - k))

# ---------------------------------------------------------------- up over the city; the great chord lands on 62.4
for j, m in enumerate([76, 80, 83, 88, 92, 95, 100, 104, 107, 112]): put('harp', harp(m, .3), 60.96 + j * .13, pan=-.5 + j * .11, send=.75)
put('fx', riser(1.4, .26), 61.0, send=.55)
root = 52
for j, m in enumerate([root - 12, root, root + 7, root + 12, root + 16, root + 19, root + 24, root + 28]): put('piano', mx.piano(m, .46, 4.6), 62.4 + j * .012, pan=-.35 + .1 * j, send=.55)
put('strings', ensemble([root - 12, root, root + 12, root + 19, root + 24, root + 28, root + 31], 4.4, .55, attack=.1, bright=7, release=2.2), 62.4, send=.7)
for dv, p in ((0, -.4), (7, .4), (12, 0), (16, .2)): put('choir', vox(root + 24 + dv, 3.8, .3), 62.4, pan=p, send=.85)
put('flute', flute(88 + 12, 4.4, .36), 62.4, pan=.1, send=.6)
put('drums', crash(.36), 62.4, send=.75); put('fx', mx.sub(33, .34, 3.2, decay=1.1), 62.4, send=.3); put('fx', bell(100, .26), 62.4, send=.95); put('fx', bell(107, .17), 62.65, send=.95)
for k in range(30): put('fx', mx.grain(SCALE[int(rng.integers(len(SCALE)))] + 26 - int(k * .5), .07 * (1 - k / 30), .16), 62.45 + k * .085 + rng.uniform(0, .04), pan=float(rng.uniform(-.8, .8)), send=.9)

# ---------------------------------------------------------------- curtain call: the music box has the tune again, a tone higher than it began
pad(27, 29, .2, attack=1.2, bright=3); bassline(27, 29, .16); harpbed(27, 29, .13, every=1.)
mel(phrase(0, 2, 27), lambda m, ln, v: musicbox(m, v, 3.2), 'musicbox', vel=.46, pan=-.08, send=.6)
for j, m in enumerate([64, 68, 71, 73, 76, 80, 83, 85, 88, 92, 95, 97, 100]): put('harp', harp(m, .3), 65.0 + j * .19, pan=-.5 + j * .08, send=.7)   # the harp of S02, rising this time
t = 65.2
while t < 69.3:                                                                         # bubbles, thicker as the surface nears
    k = (t - 65.2) / 4.1; f = rng.uniform(420, 1300); ln = rng.uniform(.05, .12); q = tt(ln)
    put('fx', np.sin(2 * np.pi * (f * q + f * .9 * q * q / ln)) * np.exp(-q / (ln * .35)) * rng.uniform(.025, .08), t, pan=float(rng.uniform(-.7, .7)), send=.8); t += rng.exponential(.14) * (1.25 - k)
sl = lowpass(rng.standard_normal(int(SR * 2.4)), 1100) - lowpass(rng.standard_normal(int(SR * 2.4)), 300)      # the paper disc, drawn off the moon
gate = (np.floor(tt(2.4) * 12) % 2) * .5 + .5; put('fx', sl * gate * np.sin(np.linspace(0, np.pi, len(sl))) ** .7 * .03, 66.1, pan=-.3, send=.35)
put('fx', bell(100, .2), 68.3, send=.95); put('fx', bell(107, .13), 68.36, send=.95)                                # the moon is back
put('fx', whoosh(1.3, .46, 2600, 420), 68.9, send=.35)                                  # the paper waves wash back
put('fx', swish(1.9, .36, 1500), 69.9, send=.3)                                         # the drapes close
for m, p in ((64, -.2), (71, 0), (76, .1), (80, .2)): put('strings', ensemble([m], 2.3, .24, attack=.8, bright=2.6, release=1.2), 69.6, pan=p, send=.7)
for j, m in enumerate([88, 92, 95, 100]): put('musicbox', musicbox(m, .3, 3.2), 70.8 + j * .1, pan=-.2 + j * .13, send=.7)

# ================================================================ reverb, master
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]
def reverb(send):
    irl = int(SR * 3.6); ti = np.arange(irl) / SR; r2 = np.random.default_rng(5); pre = int(SR * .03)
    out = np.zeros_like(send)
    for c in range(2):
        ir = lowpass(r2.standard_normal(irl), 4800 - 1200 * c) * np.exp(-ti / 1.05) * np.minimum(1, ti / .02)
        ir = np.concatenate([np.zeros(pre), ir])[:irl]
        out[c] = conv(send[c], ir) * (.9 / np.sqrt(np.sum(ir ** 2)))
    return out
def pingpong(dry):
    d = int(SR * BEAT * .75); out = np.zeros_like(dry); mono = lowpass(dry.mean(0), 3600)
    for k in range(1, 5):
        g = .42 ** k; sh = np.zeros_like(mono); sh[d * k:] = mono[:-d * k]; out[k % 2] += sh * g
    return out
out = mx.dry + reverb(mx.send) * .44 + pingpong(DELAY.dry) * .8
out -= np.stack([lowpass(out[0], 34), lowpass(out[1], 34)])
out = out * .55 + np.stack([lowpass(out[0], 7000), lowpass(out[1], 7000)]) * .45              # a softer top end: everything here is under water
win = int(SR * .05); mono = np.sqrt(np.convolve(out.mean(0) ** 2, np.ones(win) / win, 'same')) + 1e-6
ref = np.percentile(mono, 92); out *= np.minimum(1, (ref / mono) ** .22)
out *= np.minimum(1, (DUR - np.arange(mx.N) / SR) / .7)
peak = np.max(np.abs(out)); out = np.tanh(out / peak * 1.15) / np.tanh(1.15) * .8

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'assets/music.mp3'
    write(out, path); print('wrote', path, 'peak', float(np.max(np.abs(out))), 'rms', float(np.sqrt(np.mean(out ** 2))))
    if '--timeline' in sys.argv:
        from PIL import Image, ImageDraw
        W, H = 1600, 300; im = Image.new('RGB', (W, H), (10, 14, 40)); d = ImageDraw.Draw(im); X = lambda t: int(40 + (W - 80) * t / DUR)
        for name, a, b, col in [('prologue', 0, 9.6, (120, 170, 240)), ('castle', 9.6, 16.8, (110, 150, 230)), ('hum', 16.8, 24, (150, 170, 230)), ('no moon', 24, 33.6, (80, 90, 140)), ('dark', 33.6, 43.2, (50, 60, 100)), ('voice', 43.2, 48, (170, 150, 230)), ('chorus (E)', 48, 62.4, (240, 140, 220)), ('moon jelly', 62.4, 64.8, (255, 190, 240)), ('curtain', 64.8, 72, (200, 190, 240))]:
            d.rectangle([X(a), 18, X(b), 54], fill=col); d.text((X(a) + 4, 26), name, fill=(10, 10, 20))
        for b in range(31): d.line([(X(b * BAR), 58), (X(b * BAR), 272)], fill=(36, 42, 80))
        m = out.mean(0); n = W - 80; seg = len(m) // n
        for i in range(n):
            v = np.abs(m[i * seg:(i + 1) * seg]).max(); d.line([(40 + i, 165 - 100 * v), (40 + i, 165 + 100 * v)], fill=(205, 215, 245))
        for t in range(0, 73, 12): d.text((X(t) - 4, 280), str(t), fill=(150, 160, 200))
        p = sys.argv[sys.argv.index('--timeline') + 1]; im.save(p); print('timeline', p)
