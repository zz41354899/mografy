// Stage example: a dark bento section for a fictional task app, Fieldnote, planned as one picture.
// Only one tile shows the app (and the only window chrome); the others are a stat, an object and a diagram, and no
// two neighbours are the same kind. One event runs through all of them: two keys are pressed, a task is done, the
// weekly count rolls, and the task travels into Done. Then the week resets. No cursor: the system does this itself.
import type { FrameContext } from '@mografy/runtime';
import { clamp, pr } from '@mografy/runtime';
import { play, wait, set, mark, withStage, createKit, look } from './stage.js';
import type { Rect, Point } from './stage.js';

const W = 1280, H = 720;
const initial = { keys: false, done: false, count: 12, flow: 0 };
type S = typeof initial;

// ---- one grid, one gutter
const PAD = 40, GAP = 18;
const A: Rect = [PAD, PAD, 500, H - 2 * PAD];
const B: Rect = [PAD + 500 + GAP, PAD, 344, (H - 2 * PAD - GAP) / 2];
const C: Rect = [B[0] + B[2] + GAP, PAD, W - PAD - (B[0] + B[2] + GAP), B[3]];
const D: Rect = [B[0], PAD + B[3] + GAP, W - PAD - B[0], B[3]];
const ROWS = ['Ship onboarding email', 'Review pricing page', 'Draft launch notes', 'Book user interviews'];

const show = play<S>(initial, [
  mark('Done in two keys'),
  wait(1.1),
  set({ keys: true }),
  wait(0.3),
  set({ keys: false, done: true }),
  wait(0.45),
  set({ count: 13, flow: 2 }, { duration: 1.4 }),
  wait(2.6),
  mark('Next week'),
  set({ done: false, count: 12, flow: 0 }, { duration: 0.6 }),
  wait(1.2),
], { size: [W, H], layout: () => ({}), loop: true, pointer: false });

export const meta = { width: 1920, height: 1080, duration: show.duration, fps: 30, background: '#0b0b0c', shots: show.shots, loop: true };
export const params = { look: { name: 'Look', type: 'enum' as const, default: 'dark', options: ['dark', 'light'] } };
export async function setup() {}

export function renderFrame(ctx: FrameContext, time: number, p: { look: 'dark' | 'light' }) {
  const ui = createKit(look(p.look)), L = ui.look, s = show.at(time), scale = ctx.width / W;
  const tile = (c: CanvasRenderingContext2D, r: Rect) => ui.card(c, r, { radius: 22, fill: L.dark ? '#141416' : '#ffffff' });
  const title = (c: CanvasRenderingContext2D, r: Rect, strong: string, quiet: string) => {
    const w = ui.text(c, strong, r[0] + 28, r[1] + 38, { size: 19, weight: 600, role: 'keep' });
    ui.text(c, quiet, r[0] + 28 + w + 6, r[1] + 38, { size: 19, weight: 500, color: L.mute, role: 'keep' });
  };
  ctx.withCanvas(c0 => {
    const c = c0 as CanvasRenderingContext2D;
    ui.backdrop(c, ctx.width, ctx.height);
    withStage(c, s, g => {
      // A: the one tile with UI, its window running off the tile's bottom and right
      tile(g, A); title(g, A, 'One quiet list.', 'Nothing you didn’t put there.');
      g.save(); ui.rr(g, A[0], A[1], A[2], A[3], 22); g.clip();
      ui.window(g, [A[0] + 28, A[1] + 76, 560, 640], { chrome: 'app' }, (w, b) => {
        const [x, y] = b.content;
        ui.text(w, 'Today', x + 28, y + 40, { size: 20, weight: 600, role: 'keep' });
        const doneK = s.is('done', true), gone = doneK, collapse = clamp(pr(gone, 0.35, 1));
        let yy = y + 92;
        ROWS.forEach((label, i) => {
          const focal = i === 1, h = focal ? 58 * (1 - collapse) : 58;
          if (h < 1) return;
          w.save(); w.beginPath(); w.rect(x, yy - 29, 560, h); w.clip(); w.globalAlpha *= focal ? 1 - clamp(pr(gone, 0.5, 1)) : 1;
          const ck = focal ? clamp(doneK * 2) : 0;
          ui.stroke(w, x + 28, yy - 11, 22, 22, 7, L.line, 2);
          if (ck > 0) { ui.fill(w, x + 28, yy - 11, 22, 22, 7, L.accent); w.save(); w.globalAlpha *= ck; ui.icon(w, 'check', x + 39, yy, 16, L.accentInk); w.restore(); }
          if (focal) {
            const tw = ui.text(w, label, x + 66, yy, { size: 17, weight: 500, color: ck > 0.5 ? L.mute : L.ink, role: 'keep', max: 360 });
            if (ck > 0) ui.hline(w, x + 66, yy + 1, tw * ck, L.mute, 1.5);
          } else ui.bar(w, x + 66, yy, [170, 0, 210, 150][i]!, 9);
          ui.hline(w, x + 18, yy + 29, 520, L.line, 1);
          w.restore(); yy += h;
        });
      });
      g.restore();

      // B: a stat
      tile(g, B); title(g, B, 'Done this week', '');
      const cp = s.pair('count');
      ui.roll(g, cp.from, cp.to, cp.k, B[0] + 28, B[1] + 160, { size: 96, weight: 600, tracking: -0.04 });
      ui.text(g, 'tasks, on four mornings', B[0] + 30, B[1] + 238, { size: 16, color: L.mute, role: 'keep' });

      // C: an object — the two keys that did it
      tile(g, C); title(g, C, 'Two keys.', '');
      const press = s.on('keys', { duration: 0.12 });
      const kw = 76, total = kw * 2 + 16, kx = C[0] + C[2] / 2 - total / 2, ky = C[1] + C[3] / 2 - 18;
      ui.key(g, kx, ky, '⌘', { press, size: kw }); ui.key(g, kx + kw + 16, ky, '↵', { press, size: kw });

      // D: a diagram — the task travels Inbox → Today → Done
      tile(g, D); title(g, D, 'Linked work moves together.', '');
      const nodes: [string, Point][] = [['Inbox', [D[0] + 120, D[1] + 190]], ['Today', [D[0] + D[2] / 2, D[1] + 150]], ['Done', [D[0] + D[2] - 120, D[1] + 210]]];
      g.save(); g.strokeStyle = L.line; g.lineWidth = 2; g.beginPath(); g.moveTo(...nodes[0]![1]); g.bezierCurveTo(nodes[0]![1][0] + 120, nodes[0]![1][1], nodes[1]![1][0] - 120, nodes[1]![1][1], ...nodes[1]![1]); g.bezierCurveTo(nodes[1]![1][0] + 120, nodes[1]![1][1], nodes[2]![1][0] - 120, nodes[2]![1][1], ...nodes[2]![1]); g.stroke(); g.restore();
      const f = s.num('flow');
      nodes.forEach(([label, [x, y]], i) => {
        const lit = clamp(1 - Math.abs(f - i) * 1.4);
        const w0 = ui.measure(g, label, { size: 15, weight: 600 }) + 36;
        ui.fill(g, x - w0 / 2, y - 18, w0, 36, 10, lit > 0.5 ? (L.dark ? '#f4f4f5' : '#1d1d1f') : L.hover);
        ui.text(g, label, x, y + 1, { size: 15, weight: 600, align: 'center', role: 'keep', color: lit > 0.5 ? (L.dark ? '#0b0b0c' : '#ffffff') : L.mute });
      });
      // the travelling chip: along the same curve, by flow 0..2
      const seg = Math.min(1, Math.floor(f)), u = f - seg, a = nodes[seg]![1], b = nodes[Math.min(2, seg + 1)]![1];
      const bez = (p0: number, p1: number, p2: number, p3: number, t: number) => (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
      const cx = bez(a[0], a[0] + 120, b[0] - 120, b[0], u), cy = bez(a[1], a[1], b[1], b[1], u);
      const moving = f > 0.02 && f < 1.98;
      if (moving) { ui.dot(g, cx, cy - 34, 7, L.accent === L.accentInk ? L.ink : L.accent); g.save(); g.globalAlpha *= 0.25; ui.dot(g, cx, cy - 34, 14, L.dark ? '#ffffff' : '#000000'); g.restore(); }
    }, scale);
  });
}
