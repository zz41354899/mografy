# 來自月亮的偶像 — an original 60 s score for the story film (new music, nothing from the promo track).
# 120 BPM, E-flat major, bar = 2 s, offset 0: one bar per storyboard half-phrase, so every story beat lands on a bar.
#   python3 music-src/compose.py assets/music.mp3 [--timeline storyboards/music-timeline.png] [--stems music-src/stems]
# Deterministic (seeded). Uses the synth voices and reverb idea from score.py (numpy only; ffmpeg for mp3).
#
#  0– 8  序     music box theme alone over a soft pad; a wooden tok on every mallet stroke
#  8–16  起     pizzicato ostinato joins, twinkles as the town's windows light
# 16–24  承     the descent: strings swell, harp falls, a flute sings the theme slower; soft landing at 23.5
# 24–32  轉     the empty hall: one held high note, a few piano tones in C minor
# 32–40  first song: her verse on a soft synth voice; audience blips one per beat; claps, then kick; riser
# 40–54  合     the idol chorus: drums, bass, pumping chords, the hook (new melody), bells
# 54–60  謝幕   curtain swish, the music-box theme returns over the band, final chord on 58
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from score import Mix, SR, hz, lowpass, write

DUR, BPM = 60.0, 120
BEAT = 60 / BPM; BAR = BEAT * 4
T = lambda bar, beat=0.0: bar * BAR + beat * BEAT

# ---------------------------------------------------------------- harmony (one chord per bar; E-flat major)
CH = {'Eb': (51, [0, 4, 7]), 'Cm': (48, [0, 3, 7]), 'Ab': (44, [0, 4, 7]), 'Bb': (46, [0, 4, 7]), 'Gm': (43, [0, 3, 7]),
      'Fm': (41, [0, 3, 7]), 'Bbsus': (46, [0, 5, 7]), 'Eb/G': (43, [8, 12, 15]), 'Bb/D': (50, [8, 12, 15])}
#        0     1     2     3        4     5     6     7     8     9       10    11    12    13    14    15
BARS = ['Eb', 'Cm', 'Ab', 'Bbsus', 'Eb', 'Gm', 'Ab', 'Bb', 'Ab', 'Eb/G', 'Fm', 'Bb', 'Cm', 'Ab', 'Cm', 'Bb',
        'Eb', 'Bb/D', 'Cm', 'Ab', 'Ab', 'Bb', 'Eb', 'Cm', 'Ab', 'Bb', 'Eb', 'Eb', 'Ab', 'Eb']
#        16    17      18    19    20    21    22    23    24    25    26    27    28    29
HALF = {19: ('Ab', 'Bb'), 28: ('Ab', 'Bb')}   # bars that change chord on beat 3
def chord_at(t):
    b = min(len(BARS) - 1, int(t // BAR)); name = BARS[b]
    if b in HALF: name = HALF[b][0] if (t - b * BAR) < 2 * BEAT else HALF[b][1]
    return CH[name]
def tones(t, octave=0):
    bass, iv = chord_at(t)
    return [bass + 12 + i + octave for i in iv]

# ---------------------------------------------------------------- melodies: (bar, beat, beats, midi)
E5, F5, G5, Ab5, Bb5, C6, D6, Eb6, F6, G6, Ab6 = 75, 77, 79, 80, 82, 84, 86, 87, 89, 91, 92
C5, D5, Eb5 = 72, 74, 75
THEME = [  # the music box theme (bars 0–7)
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
          (1, 0, 1, C6), (1, 1, .5, Eb6), (1, 1.5, .5, D6), (1, 2, 1, C6), (1, 3, 1, G5)]
HOOK_C = [(0, 0, .5, D6), (0, .5, .5, D6), (0, 1, .5, Bb5), (0, 1.5, 1, D6), (0, 2.5, .5, F6), (0, 3, 1, Ab6),
          (1, 0, 2.5, G6), (1, 2.5, .5, F6), (1, 3, 1, Eb6)]
shift = lambda seq, b: [(bar + b, beat, ln, m) for bar, beat, ln, m in seq]
HOOK = shift(HOOK_A, 20) + shift(HOOK_B, 22) + shift(HOOK_A, 24)[:6] + shift(HOOK_C, 25)
REPRISE = [(27, 0, 1, Bb5), (27, 1, .5, G5), (27, 1.5, .5, Ab5), (27, 2, 1, Bb5), (27, 3, 1, Eb6),
           (28, 0, 1, Ab5), (28, 1, 1, C6), (28, 2, 1, D6), (28, 3, 1, F6), (29, 0, 4, Eb6)]

# ---------------------------------------------------------------- voices
mx = Mix(DUR, 4106)
STEMS = {}
def put(stem, sig, t0, gain=1.0, pan=0.0, send=.3):
    mx.put(sig, t0, gain, pan, send)
    if stem not in STEMS: STEMS[stem] = Mix(DUR, 1)
    STEMS[stem].put(sig, t0, gain, pan, send)
def tt(length): return np.arange(int(SR * length)) / SR
def env(t, a, r, length): return np.minimum(1, t / a) * np.clip((length - t) / r, 0, 1)

def musicbox(m, vel=.5, length=2.6):
    t = tt(length); f = hz(m)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 1.6), (3.0, .32, 5), (5.98, .12, 11), (9.2, .05, 16)])
    s += np.sin(2 * np.pi * f * 12.1 * t) * np.exp(-t * 60) * .08
    return s * env(t, .002, .2, length) * vel * .22
def pizz(m, vel=.5, length=.6):
    t = tt(length); f = hz(m)
    s = sum((1 / k ** 1.3) * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (8 + 6 * k)) for k in range(1, 7))
    return s * env(t, .003, .05, length) * vel * .32
def flute(m, length, vel=.5):
    t = tt(length); f = hz(m); vib = 1 + .004 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - .25) / .4, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    s = np.sin(ph) + .18 * np.sin(2 * ph) + .05 * np.sin(3 * ph)
    s += lowpass(mx.rng.standard_normal(len(t)), 2600) * .05
    return s * env(t, .09, .18, length) * vel * .2
def voice(m, length, vel=.5):
    """The idol's synth voice: a soft square-saw blend, vibrato after the attack, gentle low-pass."""
    t = tt(length + .12); f = hz(m); vib = 1 + .006 * np.sin(2 * np.pi * 5.6 * t) * np.clip((t - .18) / .25, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    s = sum((1 / k) * np.sin(k * ph) * (1.0 if k % 2 else .45) for k in range(1, 12) if f * k < 9000)
    s = lowpass(s, 2600 + 1200 * vel)
    return s * env(t, .012, .1, length + .12) * vel * .16
def strings(notes, length, vel=.5, attack=1.2, bright=4.5):
    return mx.pad(notes, length, bright, vel=vel, attack=attack, release=min(1.2, length * .4))
def harp(m, vel=.4): return mx.pluck(m, vel * .9, 1.6)
def bell(m, vel=.4): return mx.bell(m, vel, 2.4)
def tok(vel=.5):
    t = tt(.12); s = (np.sin(2 * np.pi * 820 * t) + .5 * np.sin(2 * np.pi * 1730 * t)) * np.exp(-t / .028)
    s += lowpass(mx.rng.standard_normal(len(t)), 3000) * np.exp(-t / .006) * .4
    return s * vel * .3
def kick(vel=.8):
    t = tt(.45); f = 48 + 110 * np.exp(-t / .045); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .22)
    s += lowpass(mx.rng.standard_normal(len(t)), 4000) * np.exp(-t / .004) * .3
    return s * vel * .55
def snare(vel=.6):
    t = tt(.3); n = mx.rng.standard_normal(len(t)); n = lowpass(n, 7000) - lowpass(n, 1400)
    return (n * np.exp(-t / .11) * .9 + np.sin(2 * np.pi * 195 * t) * np.exp(-t / .06) * .5) * vel * .35
def clap(vel=.6):
    t = tt(.32); n = mx.rng.standard_normal(len(t)); n = lowpass(n, 5200) - lowpass(n, 900)
    e = sum(np.exp(-np.clip(t - d, 0, None) / (.008 if d < .02 else .1)) * (t >= d) for d in (0, .011, .022))
    return n * e * vel * .3
def hat(vel=.4, length=.06):
    t = tt(length); n = mx.rng.standard_normal(len(t)); n = n - lowpass(n, 7500)
    return n * np.exp(-t / (length / 3)) * vel * .25
def crash(vel=.6):
    t = tt(2.2); n = mx.rng.standard_normal(len(t)); n = n - lowpass(n, 4500)
    return n * np.exp(-t / .8) * vel * .22
def bass(m, length, vel=.6):
    t = tt(length); f = hz(m)
    s = np.sin(2 * np.pi * f * t) + .35 * np.sin(4 * np.pi * f * t) + .12 * np.sin(6 * np.pi * f * t)
    return s * env(t, .004, .06, length) * np.exp(-t / .9) * vel * .34
def swish(length=.6, vel=.5, bright=3500):
    n = lowpass(mx.rng.standard_normal(int(SR * length)), bright) - lowpass(mx.rng.standard_normal(int(SR * length)), 400) * .3
    return n * np.sin(np.linspace(0, np.pi, len(n))) ** 2 * vel * .12
def riser(length, vel=.5):
    t = tt(length); k = t / length
    s = np.sin(2 * np.pi * np.cumsum(180 * 2 ** (k * 3)) / SR) * .25 + lowpass(mx.rng.standard_normal(len(t)), 5000) * .35
    return s * k ** 2.2 * vel * .3
def thump(vel=.6): return mx.sub(31, vel, 1.2, decay=.35)
def pump(sig, t0):
    """Side-chain feel: dip on every beat."""
    t = t0 + np.arange(len(sig)) / SR; ph = (t % BEAT)
    return sig * (1 - .55 * np.exp(-ph / .13))

def melody(seq, inst, stem, vel=.5, pan=0.0, send=.35, octave=0, gain=1.0):
    for bar, beat, ln, m in seq:
        t0 = T(bar, beat); length = ln * BEAT
        if inst is musicbox: s = musicbox(m + octave, vel)
        elif inst is flute: s = flute(m + octave, length + .15, vel)
        elif inst is voice: s = voice(m + octave, length * .92, vel)
        else: s = inst(m + octave, vel)
        put(stem, s, t0, gain, pan, send)

# ---------------------------------------------------------------- 序 0–8 / 起 8–16
melody(THEME, musicbox, 'musicbox', .55, .1, .45)
for b in range(0, 8):
    bass_, iv = chord_at(T(b))
    put('strings', strings([bass_ + 24 + i for i in iv], BAR + .8, .22 + .04 * (b >= 4), attack=1.0), T(b), send=.5)
put('fx', swish(.25, .35, 6000), .5, pan=0, send=.2)                       # footlights click on
put('fx', swish(1.6, .45, 1800), 1.0, pan=-.3, send=.35)                                   # drapes open
for i, t0 in enumerate(np.arange(T(1, 1), T(4), BEAT)):                                    # the mallet, on the beat
    put('fx', tok(.32 + .06 * (i % 2 == 0)), t0, pan=.25, send=.25)
put('fx', swish(1.0, .4, 1200), 7.6, pan=0, send=.4)                                       # the town rises
for b in range(4, 8):                                                                      # pizzicato ostinato
    for k, beat in enumerate([0, 1, 1.5, 2, 3, 3.5]):
        ch = tones(T(b, beat)); m = [ch[0], ch[2], ch[1], ch[0] + 12, ch[2], ch[1]][k] - 12
        put('pizz', pizz(m, .45 if beat % 1 == 0 else .3), T(b, beat), pan=-.25, send=.2)
    bass_, _ = chord_at(T(b)); put('bass', pizz(bass_ + 12, .5, .9), T(b), send=.15)
rng = np.random.default_rng(31)
for t0 in sorted(rng.uniform(9.0, 15.4, 16)):                                              # windows lighting
    ch = tones(t0, 24); put('fx', bell(ch[rng.integers(3)], .14), t0, pan=float(rng.uniform(-.7, .7)), send=.6)

# ---------------------------------------------------------------- 承 16–24: the descent
put('fx', swish(.5, .4, 2400), 15.65, pan=-.5, send=.3)                                    # washi screen slides in
for b in range(8, 12):
    bass_, iv = chord_at(T(b))
    put('strings', strings([bass_ + 24 + i for i in iv] + [bass_ + 12], BAR + .9, .3 + .08 * (b - 8), attack=1.4, bright=5 + b - 8), T(b), send=.55)
    put('bass', mx.sub(bass_ + 12, .35, BAR, decay=1.6), T(b), send=0)
    for j in range(8):                                                                     # harp falling through the chord
        ch = tones(T(b), 12); seq = sorted(ch + [c + 12 for c in ch], reverse=True)
        put('harp', harp(seq[j % len(seq)], .32), T(b, j * .5), pan=.35 - .1 * (j % 4), send=.5)
melody(DESCENT, flute, 'flute', .55, -.1, .5)
put('fx', thump(.5), 23.5, send=.2); put('fx', bell(Eb5, .25), 23.5, pan=0, send=.6)    # landing
put('fx', swish(.5, .4, 2200), 23.75, pan=0, send=.3)                                      # the screen rolls up

# ---------------------------------------------------------------- 轉 24–32: the empty hall
held = flute(Bb5, 15.6, .22); put('flute', held, 24.2, pan=.1, send=.6)
for b in range(12, 16):
    bass_, iv = chord_at(T(b))
    put('strings', strings([bass_ + 12 + i for i in iv], BAR + .6, .16, attack=1.6, bright=3), T(b), send=.6)
    for beat, idx in [(0, 0), (2.5, 2)]:
        put('piano', mx.piano(tones(T(b))[idx] + 12, .22, 3.0), T(b, beat), pan=-.2, send=.5)
put('fx', bell(Bb5 + 12, .08), 28.6, send=.7)  # the light flickers

# ---------------------------------------------------------------- 32–40: her first song, the audience arrives
melody(VERSE, voice, 'voice', .5, 0, .35)
for b in range(16, 20):
    for half in (0, 2):
        t0 = T(b, half); ch = tones(t0)
        put('piano', mx.piano(ch[0], .22, 2.2), t0, pan=-.3, send=.35)
        put('piano', mx.piano(ch[1], .18, 2.2), t0 + BEAT, pan=-.3, send=.35)
    bass_, _ = chord_at(T(b)); put('bass', bass(bass_ + 12, BAR * .95, .45), T(b), send=0)
    put('strings', strings([n + 12 for n in tones(T(b))], BAR + .5, .18 + .05 * (b - 16), attack=.8, bright=6), T(b), send=.45)
for i, t0 in enumerate(np.arange(33.0, 39.6, BEAT)):                                       # one blip per arriving fan
    ch = tones(t0, 12); put('fx', pizz(ch[i % 3] + 12 * (i // 6), .3, .4), t0, pan=float(np.sin(i * 1.7) * .6), send=.4)
for t0 in np.arange(T(17, 1), T(19, 3.5), BEAT * 2): put('drums', clap(.45), t0, pan=.1, send=.25)  # claps on 2 and 4
for t0 in np.arange(T(18), T(19, 3.5), BEAT): put('drums', kick(.45), t0, send=0)
put('fx', riser(2.0, .5), 38.0, send=.4)
for i, t0 in enumerate(np.arange(39.0, 39.75, BEAT / 4)): put('drums', snare(.2 + .4 * i / 6), t0, pan=.05, send=.2)

# ---------------------------------------------------------------- 合 40–54: the idol chorus
put('drums', crash(.7), 40.0, pan=-.2, send=.4); put('fx', thump(.7), 40.0, send=0)
put('fx', swish(.12, .5, 7000), 40.0, send=.1)                                             # the puppet flips (paper snap)
CHORUS = (20, 27)
for b in range(*CHORUS):
    t0 = T(b); bass_, iv = chord_at(t0)
    for k in range(4):                                                                     # drums
        put('drums', kick(.75), T(b, k), send=0)
        if k in (1, 3): put('drums', snare(.55), T(b, k), pan=.05, send=.25); put('drums', clap(.35), T(b, k), pan=-.1, send=.25)
    for k in range(8): put('drums', hat(.35 if k % 2 else .22, .05 if k % 2 else .03), T(b, k * .5 + .0), pan=.35, send=.1)
    for k in range(8):                                                                     # octave bass in eighths
        cb = chord_at(T(b, k * .5))[0]; put('bass', bass(cb + 12 + (12 if k % 2 else 0), BEAT * .45, .55), T(b, k * .5), send=0)
    for half in (0, 2):                                                                    # pumping chords
        ch = tones(T(b, half), 12); sig = mx.pad(ch, BEAT * 2 + .1, 9, vel=.55, attack=.02, release=.15)
        put('synth', pump(sig, T(b, half)), T(b, half), pan=0, send=.3)
    for k, beat in enumerate([.5, 1.5, 2.5, 3.5]):                                         # offbeat bell sparkle
        ch = tones(T(b, beat), 24); put('synth', bell(ch[(b + k) % 3], .1), T(b, beat), pan=.5 * (-1) ** k, send=.5)
melody(HOOK, voice, 'voice', .62, 0, .3)
melody(HOOK, musicbox, 'musicbox', .22, .25, .45, octave=12)                               # a music-box shadow an octave up
put('fx', swish(.6, .5, 3000), 45.7, pan=0, send=.3)                                      # the moon comes forward
for t0 in (48.67, 51.33): put('fx', swish(.45, .55, 3800), t0 - .15, pan=.6, send=.25)    # kamishibai pulls
for j in range(6): put('fx', bell(tones(49.2, 24)[j % 3] + 12 * (j // 3), .12), 49.2 + j * .07, pan=-.5 + .2 * j, send=.6)  # the fan opens

# ---------------------------------------------------------------- 謝幕 54–60
put('fx', swish(.55, .7, 2600), 53.5, pan=0, send=.3); put('fx', thump(.55), 54.0, send=0)  # drapes snap shut
put('fx', swish(.6, .45, 2200), 54.15, pan=0, send=.3)                                     # and reopen
melody(REPRISE, musicbox, 'musicbox', .5, .1, .5)
melody(REPRISE[:5], voice, 'voice', .3, -.1, .4, octave=-12)
for b in (27, 28):
    bass_, iv = chord_at(T(b))
    put('strings', strings([bass_ + 24 + i for i in iv], BAR + .4, .35, attack=.4, bright=7), T(b), send=.5)
    put('bass', bass(bass_ + 12, BAR * .9, .4), T(b), send=0)
    for k in (1, 3): put('drums', clap(.3), T(b, k), send=.3)
    for k in range(8): put('drums', hat(.2, .03), T(b, k * .5), pan=.35, send=.1)
for j, t0 in enumerate(np.arange(54.7, 56.6, .12)): put('fx', bell(tones(t0, 24)[j % 3] + 12 * ((j // 3) % 2), .07), t0, pan=float(np.sin(j)), send=.6)  # bulbs
# the final chord on 58: piano, strings, bell, crash
for j, m in enumerate([39, 51, 58, 63, 67, 70, 75]): put('piano', mx.piano(m, .45, 3.5), 58.0 + j * .012, pan=-.3 + .1 * j, send=.45)
put('strings', strings([63, 67, 70, 74, 79], 2.0, .5, attack=.2, bright=8), 58.0, send=.6)
put('drums', crash(.45), 58.0, pan=.2, send=.5); put('fx', bell(Eb6 + 12, .3), 58.0, send=.7)
put('fx', swish(.9, .4, 1800), 59.0, pan=0, send=.4)                                      # drapes close

# ---------------------------------------------------------------- reverb and master
def render(m: Mix):
    irl = int(SR * 2.6); ti = np.arange(irl) / SR; rng2 = np.random.default_rng(5)
    def conv(x, h):
        n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]
    out = np.zeros_like(m.dry)
    for c in range(2):
        ir = lowpass(rng2.standard_normal(irl), 5200) * np.exp(-ti / .7) * np.minimum(1, ti / .012)
        out[c] = m.dry[c] + conv(m.send[c], ir) * (.9 / np.sqrt(np.sum(ir ** 2))) * .38
    return out
out = render(mx)
out *= np.minimum(1, (DUR - np.arange(mx.N) / SR) / .6)
peak = np.max(np.abs(out)); out = np.tanh(out / peak * 1.15) / np.tanh(1.15) * .84   # headroom for mp3 overs

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'assets/music.mp3'
    write(out, path)
    print('wrote', path, 'peak', float(np.max(np.abs(out))), 'rms', float(np.sqrt(np.mean(out ** 2))))
    if '--stems' in sys.argv:
        d = sys.argv[sys.argv.index('--stems') + 1]; os.makedirs(d, exist_ok=True)
        for name, m in STEMS.items():
            s = render(m) / peak * .95; write(np.clip(s, -1, 1), os.path.join(d, f'{name}.wav'))
        print('stems', ', '.join(STEMS))
    if '--timeline' in sys.argv:
        from PIL import Image, ImageDraw
        W, H = 1600, 300; im = Image.new('RGB', (W, H), (18, 18, 22)); d = ImageDraw.Draw(im); X = lambda t: int(40 + (W - 80) * t / DUR)
        for name, a, b, col in [('prologue', 0, 8, (150, 110, 230)), ('town', 8, 16, (90, 140, 200)), ('descent', 16, 24, (120, 170, 230)), ('empty hall', 24, 32, (110, 90, 130)),
                                ('first song', 32, 40, (230, 150, 190)), ('idol chorus', 40, 54, (250, 120, 150)), ('curtain call', 54, 60, (240, 200, 90))]:
            d.rectangle([X(a), 20, X(b), 60], fill=col); d.text((X(a) + 4, 26), name, fill=(20, 20, 20))
        for b in range(31): d.line([(X(b * BAR), 64), (X(b * BAR), 280)], fill=(45, 45, 52))
        mono = out.mean(0); n = W - 80; seg = len(mono) // n
        for i in range(n):
            v = np.abs(mono[i * seg:(i + 1) * seg]).max(); d.line([(40 + i, 170 - 100 * v), (40 + i, 170 + 100 * v)], fill=(200, 200, 210))
        for t in range(0, 61, 4): d.text((X(t) - 4, 284), str(t), fill=(150, 150, 150))
        p = sys.argv[sys.argv.index('--timeline') + 1]; im.save(p); print('timeline', p)
