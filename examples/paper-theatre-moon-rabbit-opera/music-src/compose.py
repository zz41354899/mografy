# 來自月亮的偶像 · 3D × 2D — original 60 s score (v2 arrangement, new for the 3D film).
# 120 BPM, bar = 2 s, offset 0; E-flat major, lifting a semitone to E major for the second chorus at 46 s.
#   python3 music-src/compose.py assets/music.mp3 [--timeline storyboards/music-timeline.png] [--stems music-src/stems]
# Deterministic (seeded). numpy only (ffmpeg for mp3). Every hit time below comes from scenes/main.ts.
#
#  0– 8  序      music box + celesta theme over a breathing string pad; footlight ticks, velvet drapes, mallet toks
#  8–16  起      pizzicato ostinato, the town rising in paper slides, celesta twinkles as windows light, glow swell
# 16–24  承      the descent: string ensemble swells, harp falls, flute sings; cloud whooshes; soft landing on 23.5
# 24–32  轉      the empty hall: stage-light clunk, one held note, sparse C-minor piano; the flicker; a breath
# 32–40  first song: her verse on a soft vocal synth; one blip per arriving fan, then a shower; claps, kick, riser
# 40–46  合      flip + crash; idol chorus I (drums, octave bass, side-chained chords, EP stabs, hook + double)
# 46–54          tom fill → key lift to E; chorus II with shakers, string counter-line, ping-pong delay; card pulls
# 54–60  謝幕    drapes snap and reopen, bulbs arpeggio, music-box reprise, the bow, final chord on 58
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from score import Mix, SR, hz, lowpass, write

DUR, BPM = 60.0, 120
BEAT = 60 / BPM; BAR = BEAT * 4
T = lambda bar, beat=0.0: bar * BAR + beat * BEAT
LIFT = 46.0
tr = lambda t: 1 if t >= LIFT - 1e-6 else 0          # semitone lift for chorus II and the curtain call

# ---------------------------------------------------------------- harmony (one chord per bar, some split on beat 3)
CH = {'Eb': (51, [0, 4, 7]), 'Cm': (48, [0, 3, 7]), 'Ab': (44, [0, 4, 7]), 'Bb': (46, [0, 4, 7]), 'Gm': (43, [0, 3, 7]),
      'Fm': (41, [0, 3, 7]), 'Bbsus': (46, [0, 5, 7]), 'Eb/G': (43, [8, 12, 15]), 'Bb/D': (50, [8, 12, 15]), 'B': (47, [0, 4, 7]),
      'Abmaj7': (44, [0, 4, 7, 11]), 'Ebadd9': (51, [0, 4, 7, 14])}
BARS = ['Ebadd9', 'Cm', 'Abmaj7', 'Bbsus', 'Eb', 'Gm', 'Ab', 'Bb',            # 0–7   (0–16)
        'Ab', 'Eb/G', 'Fm', 'Bb', 'Cm', 'Ab', 'Cm', 'Bb',                   # 8–15  (16–32)
        'Eb', 'Bb/D', 'Cm', 'Ab', 'Eb', 'Bb/D', 'Ab',                       # 16–22 (32–46)
        'Eb', 'Bb/D', 'Cm', 'Ab', 'Eb', 'Ab', 'Eb']                         # 23–29 (46–60, sounding a semitone up)
HALF = {3: ('Bbsus', 'Bb'), 19: ('Ab', 'Bb'), 22: ('Ab', 'B'), 26: ('Ab', 'Bb'), 28: ('Ab', 'Bb')}
def chord_at(t):
    b = min(len(BARS) - 1, int(t // BAR)); name = BARS[b]
    if b in HALF: name = HALF[b][0] if (t - b * BAR) < 2 * BEAT else HALF[b][1]
    root, iv = CH[name]
    return root + tr(t), iv
def tones(t, octave=0):
    root, iv = chord_at(t)
    return [root + 12 + i + octave for i in iv[:3]]

# ---------------------------------------------------------------- melodies: (bar, beat, beats, midi) in E-flat (lifted by tr)
C5, D5, Eb5, F5, G5, Ab5, Bb5, C6, D6, Eb6, F6, G6, Ab6 = 72, 74, 75, 77, 79, 80, 82, 84, 86, 87, 89, 91, 92
THEME = [
    (0, 0, 1, Bb5), (0, 1, .5, G5), (0, 1.5, .5, Ab5), (0, 2, 1, Bb5), (0, 3, 1, Eb6),
    (1, 0, 1.5, C6), (1, 1.5, .5, Bb5), (1, 2, 2, G5),
    (2, 0, 1, Ab5), (2, 1, 1, C6), (2, 2, 1, Eb6), (2, 3, .5, D6), (2, 3.5, .5, C6),
    (3, 0, 2, Bb5), (3, 2, .5, Ab5), (3, 2.5, .5, G5), (3, 3, 1, F5),
    (4, 0, 1, G5), (4, 1, 1, Bb5), (4, 2, 1.5, Eb6), (4, 3.5, .5, D6),
    (5, 0, 1, D6), (5, 1, 1, Bb5), (5, 2, 2, G5),
    (6, 0, 1, C6), (6, 1, .5, Ab5), (6, 1.5, .5, Bb5), (6, 2, 1, C6), (6, 3, 1, Eb6),
    (7, 0, 2, D6), (7, 2, 1, F6), (7, 3, 1, D6),
]
DESCENT = [(8, 0, 2, Eb6), (8, 2, 2, C6), (9, 0, 3, Bb5), (9, 3, 1, G5), (10, 0, 2, Ab5), (10, 2, 2, F5), (11, 0, 3.5, D5)]
VERSE = [
    (16, 0, .5, Eb5), (16, .5, .5, F5), (16, 1, 1, G5), (16, 2, 1.5, Bb5), (16, 3.5, .5, G5),
    (17, 0, 1, F5), (17, 1, 1, D5), (17, 2, .5, F5), (17, 2.5, .5, G5), (17, 3, 1, Ab5),
    (18, 0, 1.5, G5), (18, 1.5, .5, Eb5), (18, 2, 1, C5), (18, 3, 1, Eb5),
    (19, 0, 1, Ab5), (19, 1, 1, C6), (19, 2, 1, Bb5), (19, 3, .75, D6),
]
HOOK_A = [(0, 0, .5, Eb6), (0, .5, .5, Eb6), (0, 1, .5, C6), (0, 1.5, 1, Eb6), (0, 2.5, .5, F6), (0, 3, 1, Eb6),
          (1, 0, .5, D6), (1, .5, .5, D6), (1, 1, .5, Bb5), (1, 1.5, 1, D6), (1, 2.5, .5, Eb6), (1, 3, 1, F6)]
HOOK_B = [(0, 0, 1.5, G6), (0, 1.5, .5, F6), (0, 2, 1, Eb6), (0, 3, 1, Bb5),
          (1, 0, 1, C6), (1, 1, .5, Eb6), (1, 1.5, .5, D6), (1, 2, 1, C6), (1, 3, .5, Bb5), (1, 3.5, .5, D6)]
PRELIFT = [(0, 0, .5, C6), (0, .5, .5, C6), (0, 1, .5, Ab5), (0, 1.5, 1, C6), (0, 2, .5, Eb6), (0, 2.5, .5, F6), (0, 3, 1, Eb6)]  # over B: D#6 → E6
shift = lambda seq, b: [(bar + b, beat, ln, m) for bar, beat, ln, m in seq]
CHORUS1 = shift(HOOK_A, 20) + shift(PRELIFT, 22)
CHORUS2 = shift(HOOK_A, 23) + shift(HOOK_B, 25)
COUNTER = [(23, 0, 4, G5), (24, 0, 4, F5), (25, 0, 2, Eb5), (25, 2, 2, G5), (26, 0, 2, Ab5), (26, 2, 2, Bb5)]   # string counter-line
REPRISE = [(27, 0, 1, Bb5), (27, 1, .5, G5), (27, 1.5, .5, Ab5), (27, 2, 1, Bb5), (27, 3, 1, Eb6),
           (28, 0, 1, Ab5), (28, 1, 1, C6), (28, 2, 1, D6), (28, 3, 1, F6), (29, 0, 4, Eb6)]

# ---------------------------------------------------------------- voices
mx = Mix(DUR, 4107)
STEMS: dict = {}
DELAY = Mix(DUR, 2)                                   # ping-pong delay send (lead in the choruses)
def put(stem, sig, t0, gain=1.0, pan=0.0, send=.3, delay=0.0):
    mx.put(sig, t0, gain, pan, send)
    if delay: DELAY.put(sig, t0, gain * delay, pan, 0)
    if stem not in STEMS: STEMS[stem] = Mix(DUR, 1)
    STEMS[stem].put(sig, t0, gain, pan, send)
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
def vox(m, length, vel=.5, det=0.0):
    """Vocal synth: harmonics weighted by formant peaks, breath noise, delayed vibrato."""
    L = length + .14; t = tt(L); f = hz(m + det)
    vib = 1 + .0065 * np.sin(2 * np.pi * 5.4 * t + det * 9) * np.clip((t - .2) / .3, 0, 1)
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
def shimmer(t0, t1, vel=.12, rate=40):
    t = t0
    while t < t1:
        k = (t - t0) / (t1 - t0); ch = tones(t, 24 + 12 * (rng.random() < .3))
        put('fx', mx.grain(ch[rng.integers(3)], vel * (.3 + k), .09), t, pan=float(rng.uniform(-.8, .8)), send=.7)
        t += rng.exponential(1 / (rate * (.3 + k)))
def thump(vel=.6): return mx.sub(31, vel, 1.2, decay=.35)
def breath(length=1.0, vel=.4):
    n = lowpass(rng.standard_normal(int(SR * length)), 2600) - lowpass(rng.standard_normal(int(SR * length)), 500)
    return n * np.sin(np.linspace(0, np.pi, len(n))) ** 1.5 * vel * .12
def zap(vel=.5):
    t = tt(.18); s = np.sign(np.sin(2 * np.pi * 120 * t)) * .5 + lowpass(rng.standard_normal(len(t)), 6000)
    return lowpass(s, 3000) * np.exp(-t / .05) * vel * .12
def pump(sig, t0, depth=.55):
    t = t0 + np.arange(len(sig)) / SR; ph = (t % BEAT)
    return sig * (1 - depth * np.exp(-ph / .13))

def melody(seq, inst, stem, vel=.5, pan=0.0, send=.35, octave=0, gain=1.0, delay=0.0):
    for bar, beat, ln, m in seq:
        t0 = T(bar, beat); length = ln * BEAT; mm = m + octave + tr(t0)
        if inst is flute: s = flute(mm, length + .15, vel)
        elif inst is vox: s = vox(mm, length * .94, vel)
        elif inst is ensemble: s = ensemble([mm], length + .3, vel, attack=.35, bright=6)
        else: s = inst(mm, vel)
        put(stem, s, t0, gain, pan, send, delay)
        if inst is vox and gain > .5:   # a doubled voice a few cents apart, spread wide
            put(stem, vox(mm, length * .94, vel * .55, det=.08), t0 + .012, gain, -pan - .45, send, delay * .6)

# ================================================================ 序 0–8 : S01 seats / S02 moon
melody(THEME[:17], musicbox, 'musicbox', .55, .12, .45)
for b in range(0, 4):
    root, iv = chord_at(T(b)); put('strings', ensemble([root + 24 + i for i in iv[:3]] + [root + 12], BAR + .9, .26 + .05 * b, attack=1.2, bright=4.5), T(b), send=.55)
for k in range(13): put('fx', tick(84 + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][k], .26), .3 + k / 13, pan=-.7 + k * .11, send=.45)   # marquee bulbs, one by one
for k in range(9): put('fx', tick(72 + [0, 4, 7, 12, 16, 19, 24, 28, 31][k], .22), 1.6 + k * .8 / 9, pan=-.8 + k * .2, send=.4)    # footlights
put('fx', whoosh(1.5, .55, 200, 1600), 2.6, pan=-.2, send=.35)                       # velvet drapes open
put('fx', whoosh(1.2, .4, 150, 1200), 1.45, pan=0, send=.3)                           # the camera pulls back from the marquee
put('fx', whoosh(.7, .45, 400, 3200), 3.75, pan=0, send=.3)                           # push in to the moon
put('fx', thump(.35), 5.0, send=.2); put('fx', tok(.25), 5.08, pan=.25, send=.2)     # the moon lands on its strings
for i, t0 in enumerate(np.arange(4.5, 7.6, BEAT)): put('fx', tok(.3 + .06 * (i % 2 == 0)), t0, pan=.3, send=.25)   # mallet on the beat
put('fx', swish(.55, .45, 2600, up=True), 7.5, pan=.2, send=.35)                     # moon flown up

# ================================================================ 起 8–16 : S03 town / S04 her eyes
melody(THEME[17:], celesta, 'celesta', .5, .15, .5)
for b in range(4, 8):
    root, iv = chord_at(T(b)); put('strings', ensemble([root + 24 + i for i in iv[:3]], BAR + .8, .22, attack=1.0, bright=4), T(b), send=.55)
    for k, beat in enumerate([0, 1, 1.5, 2, 3, 3.5]):
        ch = tones(T(b, beat)); m = [ch[0], ch[2], ch[1], ch[0] + 12, ch[2], ch[1]][k] - 12
        put('pizz', pizz(m, .45 if beat % 1 == 0 else .3), T(b, beat), pan=-.3, send=.22)
    put('bass', pizz(root + 12, .5, .9), T(b), send=.15)
for i, t0 in enumerate((8.2, 8.45, 8.7)): put('fx', swish(2.1, .32, 900 + 300 * i), t0, pan=-.4 + .4 * i, send=.3)   # three layers slide up
for t0 in sorted(rng.uniform(9.0, 11.7, 18)):                                         # windows light
    ch = tones(t0, 24); put('fx', celesta(ch[rng.integers(3)] + 12 * (rng.random() < .4), .28), t0, pan=float(rng.uniform(-.7, .7)), send=.6)
# ---- the paper train: steam chuffs on the 8ths, clickety-clack on the rail joints, a two-tone whistle; it passes right → left
def chuff(vel=.3, bright=1600):
    t = tt(.2); n = lowpass(rng.standard_normal(len(t)), bright) * (np.minimum(1, t / .008) * np.exp(-t / .055))
    return n * vel * 1.4
def clack(vel=.3):
    t = tt(.09); s = (np.sin(2 * np.pi * 410 * t) + .6 * np.sin(2 * np.pi * 1130 * t)) * np.exp(-t / .018) + lowpass(rng.standard_normal(len(t)), 4000) * np.exp(-t / .004) * .5
    return s * vel * .35
def whistle(length, vel=.3):
    t = tt(length); out = np.zeros(len(t))
    for m, a in ((G5 + 12, 1.0), (Bb5 + 12, .8), (D6 + 12, .55)):
        f = hz(m) * (1 + .006 * np.sin(2 * np.pi * 6.0 * t)); ph = 2 * np.pi * np.cumsum(f) / SR; out += a * (np.sin(ph) + .25 * np.sin(2 * ph))
    out += lowpass(rng.standard_normal(len(t)), 5000) * .12
    return out * env(t, .03, .12, length) * vel * .18
T0, T1 = 9.4, 11.9
for k in range(int((T1 - T0) / .125) + 6):
    t0 = T0 - .25 + k * .125; u = (t0 - T0) / (T1 - T0); near = max(0.0, 1 - abs(u - .5) * 1.7)   # loudest as it passes the middle
    put('fx', chuff(.12 + .22 * near, 1300 + 900 * near * (k % 2 == 0)), t0, pan=.85 - 1.7 * min(1, max(0, u)), send=.25)
    if k % 4 in (0, 1): put('fx', clack(.18 + .25 * near), t0 + .03, pan=.85 - 1.7 * min(1, max(0, u)), send=.15)
put('fx', whistle(.22, .9), 9.62, pan=.7, send=.55); put('fx', whistle(.55, .9), 9.9, pan=.62, send=.6)
for k in range(24):                                                                                # far away behind her in S04, fading
    t0 = 12.1 + k * .125; put('fx', chuff(.07 * (1 - k / 24), 900), t0, pan=-.2 - .6 * k / 24, send=.4)
put('fx', whistle(.4, .35), 13.2, pan=-.4, send=.8)
shimmer(11.2, 12.1, .14, 60)                                                          # the window glow swallows the frame
put('fx', bell(Eb5 + 12, .2), 12.0, send=.7)
for t0 in (12.0, 14.0): put('piano', mx.piano(tones(t0)[2] + 12, .2, 3.0), t0 + .5, pan=-.2, send=.5)
put('fx', swish(.5, .42, 2400), 15.55, pan=-.6, send=.3)                              # washi screen slides in

# ================================================================ 承 16–24 : S05 shadow play / S06 cloud sea
for b in range(8, 12):
    root, iv = chord_at(T(b))
    put('strings', ensemble([root + 24 + i for i in iv[:3]] + [root + 12], BAR + .9, .3 + .09 * (b - 8), attack=1.3, bright=5 + b - 8), T(b), send=.55)
    put('bass', mx.sub(root + 12, .35, BAR, decay=1.6), T(b), send=0)
    for j in range(8):
        ch = tones(T(b), 12); seq = sorted(ch + [c + 12 for c in ch], reverse=True)
        put('harp', harp(seq[j % len(seq)], .32), T(b, j * .5), pan=.4 - .1 * (j % 4), send=.5)
melody(DESCENT, flute, 'flute', .55, -.1, .5)
put('fx', swish(.8, .5, 2000), 19.22, pan=-.5, send=.3); put('fx', swish(.8, .5, 2200), 19.24, pan=.5, send=.3)   # the shoji doors slide apart
for j in range(10): put('harp', harp(tones(19.3, 12)[j % 3] + 12 * (j // 3), .3), 19.3 + j * .065, pan=-.5 + j * .1, send=.6)   # into the sky
put('fx', whoosh(1.0, .6, 250, 2800), 23.5, pan=.3, send=.4)                                  # cloud wipe
put('fx', thump(.45), 23.5, send=.2); put('fx', celesta(Eb6, .3), 23.5, send=.6)             # landing

# ================================================================ 轉 24–32 : S07 empty stage / S08 deep breath
put('fx', thump(.5), 24.02, send=.15); put('fx', tok(.35), 24.0, send=.3)              # the spotlight clunks on
put('flute', flute(Bb5, 15.4, .2), 24.3, pan=.1, send=.6)
for b in range(12, 16):
    root, iv = chord_at(T(b))
    put('strings', ensemble([root + 12 + i for i in iv[:3]], BAR + .6, .16, attack=1.6, bright=3), T(b), send=.6)
    for beat, idx in [(0, 0), (2.5, 2)]: put('piano', mx.piano(tones(T(b))[idx] + 12, .22, 3.0), T(b, beat), pan=-.2, send=.5)
put('fx', zap(.6), 28.56, send=.3); put('fx', bell(Bb5 + 12, .14), 28.6, send=.7)       # flicker + flash
put('fx', breath(1.1, .55), 30.5, pan=0, send=.45)                                    # a deep breath
put('fx', riser(.5, .35), 31.55, send=.4)                                             # iris opens

# ================================================================ 32–40 : S09 her first song, fans arrive
melody(VERSE, vox, 'voice', .55, 0, .35, gain=.9)
for b in range(16, 20):
    for half in (0, 2):
        t0 = T(b, half); ch = tones(t0)
        put('ep', epiano(ch[0] + 12, .3), t0, pan=-.3, send=.35); put('ep', epiano(ch[1] + 12, .25), t0 + BEAT, pan=-.3, send=.35)
    root, _ = chord_at(T(b)); put('bass', bass(root + 12, BAR * .95, .45), T(b), send=0)
    put('strings', ensemble([n + 12 for n in tones(T(b))], BAR + .5, .2 + .05 * (b - 16), attack=.8, bright=6), T(b), send=.45)
FANS, FAN0, FAN_SPAN = 104, 32.5, 7
fan_times = [FAN0 + FAN_SPAN * (i / FANS) ** .45 for i in range(FANS)]
last = -1
for i, t0 in enumerate(fan_times):                                                   # one blip per fan, until they come too fast
    if t0 - last < .11: continue
    ch = tones(t0, 12); put('fx', pizz(ch[i % 3] + 12 * (i // 7 % 2), .3, .4), t0, pan=float(np.sin(i * 1.7) * .6), send=.4); last = t0
shimmer(37.2, 39.5, .1, 50)                                                          # the hall fills: a shower of penlights
for t0 in np.arange(T(17, 1), T(19, 3.5), BEAT * 2): put('drums', clap(.42), t0, pan=.1, send=.25)
for t0 in np.arange(T(18), T(19, 3.5), BEAT): put('drums', kick(.45), t0, send=0)
put('fx', riser(2.0, .55), 38.0, send=.4)
for i, t0 in enumerate(np.arange(39.0, 39.8, BEAT / 4)): put('drums', snare(.18 + .45 * i / 7), t0, pan=.05, send=.2)

# ================================================================ 合 40–46 : S10 flip / S11 poster
put('drums', crash(.75), 40.0, pan=-.2, send=.4); put('fx', thump(.75), 40.0, send=0)
for k in range(3): put('fx', swish(.06, .55, 8000), 40.0 + k / 12, pan=.1 * k, send=.1)   # the card flips: back → edge → face
def chorus_bar(b, shaker_on=False):
    for k in range(4):
        put('drums', kick(.75), T(b, k), send=0)
        if k in (1, 3): put('drums', snare(.5), T(b, k), pan=.05, send=.25); put('drums', clap(.32), T(b, k), pan=-.1, send=.25)
    for k in range(8): put('drums', hat(.33 if k % 2 else .2, .05 if k % 2 else .03), T(b, k * .5), pan=.35, send=.1)
    if shaker_on:
        for k in range(16): put('drums', shaker(.3 if k % 2 else .18), T(b, k * .25), pan=-.45, send=.12)
    for k in range(8):
        cb = chord_at(T(b, k * .5))[0]; put('bass', pump(bass(cb + 12 + (12 if k % 2 else 0), BEAT * .45, .55), T(b, k * .5), .35), T(b, k * .5), send=0)
    for half in (0, 2):
        ch = tones(T(b, half), 12); sig = mx.pad(ch, BEAT * 2 + .1, 9, vel=.5, attack=.02, release=.15)
        put('synth', pump(sig, T(b, half)), T(b, half), pan=0, send=.3)
    for k, beat in enumerate([.5, 1.5, 2.5, 3.5]):
        ch = tones(T(b, beat), 12); put('ep', epiano(ch[k % 3] + 12, .26, .5), T(b, beat), pan=.45 * (-1) ** k, send=.3)
for b in range(20, 23): chorus_bar(b)
melody(CHORUS1, vox, 'voice', .62, 0, .3, gain=1.0, delay=.25)
melody(CHORUS1, musicbox, 'musicbox', .2, .3, .45, octave=12)
shimmer(42.4, 43.2, .12, 45)                                                         # petals
put('fx', thump(.55), 43.3, send=.1); put('fx', swish(.12, .6, 5000), 43.3, send=.2)  # the poster stamps in
put('fx', swish(.55, .55, 3600), 45.55, pan=-.5, send=.25)                           # the poster is pulled away
for k, (t0, m) in enumerate([(45.5, 50), (45.625, 47), (45.75, 45), (45.875, 43)]): put('drums', tom(m, .5 + .08 * k), t0, pan=.4 - .25 * k, send=.25)

# ================================================================ 46–54 : S12 the kamishibai box, key lift to E
put('drums', crash(.7), LIFT, pan=.2, send=.45); put('fx', thump(.6), LIFT, send=0)
put('fx', whoosh(1.8, .4, 300, 2000), 46.1, pan=0, send=.35)                          # push into the box
for b in range(23, 27): chorus_bar(b, shaker_on=True)
melody(CHORUS2, vox, 'voice', .64, 0, .3, gain=1.0, delay=.3)
melody(CHORUS2, musicbox, 'musicbox', .2, .3, .45, octave=12)
melody(COUNTER, ensemble, 'strings', .55, -.35, .5, octave=-12)
for t0 in (48.6, 51.3): put('fx', swish(.45, .55, 3800), t0 - .05, pan=.6, send=.25)   # card pulls
for j in range(6): put('fx', celesta(tones(49.2, 24)[j % 3] + 12 * (j // 3), .22), 49.15 + j * .06, pan=-.5 + .2 * j, send=.6)

# ================================================================ 謝幕 54–60 : S13 curtain call
put('fx', swish(.5, .7, 2600), 53.4, send=.3); put('fx', thump(.55), 53.85, send=0)     # drapes snap shut
put('fx', whoosh(.75, .45, 250, 2200), 54.1, send=.3)                                     # and reopen
melody(REPRISE, musicbox, 'musicbox', .52, .1, .5)
melody(REPRISE[:5], vox, 'voice', .32, -.1, .4, octave=-12, gain=.5)
for b in (27, 28):
    root, iv = chord_at(T(b))
    put('strings', ensemble([root + 24 + i for i in iv[:3]], BAR + .4, .36, attack=.4, bright=7), T(b), send=.5)
    put('bass', bass(root + 12, BAR * .9, .4), T(b), send=0)
    for k in (1, 3): put('drums', clap(.28), T(b, k), send=.3)
    for k in range(8): put('drums', hat(.18, .03), T(b, k * .5), pan=.35, send=.1)
for j in range(26): put('fx', celesta(tones(54.6, 24)[j % 3] + 12 * ((j // 3) % 2), .14), 54.6 + j * 1.6 / 26, pan=float(np.sin(j * .7)), send=.6)   # bulbs light one by one
put('fx', tok(.25), 57.9, send=.3)                                                       # the bow
shimmer(57.9, 59.0, .1, 40)                                                               # confetti
root = 52   # E (lifted)
for j, m in enumerate([root - 12, root, root + 7, root + 12, root + 16, root + 19, root + 24]): put('piano', mx.piano(m, .45, 3.6), 58.0 + j * .014, pan=-.3 + .1 * j, send=.45)
put('strings', ensemble([root + 12, root + 16, root + 19, root + 23, root + 28], 2.0, .55, attack=.15, bright=8), 58.0, send=.6)
put('drums', crash(.45), 58.0, pan=.2, send=.5); put('fx', bell(root + 36, .28), 58.0, send=.7)
put('fx', whoosh(.9, .4, 200, 1500), 58.3, send=.4)                                      # drapes close
for j, m in enumerate([76, 80, 83, 88, 92]): put('musicbox', musicbox(m, .35), 58.8 + j * .07, pan=-.3 + .15 * j, send=.6)   # the title

# ================================================================ reverb, delay, master
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]
def reverb(send):
    irl = int(SR * 2.8); ti = np.arange(irl) / SR; r2 = np.random.default_rng(5); pre = int(SR * .022)
    out = np.zeros_like(send)
    for c in range(2):
        ir = lowpass(r2.standard_normal(irl), 5600 - 1400 * c) * np.exp(-ti / .78) * np.minimum(1, ti / .015)
        for d, g in [(.011, .5), (.019, .35), (.027, .3), (.041, .22)]: ir[int(SR * (d + .003 * c))] += g * (1 if c else -1)   # early reflections
        ir = np.concatenate([np.zeros(pre), ir])[:irl]
        out[c] = conv(send[c], ir) * (.9 / np.sqrt(np.sum(ir ** 2)))
    return out
def pingpong(dry):
    d = int(SR * BEAT * .75); out = np.zeros_like(dry); mono = lowpass(dry.mean(0), 4200)
    for k in range(1, 5):
        g = .45 ** k; sh = np.zeros_like(mono); sh[d * k:] = mono[:-d * k]; out[k % 2] += sh * g
    return out
def master(m: Mix, dly: Mix):
    out = m.dry + reverb(m.send) * .36 + pingpong(dly.dry) * .9 + reverb(pingpong(dly.dry)) * .1
    out -= np.stack([lowpass(out[0], 28), lowpass(out[1], 28)])                       # low cut
    # gentle glue compression (RMS over 50 ms windows)
    win = int(SR * .05); mono = np.sqrt(np.convolve(out.mean(0) ** 2, np.ones(win) / win, 'same')) + 1e-6
    ref = np.percentile(mono, 90); gain = np.minimum(1, (ref / mono) ** .18)
    out *= gain
    tsec = np.arange(m.N) / SR; out *= 1 + .18 * np.clip((tsec - 45.9) / .2, 0, 1) * np.clip((54.0 - tsec) / .3, 0, 1)   # chorus II sits a little higher
    out *= np.minimum(1, (DUR - np.arange(m.N) / SR) / .5)
    peak = np.max(np.abs(out)); return np.tanh(out / peak * 1.2) / np.tanh(1.2) * .86, peak
out, PEAK = master(mx, DELAY)

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'assets/music.mp3'
    write(out, path)
    print('wrote', path, 'peak', float(np.max(np.abs(out))), 'rms', float(np.sqrt(np.mean(out ** 2))))
    if '--stems' in sys.argv:
        d = sys.argv[sys.argv.index('--stems') + 1]; os.makedirs(d, exist_ok=True)
        for name, m in STEMS.items():
            s = (m.dry + reverb(m.send) * .36) / PEAK * .95; write(np.clip(s, -1, 1), os.path.join(d, f'{name}.wav'))
        print('stems', ', '.join(STEMS))
    if '--timeline' in sys.argv:
        from PIL import Image, ImageDraw
        W, H = 1600, 330; im = Image.new('RGB', (W, H), (14, 16, 30)); d = ImageDraw.Draw(im); X = lambda t: int(40 + (W - 80) * t / DUR)
        for name, a, b, col in [('prologue', 0, 8, (150, 110, 230)), ('town / eyes', 8, 16, (90, 140, 200)), ('descent', 16, 24, (120, 170, 230)), ('empty hall', 24, 32, (110, 90, 130)),
                                ('first song', 32, 40, (230, 150, 190)), ('chorus I', 40, 46, (250, 120, 150)), ('chorus II (E)', 46, 54, (255, 150, 110)), ('curtain call', 54, 60, (240, 200, 90))]:
            d.rectangle([X(a), 20, X(b), 60], fill=col); d.text((X(a) + 4, 26), name, fill=(20, 20, 20))
        for b in range(31): d.line([(X(b * BAR), 64), (X(b * BAR), 300)], fill=(40, 44, 64))
        HITS = [.3, 1.0, 1.6, 2.6, 3.75, 19.22, 4.5, 5.0, 7.5, 8.2, 12.0, 15.55, 20.0, 23.5, 24.0, 24.02, 28.6, 30.5, 32.0, 40.0, 43.3, 45.6, 46.0, 48.6, 51.3, 53.85, 54.1, 54.6, 57.9, 58.0, 58.85]
        for h in HITS: d.line([(X(h), 64), (X(h), 300)], fill=(255, 255, 255))
        mono = out.mean(0); n = W - 80; seg = len(mono) // n
        for i in range(n):
            v = np.abs(mono[i * seg:(i + 1) * seg]).max(); d.line([(40 + i, 185 - 100 * v), (40 + i, 185 + 100 * v)], fill=(200, 200, 215))
        for t in range(0, 61, 4): d.text((X(t) - 4, 310), str(t), fill=(150, 150, 170))
        p = sys.argv[sys.argv.index('--timeline') + 1]; im.save(p); print('timeline', p)
