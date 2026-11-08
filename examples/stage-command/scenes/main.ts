// Stage example: a keyboard-only moment in a fictional issue tracker, Keel. ⌘K opens the palette, "assign" filters
// it, Return assigns the issue and the avatar flies into the Assignee field while the camera leans in. ⌘Z undoes it,
// which is the loop. No cursor: the keycaps at the bottom are the cause of every change.
import type { FrameContext } from '@mografy/runtime';
import { clamp, ease, pr, springEase } from '@mografy/runtime';
import { play, wait, set, type, focus, mark, withStage, createKit, look, pin, blink } from './stage.js';
import type { Rect } from './stage.js';

const W = 1280, H = 720;
const initial = { keys: '', palette: false, query: '', assignee: '' };
type S = typeof initial;

// ---- layout
const WIN = pin([W, H], [1240, 780], 'tl', [70, 60]);
const SIDE = 210, CX = WIN[0] + 12 + SIDE + 56, TOP = WIN[1] + 76;
const ROW_Y = (i: number) => TOP + 170 + i * 52;
const ASSIGNEE: Rect = [CX + 140, ROW_Y(1) - 18, 220, 36];
const PAL: Rect = [W / 2 - 250 + 90, 150, 500, 290];
const ITEM = (i: number): Rect => [PAL[0] + 10, PAL[1] + 72 + i * 48, PAL[2] - 20, 44];
const layout = (): Record<string, Rect> => ({ assignee: [ASSIGNEE[0] - 40, ASSIGNEE[1] - 60, 360, 160] });

const show = play<S>(initial, [
  mark('⌘K'),
  wait(0.9),
  set({ keys: 'cmdk' }), wait(0.22), set({ palette: true }), wait(0.3), set({ keys: '' }),
  type('query', 'assign', 13), wait(0.3),
  mark('Assign'),
  set({ keys: 'enter' }), wait(0.18), set({ palette: false, assignee: 'me' }), wait(0.2), set({ keys: '' }),
  focus('assignee', 1.6, 1.0), wait(2.0), focus(null, 1, 0.9),
  wait(0.4),
  mark('⌘Z'),
  set({ keys: 'undo' }), wait(0.22), set({ assignee: '', query: '' }), wait(0.25), set({ keys: '' }),
  wait(0.9),
], { size: [W, H], layout, loop: true, pointer: false });

export const meta = { width: 1920, height: 1080, duration: show.duration, fps: 30, background: '#efeeec', shots: show.shots, loop: true };
export const params = { accent: { name: 'Accent', type: 'color' as const, default: '#6d28d9' } };
export async function setup() {}

const pop = springEase(7.5, 0.8);
const ITEMS = ['Assign to me', 'Assign to…', 'Change status', 'Set priority', 'Copy link'];

export function renderFrame(ctx: FrameContext, time: number, p: { accent: string }) {
  const ui = createKit(look('light', { accent: p.accent, accentSoft: '#efe9fc' })), L = ui.look, s = show.at(time), scale = ctx.width / W;
  const assigned = s.is('assignee', 'me');
  ctx.withCanvas(c0 => {
    const c = c0 as CanvasRenderingContext2D;
    ui.backdrop(c, ctx.width, ctx.height);
    withStage(c, s, g => {
      ui.window(g, WIN, { chrome: 'tahoe', sidebar: SIDE }, (w, b) => {
        ui.nav(w, b.sidebar!, { brand: 'Keel', mark: L.accent, items: [['inbox', 'Inbox'], ['doc', 'Issues'], ['chart', 'Cycles'], ['users', 'Team']], active: 1, top: 104 });
        ui.text(w, 'KEL-482', CX, TOP + 50, { size: 14, color: L.mute, role: 'keep' });
        ui.text(w, 'Checkout fails on Safari 17', CX, TOP + 92, { size: 30, weight: 600, role: 'keep', max: 760 });
        // properties: Status and Assignee are words, the rest are lines
        ui.text(w, 'Status', CX, ROW_Y(0), { size: 15, color: L.mute });
        ui.badge(w, CX + 140, ROW_Y(0), 'In progress', { size: 13, color: '#b45309', soft: '#fef3c7' });
        ui.text(w, 'Assignee', CX, ROW_Y(1), { size: 15, color: L.mute });
        const un = 1 - assigned;
        if (un > 0.01) { w.save(); w.globalAlpha *= un; ui.stroke(w, ASSIGNEE[0], ASSIGNEE[1] + 4, 28, 28, 14, L.faint, 1.5); ui.text(w, 'Unassigned', ASSIGNEE[0] + 40, ROW_Y(1), { size: 15, color: L.faint, role: 'keep' }); w.restore(); }
        if (s.value('assignee') === 'me' && s.since('assignee') > 0.5 || (s.value('assignee') === '' && assigned > 0.01)) {
          w.save(); w.globalAlpha *= assigned; ui.avatar(w, ASSIGNEE[0] + 14, ROW_Y(1), 14, 'NC', '#0e7490'); ui.text(w, 'You', ASSIGNEE[0] + 40, ROW_Y(1), { size: 15, weight: 600, role: 'keep' }); w.restore();
        }
        for (let i = 2; i < 5; i++) { ui.bar(w, CX, ROW_Y(i), 70, 8); ui.bar(w, CX + 140, ROW_Y(i), [110, 80, 140][i - 2]!, 8); }
        ui.hline(w, CX, ROW_Y(4) + 40, 800);
        ui.bars(w, CX, ROW_Y(4) + 84, [620, 700, 540, 660, 380], 30, 9);
      });
      // the palette: grows from its top edge, filters as you type
      const pk = s.on('palette', { duration: 0.4 });
      if (pk > 0.001) { g.save(); g.globalAlpha = 0.14 * clamp(pk); ui.fill(g, 0, 0, W, H, 0, '#1d1d1f'); g.restore(); }
      ui.menu(g, PAL, pk, (m, r) => {
        const q = String(s.value('query'));
        ui.icon(m, 'search', r[0] + 30, r[1] + 32, 20, L.mute);
        if (q) ui.text(m, q, r[0] + 56, r[1] + 33, { size: 19, role: 'keep' }); else ui.text(m, 'Type a command…', r[0] + 56, r[1] + 33, { size: 19, color: L.faint, role: 'keep' });
        if (s.value('palette')) ui.fill(m, r[0] + 56 + (q ? ui.measure(m, q, { size: 19 }) : 0) + 2, r[1] + 21, 2, 24, 1, q || blink(time) ? L.accent : 'rgba(0,0,0,0)');
        ui.hline(m, r[0], r[1] + 62, r[2]);
        const shown = q.length >= 2 ? ITEMS.filter(x => x.toLowerCase().includes(q)) : ITEMS;
        shown.forEach((label, i) => {
          const it = ITEM(i);
          if (i === 0) ui.fill(m, it[0], it[1], it[2], it[3], 10, L.accentSoft);
          ui.icon(m, i < 2 ? 'users' : 'dots', it[0] + 24, it[1] + 22, 18, i === 0 ? L.accent : L.mute);
          ui.text(m, label, it[0] + 48, it[1] + 23, { size: 16, weight: i === 0 ? 600 : 500, color: i === 0 ? L.ink : L.mute, role: i < 2 || q ? 'keep' : 'ui' });
          if (i === 0) ui.text(m, '↵', it[0] + it[2] - 22, it[1] + 23, { size: 15, color: L.mute, role: 'keep', align: 'right' });
        });
      });
      // the avatar flies from the chosen row into the field
      if (s.value('assignee') === 'me' && s.since('assignee') <= 0.5) {
        const k = clamp(pr(s.since('assignee'), 0, 0.5));
        const from = ITEM(0), to: Rect = [ASSIGNEE[0], ASSIGNEE[1] + 4, 28, 28];
        ui.fly(g, [from[0] + 10, from[1] + 8, 28, 28], to, pop(k), f => ui.avatar(f, 14, 14, 14, 'NC', '#0e7490'), { lift: 60 });
      }
    }, scale);
    // keycaps: outside the camera, at the bottom of the frame
    const keys = String(s.value('keys')), prevKeys = String(s.prev('keys'));
    const shown = keys || prevKeys, on = keys ? ease.inOutCubic(clamp(pr(s.since('keys'), 0, 0.16))) : 1 - ease.inOutCubic(clamp(pr(s.since('keys'), 0.1, 0.35)));
    if (shown && on > 0.001) {
      const caps = shown === 'cmdk' ? ['⌘', 'K'] : shown === 'enter' ? ['↵'] : ['⌘', 'Z'];
      c.save(); c.scale(scale, scale); c.globalAlpha *= on;
      const size = 54, gap = 12, total = caps.length * size + (caps.length - 1) * gap;
      caps.forEach((label, i) => ui.key(c, W / 2 - total / 2 + i * (size + gap), H - 112 + (1 - on) * 10, label, { press: keys ? clamp(pr(s.since('keys'), 0.05, 0.15)) : 0, size }));
      c.restore();
    }
  });
}
