// Stage example: one action across two screens, for a fictional bill-splitting app, Kitty.
// On the web, Ari requests $40 from Sam; on Sam's phone (cropped by the frame, overlapping the window) the request
// arrives, a tap opens it and a second tap pays. The web total rolls and Sam's row turns Paid. New split resets.
// The window steps back while the phone has the viewer's attention.
import type { FrameContext } from '@mografy/runtime';
import { clamp, pr, springEase } from '@mografy/runtime';
import { play, wait, set, click, tap, move, mark, withStage, createKit, look, lerpRect } from './stage.js';
import type { Rect, Point } from './stage.js';

const W = 1280, H = 720;
const START: Point = [720, 640];
const initial = { requested: false, phone: false, notif: false, sheet: false, paid: false, collected: 40 };
type S = typeof initial;

// ---- layout (stage coordinates; the phone's own rects are in screen coordinates)
const WIN: Rect = [40, 56, 940, 720];
const CX = WIN[0] + 56, TOP = WIN[1] + 58;
const ROW_Y = (i: number) => TOP + 300 + i * 66;
const REQUEST: Rect = [CX + 520, ROW_Y(1) - 20, 200, 40];
const RESET: Rect = [CX + 560, TOP + 38, 160, 40];
const PHONE: Rect = [890, 136, 340, 740];
const BEZ = PHONE[2] * 0.032, SX = PHONE[0] + BEZ, SY = PHONE[1] + BEZ, SW = PHONE[2] - 2 * BEZ, SH = PHONE[3] - 2 * BEZ;
const NOTE: Rect = [12, 190, SW - 24, 84];
const SHEET_Y = 236;
const PAY: Rect = [24, SHEET_Y + 196, SW - 48, 52];
const onStage = (r: Rect): Rect => [SX + r[0], SY + r[1], r[2], r[3]];
const layout = (s: S): Record<string, Rect> => ({
  request: REQUEST, reset: RESET, note: onStage(NOTE), ...(s.sheet ? { pay: onStage(PAY) } : {}),
});

const show = play<S>(initial, [
  mark('Request'),
  wait(0.8),
  click('request', { requested: true }),
  move([560, 640]),
  wait(0.1),
  set({ phone: true, notif: true }),
  wait(1.1),
  mark('Pay on the phone'),
  tap('note', { sheet: true, notif: false }),
  wait(0.9),
  tap('pay', { paid: true }),
  wait(0.7),
  set({ sheet: false, phone: false }),
  wait(0.25),
  set({ collected: 80 }),
  wait(2.0),
  mark('New split'),
  click('reset', { requested: false, paid: false, collected: 40 }),
  wait(0.4),
  move(START),
  wait(0.6),
], { size: [W, H], layout, start: START, loop: true, cursors: { request: 'pointer', reset: 'pointer' } });

export const meta = { width: 1920, height: 1080, duration: show.duration, fps: 30, background: '#efeeec', shots: show.shots, loop: true };
export const params = { accent: { name: 'Accent', type: 'color' as const, default: '#db2777' } };
export async function setup() {}

const grow = springEase(6.5, 0.9);
const money = (n: number) => '$' + Math.round(n);

export function renderFrame(ctx: FrameContext, time: number, p: { accent: string }) {
  const ui = createKit(look('light', { accent: p.accent, accentSoft: '#fde7f1' })), L = ui.look, s = show.at(time), cur = s.cursor, scale = ctx.width / W;
  ctx.withCanvas(c0 => {
    const c = c0 as CanvasRenderingContext2D;
    ui.backdrop(c, ctx.width, ctx.height);
    withStage(c, s, g => {
      ui.window(g, WIN, { chrome: 'browser', url: 'kitty.app/split/nori', recede: s.on('phone') }, (w) => {
        ui.text(w, 'Dinner at Nori', CX, TOP + 58, { size: 30, weight: 600, role: 'keep' });
        ui.text(w, '3 people · $120.00', CX, TOP + 94, { size: 16, color: L.mute, role: 'keep' });
        ui.button(w, RESET, 'New split', { kind: 'secondary', icon: 'plus', size: 15, press: s.value('paid') ? cur.press : 0 });
        // collected so far
        const cp = s.pair('collected');
        ui.text(w, 'Collected', CX, TOP + 160, { size: 15, color: L.mute });
        const tw = ui.roll(w, cp.from, cp.to, cp.k, CX, TOP + 202, { size: 40, weight: 600, format: money });
        ui.text(w, 'of $120', CX + tw + 12, TOP + 208, { size: 18, color: L.mute, role: 'keep' });
        ui.fill(w, CX, TOP + 238, 720, 8, 4, L.hover); ui.fill(w, CX, TOP + 238, 720 * s.num('collected') / 120, 8, 4, L.accent);
        // people: Sam is the story; the others are quiet
        [['You', '#0e7490'], ['Sam', '#7c3aed'], ['', '#ca8a04']].forEach(([name, color], i) => {
          const y = ROW_Y(i);
          ui.avatar(w, CX + 18, y, 18, name ? name[0]! : '', color!);
          if (name) ui.text(w, name, CX + 50, y, { size: 17, weight: 600, role: 'keep' }); else ui.bar(w, CX + 50, y, 90);
          ui.text(w, '$40.00', CX + 340, y, { size: 16, weight: 500, role: i === 1 ? 'keep' : 'ui', color: L.mute });
          if (i !== 1) ui.badge(w, CX + 560, y, 'Paid', { size: 13, color: '#15803d', soft: '#dcfce7', k: i === 0 ? 1 : 1 });
          ui.hline(w, CX, y + 33, 720, L.line, 1);
        });
        // Sam's row: Request → Requested → Paid
        const y = ROW_Y(1), req = s.on('requested'), paid = s.is('paid', true);
        const btn = 1 - req;
        if (btn > 0.01) { w.save(); w.globalAlpha *= btn; ui.button(w, REQUEST, 'Request $40', { kind: 'primary', size: 15, press: s.value('requested') ? 0 : cur.press }); w.restore(); }
        if (req > 0.01 && paid < 0.99) ui.badge(w, CX + 560, y, 'Requested', { size: 13, k: req * (1 - paid) });
        if (paid > 0.01 && s.value('collected') === 80) ui.badge(w, CX + 560, y, 'Paid', { size: 13, color: '#15803d', soft: '#dcfce7', k: s.on('collected') > 0 ? clamp(pr(s.since('collected'), 0, 0.4)) : 1 });
      });
      // Sam's phone
      ui.phone(g, PHONE, (sc, w, h) => {
        ui.lockScreen(sc, w, h, { date: 'Friday, 9 May', time: '8:41', colors: ['#f5c2d3', '#c9b6e4'] });
        ui.notification(sc, NOTE, s.on('notif'), { app: 'Kitty', title: 'Ari requested $40', body: 'Dinner at Nori · tap to pay', time: 'now', color: p.accent });
        const sk = s.on('sheet');
        if (sk > 0.001) {
          const r = lerpRect([NOTE[0], NOTE[1], NOTE[2], NOTE[3]], [0, SHEET_Y, w, h - SHEET_Y], s.value('sheet') ? grow(clamp(pr(s.since('sheet'), 0, 0.55))) : 1);
          sc.save(); sc.globalAlpha *= clamp(sk * 2); sc.fillStyle = `rgba(0,0,0,${0.25 * sk})`; sc.fillRect(0, 0, w, h);
          ui.fill(sc, r[0], r[1], r[2], r[3], 28, '#ffffff');
          sc.translate(r[0], r[1]); const k = r[2] / w; sc.scale(k, k);
          ui.avatar(sc, w / 2, 48, 24, 'A', '#0e7490');
          ui.text(sc, 'Pay Ari', w / 2, 98, { size: 18, color: '#555', align: 'center', role: 'keep' });
          const paid = s.is('paid', true);
          ui.text(sc, '$40.00', w / 2, 146, { size: 44, weight: 600, color: '#111', align: 'center', role: 'keep' });
          const pb: Rect = [PAY[0], PAY[1] - SHEET_Y, PAY[2], PAY[3]];
          ui.fill(sc, pb[0], pb[1], pb[2], pb[3], 26, paid > 0.5 ? '#15803d' : p.accent);
          ui.text(sc, paid > 0.5 ? 'Paid' : 'Pay', w / 2, pb[1] + pb[3] / 2 + 1, { size: 18, weight: 600, color: '#ffffff', align: 'center', role: 'keep' });
          if (paid > 0.5) ui.icon(sc, 'check', w / 2 - 40, pb[1] + pb[3] / 2, 18, '#ffffff');
          sc.restore();
        }
      }, { time: '8:41' });
      ui.pointer(g, cur);
    }, scale);
  });
}
