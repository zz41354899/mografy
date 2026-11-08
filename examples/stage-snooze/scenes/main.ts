// Stage example: a feature card for a fictional mail app, Hearthmail, in the quiet card chrome.
// Hover reveals a row's actions, the clock opens a small menu, Tomorrow snoozes the email: it slides away and the
// list closes up. Undo in the toast brings it back, which is the loop.
import type { FrameContext } from '@mografy/runtime';
import { clamp, pr } from '@mografy/runtime';
import { play, wait, set, click, move, focus, mark, withStage, createKit, look } from './stage.js';
import type { Rect, Point } from './stage.js';

const W = 1280, H = 720;
const START: Point = [1000, 640];
const initial = { menu: false, snoozed: false, toast: false };
type S = typeof initial;

const CARD: Rect = [250, 64, 780, 720];          // one quiet card, running off the bottom
const CX = CARD[0] + 40, RW = CARD[2] - 80;
const ROW_Y = (i: number) => CARD[1] + 150 + i * 74;
const ROW: Rect = [CARD[0] + 16, ROW_Y(1) - 37, CARD[2] - 32, 74];
const CLOCK: Rect = [CX + RW - 30, ROW_Y(1) - 16, 32, 32];
const MENU: Rect = [CLOCK[0] - 196, CLOCK[1] + 42, 228, 152];
const OPT = (i: number): Rect => [MENU[0] + 8, MENU[1] + 8 + i * 46, MENU[2] - 16, 44];
const TOAST_C: Point = [CARD[0] + CARD[2] / 2, H - 70], TOAST_W = 340;
const UNDO: Rect = [TOAST_C[0] + TOAST_W / 2 - 78, TOAST_C[1] - 22, 78, 44];
const layout = (s: S): Record<string, Rect> => ({
  row: [ROW[0] + 260, ROW[1] + 20, 40, 30], clock: CLOCK, area: [ROW[0] + 180, ROW[1] - 10, 560, 300], ...(s.menu ? { tomorrow: OPT(1) } : {}), ...(s.toast ? { undo: UNDO } : {}),
});

const show = play<S>(initial, [
  mark('Snooze'),
  wait(0.8),
  focus('area', 1.3, 1.1),
  move('row'),
  wait(0.35),
  click('clock', { menu: true }),
  wait(0.45),
  click('tomorrow', { menu: false, snoozed: true }),
  wait(0.3),
  set({ toast: true }),
  wait(0.6),
  focus(null, 1, 1.0),
  wait(1.3),
  mark('Undo'),
  click('undo', { snoozed: false, toast: false }),
  wait(0.5),
  move(START),
  wait(0.6),
], { size: [W, H], layout, start: START, loop: true, cursors: { clock: 'pointer', tomorrow: 'pointer', undo: 'pointer' } });

export const meta = { width: 1920, height: 1080, duration: show.duration, fps: 30, background: '#efeeec', shots: show.shots, loop: true };
export const params = { look: { name: 'Look', type: 'enum' as const, default: 'light', options: ['light', 'dark', 'minimal'] } };
export async function setup() {}

export function renderFrame(ctx: FrameContext, time: number, p: { look: 'light' | 'dark' | 'minimal' }) {
  const ui = createKit(look(p.look, { accent: '#ea580c', accentSoft: p.look === 'dark' ? '#3a2416' : '#ffedd5' })), L = ui.look, s = show.at(time), cur = s.cursor, scale = ctx.width / W;
  ctx.withCanvas(c0 => {
    const c = c0 as CanvasRenderingContext2D;
    ui.backdrop(c, ctx.width, ctx.height);
    withStage(c, s, g => {
      ui.window(g, CARD, { chrome: 'card' }, w => {
        ui.text(w, 'Inbox', CX, CARD[1] + 62, { size: 28, weight: 600, role: 'keep' });
        ui.badge(w, CX + 96, CARD[1] + 63, '12 new', { size: 13 });
        const out = s.is('snoozed', true), collapse = clamp(pr(out, 0.35, 1));
        let y = ROW_Y(0);
        for (let i = 0; i < 8; i++) {
          const focal = i === 1, h = focal ? 74 * (1 - collapse) : 74;
          if (h < 0.5) continue;
          w.save(); w.beginPath(); w.rect(CARD[0], y - 37, CARD[2], h); w.clip();
          if (focal) { w.globalAlpha *= 1 - clamp(out * 1.4); w.translate(-60 * out, 0); }
          const hover = focal && !s.value('snoozed') && cur.x > ROW[0] && cur.x < ROW[0] + ROW[2] && cur.y > ROW[1] && cur.y < ROW[1] + ROW[3];
          if (hover || (focal && s.value('menu'))) ui.fill(w, ROW[0], y - 33, ROW[2], 66, 12, L.hover);
          ui.avatar(w, CX + 18, y, 18, '', ['#2563eb', '#ea580c', '#0d9488', '#7c3aed', '#ca8a04', '#db2777', '#16a34a', '#64748b'][i]!);
          if (focal) {
            ui.text(w, 'Lena Ortiz', CX + 52, y - 11, { size: 16, weight: 600, role: 'keep' });
            ui.text(w, 'Q3 deck: final numbers before Friday', CX + 52, y + 13, { size: 15, color: L.mute, role: 'keep', max: 420 });
            if (hover || s.value('menu')) { ui.icon(w, 'inbox', CX + RW - 70, y, 20, L.mute); ui.fill(w, CLOCK[0], CLOCK[1], 32, 32, 8, s.value('menu') ? L.accentSoft : 'rgba(0,0,0,0)'); ui.icon(w, 'clock', CLOCK[0] + 16, CLOCK[1] + 16, 20, s.value('menu') ? L.accent : L.ink); }
            else ui.text(w, '9:41', CX + RW, y - 11, { size: 13, color: L.faint, align: 'right', role: 'keep' });
          } else {
            ui.bar(w, CX + 52, y - 11, [110, 0, 90, 130, 100, 120, 80, 104][i]!, 9);
            ui.bar(w, CX + 52, y + 13, [300, 0, 360, 260, 330, 280, 340, 300][i]!, 8, L.hover);
            ui.bar(w, CX + RW - 36, y - 11, 36, 7, L.hover);
          }
          w.restore();
          ui.hline(w, CX, y + 37 - (focal ? 74 - h : 0), RW, L.line, 1);
          y += h;
        }
      });
      // the snooze menu
      ui.menu(g, MENU, s.on('menu'), (m) => {
        ['Later today', 'Tomorrow', 'Next week'].forEach((label, i) => {
          const r = OPT(i), hot = i === 1 && cur.y > r[1] && cur.y < r[1] + r[3] && cur.x > r[0] && cur.x < r[0] + r[2];
          if (hot) ui.fill(m, r[0], r[1], r[2], r[3], 9, L.hover);
          ui.text(m, label, r[0] + 14, r[1] + 22, { size: 15, weight: i === 1 ? 600 : 500, role: i === 1 ? 'keep' : 'ui' });
          ui.text(m, ['6 PM', 'Thu 8 AM', 'Mon 8 AM'][i]!, r[0] + r[2] - 14, r[1] + 22, { size: 13, color: L.faint, align: 'right' });
        });
      });
      ui.toast(g, TOAST_C[0], TOAST_C[1], 'Snoozed until tomorrow', s.on('toast'), { icon: 'clock', action: 'Undo', width: TOAST_W, size: 15 });
      ui.pointer(g, cur);
    }, scale);
  });
}
