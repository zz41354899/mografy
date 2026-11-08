// Stage example: a checkout in a browser with tabs, for a fictional coffee roaster, Fernleaf.
// The email is typed, Pay is pressed, the button holds a spinner, and the form gives way to a confirmation whose
// check draws itself. Done returns to the empty form, which is the loop. Payment fields stay placeholder lines.
import type { FrameContext } from '@mografy/runtime';
import { clamp, pr } from '@mografy/runtime';
import { play, wait, set, click, type, move, mark, withStage, createKit, look, pin, blink } from './stage.js';
import type { Rect, Point } from './stage.js';

const W = 1280, H = 720;
const START: Point = [900, 650];
const initial = { focus: false, email: '', paying: false, paid: false };
type S = typeof initial;

const WIN = pin([W, H], [1270, 800], 'tl', [56, 50]);
const FX = WIN[0] + 76, TOP = WIN[1] + 96;
const EMAIL: Rect = [FX, TOP + 132, 520, 52];
const PAY: Rect = [FX, TOP + 404, 520, 54];
const DONE: Rect = [FX, TOP + 330, 180, 48];
const SUM: Rect = [FX + 590, TOP + 60, 430, 400];
const layout = (s: S): Record<string, Rect> => ({ email: EMAIL, ...(s.paid ? { done: DONE } : { pay: PAY }) });

const show = play<S>(initial, [
  mark('Pay'),
  wait(0.8),
  click('email', { focus: true }),
  type('email', 'you@example.com', 20),
  wait(0.3),
  click('pay', { paying: true }),
  wait(0.95),
  set({ paying: false, paid: true }),
  wait(2.2),
  mark('Done'),
  click('done', { paid: false, email: '', focus: false }),
  wait(0.4),
  move(START),
  wait(0.6),
], { size: [W, H], layout, start: START, loop: true, cursors: { email: 'text', pay: 'pointer', done: 'pointer' } });

export const meta = { width: 1920, height: 1080, duration: show.duration, fps: 30, background: '#efeeec', shots: show.shots, loop: true };
export const params = { accent: { name: 'Accent', type: 'color' as const, default: '#9a3412' } };
export async function setup() {}

export function renderFrame(ctx: FrameContext, time: number, p: { accent: string }) {
  const ui = createKit(look('light', { accent: p.accent, accentSoft: '#fdeee6' })), L = ui.look, s = show.at(time), cur = s.cursor, scale = ctx.width / W;
  ctx.withCanvas(c0 => {
    const c = c0 as CanvasRenderingContext2D;
    ui.backdrop(c, ctx.width, ctx.height);
    withStage(c, s, g => {
      ui.window(g, WIN, { chrome: 'tabs', tabs: ['Fernleaf · Checkout', ''], activeTab: 0, url: 'fernleaf.coffee/checkout' }, w => {
        const paid = s.is('paid', true), form = 1 - paid;
        ui.text(w, 'Fernleaf', FX, TOP + 52, { size: 22, weight: 600, role: 'keep' });
        // the form: email is real, payment details are lines
        if (form > 0.01) {
          w.save(); w.globalAlpha *= form; w.translate(0, -12 * paid);
          ui.text(w, 'Email', FX, TOP + 114, { size: 15, weight: 600, color: L.mute });
          const email = String(s.value('email')), typing = s.since('email') < 0.15;
          ui.field(w, EMAIL, { value: email, placeholder: 'you@company.com', focus: s.on('focus'), caret: Boolean(s.value('focus')) && !s.value('paying') && (typing || blink(time)), size: 17 });
          ui.text(w, 'Payment', FX, TOP + 224, { size: 15, weight: 600, color: L.mute });
          ui.card(w, [FX, TOP + 242, 520, 120], { radius: 12 });
          ui.bar(w, FX + 22, TOP + 274, 210); ui.hline(w, FX, TOP + 302, 520); ui.bar(w, FX + 22, TOP + 332, 90); ui.bar(w, FX + 280, TOP + 332, 70);
          const paying = s.on('paying');
          ui.button(w, PAY, paying > 0.5 ? '' : 'Pay $36.00', { kind: 'primary', press: s.value('paid') ? 0 : cur.press, size: 17 });
          if (paying > 0.01) {
            const [cx, cy] = [PAY[0] + PAY[2] / 2, PAY[1] + PAY[3] / 2], a = time * 7;
            w.save(); w.globalAlpha *= paying; w.strokeStyle = '#ffffff'; w.lineWidth = 3; w.lineCap = 'round'; w.beginPath(); w.arc(cx, cy, 11, a, a + 4.2); w.stroke(); w.restore();
          }
          w.restore();
        }
        // the confirmation: the check draws itself
        if (paid > 0.01) {
          w.save(); w.globalAlpha *= clamp(paid * 1.3); w.translate(0, 12 * (1 - paid));
          const k = clamp(pr(s.since('paid'), 0.1, 0.6)), cx = FX + 40, cy = TOP + 170;
          ui.dot(w, cx, cy, 36, '#dcfce7');
          w.save(); w.strokeStyle = '#15803d'; w.lineWidth = 5; w.lineCap = 'round'; w.lineJoin = 'round'; w.beginPath();
          const pts: [number, number][] = [[cx - 15, cy + 1], [cx - 4, cy + 12], [cx + 16, cy - 10]], d1 = 0.4;
          w.moveTo(...pts[0]!); if (k < d1) w.lineTo(pts[0]![0] + (pts[1]![0] - pts[0]![0]) * k / d1, pts[0]![1] + (pts[1]![1] - pts[0]![1]) * k / d1); else { w.lineTo(...pts[1]!); const u = (k - d1) / (1 - d1); w.lineTo(pts[1]![0] + (pts[2]![0] - pts[1]![0]) * u, pts[1]![1] + (pts[2]![1] - pts[1]![1]) * u); }
          w.stroke(); w.restore();
          ui.text(w, 'Order confirmed', FX, TOP + 248, { size: 30, weight: 600, role: 'keep' });
          ui.text(w, 'Receipt sent to you@example.com', FX, TOP + 284, { size: 16, color: L.mute, role: 'keep', max: 520 });
          ui.button(w, DONE, 'Done', { kind: 'secondary', press: s.value('paid') ? cur.press : 0, size: 16 });
          w.restore();
        }
        // order summary: one real line item and the total
        ui.card(w, SUM, { radius: 16, fill: '#faf9f7' });
        ui.fill(w, SUM[0] + 28, SUM[1] + 32, 72, 72, 14, '#e7d5c4'); ui.fill(w, SUM[0] + 50, SUM[1] + 44, 28, 48, 6, '#9a3412');
        ui.text(w, 'House blend', SUM[0] + 120, SUM[1] + 56, { size: 17, weight: 600, role: 'keep' });
        ui.text(w, '2 bags · whole bean', SUM[0] + 120, SUM[1] + 82, { size: 14, color: L.mute });
        ui.text(w, '$32.00', SUM[0] + SUM[2] - 28, SUM[1] + 56, { size: 16, weight: 600, align: 'right', role: 'keep' });
        ui.hline(w, SUM[0] + 28, SUM[1] + 136, SUM[2] - 56);
        ui.bar(w, SUM[0] + 28, SUM[1] + 172, 90); ui.bar(w, SUM[0] + SUM[2] - 88, SUM[1] + 172, 60);
        ui.bar(w, SUM[0] + 28, SUM[1] + 206, 70); ui.bar(w, SUM[0] + SUM[2] - 78, SUM[1] + 206, 50);
        ui.hline(w, SUM[0] + 28, SUM[1] + 240, SUM[2] - 56);
        ui.text(w, 'Total', SUM[0] + 28, SUM[1] + 280, { size: 17, weight: 600 });
        ui.text(w, '$36.00', SUM[0] + SUM[2] - 28, SUM[1] + 280, { size: 22, weight: 600, align: 'right', role: 'keep' });
      });
      ui.pointer(g, cur);
    }, scale);
  });
}
