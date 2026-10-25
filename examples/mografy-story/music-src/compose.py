# A composed score for "為什麼我開發 Mografy": chords and a slow singing melody placed on the film's own moments,
# instead of a looped four-chord bar grid. Only long notes: warm strings, a soft felt piano (melody + one chord per
# change), a held cello-like bass. No drums, no arpeggios, no noise, no bells.
#   python3 music-src/compose.py assets/music.mp3 [--timeline storyboards/music-timeline.png]
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from score import Mix, SR, hz, lowpass, write

DUR = 70.75
OPEN, RESOLVE = 27.5, 67.6     # the black box opens into light; the logo locks up

# (film second, bass midi, chord tones midi). B minor in the dark half, D major once the box opens.
CHORDS = [
    (0.0,   35, [59, 62, 66, 73]),        # Bm(add9)        the question
    (4.5,   31, [59, 62, 66, 69]),        # Gmaj7           one prompt makes a video
    (9.0,   28, [59, 62, 66, 67]),        # Em9             can we still control it?
    (13.0,  31, [59, 62, 66, 71]),        # Gmaj7           every edit regenerates
    (18.5,  28, [55, 59, 62, 66]),        # Em9             versions pile up
    (22.5,  31, [55, 59, 62, 66]),        # Gmaj7           into the black box
    (25.0,  33, [57, 62, 64, 69]),        # Asus4
    (26.4,  33, [57, 61, 64, 69]),        # A               ... about to open
    (OPEN,  38, [62, 66, 69, 76]),        # D(add9)         light
    (30.5,  37, [61, 64, 69, 73]),        # A/C#            the system
    (33.5,  35, [59, 62, 66, 69]),        # Bm7
    (37.0,  31, [59, 62, 66, 71]),        # Gmaj7           the precise edit
    (40.0,  33, [57, 62, 64, 69]),        # Asus4
    (41.0,  33, [57, 61, 64, 69]),        # A
    (42.0,  31, [59, 62, 66, 71]),        # Gmaj7           four people
    (45.0,  33, [61, 64, 66, 69]),        # A6
    (48.0,  30, [57, 61, 64, 69]),        # F#m7
    (51.0,  35, [59, 62, 66, 69]),        # Bm7
    (54.0,  31, [59, 62, 66, 69, 76]),    # Gmaj9           describe it to AI
    (56.5,  33, [57, 61, 66, 69]),        # A6
    (59.0,  28, [59, 62, 66, 67]),        # Em9             the statement
    (61.5,  33, [57, 62, 64, 67]),        # A7sus4
    (63.95, 31, [59, 62, 66, 71]),        # Gmaj7           the logo draws
    (66.0,  33, [57, 62, 64, 69]),        # Asus4
    (RESOLVE, 38, [62, 66, 69, 73, 76]),  # Dmaj9           lock-up, hold
]

# (start, midi, length). Every note is at least a second long and they join legato.
MELODY = [
    (1.2, 66, 2.3), (3.5, 64, 1.0), (4.5, 62, 4.3),
    (9.0, 66, 2.0), (11.0, 67, 2.0),
    (13.0, 71, 3.0), (16.0, 69, 2.5),
    (18.5, 67, 2.0), (20.5, 66, 2.0),
    (22.5, 71, 2.5), (25.0, 69, 2.5),
    (OPEN, 74, 2.0), (29.5, 76, 1.0), (30.5, 73, 2.0), (32.5, 71, 1.0),
    (33.5, 74, 1.5), (35.0, 71, 2.0),
    (37.0, 78, 2.0), (39.0, 76, 1.0), (40.0, 74, 1.0), (41.0, 73, 1.0),
    (42.0, 71, 2.0), (44.0, 74, 1.0), (45.0, 76, 2.0), (47.0, 73, 1.0),
    (48.0, 69, 2.0), (50.0, 73, 1.0), (51.0, 74, 2.0), (53.0, 76, 1.0),
    (54.0, 78, 2.5), (56.5, 76, 2.5),
    (59.0, 74, 1.5), (60.5, 71, 1.0), (61.5, 76, 2.45),
    (63.95, 74, 2.05), (66.0, 69, 1.6), (RESOLVE, 74, DUR - RESOLVE),
]

# Overall level over the film: hushed question, a breath before the box opens, warm and full in the middle, settle, resolve.
LEVEL = [(0, .2), (12, .27), (22, .33), (26.8, .4), (OPEN, .78), (33, .7), (42, .78), (54, .9), (59, .8), (64, .62), (RESOLVE, .85), (DUR, .7)]
def level(t): return float(np.interp(t, *zip(*LEVEL)))
def bright(t): return 2.6 if t < OPEN else 4.5 + 1.5 * level(t)   # darker timbre inside the box

class Score(Mix):
    def strings(self, notes, length, b=4.0, vel=.5, attack=1.4, release=1.6):
        """Bowed-string ensemble: detuned saws with slow vibrato, harmonics rolled off by `b`."""
        t = self.t(length); s = np.zeros_like(t)
        for m in notes:
            for det, ph in ((-.06, 0), (0, 1.7), (.06, 3.1)):
                vib = .0025 * np.sin(2 * np.pi * (5.1 + det * 6) * t + ph) * np.minimum(1, t / 1.2)
                inst = 2 * np.pi * np.cumsum(hz(m + det) * (1 + vib)) / SR
                for k in range(1, 16):
                    if hz(m) * k > 6000: break
                    s += np.exp(-k / b) / k * np.sin(k * inst + ph * k)
        env = np.minimum(1, t / attack) ** 1.5 * np.clip((length - t) / release, 0, 1)
        return s * env * vel * .05 / max(1, len(notes)) ** .5

    def cello(self, m, length, vel=.5):
        t = self.t(length); inst = 2 * np.pi * np.cumsum(hz(m) * (1 + .002 * np.sin(2 * np.pi * 4.6 * t))) / SR
        s = sum(a * np.sin(k * inst) for k, a in enumerate([1, .5, .28, .12, .06], 1))
        return s * np.minimum(1, t / .7) * np.clip((length - t) / 1.2, 0, 1) * vel * .22

    def felt(self, m, vel, length):
        """Soft felt piano: rounder than the base piano, slow attack, long ring."""
        t = self.t(length); f = hz(m)
        s = sum(a * np.sin(2 * np.pi * f * k * (1 + .0003 * k * k) * t) * np.exp(-t * (.55 + .9 * k) * (f / 300) ** .35)
                for k, a in enumerate([1, .35, .12, .05], 1))
        return s * np.minimum(1, t / .035) * np.clip((length - t) / .6, 0, 1) * vel * .34

mx = Score(DUR, 21)
STEM = os.environ.get('STEM')
for i, (at, bass, tones) in enumerate(CHORDS if STEM != 'melody' else []):
    end = CHORDS[i + 1][0] if i + 1 < len(CHORDS) else DUR
    L, b = level(at), bright(at); ln = end - at
    ov = 1.4   # chords overlap so strings cross-fade, never gap
    mx.put(mx.strings(tones, ln + ov + (DUR - at if at >= RESOLVE else 0), b, .4 + .4 * L, attack=1.6 if at else 3.0, release=min(2.2, DUR - at)), at - (0 if at == 0 else .5), pan=0, send=.55)
    mx.put(mx.strings([tones[0] - 12, tones[2] - 12], ln + ov, b * .8, .16 + .2 * L, attack=1.8), at - (0 if at == 0 else .5), pan=-.35, send=.5)
    mx.put(mx.cello(bass + 12, ln + 1.2, .3 + .4 * L), at, pan=.1, send=.25)
    if at >= OPEN or at in (4.5, 13.0, 22.5):   # one soft piano chord on each change (fewer in the dark half)
        for j, m in enumerate(tones[:4]):
            mx.put(mx.felt(m - 12 if m > 66 else m, .1 + .14 * L, ln + 2.5), at + .02 * j, pan=-.25 + .15 * j, send=.5)

for at, m, ln in (MELODY if STEM != 'bed' else []):
    L = level(at)
    mx.put(mx.felt(m, .45 + .45 * L, ln + 2.2), at, pan=.12, send=.5)
    if at >= OPEN:   # strings double the melody an octave down once the light comes in
        mx.put(mx.strings([m - 12], ln + .8, 3.5, .35 * L, attack=.5, release=.8), at, pan=.25, send=.5)

# The box opening: the D chord blooms in over the last seconds of the dark half.
mx.put(mx.strings([50, 57, 62, 66, 69], 5.0, 5, .9, attack=2.6, release=2.0), OPEN - 2.6, send=.65)
# The lock-up: a high soft string halo over the final chord.
mx.put(mx.strings([81, 85, 88], DUR - RESOLVE + .5, 3, .25, attack=1.5, release=2.5), RESOLVE - .3, send=.8)

# ---- hall reverb (long, decorrelated per channel), master
irl = int(SR * 3.6); ti = np.arange(irl) / SR
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h))))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]
out = np.zeros_like(mx.dry)
for c in range(2):
    ir = lowpass(mx.rng.standard_normal(irl), 3800) * np.exp(-ti / .95) * np.minimum(1, ti / .03)
    out[c] = mx.dry[c] + conv(mx.send[c], ir) * (.9 / np.sqrt(np.sum(ir ** 2))) * .5
out = np.stack([lowpass(ch, 9000) for ch in out])
out *= np.minimum(1, np.arange(mx.N) / SR / .8) * np.minimum(1, (DUR - np.arange(mx.N) / SR) / 2.4)
if not STEM: out /= np.max(np.abs(out)) / .9
out = np.tanh(out * 1.05) / np.tanh(1.05)

write(out, sys.argv[1])
if '--timeline' in sys.argv:
    from score import timeline
    secs = [dict(name=n, start=a, end=b, mood=m, energy=[level(a), level(b)]) for n, a, b, m in
            [('question', 0, 13, 'pensive'), ('regenerate', 13, 22.5, 'pensive'), ('box', 22.5, OPEN, 'calm'), ('light', OPEN, 42, 'warm'),
             ('people', 42, 54, 'warm'), ('statement', 54, 63.95, 'hopeful'), ('logo', 63.95, DUR, 'calm')]]
    timeline(dict(duration=DUR, bpm=72, sections=secs, hits=[dict(at=OPEN, kind='open'), dict(at=RESOLVE, kind='resolve')]), out,
             sys.argv[sys.argv.index('--timeline') + 1])
print('peak', float(np.max(np.abs(out))), 'rms', float(np.sqrt(np.mean(out ** 2))))
