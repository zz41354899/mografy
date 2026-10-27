// Before / after: the page splits in two. The grey top half fills with a messy list of twelve manual steps, some
// struck through; then an orange line wipes down out of it into the white bottom half, uncovering the one clean,
// orange-checked line of the after, and settles as its rule.
import type { FrameContext } from '@mografy/runtime';
import { at, ease, exitOf, lerp, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { DISPLAY, MX, SANS, W, charLine, editorialParams, measure, page, paper, txt } from './editorial.js';

export const template = {
  id: 'before-after', name: 'Before and after', category: 'explain', aspect: '9:16',
  pair: 'before-after-wide',
  summary: 'A grey half with twelve messy manual steps; an orange line wipes down into the white half and its one clean, checked line.',
  agentHint: 'Contrast the old way with the product. Write each label as "KICKER: HEADLINE" (the part after the colon is the big line, 1–3 words). The twelve steps and the checked line are STEPS and RESULT in the file.',
  principles: ['staging', 'timing', 'follow-through', 'exaggeration'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 5, fps: 30, background: '#FFFFFF' };

export const params = {
  before: { name: 'Before', type: 'string' as const, default: 'BEFORE: 12 MANUAL STEPS' },
  after: { name: 'After', type: 'string' as const, default: 'AFTER: ONE CLICK' },
  ...editorialParams, ...safeParam,
};

const SPLIT = 960, WIPE = 2.15, WIPE_END = 2.95, LINE_FROM = 410, LINE_TO = 1500;
const STEPS = ['Export the CSV', 'Clean the columns', 'Copy to the sheet', 'Fix the formulas', 'Check last week', 'Build the chart',
  'Paste into slides', 'Resize the chart', 'Write the summary', 'Email the team', 'Answer questions', 'Repeat on Monday'];
const STRUCK = [1, 3, 4, 7, 9, 10], RESULT = 'Report sent to the team';

/** "KICKER: HEADLINE" → both parts (no colon: the whole label is the headline). */
function split(label: string) {
  const i = label.indexOf(':');
  return i < 0 ? { kicker: '', head: label.trim() } : { kicker: label.slice(0, i).trim(), head: label.slice(i + 1).trim() };
}
/** Largest Anton size up to `size` at which `value` fits `width`. */
const fitSize = (c: C2D, value: string, width: number, size: number) => Math.min(size, size * width / Math.max(1, measure(c, value, { size, color: '', family: DISPLAY, tracking: size * .02 })));

/** A grey stroke through a step, a little uneven, drawn left to right. */
function strike(c: C2D, x: number, y: number, w: number, p: number, color: string, seed: number) {
  if (p <= 0) return;
  c.save(); c.strokeStyle = color; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i <= 16 * p; i++) {
    const t = i / 16, yy = y + Math.sin(t * Math.PI * 1.2 + seed) * 3 - t * 4;
    if (i === 0) c.moveTo(x - 6 + t * (w + 12), yy); else c.lineTo(x - 6 + t * (w + 12), yy);
  }
  c.stroke(); c.restore();
}

function kickerLine(c: C2D, value: string, y: number, color: string, time: number, start: number, a: number) {
  const k = at(time, start, start + .6, ease.outQuint);
  c.save(); c.beginPath(); c.rect(0, y - 40, W, 54); c.clip();
  const w = txt(c, value.toUpperCase(), MX, y + (1 - k) * 50, { size: 30, color, family: SANS, weight: 800, tracking: 6, alpha: a });
  c.restore();
  c.save(); c.globalAlpha *= a; c.fillStyle = color; c.fillRect(MX + w + 24, y - 11, 60 * at(time, start + .2, start + .7, ease.inOutCubic), 3); c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .5);
  const grey = pg.dark ? '#1C1C1C' : '#F1F1F1', greyInk = pg.dark ? '#6A6A6A' : '#9A9A9A', strikeInk = pg.dark ? '#8A8A8A' : '#6E6E6E';
  const before = split(String(p.before)), after = split(String(p.after));
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    // The grey half slides down from the top edge; the rest stays white.
    const half = at(time, 0, .45, ease.outQuart) * (1 - at(time, d - .45, d, ease.inOutCubic));
    if (p.backdrop !== false && half > 0) { c.fillStyle = grey; c.fillRect(0, 0, W, SPLIT * half); }

    // BEFORE: kicker, grey headline, then twelve steps in two columns, a little crooked, several struck through.
    const a = 1 - out;
    if (before.kicker) kickerLine(c, before.kicker, 220, greyInk, time, .15, a);
    const bh = before.head.toUpperCase(), bs = fitSize(c, bh, 900, 120);
    charLine(c, bh, MX, 352, bs, time, .25, { color: greyInk, align: 'left', stagger: .025, exitAt: d - .6, fx: () => ({ alpha: a }) });
    STEPS.forEach((s, i) => {
      const col = i % 2, row = Math.floor(i / 2), t0 = .55 + i * .06;
      const k = at(time, t0, t0 + .45, ease.outQuint);
      if (k <= 0) return;
      const jx = Math.sin(i * 2.1) * 10, rot = Math.sin(i * 1.7 + .4) * .022;
      const x = MX + col * 450 + jx, y = 470 + row * 72 + Math.cos(i * 1.3) * 5;
      c.save(); c.globalAlpha *= k * a; c.translate(x, y + (1 - k) * 24); c.rotate(rot);
      const nw = txt(c, String(i + 1).padStart(2, '0'), 0, 0, { size: 24, color: greyInk, family: SANS, weight: 800 });
      const struck = STRUCK.includes(i), tw = txt(c, s, nw + 16, 0, { size: 32, color: struck ? greyInk : strikeInk, family: SANS, weight: 600 });
      if (struck) { const sp = at(time, 1.25 + STRUCK.indexOf(i) * .08, 1.55 + STRUCK.indexOf(i) * .08, ease.inOutCubic); strike(c, nw + 16, -11, tw, sp, strikeInk, i); }
      c.restore();
    });

    // The wipe: an orange line falls from the steps to the after half; the after half is uncovered above it.
    const wipe = at(time, WIPE, WIPE_END, ease.inOutCubic), lineY = lerp(LINE_FROM, LINE_TO, wipe);
    const lineIn = at(time, WIPE - .25, WIPE, ease.inOutCubic), lineW = (W - MX * 2) * lineIn * (1 - at(time, d - .5, d - .1, ease.inOutCubic));
    c.save(); c.beginPath(); c.rect(0, SPLIT, W, Math.max(0, lineY - SPLIT)); c.clip();
    // AFTER: orange kicker, the big headline opening from tight to loose, one checked line.
    if (after.kicker) kickerLine(c, after.kicker, 1080, pg.accent, time, WIPE + .25, a);
    const ah = after.head.toUpperCase(), as = fitSize(c, ah, 900, 220), op = at(time, WIPE + .3, WIPE + 1.2, ease.outQuart);
    txt(c, ah, MX, 1300 - out * 40, { size: as, color: pg.ink, family: DISPLAY, tracking: lerp(-8, as * .02, op), alpha: a });
    c.restore();
    // The checked line sits just above where the wipe line comes to rest.
    const ck = spring(time, WIPE_END - .05, .5, .25), ty = 1440;
    if (lineY > ty - 50) {
      c.save(); c.globalAlpha *= a; c.beginPath(); c.rect(0, SPLIT, W, lineY - SPLIT); c.clip();
      c.save(); c.translate(MX + 26, ty - 18); c.scale(ck, ck);
      c.fillStyle = pg.accent; c.fillRect(-26, -26, 52, 52);
      c.strokeStyle = pg.bg; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(-13, 1); c.lineTo(-4, 10); c.lineTo(14, -10); c.stroke();
      c.restore();
      txt(c, RESULT, MX + 82, ty, { size: 48, color: pg.ink, family: SANS, weight: 700 });
      c.restore();
    }
    if (lineW > 0) { c.fillStyle = pg.accent; c.fillRect(MX, lineY - 4, lineW, 8); }
    // A quiet hairline marks the split until the wipe crosses it.
    const hair = at(time, .2, .7, ease.inOutCubic) * (1 - at(time, WIPE + .2, WIPE + .4));
    if (hair > 0) { c.save(); c.globalAlpha *= hair; c.fillStyle = pg.dots; c.fillRect(MX, SPLIT - 1, W - MX * 2, 2); c.restore(); }
    safeGuide(c, '9:16', p.safeGuide);
  });
}
