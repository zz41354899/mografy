// Stage example: a dark analytics hero for a fictional product, Lumen, in the newer macOS window.
// The cursor finds the one spike on the signups chart; the tooltip answers it; the camera leans in while a single
// annotation explains why; then everything eases back. Nothing else on the dashboard has words.
import type { FrameContext } from '@mografy/runtime';
import { clamp, lerp, pr } from '@mografy/runtime';
import { play, wait, set, move, focus, mark, withStage, createKit, look, pin } from './stage.js';
import type { Rect, Point } from './stage.js';

const W = 1280, H = 720;
const START: Point = [1010, 660];
const initial = { hover: false, note: false };
type S = typeof initial;

// ---- layout
const WIN = pin([W, H], [1260, 780], 'tl', [78, 60]);
const SIDE = 206;
const CX = WIN[0] + 12 + SIDE + 40, TOP = WIN[1] + 76;
const CHART: Rect = [CX, TOP + 168, 820, 330];
const PLOT: Rect = [CHART[0] + 34, CHART[1] + 70, CHART[2] - 68, CHART[3] - 104];
const SIDE_CARD: Rect = [CHART[0] + CHART[2] + 22, CHART[1], 420, CHART[3]];
const DATA = Array.from({ length: 30 }, (_, i) => 0.28 + 0.06 * Math.sin(i * 0.9) + 0.04 * Math.sin(i * 2.3 + 1) + i * 0.004 + (i === 21 ? 0.5 : i === 22 ? 0.16 : i === 20 ? 0.05 : 0));
const pt = (i: number): Point => [PLOT[0] + PLOT[2] * i / (DATA.length - 1), PLOT[1] + PLOT[3] * (1 - DATA[i]!)];
const SPIKE = pt(21);
const layout = (): Record<string, Rect> => ({ spike: [SPIKE[0] - 12, SPIKE[1] - 12, 24, 24], view: [SPIKE[0] - 120, SPIKE[1] - 10, 240, 160] });

const show = play<S>(initial, [
  mark('Find the spike'),
  wait(1.0),
  move('spike'),
  set({ hover: true }),
  wait(0.5),
  mark('Explain it'),
  focus('view', 1.55, 1.15),
  wait(0.35),
  set({ note: true }),
  wait(2.3),
  focus(null, 1, 1.0),
  set({ note: false }),
  wait(0.5),
  move(START),
  set({ hover: false }),
  wait(1.0),
], { size: [W, H], layout, start: START, loop: true, cursors: { spike: 'crosshair' } });

export const meta = { width: 1920, height: 1080, duration: show.duration, fps: 30, background: '#0b0b0c', shots: show.shots, loop: true };
export const params = {
  look: { name: 'Look', type: 'enum' as const, default: 'dark', options: ['dark', 'light', 'blueprint'] },
};
export async function setup() {}

export function renderFrame(ctx: FrameContext, time: number, p: { look: 'dark' | 'light' | 'blueprint' }) {
  const ui = createKit(look(p.look, p.look === 'light' ? { accent: '#1d1d1f' } : {})), L = ui.look, s = show.at(time), scale = ctx.width / W;
  const line = L.dark ? '#e8e8ea' : '#1d1d1f';
  ctx.withCanvas(c0 => {
    const c = c0 as CanvasRenderingContext2D;
    ui.backdrop(c, ctx.width, ctx.height);
    withStage(c, s, g => {
      ui.window(g, WIN, { chrome: 'tahoe', sidebar: SIDE }, (w, b) => {
        ui.nav(w, b.sidebar!, { brand: 'Lumen', mark: L.dark ? '#3f3f46' : '#d4d4d8', items: [['chart', 'Dashboards'], ['users', 'People'], ['inbox', 'Events'], ['settings', 'Settings']], active: 0, top: 96 });
        // header: title, a quiet range control
        ui.text(w, 'Growth', CX, TOP + 34, { size: 28, weight: 600, role: 'keep' });
        ui.fill(w, CX + 620, TOP + 14, 200, 40, 12, L.surface); ui.fill(w, CX + 624, TOP + 18, 92, 32, 9, L.hover); ui.bar(w, CX + 646, TOP + 34, 48, 8); ui.bar(w, CX + 742, TOP + 34, 52, 8);
        // stats: one real figure
        [0, 1, 2, 3].forEach(i => {
          const x = CX + i * 210, y = TOP + 84;
          if (i === 0) { ui.text(w, 'Signups, 30 days', x, y, { size: 14, color: L.mute, max: 190 }); ui.text(w, '5,074', x, y + 38, { size: 32, weight: 600, role: 'keep' }); }
          else { ui.bar(w, x, y, [90, 70, 100][i - 1]!, 8); ui.bar(w, x, y + 38, [110, 84, 96][i - 1]!, 18, L.hover); }
        });
        // chart card
        ui.fill(w, CHART[0], CHART[1], CHART[2], CHART[3], 18, L.surface); ui.stroke(w, CHART[0], CHART[1], CHART[2], CHART[3], 18, L.line);
        ui.text(w, 'Signups', CHART[0] + 30, CHART[1] + 36, { size: 16, weight: 600 }); ui.bar(w, CHART[0] + CHART[2] - 130, CHART[1] + 36, 100, 8);
        for (let k = 0; k <= 3; k++) ui.hline(w, PLOT[0], PLOT[1] + PLOT[3] * k / 3, PLOT[2], L.line, 1);
        // the line, a soft fill under it
        w.beginPath(); DATA.forEach((_, i) => { const [x, y] = pt(i); if (i) w.lineTo(x, y); else w.moveTo(x, y); });
        w.save(); w.lineTo(PLOT[0] + PLOT[2], PLOT[1] + PLOT[3]); w.lineTo(PLOT[0], PLOT[1] + PLOT[3]); w.closePath();
        const grad = w.createLinearGradient(0, PLOT[1], 0, PLOT[1] + PLOT[3]); grad.addColorStop(0, L.dark ? 'rgba(232,232,234,.16)' : 'rgba(29,29,31,.08)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); w.fillStyle = grad; w.fill(); w.restore();
        w.beginPath(); DATA.forEach((_, i) => { const [x, y] = pt(i); if (i) w.lineTo(x, y); else w.moveTo(x, y); });
        w.strokeStyle = line; w.lineWidth = 2.5; w.lineJoin = 'round'; w.stroke();
        // hover: guide, point, tooltip
        const hv = s.on('hover');
        if (hv > 0.001) {
          w.save(); w.globalAlpha *= clamp(hv);
          ui.vline(w, SPIKE[0], PLOT[1] - 6, PLOT[3] + 6, L.dark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.18)', 1.5);
          ui.dot(w, SPIKE[0], SPIKE[1], 7 * (0.6 + 0.4 * hv), line); ui.dot(w, SPIKE[0], SPIKE[1], 3.5, L.surface);
          const tip: Rect = [SPIKE[0] + 18, SPIKE[1] - 6 + (1 - hv) * 6, 168, 62];
          ui.shadow(w, tip, 12, 0.6, L.window); ui.fill(w, tip[0], tip[1], tip[2], tip[3], 12, L.dark ? '#27272a' : '#ffffff'); ui.stroke(w, tip[0], tip[1], tip[2], tip[3], 12, L.line, 1);
          ui.text(w, 'May 21', tip[0] + 16, tip[1] + 20, { size: 13, color: L.mute, role: 'keep' });
          ui.text(w, '1,284 signups', tip[0] + 16, tip[1] + 42, { size: 16, weight: 600, role: 'keep', max: 140 });
          w.restore();
        }
        // the one annotation: a leader line drawn from the point, then the label
        const nk = s.on('note');
        if (nk > 0.001) {
          const end: Point = [SPIKE[0] - 96, SPIKE[1] + 96], draw = clamp(nk * 1.6);
          w.save(); w.strokeStyle = L.dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.45)'; w.lineWidth = 1.5; w.setLineDash([4, 4]);
          w.beginPath(); w.moveTo(SPIKE[0] - 6, SPIKE[1] + 6); w.lineTo(lerp(SPIKE[0] - 6, end[0], draw), lerp(SPIKE[1] + 6, end[1], draw)); w.stroke(); w.restore();
          const lk = clamp(pr(nk, 0.45, 1));
          if (lk > 0) {
            w.save(); w.globalAlpha *= lk; const lab: Rect = [end[0] - 176, end[1] - 4 + (1 - lk) * 8, 176, 50];
            ui.fill(w, lab[0], lab[1], lab[2], lab[3], 10, L.dark ? '#f4f4f5' : '#1d1d1f');
            ui.text(w, 'Launch post went live', lab[0] + 14, lab[1] + 25, { size: 14, weight: 600, color: L.dark ? '#0b0b0c' : '#ffffff', role: 'keep', max: 150 });
            w.restore();
          }
        }
        // a second card that runs off the edge: context, no words
        ui.fill(w, SIDE_CARD[0], SIDE_CARD[1], SIDE_CARD[2], SIDE_CARD[3], 18, L.surface); ui.stroke(w, SIDE_CARD[0], SIDE_CARD[1], SIDE_CARD[2], SIDE_CARD[3], 18, L.line);
        ui.bar(w, SIDE_CARD[0] + 28, SIDE_CARD[1] + 36, 90, 8);
        for (let i = 0; i < 7; i++) { const bh = 40 + 90 * (0.5 + 0.5 * Math.sin(i * 1.3 + 0.4)); ui.fill(w, SIDE_CARD[0] + 28 + i * 34, SIDE_CARD[1] + 290 - bh, 22, bh, 5, L.hover); }
      });
      ui.pointer(g, s.cursor);
    }, scale);
  });
}
