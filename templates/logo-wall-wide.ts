// Wide logo wall, after the prompt chips drifting across the montage's galaxy: partner names as dark glass chips
// with a coloured dot float out of a soft light at the centre and settle into a loose grid under the headline.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, stage, type TemplateInfo } from './kit.js';
import { K, P, SPEC, W, dot, eo, glow, ground, kin, layer, lerp, look, montageParams, rnd, rr, setFont, specLinear, textW, vignette } from './montage.js';

export const template = {
  id: 'logo-wall-wide', name: 'Logo wall', category: 'proof', aspect: '16:9',
  summary: 'Partner names as glass chips with coloured dots float out of a soft light and settle into a loose grid under the headline.',
  agentHint: 'Social proof in a landscape film or a talk. The twelve names are fictional stand-ins in `NAMES`: replace them with real customers you may name (or draw their logos inside the chips, keeping the chip and dot). The first number in the headline takes the spectrum.',
  principles: ['staging', 'overlapping action', 'slow in and slow out', 'appeal'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 4, fps: 30, background: '#06080C' };

export const params = {
  title: { name: 'Headline', type: 'string' as const, default: 'Trusted by 1,200 teams' },
  ...montageParams('night'), ...safeParam,
};

/** Fictional partner names (stand-ins), four per row. */
const NAMES = ['Quillstone', 'Harbor & Pine', 'Tidewell', 'Brightmoor', 'Kestrel & Co', 'Ferngrove', 'Lumacraft', 'Orchard Nine', 'Saltmarsh Studio', 'Copperleaf', 'Wrenfield', 'Juniper Row'];
const TY = 250, OX = W / 2, OY = 620, ROWS = [486, 620, 754], ROW_SHIFT = [-52, 44, -20], CH = 80, FS = 30, GAP = 30;

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .5);
  stage(ctx, '16:9', c => {
    ground(c, p, time, { orbA: K.teal, orbB: K.violet });
    // The headline, its first number in the spectrum.
    const title = String(p.title), m = title.match(/[\d][\d,.]*\+?/), n0 = m ? m.index! : -1, n1 = m ? n0 + m[0].length : -1;
    kin(c, title, W / 2, TY, 88, lk.ink, time - .1, { w: 600, st: .026, out,
      colAt: i => i >= n0 && i < n1 ? 'fill' : lk.ink, fill: (x, x0) => specLinear(x, x0 + textW(x, title.slice(0, n0), 88, 600), 0, x0 + textW(x, title.slice(0, n1), 88, 600), 0, [K.teal, K.sky, K.violet]) });

    // A soft light at the centre that the chips float out of.
    const la = eo(P(time, .05, .5)) * lerp(1, .35, eo(P(time, .7, 1.8))) * (1 - out);
    if (la > 0) { c.save(); c.globalCompositeOperation = lk.dark ? 'lighter' : 'source-over'; glow(c, OX, OY, 460, K.teal, .26 * la); glow(c, OX, OY, 220, lk.dark ? '#CFF1EC' : K.sky, .3 * la); c.restore(); }

    // Lay out the chips in rows, centred with a small per-row shift so the grid stays loose.
    const chips: { name: string; x: number; y: number; w: number; i: number }[] = [];
    for (let r = 0; r < 3; r++) {
      const names = NAMES.slice(r * 4, r * 4 + 4), ws = names.map(s => textW(c, s, FS, 500) + 100), tot = ws.reduce((a, b) => a + b, 0) + GAP * (ws.length - 1);
      let x = W / 2 - tot / 2 + ROW_SHIFT[r]!;
      names.forEach((name, j) => { const i = r * 4 + j; chips.push({ name, x: x + ws[j]! / 2, y: ROWS[r]! + (rnd(i * 3.7) - .5) * 30, w: ws[j]!, i }); x += ws[j]! + GAP + (rnd(i * 9.1) - .5) * 24; });
    }
    // The wall fades out as one group, so chip, dot and name never show through each other.
    layer(c, 'logo-wall', 1 - out, x => {
      for (const ch of chips) {
        const dist = Math.hypot(ch.x - OX, ch.y - OY), t0 = .3 + dist / 900 * .75 + rnd(ch.i * 5.3) * .1, k = eo(P(time, t0, t0 + 1.0));
        if (k <= 0) continue;
        const push = 1 + .04 * out, f = lerp(.55, 1, k) * push, cx = OX + (ch.x - OX) * f, cy = OY + (ch.y - OY) * f, s = lerp(.6, 1, k);
        x.save(); x.globalAlpha *= P(k, 0, .3); x.translate(cx, cy); x.rotate(.035 * Math.sin(ch.i * 2.1) * k); x.scale(s, s);
        const w = ch.w, h = CH;
        // On the light ground a soft drop shadow from two offset fills (shadowBlur on twelve chips is slow on CPU canvases).
        if (!lk.dark) [[12, .035], [5, .06]].forEach(([g, al]) => { rr(x, -w / 2 - g!, -h / 2 - g! + 8, w + g! * 2, h + g! * 2, h / 2 + g!); x.fillStyle = `rgba(28,46,64,${al})`; x.fill(); });
        rr(x, -w / 2, -h / 2, w, h, h / 2); x.fillStyle = lk.dark ? 'rgba(16,20,28,.92)' : 'rgba(255,255,255,.96)'; x.fill();
        x.strokeStyle = lk.dark ? 'rgba(255,255,255,.13)' : 'rgba(20,24,32,.08)'; x.lineWidth = 1.4; x.stroke();
        dot(x, -w / 2 + 38, 0, 7, SPEC[ch.i % 5]!);
        setFont(x, FS, 500); x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = lk.dark ? '#D6DDE6' : K.ink; x.fillText(ch.name, -w / 2 + 62, 1);
        x.restore();
      }
    }, { bounds: [100, 360, W - 200, 520] });
    if (lk.dark) vignette(c, .45);
    safeGuide(c, '16:9', p.safeGuide);
  });
}
