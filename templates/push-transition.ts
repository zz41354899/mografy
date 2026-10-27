// Vertical push: the first picture sinks back, then the next one pushes it up out of the frame. Between them the page
// opens as a gap with an orange leading edge, both pictures sink back a little like a swiped carousel page, and the
// pictures travel slower than their frames. The incoming picture's number and title rise in, then lift away.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { at, clamp, ease, lerp, safeGuide, safeParam, springs, stage, type C2D, type TemplateInfo } from './kit.js';
import { CX, DISPLAY, H, MX, W, charLine, cover, editorialParams, editorialScreen, loadPhoto, measure, page, paper, txt, type Page } from './editorial.js';

export const template = {
  id: 'push-transition', name: 'Vertical push', category: 'transition', aspect: '9:16', pair: 'push-transition-wide',
  summary: 'The next picture pushes the last one up out of frame, with a page gap and an orange leading edge between them; its title rises in.',
  agentHint: 'Between two full-frame pictures or screens of a 9:16 film. Titles 1–4 words. The pictures are stand-in product screens: put assets/from.jpg and assets/to.jpg in the project (or redraw `picture`) so the push carries your own last and next shot.',
  principles: ['anticipation', 'follow-through', 'overlapping action', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 2.6, fps: 30, background: '#FFFFFF' };

export const params = {
  from: { name: 'From title', type: 'string' as const, default: 'Plan the sprint' },
  to: { name: 'To title', type: 'string' as const, default: 'Ship on Friday' },
  ...editorialParams, ...safeParam,
};

export async function setup(ctx: SetupContext) {
  await loadPhoto(ctx, 'from.jpg', 'from');
  await loadPhoto(ctx, 'to.jpg', 'to');
}

const PUSH = .45, LEN = .8, GAP = 150, LABEL_Y = 1500;
const SCREENS = [{ title: 'Sprint board', figure: '24', label: 'Tasks in this sprint' }, { title: 'Reports', label: 'Hours saved this quarter' }];

/** Picture i (0 from, 1 to): a photo from the project or the stand-in product screen, with a scrim for the title. */
function picture(c: C2D, ctx: FrameContext, i: number, pg: Page, t: number) {
  const img = ctx.assets[i ? 'to' : 'from'] as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (img) cover(c, img, 0, 0, W, H, .5, .5, lerp(1.06, 1, at(t, 0, 1.4, ease.outCubic)));
  // The stand-in screen stops above the title, so the lower third stays quiet for it.
  else { c.fillStyle = '#141414'; c.fillRect(0, 0, W, H); editorialScreen(c, W, 1250, pg, t, SCREENS[i]); }
  const g = c.createLinearGradient(0, 1150, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = g; c.fillRect(0, 1150, W, H - 1150);
}

/** Number, a short accent bar and the title, set on the picture's lower left. `k` builds it, `out` lifts it away. */
function label(c: C2D, pg: Page, n: number, title: string, time: number, start: number, exitAt: number) {
  const k = at(time, start, start + .7, ease.outQuart), ex = at(time, exitAt, exitAt + .35, ease.inOutCubic);
  if (k <= 0 || ex >= 1) return;
  c.save(); c.beginPath(); c.rect(0, LABEL_Y - 150, W, 190); c.clip();
  const lift = (1 - k) * 110 - ex * 150;
  const nw = txt(c, `0${n}`, MX, LABEL_Y + lift, { size: 132, color: pg.accentLight, family: DISPLAY });
  c.fillStyle = pg.accentLight; c.fillRect(MX + nw + 18, LABEL_Y - 96 + lift, 3, 96);
  c.restore();
  const tx = MX + nw + 42, up = title.toUpperCase(), max = 950 - tx;
  const size = Math.min(84, 84 * max / Math.max(1, measure(c, up, { size: 84, color: '', family: DISPLAY, tracking: 84 * .02 })));
  charLine(c, up, tx, LABEL_Y - 6, size, time, start + .12, { color: '#FFFFFF', align: 'left', stagger: .025, exitAt });
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration;
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    // Anticipation: the first picture sinks back a little before it is pushed; then the push runs on the camera spring.
    const pre = Math.sin(clamp((time - PUSH + .3) / .45) * Math.PI) * (time < PUSH ? 1 : 0) + (time >= PUSH ? at(time, PUSH, PUSH + .15) : 0) * (1 - at(time, PUSH + .2, PUSH + .5));
    const pos = at(time, PUSH, PUSH + LEN, springs.camera), moving = Math.sin(clamp(pos) * Math.PI);
    const depth = 1 - .05 * moving - .02 * pre, gap = GAP * moving, seam = H * (1 - pos);
    c.save(); c.translate(CX, H / 2); c.scale(depth, depth); c.translate(-CX, -H / 2);
    // Outgoing picture: its frame leaves with the seam, the picture inside at 62 % of the speed.
    if (pos < 1) {
      c.save(); c.beginPath(); c.rect(0, seam - gap - H, W, H); c.clip();
      c.translate(0, -H * pos * .62); picture(c, ctx, 0, pg, time + 3);
      label(c, pg, 1, String(p.from), time, -1, d);
      c.restore();
    }
    // Incoming picture, from the seam down, with an orange leading edge on its top.
    if (pos > 0) {
      c.save(); c.beginPath(); c.rect(0, seam, W, H - seam + 2); c.clip();
      c.translate(0, seam * .62); picture(c, ctx, 1, pg, time - PUSH);
      c.restore();
      if (moving > .01) { c.save(); c.globalAlpha *= moving; c.fillStyle = pg.accent; c.fillRect(0, seam - 7, W, 14); c.restore(); }
    }
    c.restore();
    label(c, pg, 2, String(p.to), time, PUSH + LEN * .75, d - .5);
    safeGuide(c, '9:16', p.safeGuide);
  });
}
