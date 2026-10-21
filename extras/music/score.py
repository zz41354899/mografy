# Mografy contextual score (optional extra). Reads a music cue file (music.json) that describes the film's context:
# sections with a mood and an energy level, and hits at the moments that need sound. Synthesises a matching score
# with numpy only, deterministic for a given seed. Change the cues (or the film's timing) and re-run: the music follows.
#   python3 score.py music.json assets/music.mp3 [--timeline storyboards/music-timeline.png]
# A .wav output needs only numpy; .mp3 / .m4a outputs are encoded with ffmpeg. The timeline image needs Pillow.
import json, os, subprocess, sys, tempfile, wave
import numpy as np

SR = 44100

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

def lowpass(x, cutoff):
    """One-pole-like low-pass applied in the frequency domain (fast, no scipy)."""
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / cutoff) ** 2), n)

class Mix:
    def __init__(self, dur, seed):
        self.N = int(SR * dur); self.dur = dur; self.rng = np.random.default_rng(seed)
        self.dry = np.zeros((2, self.N)); self.send = np.zeros((2, self.N))

    def put(self, sig, t0, gain=1.0, pan=0.0, send=0.3):
        i = int(round(t0 * SR))
        if i >= self.N or i < 0 or len(sig) == 0: return
        sig = sig[: self.N - i] * gain
        g = np.array([np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)])[:, None]
        self.dry[:, i:i + len(sig)] += sig * g; self.send[:, i:i + len(sig)] += sig * g * send

    # ---- instruments
    def t(self, length): return np.arange(int(SR * length)) / SR

    def piano(self, m, vel=.6, length=2.5):
        t = self.t(length); f = hz(m)
        s = sum(a * np.sin(2 * np.pi * f * (k + 1) * (1 + .0004 * k * k) * t) * np.exp(-t * (1.6 + 1.3 * k) * (f / 400) ** .3)
                for k, a in enumerate([1, .42, .2, .1, .05, .025]))
        s *= np.minimum(1, t / .006) * np.minimum(1, (length - t) / .25)
        th = int(SR * .03); s[:th] += lowpass(self.rng.standard_normal(th) * np.exp(-np.arange(th) / SR / .008), 900) * .35
        return s * vel * .32

    def pluck(self, m, vel=.5, length=.9):
        t = self.t(length); f = hz(m)
        s = sum((1 / k) * np.sin(2 * np.pi * f * k * t) * np.exp(-t * (5 + 4 * k)) for k in range(1, 9))
        return s * np.minimum(1, t / .002) * np.minimum(1, (length - t) / .05) * vel * .3

    def bell(self, m, vel=.4, length=2.2):
        t = self.t(length); f = hz(m)
        s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 1.4), (2.76, .5, 3), (5.4, .25, 6), (8.9, .1, 9)])
        return s * np.minimum(1, t / .002) * np.minimum(1, (length - t) / .2) * vel * .16

    def sub(self, m, vel=.6, length=.45, decay=.16):
        t = self.t(length); ph = 2 * np.pi * np.cumsum(hz(m) * (1 + .8 * np.exp(-t / .03) * (decay < .5))) / SR
        env = np.exp(-t / decay) * np.minimum(1, t / (.004 if decay < .5 else .25)) * np.minimum(1, (length - t) / .3)
        return np.sin(ph) * env * vel * .38

    def click(self, m, vel=.5):
        t = self.t(.06); n = len(t)
        return (np.sin(2 * np.pi * hz(m) * t) * np.exp(-t / .018) + np.diff(self.rng.standard_normal(n + 1)) * np.exp(-t / .004) * .25) * vel * .3

    def pad(self, notes, length, bright=6.0, vel=.5, attack=.8, release=.9):
        t = self.t(length); s = np.zeros_like(t)
        for m in notes:
            for det in (-.07, 0, .07):
                f = hz(m + det)
                for k in range(1, 14):
                    if f * k > 7000: break
                    s += (1 / k) * np.exp(-k / bright) * np.sin(2 * np.pi * f * k * t + k * det * 9)
        env = np.minimum(1, t / attack) * np.clip((length - t) / release, 0, 1)
        return s * env * vel * .06 / max(1, len(notes)) ** .5

    def noise(self, length, cutoff): return lowpass(self.rng.standard_normal(int(SR * length)), cutoff)

    def grain(self, m, vel=.1, length=.08):
        """A tiny sine grain with a Hann envelope: thousands of them read as a cloud of particles."""
        t = self.t(length)
        env = np.sin(np.pi * t / length) ** 2 if length < .3 else np.minimum(1, t / .12) * (1 - t / length) ** 2   # long grains speak at once
        return np.sin(2 * np.pi * hz(m) * t + self.rng.uniform(0, 6.3)) * env * vel

    def cloud(self, t0, t1, rate, pitch, pan, vel, send=.6):
        """Scatter grains over [t0, t1). rate/pitch/pan/vel are functions of k in 0..1 (position in the span)."""
        # 'flowing' rhythm: a tenth as many grains, each long and soft, so the cloud becomes a smooth shimmer.
        thin, ln, gain = (10, (.7, 1.6), 1.8) if self.smooth else (1, (.04, .14), 1)
        t = t0
        while t < t1:
            k = (t - t0) / max(1e-6, t1 - t0)
            self.put(self.grain(pitch(k), vel(k) * gain, self.rng.uniform(*ln)), t, pan=float(np.clip(pan(k), -1, 1)), send=send)
            t += self.rng.exponential(thin / max(1, rate(k)))

    def sweep(self, f0, f1, length, decay):
        t = self.t(length)
        return np.sin(2 * np.pi * np.cumsum(np.geomspace(f0, f1, len(t))) / SR) * np.exp(-t / decay)

# ---- harmony: one chord per bar, from the key and mode
KEYS = {k: i for i, k in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
PROG = {  # (root offset, chord intervals) per bar, looped
    'major': [(0, [0, 4, 7, 11, 14]), (9, [0, 3, 7, 10, 14]), (5, [0, 4, 7, 11, 14]), (7, [0, 2, 7, 9, 14])],
    'minor': [(0, [0, 3, 7, 10, 14]), (8, [0, 4, 7, 11, 14]), (3, [0, 4, 7, 11, 14]), (10, [0, 4, 7, 9, 14])],
}
# Per mood: which instrument carries the pattern, register, pad brightness, reverb.
MOODS = {
    'calm':    dict(lead='piano', oct=0,  bright=4, send=.35, bells=False),
    'warm':    dict(lead='piano', oct=0,  bright=5, send=.3,  bells=False),
    'hopeful': dict(lead='piano', oct=12, bright=7, send=.35, bells=True),
    'playful': dict(lead='pluck', oct=12, bright=6, send=.2,  bells=False),
    'tech':    dict(lead='pluck', oct=12, bright=8, send=.2,  bells=False),
    'tense':   dict(lead='pluck', oct=0,  bright=3, send=.25, bells=False, minor=True),
    'cosmic':  dict(lead='bell',  oct=12, bright=5, send=.55, bells=True),
    'epic':    dict(lead='piano', oct=12, bright=10, send=.4, bells=True),
}

def energy_at(sec, t):
    e = sec.get('energy', .5)
    if isinstance(e, list):
        k = (t - sec['start']) / max(1e-6, sec['end'] - sec['start']); return e[0] + (e[1] - e[0]) * k
    return e

def score(cues):
    dur = cues['duration']; bpm = cues.get('bpm', 120); bpb = cues.get('beatsPerBar', 4); off = cues.get('offset', 0)
    beat = 60 / bpm; barlen = beat * bpb
    root = 48 + KEYS[cues.get('key', 'C')]; mode = cues.get('mode', 'major')
    mx = Mix(dur, cues.get('seed', 7))
    flowing = cues.get('rhythm', 'pulse') == 'flowing'   # fewer, longer notes: no 8ths or 16ths, no clicks
    mx.smooth = flowing
    sections = sorted(cues['sections'], key=lambda s: s['start'])
    hits = sorted(cues.get('hits', []), key=lambda h: h['at'])
    impacts = [h['at'] for h in hits if h['kind'] in ('burst', 'impact')]
    resolve = next((h['at'] for h in hits if h['kind'] == 'resolve'), None)

    def chord(t, minor=False):
        n = max(0, int((t - off) // barlen)); r, iv = PROG['minor' if minor or mode == 'minor' else 'major'][n % 4]
        return root + r, [root + r + 12 + i for i in iv]

    def ducked(t):  # silence just before an impact (tension) and once the resolve chord lands
        return any(a - .5 <= t < a for a in impacts) or (resolve is not None and t >= resolve - .02)


    inst = lambda name: {'piano': mx.piano, 'pluck': mx.pluck, 'bell': mx.bell}[name]
    for s in sections:
        mood = s.get('mood', cues.get('mood', 'calm'))
        if mood not in MOODS: raise SystemExit(f"unknown mood '{mood}' in section '{s.get('name', s['start'])}'; use one of: {', '.join(MOODS)}")
        md = MOODS[mood]; minor = md.get('minor', False)
        lead = inst(md['lead'])
        if s.get('texture', cues.get('texture')) == 'particles':
            # A shimmer of grains on the chord tones, two to three octaves up; denser and louder with energy.
            for b in np.arange(s['start'], s['end'], beat):
                if ducked(b): continue
                e = energy_at(s, b); _, ch = chord(b, minor)
                mx.cloud(b, min(b + beat, s['end']), lambda k: 8 + 70 * e, lambda k: ch[mx.rng.integers(4)] + mx.rng.choice([12, 24, 24, 36]),
                         lambda k: mx.rng.uniform(-.9, .9), lambda k: .03 + .06 * e)
        # Pad: one per bar, brighter with energy.
        b0 = off + np.ceil((s['start'] - off) / barlen - 1e-6) * barlen
        bars = [s['start']] + [b for b in np.arange(b0, s['end'], barlen) if b > s['start'] + .05]
        for i, b in enumerate(bars):
            end = bars[i + 1] if i + 1 < len(bars) else s['end']
            if resolve is not None and b >= resolve: break
            e = energy_at(s, b); _, ch = chord(b, minor)
            mx.put(mx.pad(ch[:4], end - b + .6, md['bright'] * (.6 + e), vel=.25 + .45 * e, attack=.5 if i else .9), b, send=md['send'])
        # Rhythmic layers on the beat grid.
        step = beat / 4
        g0 = off + np.ceil((s['start'] - off) / step - 1e-6) * step
        for k, t0 in enumerate(np.arange(g0, s['end'] - 1e-6, step)):
            if ducked(t0): continue
            e = energy_at(s, t0); q = int(round((t0 - off) / step)); bass, ch = chord(t0, minor)
            on_beat, on_8th = q % 4 == 0, q % 2 == 0
            if e >= .3 and on_beat and not flowing:
                mx.put(mx.sub(bass + 12, .3 + .4 * e), t0, send=0)
            elif e >= .3 and flowing and q % (4 * bpb) == 0:   # one long, soft bass note per bar
                mx.put(mx.sub(bass + 12, .3 + .35 * e, barlen, decay=1.5), t0, send=0)
            density = (8 if e < .6 else 4) if flowing else (4 if e < .5 else 2 if e < .75 else 1)  # halves/quarters, or quarters/8ths/16ths
            if e < .3:   # sparse motif: beats 1 and 3 only
                if q % (4 * max(1, bpb // 2)) == 0: mx.put(lead(ch[(q // 8) % 4] + md['oct'], .35), t0, pan=.2 * np.sin(q), send=md['send'])
            elif q % density == 0 and (density > 1 or e >= .75):
                pat = [0, 2, 1, 3, 2, 4, 1, 2]
                m = ch[pat[(q // density) % 8]] + md['oct'] + (12 if density == 1 and (q // 8) % 2 else 0)
                note = mx.piano(m, .16 + .16 * e, 3.0) if flowing and md['lead'] == 'pluck' else lead(m, (.14 + .14 * e) if flowing else (.18 + .2 * e))
                mx.put(note, t0, pan=.4 * np.sin(q * .7), send=md['send'] + (.15 if flowing else 0))
            if md['bells'] and e >= .4 and q % 16 == 6:
                mx.put(mx.bell(ch[3] + 24, .25 * e), t0, pan=.5 * np.sin(q), send=.6)

    # ---- hits
    for h in hits:
        a = h['at']; g = h.get('strength', 1.0); _, ch = chord(a)
        k = h['kind']
        if k == 'gather':
            # Scattered grains converge: denser, narrower in pitch and pan, onto one note as the particles meet.
            ln = h.get('length', 1.5); target = ch[0] + 36; a0 = a - ln
            mx.cloud(a0, a, lambda k: 10 + 150 * k ** 2, lambda k: target + round(mx.rng.uniform(-14, 14) * (1 - k)),
                     lambda k: mx.rng.uniform(-1, 1) * (1 - k), lambda k: (.03 + .1 * k) * g)
            sw = mx.noise(ln, 4000) * np.linspace(0, 1, int(SR * ln)) ** 2
            mx.put(sw, a0, .05 * g, 0, .5)
        elif k == 'swirl':
            # Particles stream round: a cloud panning in a circle, rising a little in pitch.
            ln = h.get('length', 1.2)
            mx.cloud(a, a + ln, lambda k: 60 + 60 * np.sin(np.pi * k), lambda k: ch[mx.rng.integers(4)] + 24 + round(5 * k),
                     lambda k: np.sin(2 * np.pi * 1.5 * k), lambda k: .08 * np.sin(np.pi * k) * g + .01)
        elif k == 'sweep':
            # A light sweeps across: bright grains travelling left to right.
            ln = h.get('length', .7)
            mx.cloud(a, a + ln, lambda k: 140, lambda k: ch[mx.rng.integers(4)] + 36, lambda k: -1 + 2 * k + mx.rng.uniform(-.1, .1),
                     lambda k: .07 * np.sin(np.pi * k) * g)
        elif k == 'pop':
            mx.put(mx.sweep(900, 320, .09, .03), a, .35 * g, 0, .2)
        elif k in ('burst', 'impact'):
            lead_in = h.get('build', 1.5 if k == 'burst' else 0)
            if lead_in:  # riser into the impact
                rl = int(SR * lead_in); tt = np.arange(rl) / SR
                r = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (tt / lead_in * 3)) / SR) * .3 + mx.noise(lead_in, 2500)[:rl] * .25
                mx.put(r * (tt / lead_in) ** 2.2, a - lead_in, .22 * g, 0, .5)
            mx.put(mx.sweep(110, 40, 1.6, .45), a, .6 * g, 0, .15)
            nb = mx.noise(.4, 1800); mx.put(nb * np.exp(-np.arange(len(nb)) / SR / .08), a, .15 * g, 0, .6)
            for j, m in enumerate(ch[:3]): mx.put(mx.piano(m, .4 * g, 2.5), a + j * .015, pan=-.2 + .2 * j)
        elif k == 'whoosh':
            ln = h.get('length', .6); w = mx.noise(ln, 2500) * np.sin(np.linspace(0, np.pi, int(SR * ln))) ** 2
            mx.put(w, a - ln / 2, .08 * g, .5, .4)
        elif k == 'fall':
            mx.put(mx.sweep(700, 180, .5, .15), a, .12 * g, 0, .4)
        elif k == 'sparkle':
            for j in range(h.get('count', 3)): mx.put(mx.bell(ch[j % 4] + 24 + 12 * (j // 4), .35 * g), a + j * h.get('every', .08), pan=.3 * (j % 3 - 1), send=.6)
        elif k == 'ticks':
            scale = [0, 2, 4, 7, 9, 12, 14, 16]
            for j in range(h.get('count', 4)):
                m = 72 + KEYS[cues.get('key', 'C')] + scale[j % 8]; at = a + j * h.get('every', .125); pan = -.25 + .5 * j / max(1, h.get('count', 4) - 1)
                if flowing: mx.put(mx.bell(m + 12, .22 * g, 1.5), at, pan=pan, send=.55)
                else: mx.put(mx.click(m + 12, .45 * g), at, pan=pan, send=.3)
        elif k == 'resolve':
            bass, _ = chord(0)
            for j, m in enumerate([bass, bass + 7, bass + 16, bass + 19, bass + 23, bass + 26]):
                mx.put(mx.piano(m, .5 * g, 2.5), a + j * .012, pan=-.3 + .12 * j)
            mx.put(mx.sub(bass, .7 * g, .9), a, send=0)
            mx.put(mx.pad([bass + 12, bass + 16, bass + 19, bass + 23, bass + 26], dur - a, 7, vel=.6, attack=.15, release=min(1.6, dur - a)), a)
        else:
            raise SystemExit(f'unknown hit kind: {k}')

    # ---- reverb, master
    irl = int(SR * 2.4); ti = np.arange(irl) / SR
    def conv(x, h):
        n = 1 << int(np.ceil(np.log2(len(x) + len(h))))
        return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]
    out = np.zeros_like(mx.dry)
    for c in range(2):
        ir = lowpass(mx.rng.standard_normal(irl), 5000) * np.exp(-ti / .55) * np.minimum(1, ti / .01)
        out[c] = mx.dry[c] + conv(mx.send[c], ir) * (.9 / np.sqrt(np.sum(ir ** 2))) * .35
    out *= np.minimum(1, (dur - np.arange(mx.N) / SR) / .5)
    out /= np.max(np.abs(out)) / .89
    return np.tanh(out * 1.1) / np.tanh(1.1)

def timeline(cues, audio, path):
    """A review image: sections (colour = mood, height = energy), hits, bar lines and the waveform."""
    from PIL import Image, ImageDraw
    W, H = 1600, 360; dur = cues['duration']; X = lambda t: int(40 + (W - 80) * t / dur)
    im = Image.new('RGB', (W, H), (18, 18, 22)); d = ImageDraw.Draw(im)
    col = {'calm': (90, 140, 200), 'warm': (220, 150, 80), 'hopeful': (240, 200, 90), 'playful': (230, 110, 170),
           'tech': (80, 210, 200), 'tense': (200, 70, 70), 'cosmic': (150, 110, 230), 'epic': (250, 120, 60)}
    for s in cues['sections']:
        c = col[s.get('mood', cues.get('mood', 'calm'))]
        e0, e1 = (s['energy'] if isinstance(s.get('energy'), list) else [s.get('energy', .5)] * 2)
        d.polygon([(X(s['start']), 150), (X(s['start']), 150 - 110 * e0), (X(s['end']), 150 - 110 * e1), (X(s['end']), 150)], fill=c)
        d.text((X(s['start']) + 4, 154), f"{s.get('name', '')} · {s.get('mood', '')}", fill=(220, 220, 220))
    barlen = 60 / cues.get('bpm', 120) * cues.get('beatsPerBar', 4)
    for b in np.arange(cues.get('offset', 0), dur, barlen): d.line([(X(b), 30), (X(b), 330)], fill=(45, 45, 52))
    for i, h in enumerate(cues.get('hits', [])):
        d.line([(X(h['at']), 20), (X(h['at']), 340)], fill=(255, 255, 255)); d.text((X(h['at']) + 3, 6 + 12 * (i % 2)), h['kind'], fill=(255, 255, 255))
    mono = audio.mean(0); n = W - 80; seg = len(mono) // n
    for i in range(n):
        v = np.abs(mono[i * seg:(i + 1) * seg]).max() if seg else 0
        d.line([(40 + i, 260 - 70 * v), (40 + i, 260 + 70 * v)], fill=(200, 200, 210))
    for t in range(0, int(dur) + 1, 2): d.text((X(t) - 4, 340), str(t), fill=(150, 150, 150))
    im.save(path)

def write(out, path):
    encode = not path.lower().endswith('.wav')
    wav = tempfile.mkstemp(suffix='.wav')[1] if encode else path
    with wave.open(wav, 'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((out.T * 32767 * .95).astype('<i2').tobytes())
    if encode:
        try: subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-b:a', '192k', path], check=True)
        finally: os.remove(wav)

if __name__ == '__main__':
    if len(sys.argv) < 3: raise SystemExit('usage: python3 score.py music.json out.(wav|mp3|m4a) [--timeline out.png]')
    cues = json.load(open(sys.argv[1])); out = score(cues)
    write(out, sys.argv[2])
    if '--timeline' in sys.argv: timeline(cues, out, sys.argv[sys.argv.index('--timeline') + 1])
    print('peak', float(np.max(np.abs(out))), 'rms', float(np.sqrt(np.mean(out ** 2))))
