// End card: a paper sheet rises over the last picture behind an orange rule; the call to action rises letter by
// letter, a soft ring spreads from it and its marked word is underlined; below, a search field draws itself, the
// name types in and the orange button is tapped.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { alpha, at, clamp, ease, lerp, press, ring, safeGuide, safeParam, spring, springs, stage, type C2D, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, SANS, W, H, charLine, cover, editorialParams, editorialScreen, loadPhoto, marked, measure, page, paper, txt, underline, type Page } from './editorial.js';

export const template = {
  id: 'cta-endcard', name: 'Call to action', category: 'end', aspect: '9:16', pair: 'cta-endcard-wide',
  summary: 'A paper sheet rises over the last picture; the call to action rises with a soft ring, and a search field types the name and is tapped.',
  agentHint: 'Last 3–4 s of a post: a call to action of 1–3 short words (mark one with [brackets]) and a name to search for, under ~16 characters. The picture above the sheet is a stand-in: put assets/endcard.jpg in the project, or play the template with backdrop: false over your own last shot.',
  principles: ['staging', 'anticipation', 'follow-through', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 5, fps: 30, background: '#FFFFFF' };

export const params = {
  cta: { name: 'Call to action', type: 'string' as const, default: 'Link in [bio]' },
  kicker: { name: 'Label', type: 'string' as const, default: 'Try Northwind free' },
  or: { name: 'Search label', type: 'string' as const, default: 'Or search' },
  search: { name: 'Search for', type: 'string' as const, default: 'Northwind' },
  ...editorialParams, ...safeParam,
};

export async function setup(ctx: SetupContext) { await loadPhoto(ctx, 'endcard.jpg'); }

/** Sheet top, label, headline, ring centre, search label and field. */
const SHEET = 560, KICK_Y = 748, HEAD_Y = 1000, SIZE = 200, RING_Y = 930, OR_Y = 1170, FX = 150, FY = 1220, FW = 780, FH = 124, TYPE = 2.15, TAP = 3.1;

/** The last picture of the film: assets/endcard.jpg, or the stand-in product screen. */
function picture(c: C2D, ctx: FrameContext, pg: Page, time: number, lift: number) {
  const img = ctx.assets.photo as (CanvasImageSource & { width: number; height: number }) | undefined;
  c.save(); c.translate(0, -lift);
  if (img) cover(c, img, 0, 0, W, H, .5, .3);
  else editorialScreen(c, W, H, pg, time + 2, { title: 'This week', label: 'Hours saved by the team' });
  c.restore();
}

/** The search field's outline, traced clockwise from its top-left corner (p 0..1). */
function trace(c: C2D, p: number, color: string) {
  if (p <= 0) return;
  const pts = [[FX, FY], [FX + FW, FY], [FX + FW, FY + FH], [FX, FY + FH], [FX, FY]], per = 2 * (FW + FH);
  let left = per * clamp(p);
  c.save(); c.strokeStyle = color; c.lineWidth = 4; c.lineJoin = 'miter'; c.beginPath(); c.moveTo(FX, FY);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const [ax, ay] = pts[i - 1]!, [bx, by] = pts[i]!, len = Math.hypot(bx! - ax!, by! - ay!), u = Math.min(1, left / len);
    c.lineTo(lerp(ax!, bx!, u), lerp(ay!, by!, u)); left -= len;
  }
  c.stroke(); c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, overlay = p.backdrop === false;
  const fade = 1 - at(time, d - .75, d - .4, ease.inOutCubic);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    // The sheet rises over the picture with an orange rule on its leading edge, and drops away at the end.
    const rise = at(time, 0, .7, springs.camera) * (1 - at(time, d - .5, d, ease.inOutCubic)), top = lerp(H + 8, SHEET, rise);
    if (!overlay) picture(c, ctx, pg, time, (1 - rise) * 40);
    c.fillStyle = pg.paper; c.fillRect(0, top, W, H - top);
    c.fillStyle = pg.accent; c.fillRect(0, top - 8, W, 8);

    c.save(); c.beginPath(); c.rect(0, top, W, H - top); c.clip();
    // Label: tracked capitals whose spacing opens from tight to loose.
    const kk = at(time, .4, 1.2, ease.outQuart);
    txt(c, String(p.kicker).toUpperCase(), CX, KICK_Y + (1 - kk) * 24, { size: 30, color: pg.accent, family: SANS, weight: 800, tracking: lerp(-3, 9, kk), align: 'center', alpha: clamp(kk * 1.6) * fade });

    // The call to action rises letter by letter; the marked word turns orange and is underlined.
    const cta = marked(String(p.cta).toUpperCase());
    const size = Math.min(SIZE, SIZE * 800 / Math.max(1, measure(c, cta.plain, { size: SIZE, color: '', family: DISPLAY, tracking: SIZE * .02 })));
    const boxes = charLine(c, cta.plain, CX, HEAD_Y, size, time, .45, { color: pg.ink, stagger: .04, exitAt: d - .8, fx: i => cta.flags[i] ? { color: pg.accent } : {} });
    if (cta.first >= 0) {
      c.save(); c.globalAlpha *= fade; underline(c, boxes[cta.first]![0], boxes[cta.last]![1], HEAD_Y + 42, at(time, 1.35, 1.85, ease.inOutCubic), pg.accent, 10); c.restore();
    }
    // Once the line has landed, a soft ring spreads out from it.
    const rg = at(time, 1.1, 2.3, ease.outCubic);
    if (rg > 0 && rg < 1) {
      c.save(); c.strokeStyle = pg.accent; c.globalAlpha *= (1 - rg) * .55; c.lineWidth = lerp(6, 1, rg);
      c.beginPath(); c.arc(CX, RING_Y, lerp(40, 560, rg), 0, Math.PI * 2); c.stroke(); c.restore();
    }

    // "Or search": short rules either side of the label.
    const or = String(p.or).toUpperCase(), ost = { size: 28, color: pg.mute, family: SANS, weight: 800, tracking: 6 };
    const ow = measure(c, or, ost), ok = at(time, 1.55, 2.05, ease.inOutCubic) * fade;
    const ol = at(time, 1.5, 2.1, ease.outQuint);
    txt(c, or, CX, OR_Y + (1 - ol) * 24, { ...ost, align: 'center', alpha: ol * fade });
    if (ok > 0) { c.save(); c.globalAlpha *= ok; c.fillStyle = alpha(pg.mute, .6); c.fillRect(CX - ow / 2 - 30 - 60 * ok, OR_Y - 11, 60 * ok, 2); c.fillRect(CX + ow / 2 + 30, OR_Y - 11, 60 * ok, 2); c.restore(); }

    // The search field: its outline draws, the glass pops in, the name types itself, the button fills and is tapped.
    c.save(); c.globalAlpha *= fade; c.translate(0, (1 - fade) * -30);
    trace(c, at(time, 1.6, 2.2, ease.inOutCubic), pg.ink);
    const g = spring(time, 1.95, .45, .25);
    if (g > 0) {
      c.save(); c.translate(FX + 64, FY + FH / 2); c.scale(g, g); c.strokeStyle = pg.accent; c.lineWidth = 6; c.lineCap = 'round';
      c.beginPath(); c.arc(-4, -4, 19, 0, Math.PI * 2); c.moveTo(10, 10); c.lineTo(24, 24); c.stroke(); c.restore();
    }
    const word = String(p.search), n = Math.max(0, Math.min(word.length, Math.floor((time - TYPE) / .06) + 1));
    const tst = { size: 48, color: pg.ink, family: SANS, weight: 700 }, tx = FX + 116, ty = FY + FH / 2 + 17;
    if (time >= TYPE) {
      const typed = word.slice(0, n), tw = txt(c, typed, tx, ty, tst);
      const typing = time < TYPE + word.length * .06 + .1;
      if (typing || Math.floor((time - TYPE) * 2.2) % 2 === 0) { c.fillStyle = pg.accent; c.fillRect(tx + tw + 6, FY + 34, 4, FH - 68); }
    }
    // The button: an orange block fills the square at the end of the field, the arrow slides in, then a tap.
    const bx = FX + FW - FH, fill = at(time, 2.55, 2.9, ease.inOutCubic), tap = press(time, TAP, .07);
    if (fill > 0) {
      c.save(); c.translate(bx + FH / 2, FY + FH / 2); c.scale(1 - tap * .08, 1 - tap * .08); c.translate(-bx - FH / 2, -FY - FH / 2);
      c.fillStyle = pg.accent; c.fillRect(bx, FY, FH * fill, FH);
      const ar = at(time, 2.75, 3.1, ease.outQuint);
      c.beginPath(); c.rect(bx, FY, FH, FH); c.clip();
      txt(c, '→', bx + FH / 2 + (1 - ar) * -60, FY + FH / 2 + 18, { size: 54, color: '#FFFFFF', family: SANS, weight: 800, align: 'center', alpha: ar });
      c.restore();
    }
    ring(c, bx + FH / 2, FY + FH / 2, time, TAP, pg.accent, 1.3);
    c.restore();
    c.restore();
    safeGuide(c, '9:16', p.safeGuide);
  });
}
