# Score for the Mografy montage (60 s): a variation on the Mografy Pro Triangulum galaxy score. Same instruments, mix
# and hall as that film (its compose.py v2), so the two are clearly siblings, but a different feel: the whole piece sits a
# whole step lower (C Lydian, warmer and deeper), the choir sings a new line, two chord changes trade places (Em9 earlier,
# A6 later), and an organ halo opens with the light at 19.2. Times are re-timed onto this film through WARP (Triangulum second → montage second).
#   python3 music-src/compose.py assets/music.mp3 [--timeline storyboards/music-timeline.png]
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from score import Mix, SR, lowpass, write
import score
TRANS = -2   # a whole step lower than the Triangulum film
def hz(m): return score.hz(m + TRANS)

DUR = 42.0
SPARK, BLOOM, TRACKS, EDITOR, DISSOLVE, RESOLVE = 0.3, 2.7, 8.2, 33.0, 35.8, 37.65

# (film second, bass midi, pad tones, choir tones). Few changes, each a long breath; neighbours share tones.
CHORDS = [
    (0.0,    26, [45, 50, 52],                 [57, 62]),          # D5(sus2)       deep space, the spark
    (BLOOM,  26, [50, 57, 61, 64, 66],         [62, 66, 69]),      # Dmaj9          the galaxy blooms
    (TRACKS, 26, [50, 56, 59, 64, 68],         [64, 68, 71]),      # E/D (Lydian)   stars stream into the tracks
    (12.6,   35, [47, 54, 59, 62, 64],         [62, 66, 71]),      # Bm(add11)      close-up
    (16.2,   31, [43, 50, 54, 59, 61],         [62, 66, 71]),      # Gmaj7#11       02 design system
    (20.4,   28, [52, 55, 59, 62, 66],         [62, 66, 71]),      # Em9            (was A6)
    (24.6,   26, [50, 56, 59, 64, 68],         [64, 68, 71]),      # E/D            04 subtitles
    (28.4,   30, [45, 54, 57, 61, 64],         [61, 64, 69]),      # F#m7           05 everyday
    (31.0,   33, [45, 52, 57, 61, 66],         [64, 69, 73]),      # A6             (was Em9)
    (EDITOR, 31, [43, 55, 59, 62, 66, 69],     [66, 71, 73]),      # Gmaj9#11       the whole editor, the lift
    (DISSOLVE, 33, [45, 52, 57, 62, 64],       [69, 74, 76]),      # Asus4          dissolving into stars, held
    (RESOLVE, 26, [38, 50, 57, 61, 64, 66, 69], [66, 69, 73, 76]), # Dmaj9          light, the logo; held to the end
]

# The choir's slow line (start, midi, length): every note at least 1.8 s, joined legato, rising to F#5 on the logo.
LINE = [   # a new line over the same harmony: it starts on the fifth, falls before it climbs, and ends on the 9th
    (BLOOM + .2, 69, 2.6), (5.5, 66, 2.7), (TRACKS, 71, 2.4), (10.6, 68, 2.0), (12.6, 66, 1.8), (14.4, 71, 1.8),
    (16.2, 66, 2.2), (18.4, 73, 2.0), (20.4, 71, 2.1), (22.5, 74, 2.1), (24.6, 68, 2.0), (26.6, 71, 1.8),
    (28.4, 73, 2.6), (31.0, 69, 2.0), (EDITOR, 78, 2.8), (DISSOLVE, 76, 1.85), (RESOLVE, 76, DUR - RESOLVE),
]

# Overall level and the pad's opening (its "filter"): hushed and closed in the dark, opens on the bloom, breathes with the
# features, opens most on the editor and the logo.
LEVEL = [(0, .2), (SPARK, .32), (BLOOM - .4, .5), (BLOOM, .9), (4.5, .66), (TRACKS, .6), (12.6, .5), (16.2, .54),
         (20.4, .56), (24.6, .58), (28.4, .62), (31.0, .68), (EDITOR, .82), (DISSOLVE, .8), (37.3, .95), (RESOLVE, 1.0), (40, .9), (DUR, .75)]
OPEN = [(0, 1.6), (BLOOM - .6, 2.2), (BLOOM, 4.6), (5.0, 3.6), (TRACKS, 4.2), (12.6, 3.4), (16.2, 3.8), (20.4, 3.6),
        (24.6, 3.9), (28.4, 3.7), (31.0, 4.0), (EDITOR, 5.2), (DISSOLVE, 3.6), (37.3, 4.4), (RESOLVE, 5.4), (DUR, 4.0)]
def level(t): return float(np.interp(t, *zip(*LEVEL)))
def opening(t0, n): return np.interp(t0 + np.arange(n) / SR, *zip(*OPEN))


# ---- re-time the Triangulum score onto the montage: (Triangulum second, montage second)
WARP = [(0, 0), (.3, .3), (2.7, 2.6), (8.2, 9.6), (12.6, 16.6), (16.2, 19.2), (20.4, 26.4), (24.6, 31.2), (28.4, 36.4), (31.0, 40.8),
        (33.0, 45.2), (35.8, 49.9), (37.65, 55.2), (42.0, 60.0)]
def Wt(t): return float(np.interp(t, *zip(*WARP)))
CHORDS = [(Wt(at), b, p, v) for at, b, p, v in CHORDS]
LINE = [(Wt(a), m, Wt(a + l) - Wt(a)) for a, m, l in LINE]
LEVEL = [(Wt(t), v) for t, v in LEVEL]
OPEN = [(Wt(t), v) for t, v in OPEN]
SPARK, BLOOM, TRACKS, EDITOR, DISSOLVE, RESOLVE, DUR = (Wt(x) for x in (SPARK, BLOOM, TRACKS, EDITOR, DISSOLVE, RESOLVE, DUR))

def env(t, length, attack, release, curve=2.0):
    return np.minimum(1, t / attack) ** curve * np.clip((length - t) / release, 0, 1) ** 1.5

class Score(Mix):
    def nebula(self, notes, length, at, vel=.5, attack=2.4, release=2.6, seed=0):
        """Big soft pad: five detuned voices per note, harmonics rolled off by the film's OPEN curve (a slow filter)."""
        t = self.t(length); s = np.zeros_like(t); b = opening(at, len(t)); r = np.random.default_rng(seed)
        for m in notes:
            for det in (-.11, -.05, 0, .05, .11):
                drift = 1 + .0012 * np.sin(2 * np.pi * r.uniform(.05, .13) * t + r.uniform(0, 6))
                inst = 2 * np.pi * np.cumsum(hz(m + det) * drift) / SR + r.uniform(0, 6)
                for k in range(1, 13):
                    if hz(m) * k > 3600: break
                    s += np.exp(-k / b) / k * np.sin(k * inst)
        return s * env(t, length, attack, release) * vel * .03 / max(1, len(notes)) ** .5

    def choir(self, notes, length, vel=.5, attack=1.3, release=1.6, seed=1):
        """Distant wordless choir ("oo"–"ah"): a harmonic voice shaped by three soft formants, three singers per note."""
        t = self.t(length); s = np.zeros_like(t); r = np.random.default_rng(seed)
        F = [(520, 90, 1.0), (920, 120, .5), (2500, 200, .12)]
        for m in notes:
            for det in (-.07, 0, .07):
                vib = .003 * np.sin(2 * np.pi * r.uniform(4.6, 5.4) * t + r.uniform(0, 6)) * np.minimum(1, t / 1.6)
                inst = 2 * np.pi * np.cumsum(hz(m + det) * (1 + vib)) / SR
                for k in range(1, 20):
                    f = hz(m) * k
                    if f > 3200: break
                    g = sum(a / (1 + ((f - fc) / bw) ** 2) for fc, bw, a in F) + .04
                    s += g / k ** .9 * np.sin(k * inst + r.uniform(0, 6))
        return s * env(t, length, attack, release, 1.6) * vel * .05 / max(1, len(notes)) ** .5

    def organ(self, notes, length, vel=.5, attack=2.0, release=3.0):
        """Pipe-organ halo: 16', 8', 4' and quieter upper ranks, with a gentle tremulant."""
        t = self.t(length); s = np.zeros_like(t)
        for m in notes:
            f = hz(m)
            for ratio, a in ((.5, .55), (1, 1), (2, .45), (3, .12), (4, .1)):
                if f * ratio > 2600: continue
                s += a * np.sin(2 * np.pi * f * ratio * t + m)
        trem = 1 + .04 * np.sin(2 * np.pi * 5.6 * t)
        return s * trem * env(t, length, attack, release) * vel * .045 / max(1, len(notes)) ** .5

    def drone(self, m, length, vel=.5, attack=2.0, release=2.5):
        """Deep drone: sine plus a little octave, a very slow beat between two near unisons."""
        t = self.t(length); f = hz(m)
        s = np.sin(2 * np.pi * f * t) + np.sin(2 * np.pi * f * 1.003 * t + 1) + .35 * np.sin(4 * np.pi * f * t)
        return s * env(t, length, attack, release) * vel * .18

    def stars(self, notes, length, vel=.2, seed=3):
        """Far-off star tones: soft sines that fade in and out slowly at their own rates (a slow twinkle, no strikes)."""
        t = self.t(length); s = np.zeros_like(t); r = np.random.default_rng(seed)
        for m in notes:
            rate, ph = r.uniform(.11, .27), r.uniform(0, 6)
            s += (.5 - .5 * np.cos(2 * np.pi * rate * t + ph)) ** 2 * np.sin(2 * np.pi * hz(m) * t)
        return s * env(t, length, 4.0, 3.0) * vel * .05 / max(1, len(notes)) ** .5

mx = Score(DUR, 42)
for i, (at, bass, pad, voices) in enumerate(CHORDS):
    end = CHORDS[i + 1][0] if i + 1 < len(CHORDS) else DUR
    L = level(at); ov = 2.6; held = at >= RESOLVE
    ln = (DUR - at + .1) if held else end - at + ov
    pre = 0 if at == 0 else .9   # each chord fades in under the previous one, so changes are cross-fades
    for side, sd in ((-.55, i * 2), (.55, i * 2 + 1)):   # two decorrelated pads, wide
        mx.put(mx.nebula(pad, ln + pre, at - pre, .15 + .75 * L, attack=1.8 if at else 3.0, release=min(2.6, ln), seed=sd), at - pre, pan=side, send=.6)
    mx.put(mx.choir(voices, ln + pre, .06 + .32 * L, attack=1.8, release=min(2.2, ln), seed=10 + i), at - pre, pan=.05, send=.75)
    mx.put(mx.drone(bass + 12, ln + pre, .1 + .35 * L, attack=1.6, release=min(2.4, ln)), at - pre, pan=0, send=.3)

for j, (at, m, ln) in enumerate(LINE):   # the choir's line, a little forward of the bed
    mx.put(mx.choir([m], ln + 1.2, .14 + .42 * level(at), attack=.9, release=1.2, seed=40 + j), at - .15, pan=-.1, send=.7)

# the light opens (19.2 in this film): an organ halo under the Gmaj7#11
mx.put(mx.organ([43, 55, 59, 62, 66], 5.5, .45, attack=1.4, release=3.0), Wt(16.2) - 1.0, send=.8)
# deep space under everything: a low D drone and an open fifth that never stops
mx.put(mx.drone(26, DUR, .5, attack=3.0, release=3.0), 0, send=.25)
mx.put(mx.nebula([38, 45], DUR, 0, .35, attack=3.0, release=3.0, seed=90), 0, pan=0, send=.5)
# far-off stars: they appear with the galaxy and fill the sky again for the logo
mx.put(mx.stars([74, 78, 81], RESOLVE - BLOOM + 1.0, .5, seed=91), BLOOM, pan=-.6, send=.9)
mx.put(mx.stars([76, 81, 85], RESOLVE - BLOOM + 1.0, .4, seed=92), BLOOM + 1.3, pan=.6, send=.9)
mx.put(mx.stars([74, 78, 81, 85], DUR - DISSOLVE, .7, seed=93), DISSOLVE, pan=-.3, send=.95)
mx.put(mx.stars([76, 78, 83], DUR - DISSOLVE, .6, seed=94), DISSOLVE + .6, pan=.4, send=.95)
# the spark breathes in
mx.put(mx.choir([57, 62], 3.2, .3, attack=1.4, release=1.6, seed=95), SPARK, send=.85)
# the bloom: an organ halo opens with the galaxy and a slow low swell (no transient)
mx.put(mx.organ([38, 50, 57, 62, 66], 6.5, .7, attack=1.4, release=3.5), BLOOM - 1.0, send=.8)
mx.put(mx.drone(26, 6.0, .55, attack=1.3, release=4.0), BLOOM - .9, send=.2)
# into the tracks and onto the editor: swells that peak on the moment
mx.put(mx.nebula([57, 64, 68], 2.8, TRACKS - 1.6, .45, attack=1.6, release=1.2, seed=96), TRACKS - 1.6, send=.75)
mx.put(mx.organ([43, 55, 62, 66], 4.4, .45, attack=1.6, release=2.4), EDITOR - 1.2, send=.8)
# dissolve and collapse: everything rises together into the light, then a full organ chord holds under the logo
mx.put(mx.nebula([45, 57, 62, 64, 69], RESOLVE - DISSOLVE + 1.4, DISSOLVE, .6, attack=RESOLVE - DISSOLVE, release=1.4, seed=97), DISSOLVE, send=.8)
mx.put(mx.organ([38, 50, 57, 61, 66, 69], DUR - RESOLVE + 1.0, 1.25, attack=1.5, release=3.6), RESOLVE - .8, send=.85)
mx.put(mx.drone(26, DUR - RESOLVE + 1.0, .6, attack=1.1, release=3.6), RESOLVE - .7, send=.2)

# ---- a very large hall (long, dark, decorrelated per channel), master
irl = int(SR * 8.0); ti = np.arange(irl) / SR
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h))))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]
out = np.zeros_like(mx.dry)
for c in range(2):
    ir = lowpass(mx.rng.standard_normal(irl), 2600) * np.exp(-ti / 2.1) * np.minimum(1, ti / .09)
    out[c] = mx.dry[c] * .8 + conv(mx.send[c], ir) * (.9 / np.sqrt(np.sum(ir ** 2))) * .85
out = np.stack([lowpass(ch, 6500) for ch in out])
def tilt(x):   # ease the lowest end a little so the drone stays felt rather than boomy on small speakers
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * (.72 + .28 * f ** 2 / (f ** 2 + 90 ** 2)), len(x))
out = np.stack([tilt(ch) for ch in out])
out *= np.minimum(1, np.arange(mx.N) / SR / 1.2) * np.minimum(1, (DUR - np.arange(mx.N) / SR) / 2.6)
out /= np.max(np.abs(out)) / .9
out = np.tanh(out * 1.05) / np.tanh(1.05)

write(out, sys.argv[1])
if '--timeline' in sys.argv:
    from score import timeline
    secs = [dict(name=n, start=a, end=b, mood=m, energy=[level(a), level(b)]) for n, a, b, m in ((n, a if a in (SPARK, BLOOM, TRACKS, EDITOR, DISSOLVE, RESOLVE, DUR) else Wt(a), b if b in (SPARK, BLOOM, TRACKS, EDITOR, DISSOLVE, RESOLVE, DUR) else Wt(b), m) for n, a, b, m in
            [('deep space', 0, BLOOM, 'cosmic'), ('bloom · name', BLOOM, TRACKS, 'cosmic'), ('components', TRACKS, 16.2, 'cosmic'), ('design', 16.2, 20.4, 'cosmic'),
             ('physics', 20.4, 24.6, 'cosmic'), ('subtitles', 24.6, 28.4, 'cosmic'), ('everyday', 28.4, EDITOR, 'hopeful'), ('editor', EDITOR, DISSOLVE, 'hopeful'),
             ('stars', DISSOLVE, RESOLVE, 'cosmic'), ('logo', RESOLVE, DUR, 'calm')])]
    timeline(dict(duration=DUR, bpm=60, beatsPerBar=2, sections=secs, hits=[dict(at=SPARK, kind='spark'), dict(at=BLOOM, kind='bloom'), dict(at=TRACKS, kind='tracks'),
             dict(at=EDITOR, kind='editor'), dict(at=DISSOLVE, kind='dissolve'), dict(at=RESOLVE, kind='logo')]), out, sys.argv[sys.argv.index('--timeline') + 1])
print('peak', float(np.max(np.abs(out))), 'rms', float(np.sqrt(np.mean(out ** 2))))
