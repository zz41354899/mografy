// Stage example: a hero loop for a fictional invoicing app, Kettle.
// One action carries the story: Mark paid → the amount flies into this month's total, which rolls up, and the camera
// leans in on it. A toast's Undo, clicked on screen, puts everything back, so the loop has no seam.
// Framing: the window pins to the top-left and runs off the right and bottom edges. Only story strings are words.
// The Variant parameter draws the same story the five ways faux UI fails (too much, too little, boxed, flat, bland),
// so the good version and each failure can be compared side by side. Keep the default, `good`, for real work.
import type { FrameContext } from '@mografy/runtime';
import { springEase, pr, clamp } from '@mografy/runtime';
import { play, wait, set, click, move, focus, mark, withStage, createKit, look, pin } from './stage.js';
import type { Rect, Point } from './stage.js';

const W = 1280, H = 720;          // design size; withStage scales it to the film
const START: Point = [880, 640];
const initial = { paid: false, total: 18400, toast: false };
type S = typeof initial;

// ---- layout: one place for every rect the script, the camera and the drawing share
const WIN = pin([W, H], [1260, 760], 'tl', [92, 72]);
const SIDE = 200;
const CX = WIN[0] + SIDE + 40, TOP = WIN[1] + 58;
const CARDS: Rect[] = [0, 1, 2].map(i => [CX + i * 316, TOP + 102, 296, 132]);
const ROW_Y = (i: number) => TOP + 336 + i * 62;
const ROW: Rect = [CX - 14, ROW_Y(1) - 31, 980, 62];
const AMOUNT: Rect = [CX + 500, ROW_Y(1) - 15, 70, 30];
const MARK_PAID: Rect = [CX + 760, ROW_Y(1) - 19, 128, 38];
const TOTAL: Rect = [CARDS[0]![0] + 22, CARDS[0]![1] + 52, 220, 58];
const TOAST_C: Point = [W / 2 + 40, H - 58];
const TOAST_W = 300;
const UNDO: Rect = [TOAST_C[0] + TOAST_W / 2 - 78, TOAST_C[1] - 22, 78, 44];
const layout = (s: S): Record<string, Rect> => ({ markPaid: MARK_PAID, total: TOTAL, row: ROW, ...(s.toast ? { undo: UNDO } : {}) });

const script = (camera: boolean) => play<S>(initial, [
  mark('Mark paid'),
  wait(0.9),
  click('markPaid', { paid: true }),
  wait(0.42),
  set({ total: 22600, toast: true }),
  ...(camera ? [focus<S>('total', 1.5, 1.1), wait<S>(2.1), focus<S>(null, 1, 1.0)] : [wait<S>(2.1), wait<S>(1.0)]),
  mark('Undo'),
  wait(0.5),
  click('undo', { paid: false, total: 18400, toast: false }),
  wait(0.5),
  move(START),
  wait(0.7),
], { size: [W, H], layout, start: START, loop: true, cursors: { markPaid: 'pointer', undo: 'pointer' } });
const show = script(true), still = script(false);   // "flat" also loses the camera push

export const meta = { width: 1920, height: 1080, duration: show.duration, fps: 30, background: '#efeeec', shots: show.shots, loop: true };
export const params = {
  look: { name: 'Look', type: 'enum' as const, default: 'light', options: ['light', 'dark', 'blueprint', 'minimal'] },
  accent: { name: 'Accent', type: 'color' as const, default: '#0f766e' },
  variant: { name: 'Variant', type: 'enum' as const, default: 'good', options: ['good', 'too-much', 'too-little', 'boxed', 'flat', 'bland'] },
};
type Variant = 'good' | 'too-much' | 'too-little' | 'boxed' | 'flat' | 'bland';
export async function setup() {}

const pop = springEase(7.5, 0.8);
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

const NAMES = ['Lumen Labs', 'Northwind Studio', 'Pinecrest Dental', 'Harbor & Vine', 'Atlas Freight', 'Quill Agency'];
const AMOUNTS = ['$1,850', '$4,200', '$960', '$3,375', '$12,400', '$720'];
const STATUS = ['Paid', 'Overdue', 'Draft', 'Sent', 'Paid', 'Sent'];

export function renderFrame(ctx: FrameContext, time: number, p: { look: 'light' | 'dark' | 'blueprint' | 'minimal'; accent: string; variant: Variant }) {
  const v = p.variant ?? 'good';
  const base = look(p.look, p.look === 'light' || p.look === 'minimal' ? { accent: p.accent, accentSoft: p.accent + '1f' } : {});
  // too little: a wireframe; too much: every word; bland: the defaults nobody chose
  const lk = v === 'too-little' ? { ...base, words: 'none' as const, accent: '#b8b8b4', accentSoft: '#ececea' }
    : v === 'too-much' ? { ...base, words: 'all' as const }
    : v === 'bland' ? { ...base, accent: '#3b82f6', accentSoft: '#dbeafe', font: 'Arial, Helvetica, sans-serif', radius: 4, shadowStrength: 0, bg: '#ffffff', bg2: '#ffffff', sidebar: '#ffffff' }
    : base;
  const busy = v === 'too-much' || v === 'flat';
  const ui = createKit(lk), L = ui.look, s = (v === 'flat' ? still : show).at(time), cur = s.cursor, scale = ctx.width / W;
  ctx.withCanvas(c => {
    const g = c as CanvasRenderingContext2D;
    ui.backdrop(g, ctx.width, ctx.height);
    if (v === 'boxed') { g.save(); g.translate(ctx.width / 2, ctx.height / 2); g.scale(0.6, 0.6); g.translate(-ctx.width / 2 - 92 * scale * 0.9, -ctx.height / 2 - 40 * scale); }
    withStage(g, s, c2 => {
      ui.window(c2, WIN, { chrome: 'app', sidebar: SIDE }, (c3, b) => {
        // sidebar: the brand and real nav labels say what product this is; the rest are lines
        ui.nav(c3, b.sidebar!, { brand: 'Kettle', mark: L.accent, items: busy ? [['home', 'Overview'], ['doc', 'Invoices'], ['users', 'Clients'], ['chart', 'Reports'], ['card', 'Payments'], ['settings', 'Settings']] : [['home', 'Overview'], ['doc', 'Invoices'], ['users', 'Clients'], ['chart', 'Reports']], active: 1, filler: busy ? 0 : 3 });
        // header
        ui.text(c3, 'Invoices', CX, TOP + 50, { size: 30, weight: 600, role: 'keep' });
        ui.button(c3, [CX + 742, TOP + 28, 160, 42], 'New invoice', { kind: 'secondary', icon: 'plus', size: 15 });
        // stat cards: one real number, two quiet cards
        CARDS.forEach((r, i) => {
          ui.fill(c3, r[0], r[1], r[2], r[3], 14, L.surface); ui.stroke(c3, r[0], r[1], r[2], r[3], 14, L.line);
          if (i === 0) {
            ui.text(c3, 'Collected in May', r[0] + 22, r[1] + 32, { size: 15, color: L.mute, max: 170 });
            const tp = s.pair('total');
            ui.roll(c3, tp.from, tp.to, tp.k, TOTAL[0], TOTAL[1] + 30, { size: 42, weight: 600, format: money });
            const up = s.on('toast'), bw = ui.measure(c3, '+$4,200', { size: 13, weight: 600 }) + 13 * 2.2;
            ui.badge(c3, r[0] + r[2] - 22 - bw, r[1] + 32, '+$4,200', { k: up, size: 13 });
          } else if (busy) {
            ui.text(c3, ['Outstanding', 'Overdue'][i - 1]!, r[0] + 22, r[1] + 32, { size: 15, color: L.mute });
            ui.text(c3, ['$9,135', '$4,200'][i - 1]!, r[0] + 22, r[1] + 82, { size: v === 'flat' ? 42 : 36, weight: 600, role: 'keep' });
            ui.text(c3, ['14 invoices · 3 due this week', '2 clients · avg 12 days late'][i - 1]!, r[0] + 22, r[1] + 112, { size: 13, color: L.mute });
          } else { ui.bar(c3, r[0] + 22, r[1] + 32, [96, 76][i - 1]!, 8); ui.bar(c3, r[0] + 22, r[1] + 84, [150, 120][i - 1]!, 22, L.hover); }
        });
        // table
        if (busy) ['Client', 'Amount', 'Status', 'Due', 'Method'].forEach((h, i) => ui.text(c3, h, [CX, CX + 500, CX + 640, CX + 260, CX + 380][i]!, TOP + 284, { size: 13, weight: 600, color: L.mute }));
        else { ui.bar(c3, CX, TOP + 284, 70, 8); ui.bar(c3, CX + 500, TOP + 284, 54, 8); ui.bar(c3, CX + 640, TOP + 284, 48, 8); }
        ui.hline(c3, CX - 14, TOP + 302, 1000);
        for (let i = 0; i < 6; i++) {
          const y = ROW_Y(i), focal = i === 1;
          const hover = focal && v !== 'flat' && cur.x > ROW[0] && cur.x < ROW[0] + ROW[2] && cur.y > ROW[1] && cur.y < ROW[1] + ROW[3] ? 1 : 0;
          if (hover) ui.fill(c3, ROW[0], ROW[1] + 3, ROW[2], ROW[3] - 6, 10, L.hover);
          ui.avatar(c3, CX + 16, y, 15, '', v === 'bland' || v === 'too-little' ? '#c4c4c4' : ['#6d28d9', '#c2410c', '#2563eb', '#0d9488', '#ca8a04', '#db2777'][i]!);
          if (busy && !focal) {
            // every row spelled out, at the same weight as the one that matters
            ui.text(c3, NAMES[i]!, CX + 46, y - 9, { size: 16, weight: 600, role: 'keep', max: 200, fit: 'ellipsis' });
            ui.text(c3, `INV-20${30 + i}`, CX + 46, y + 12, { size: 13, color: L.mute });
            ui.text(c3, ['May 2', 'May 9', '—', 'May 30', 'May 4', 'Jun 2'][i]!, CX + 260, y, { size: 14, color: L.mute });
            ui.text(c3, ['ACH', 'Card', '—', 'Card', 'Wire', 'ACH'][i]!, CX + 380, y, { size: 14, color: L.mute });
            ui.text(c3, AMOUNTS[i]!, CX + 500, y, { size: 16, weight: 600, role: 'keep' });
            ui.badge(c3, CX + 640, y, STATUS[i]!, { size: 13, color: STATUS[i] === 'Paid' ? '#15803d' : STATUS[i] === 'Draft' ? '#6b7280' : '#1d4ed8', soft: STATUS[i] === 'Paid' ? '#dcfce7' : STATUS[i] === 'Draft' ? '#f3f4f6' : '#dbeafe' });
            if (v === 'flat') ui.button(c3, [MARK_PAID[0], y - 19, MARK_PAID[2], 38], 'Mark paid', { kind: 'primary', size: 15 });
          } else if (focal) {
            ui.text(c3, 'Northwind Studio', CX + 46, y - 9, { size: 16, weight: 600, role: 'keep', max: 240 });
            ui.text(c3, 'INV-2041', CX + 46, y + 12, { size: 13, color: L.mute, max: 160 });
            if (busy) { ui.text(c3, 'May 9', CX + 260, y, { size: 14, color: L.mute }); ui.text(c3, 'Card', CX + 380, y, { size: 14, color: L.mute }); }
            ui.text(c3, '$4,200', AMOUNT[0], y, { size: 16, weight: 600, role: 'keep' });
            const paid = s.is('paid', true), over = 1 - paid;
            if (over > 0.01) ui.badge(c3, CX + 640, y, 'Overdue', { k: over, size: 13, color: '#b42318', soft: L.dark ? '#3a1d1b' : '#fde8e7' });
            if (paid > 0.01) ui.badge(c3, CX + 640, y, 'Paid', { k: paid, size: 13 });
            const markK = 1 - s.on('paid');
            if (markK > 0.01) { c3.save(); c3.globalAlpha *= markK; ui.button(c3, MARK_PAID, 'Mark paid', { kind: 'primary', press: s.value('paid') ? 0 : cur.press, size: 15 }); c3.restore(); }
          } else {
            ui.bar(c3, CX + 46, y - 7, [120, 0, 150, 96, 136, 112][i]!, 9); ui.bar(c3, CX + 46, y + 12, 64, 7, L.hover);
            ui.bar(c3, CX + 500, y, [54, 0, 64, 50, 58, 46][i]!, 9);
            ui.bar(c3, CX + 640, y, 58, 20, L.hover);
          }
          if (i < 5) ui.hline(c3, CX - 14, y + 31, 1000);
        }
      });
      // the amount flies into the total: a copy of the row's figure, landing where the number rolls
      if (s.value('paid')) {
        const k = clamp(pr(s.since('paid'), 0, 0.62));
        if (k < 1) ui.fly(c2, [AMOUNT[0] - 12, AMOUNT[1] - 4, 94, 38], [TOTAL[0], TOTAL[1] + 6, 140, 48], pop(k), (c4, w, h) => {
          c4.save(); c4.globalAlpha *= 1 - pr(k, 0.82, 1);
          ui.fill(c4, 0, 0, w, h, 12, L.accentSoft); ui.text(c4, '$4,200', w / 2, h / 2 + 1, { size: 21, weight: 600, color: L.accent, align: 'center', role: 'keep' });
          c4.restore();
        });
      }
      // toast with Undo: the cause of the reset
      const tk = s.on('toast');
      if (tk > 0.01) {
        ui.toast(c2, TOAST_C[0], TOAST_C[1], 'Payment recorded', tk, { icon: 'check', action: 'Undo', width: TOAST_W, size: 16 });
      }
      ui.pointer(c2, cur);
    }, scale);
    if (v === 'boxed') g.restore();
  });
}
