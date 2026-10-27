// Wide numbers: three figures sharpen in out of a spectrum blur and count up in a row, each digit in a fixed slot so
// nothing jitters; as each lands a short spectrum line draws under it and its label settles in.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, W, bloom, eio, eo, glow, ground, kin, look, montageParams, setFont, specLinear, textW, vignette } from './montage.js';

export const template = {
  id: 'stat-count-wide', name: 'Wide numbers', category: 'data', aspect: '16:9', pair: 'stat-count',
  summary: 'Three numbers count up in a row in kinetic type, each landing on a short spectrum line with its label.',
  agentHint: 'Traction or results in a landscape film or a talk. Figures are the `stats` param, one "value | label" per line ("4.9/5", "3 min": the text after the number is its unit): keep three, labels under ~18 characters, values up to six digits. Digits sit in fixed slots, so numbers do not jitter while they count.',
  principles: ['timing', 'staging', 'overlapping action', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 4.5, fps: 30, background: '#06080C' };

export const params = {
  title: { name: 'Headline', type: 'string' as const, default: 'The numbers so far' },
  stats: { name: 'Figures (value | label)', type: 'string' as const, default: '12,480 | teams\n4.9 | average rating\n3 min | to first film' },
  ...montageParams('night'), ...safeParam,
};

/** The figures, one "value | label" per line: the number counts, the text after it is a unit. Three at most. */
function stats(v: unknown) {
  return String(v).split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3).map(line => {
    const [head = '', ...rest] = line.split('|'), m = head.trim().match(/^([\d,]*\.?\d+)\s*(.*)$/);
    const num = m ? m[1]!.replace(/,/g, '') : '0', dot = num.indexOf('.');
    return { value: Number(num) || 0, decimals: dot < 0 ? 0 : num.length - dot - 1, unit: m ? m[2]!.trim() : head.trim(), label: rest.join('|').trim() };
  });
}
const TY = 300, NY = 560, NS = 136, US = 52, UY = 662, LY = 718, LS = 30, COL = 560, COUNT = 1.45;

const fmt = (v: number, dec: number, group: boolean) => {
  const s = v.toFixed(dec), [i, f] = s.split('.');
  return (group ? i!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : i!) + (f !== undefined ? '.' + f : '');
};

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .5);
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });
    kin(c, String(p.title), W / 2, TY, 76, lk.ink, time - .1, { w: 600, st: .028, out });
    // One slot width for every digit, so a changing value never moves its neighbours.
    setFont(c, NS, 600); let dw = 0; for (let k = 0; k < 10; k++) dw = Math.max(dw, c.measureText(String(k)).width);
    const sepW = (ch: string) => { setFont(c, NS, 600); return c.measureText(ch).width; };
    const STATS = stats(p.stats), n = STATS.length;
    STATS.forEach((st, i) => {
      const t0 = .4 + i * .22, cx = W / 2 + (i - (n - 1) / 2) * COL, group = st.value >= 1000;
      const final = [...fmt(st.value, st.decimals, group)], widths = final.map(ch => /\d/.test(ch) ? dw : sepW(ch));
      const numW = widths.reduce((a, b) => a + b, 0), unitW = st.unit ? textW(c, st.unit, US, 500) + 16 : 0, x0 = cx - (numW + unitW) / 2;
      const k = eo(P(time, t0, t0 + COUNT)), cur = [...fmt(st.value * k, st.decimals, group)], off = final.length - cur.length;
      let x = x0;
      final.forEach((_ch, j) => {
        const g = cur[j - off];
        if (g !== undefined) kin(c, g, x + widths[j]! / 2, NY, NS, lk.ink, time - t0 - (final.length - 1 - j) * .035, { w: 600, d: .6, out, hue: i * .2 + j * .04 });
        x += widths[j]!;
      });
      if (st.unit) kin(c, st.unit, x + 16, NY + (NS - US) * .3, US, lk.mut, time - t0 - .5, { al: 'left', w: 500, tint: false, out });
      // The count lands: a short spectrum line draws out from the centre with a small flash of light.
      const land = t0 + COUNT * .82, uw = 116 * eo(P(time, land, land + .45)) * (1 - eio(P(time, d - .55, d - .15)));
      if (uw > 1) {
        const cols = [[K.teal, K.sky], [K.sky, K.violet], [K.violet, K.coral]][i]!;
        const line = (x2: C2D) => { x2.fillStyle = specLinear(x2, cx - uw / 2, 0, cx + uw / 2, 0, cols); x2.beginPath(); x2.roundRect(cx - uw / 2, UY - 2, uw, 4, 2); x2.fill(); };
        line(c);
        if (lk.dark) bloom(c, line, { radius: 8, strength: .9, halo: .6, bounds: [cx - 90, UY - 20, 180, 40] });
        const fl = P(time, land, land + .12) * (1 - P(time, land + .12, land + .7));
        if (fl > 0) { c.save(); c.globalCompositeOperation = lk.dark ? 'lighter' : 'source-over'; glow(c, cx, UY, 140, cols[0]!, .3 * fl); c.restore(); }
      }
      kin(c, st.label, cx, LY, LS, lk.mut, time - t0 - .55, { w: 500, st: .015, d: .45, tint: false, out });
    });
    if (lk.dark) vignette(c, .45);
    safeGuide(c, '16:9', p.safeGuide);
  });
}
