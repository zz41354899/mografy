// Stage example: dragging a meeting in a fictional calendar, Plume, in a browser window.
// The card lifts and follows the hand; the drop target jumps from cell to cell instead of chasing it; on release the
// card settles and the attendees confirm one by one. Dragging it back is the loop.
import type { FrameContext } from '@mografy/runtime';
import { clamp, stagger } from '@mografy/runtime';
import { play, wait, set, drag, move, focus, mark, withStage, createKit, look, pin } from './stage.js';
import type { Rect, Point } from './stage.js';

const W = 1280, H = 720;
const START: Point = [1010, 640];
const initial = { slot: 'tue-11', confirmed: false };
type S = typeof initial;

// ---- layout
const WIN = pin([W, H], [1240, 780], 'tl', [70, 60]);
const GX = WIN[0] + 112, GY = WIN[1] + 58 + 128, CW = 196, RH = 62;
const DAYS = ['Mon 12', 'Tue 13', 'Wed 14', 'Thu 15', 'Fri 16'];
const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM'];
const SLOTS: Record<string, [number, number]> = { 'tue-11': [1, 2], 'wed-2': [2, 5] };
const cell = (col: number, row: number): Rect => [GX + col * CW + 6, GY + row * RH + 4, CW - 12, RH * 1 - 8];
const OTHERS: [number, number, number, string][] = [[0, 0, 1.5, '#e0e7ff'], [0, 4, 1, '#fde68a'], [1, 5, 2, '#dcfce7'], [2, 1, 1, '#fce7f3'], [3, 0, 1, '#dcfce7'], [3, 3, 1.5, '#e0e7ff'], [4, 2, 1, '#fde68a'], [4, 5, 1, '#fce7f3']];
// The hand grabs the card's right end, so the title stays readable while it is carried.
const GRIP = 0.3 * (CW - 12);
const grip = (r: Rect): Rect => [r[0] + r[2] / 2 + GRIP - 8, r[1] + r[3] / 2 - 8, 16, 16];
const layout = (s: S): Record<string, Rect> => {
  const [col, row] = SLOTS[s.slot]!;
  return { event: grip(cell(col, row)), 'to-wed': grip(cell(...SLOTS['wed-2']!)), 'to-tue': grip(cell(...SLOTS['tue-11']!)), card: cell(col, row), area: [GX + CW * 0.6, GY + RH * 1.6, CW * 2.6, RH * 4.6] };
};

const show = play<S>(initial, [
  mark('Move the review'),
  focus('area', 1.3, 1.2),
  wait(0.9),
  drag('event', 'to-wed', { slot: 'wed-2' }),
  wait(0.25),
  set({ confirmed: true }),
  wait(1.8),
  focus(null, 1, 1.0),
  wait(0.4),
  mark('And back'),
  drag('event', 'to-tue', { slot: 'tue-11', confirmed: false }),
  wait(0.4),
  move(START),
  wait(0.6),
], { size: [W, H], layout, start: START, loop: true, cursors: { card: 'grab' } });

export const meta = { width: 1920, height: 1080, duration: show.duration, fps: 30, background: '#efeeec', shots: show.shots, loop: true };
export const params = { accent: { name: 'Accent', type: 'color' as const, default: '#2563eb' } };
export async function setup() {}


export function renderFrame(ctx: FrameContext, time: number, p: { accent: string }) {
  const ui = createKit(look('light', { accent: p.accent, accentSoft: '#e8efff' })), L = ui.look, s = show.at(time), cur = s.cursor, scale = ctx.width / W;
  const eventCard = (c: CanvasRenderingContext2D, r: Rect, lift: number, slot = String(s.value('slot'))) => {
    if (lift > 0) ui.shadow(c, r, 12, lift * 1.2, L.accentSoft);
    ui.fill(c, r[0], r[1], r[2], r[3], 12, L.accentSoft); ui.fill(c, r[0], r[1], 5, r[3], 2.5, L.accent);
    ui.text(c, 'Design review', r[0] + 18, r[1] + 20, { size: 15, weight: 600, color: '#1e3a8a', role: 'keep', max: r[2] - 30 });
    ui.text(c, slot === 'wed-2' ? 'Wed, 2:00 – 3:00' : 'Tue, 11:00 – 12:00', r[0] + 18, r[1] + 40, { size: 12, color: '#3b5bbf', role: 'keep' });
  };
  ctx.withCanvas(c0 => {
    const c = c0 as CanvasRenderingContext2D;
    ui.backdrop(c, ctx.width, ctx.height);
    withStage(c, s, g => {
      ui.window(g, WIN, { chrome: 'browser', url: 'plume.app/week' }, (w, b) => {
        const [x, y] = b.content;
        ui.text(w, 'May 12 – 16', x + 40, y + 48, { size: 26, weight: 600, role: 'keep' });
        ui.button(w, [x + 880, y + 26, 120, 40], 'Today', { kind: 'secondary', size: 14 });
        DAYS.forEach((d, i) => ui.text(w, d, GX + i * CW + 12, GY - 26, { size: 14, weight: 600, color: i === 2 ? L.accent : L.mute }));
        HOURS.forEach((h, i) => { ui.text(w, h, GX - 16, GY + i * RH + 10, { size: 12, color: L.faint, align: 'right' }); ui.hline(w, GX, GY + i * RH, CW * 5, L.line, 1); });
        for (let i = 0; i <= 5; i++) ui.vline(w, GX + i * CW, GY - 8, RH * 8 + 8, L.line, 1);
        OTHERS.forEach(([col, row, len, color]) => { const r = cell(col, row); ui.fill(w, r[0], r[1], r[2], RH * len - 8, 10, color); ui.bar(w, r[0] + 14, r[1] + 20, 80, 8, 'rgba(0,0,0,.12)'); });

        // the event: ghost at home while carried, the card under the hand, a snap target that jumps by cell
        const home = s.rect('card');
        if (cur.dragging) {
          w.save(); w.globalAlpha *= 1 - 0.65 * cur.lift; eventCard(w, home, 0); w.restore();
          const col = clamp(Math.round((cur.x - GRIP - GX - CW / 2) / CW), 0, 4), row = clamp(Math.round((cur.y - GY - RH / 2) / RH), 0, 7);
          const t = cell(col, row); w.save(); w.globalAlpha *= cur.lift; w.setLineDash([6, 5]); ui.stroke(w, t[0], t[1], t[2], t[3], 12, L.accent, 2); w.restore();
        } else {
          const lift = Math.max(cur.lift, 0);
          w.save(); const cx = home[0] + home[2] / 2, cy = home[1] + home[3] / 2, sc = 1 + 0.03 * lift; w.translate(cx, cy); w.rotate(-0.025 * lift); w.scale(sc, sc); w.translate(-cx, -cy);
          eventCard(w, home, lift); w.restore();
          // attendees confirm, one after another
          const ck = s.on('confirmed');
          if (ck > 0.001) ['#c2410c', '#0d9488', '#7c3aed'].forEach((col2, i) => {
            const a = clamp(ck * 1.6 - stagger(i, 3, 0.25));
            if (a <= 0) return;
            const ax = home[0] + home[2] - 24 - i * 22, ay = home[1] + home[3] - 2;
            w.save(); w.globalAlpha *= a; w.translate(ax, ay); w.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a);
            ui.avatar(w, 0, 0, 11, '', col2); ui.dot(w, 8, -8, 6, '#16a34a'); ui.icon(w, 'check', 8, -8, 9, '#ffffff'); w.restore();
          });
        }
      });
      if (cur.dragging) {
        // the carried card: lifted, a little tilted, under the hand
        const r = s.rect('card'), cw = r[2], ch = r[3];
        const k = cur.lift; g.save(); g.translate(cur.x - GRIP, cur.y); g.rotate(-0.025 * k); g.scale(1 + 0.03 * k, 1 + 0.03 * k); eventCard(g, [-cw / 2, -ch / 2, cw, ch], k); g.restore();
      }
      ui.pointer(g, cur);
    }, scale);
  });
}
