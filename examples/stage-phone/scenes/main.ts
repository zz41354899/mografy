// Stage example: a 9:16 loop for a fictional team chat app, Wren, driven by touch.
// A message lands on the lock screen; a tap opens it, and the notification grows into the conversation as one object;
// a reply is typed and sent; a press on the side button locks the phone, which is where the loop began.
// Framing: the phone is cropped by the bottom edge, never shown whole. Only the story's strings are words.
import type { FrameContext } from '@mografy/runtime';
import { clamp, lerp, pr, springEase } from '@mografy/runtime';
import { play, wait, set, tap, type, mark, withStage, createKit, look, lerpRect, blink } from './stage.js';
import type { Rect, Kit } from './stage.js';

const W = 720, H = 1280;            // design size for 9:16; withStage scales it to 1080 × 1920
const initial = { notif: false, open: false, draft: '', sent: false, locked: true };
type S = typeof initial;

// ---- layout (stage coordinates)
const PHONE: Rect = [104, 250, 512, 1100];                  // runs off the bottom edge
const BEZ = PHONE[2] * 0.032, SX = PHONE[0] + BEZ, SY = PHONE[1] + BEZ, SW = PHONE[2] - 2 * BEZ, SH = PHONE[3] - 2 * BEZ;
const NOTE: Rect = [16, 318, SW - 32, 104];                 // screen coordinates
const FIELD: Rect = [20, SH - 176, SW - 96, 56];
const SEND: Rect = [SW - 66, SH - 174, 52, 52];
const SIDE: Rect = [PHONE[0] + PHONE[2] - 2, PHONE[1] + 250, 8, 110];
const onStage = (r: Rect): Rect => [SX + r[0], SY + r[1], r[2], r[3]];
const layout = (s: S): Record<string, Rect> => ({
  note: onStage(NOTE), ...(s.open ? { send: onStage(SEND), field: onStage(FIELD) } : {}), side: [SIDE[0] - 14, SIDE[1], 30, SIDE[3]],
});

const show = play<S>(initial, [
  mark('Message arrives'),
  wait(0.7),
  set({ notif: true }),
  wait(1.3),
  mark('Open and reply'),
  tap('note', { open: true, locked: false }),
  wait(0.8),
  type('draft', 'On my way, 5 min'),
  wait(0.25),
  tap('send', { sent: true, draft: '' }),
  wait(1.6),
  mark('Lock'),
  tap('side', { locked: true, open: false, sent: false, notif: false }),
  wait(1.0),
], { size: [W, H], layout, loop: true, start: [W / 2, H / 2] });

export const meta = { width: 1080, height: 1920, duration: show.duration, fps: 30, background: '#e9e8e5', shots: show.shots, loop: true };
export const params = {
  look: { name: 'Look', type: 'enum' as const, default: 'light', options: ['light', 'dark'] },
  accent: { name: 'Accent', type: 'color' as const, default: '#4f46e5' },
};
export async function setup() {}

const grow = springEase(6.5, 0.85);

function conversation(ui: Kit, c: CanvasRenderingContext2D, s: ReturnType<typeof show.at>, w: number, h: number, accent: string) {
  const L = ui.look;
  c.fillStyle = L.dark ? '#0f0f11' : '#f6f6f4'; c.fillRect(0, 0, w, h);
  // header
  c.fillStyle = L.dark ? '#18181b' : '#ffffff'; c.fillRect(0, 0, w, 150); ui.hline(c, 0, 150, w);
  ui.icon(c, 'chevron', 32, 112, 22, accent);
  ui.avatar(c, 84, 112, 22, 'AC', '#d97706');
  ui.text(c, 'Ava Chen', 118, 103, { size: 19, weight: 600, role: 'keep' });
  ui.text(c, '#launch', 118, 125, { size: 14, color: L.mute });
  // history: placeholders, then the message that arrived, sitting just above the composer like a real thread
  const bubble = (x: number, y: number, bw: number, bh: number, mine: boolean) => ui.fill(c, x, y, bw, bh, 20, mine ? accent : L.dark ? '#26262a' : '#ffffff');
  const soft = L.dark ? '#3a3a40' : '#e6e6e3', OY = 300;
  bubble(20, 186, 280, 84, false); ui.bars(c, 40, 210, [220, 180, 120], 18, 8, soft);
  bubble(w - 200, 286, 180, 48, true); ui.bar(c, w - 180, 310, 120, 8, 'rgba(255,255,255,.45)');
  ui.bar(c, w / 2 - 30, 380, 60, 8, soft);
  bubble(20, 190 + OY, 250, 64, false); ui.bars(c, 40, 212 + OY, [190, 120], 20, 8, soft);
  bubble(w - 230, 274 + OY, 210, 48, true); ui.bar(c, w - 210, 298 + OY, 150, 8, 'rgba(255,255,255,.45)');
  bubble(20, 346 + OY, 312, 58, false);
  ui.text(c, 'Doors open at 4. Coming?', 40, 375 + OY, { size: 17, role: 'keep', max: 272 });
  // the reply: forms out of the field and rises into place
  const sentK = s.is('sent', true);
  if (sentK > 0.001) {
    const from: Rect = [FIELD[0], FIELD[1], FIELD[2], FIELD[3]], to: Rect = [w - 236, 424 + OY, 216, 52];
    const r = lerpRect(from, to, grow(clamp(pr(s.since('sent'), 0, 0.55)) * (s.value('sent') ? 1 : 0)));
    c.save(); c.globalAlpha *= clamp(sentK * 1.3);
    ui.fill(c, r[0], r[1], r[2], r[3], 22, accent);
    ui.text(c, 'On my way, 5 min', r[0] + r[2] / 2, r[1] + r[3] / 2 + 1, { size: 17, color: '#ffffff', align: 'center', role: 'keep' });
    const tick = pr(s.since('sent'), 0.7, 1.0);
    ui.text(c, tick < 1 ? 'Sent' : 'Read', w - 22, 494 + OY, { size: 13, color: L.mute, align: 'right', role: 'keep' });
    c.restore();
  }
  // composer
  c.fillStyle = L.dark ? '#18181b' : '#ffffff'; c.fillRect(0, SH - 206, w, 206); ui.hline(c, 0, SH - 206, w);
  const draft = String(s.value('draft'));
  ui.field(c, FIELD, { value: draft, placeholder: 'Message Ava', focus: draft ? 1 : 0, caret: draft !== '' || (s.value('open') && !s.value('sent') && blink(s.time)), size: 17 });
  const ready = draft ? 1 : 0.35;
  c.save(); c.globalAlpha *= ready; ui.dot(c, SEND[0] + 26, SEND[1] + 26, 26, accent); ui.icon(c, 'arrow', SEND[0] + 26, SEND[1] + 26, 20, '#ffffff'); c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: { look: 'light' | 'dark'; accent: string }) {
  const ui = createKit(look(p.look, { accent: p.accent })), L = ui.look, s = show.at(time), scale = ctx.width / W;
  ctx.withCanvas(c0 => {
    const c = c0 as CanvasRenderingContext2D;
    ui.backdrop(c, ctx.width, ctx.height);
    withStage(c, s, g => {
      // headline: one line, above the phone
      ui.text(g, 'Reply before you unlock.', W / 2, 120, { size: 40, weight: 600, align: 'center', role: 'keep', max: 640 });
      ui.text(g, 'Wren for teams', W / 2, 172, { size: 20, color: L.mute, align: 'center', role: 'keep' });
      // side button: pressed to lock
      const lockPress = s.since('locked') < 0.3 && s.value('locked') ? Math.sin(Math.PI * pr(s.since('locked'), 0, 0.3)) : 0;
      ui.fill(g, SIDE[0] - 4 * lockPress, SIDE[1], SIDE[2], SIDE[3], 3, '#16161a');
      ui.phone(g, PHONE, (sc, w, h) => {
        const open = s.is('open', true);
        ui.lockScreen(sc, w, h, { date: 'Thursday, 14 May', time: '3:52', colors: L.dark ? ['#1f2937', '#312e81'] : ['#a7b4dc', '#c2b2d9'] });
        // the notification, then the same object growing into the conversation
        const noteIn = s.on('notif') * (1 - open);
        ui.notification(sc, NOTE, noteIn, { app: 'Wren', title: 'Ava Chen  ·  #launch', body: 'Doors open at 4. Coming?', time: 'now', color: p.accent });
        if (open > 0.001) {
          const k = s.value('open') ? grow(clamp(pr(s.since('open'), 0, 0.62))) : 1;   // locking: no shrink, it fades under the dim
          const r = lerpRect(NOTE, [0, 0, w, h], k), rad = lerp(NOTE[3] * 0.26, w * 0.13, k);
          sc.save(); ui.rr(sc, r[0], r[1], r[2], r[3], rad); sc.clip();
          sc.globalAlpha *= s.value('open') ? clamp(open * 3) : 1 - pr(s.since('open'), 0.12, 0.3);
          sc.translate(r[0], r[1]); sc.scale(r[2] / w, r[2] / w);
          conversation(ui, sc, s, w, h, p.accent);
          sc.restore();
        }
        // screen lock: a quick dim as the side button lands
        const dim = s.value('locked') && s.since('locked') < 0.7 ? Math.sin(Math.PI * pr(s.since('locked'), 0, 0.7)) ** 2 * 0.6 : 0;
        if (dim > 0) { sc.fillStyle = `rgba(0,0,0,${dim})`; sc.fillRect(0, 0, w, h); }
      }, { time: '3:52', dark: s.is('open', true) > 0.5 && !L.dark ? false : true });
      ui.pointer(g, s.cursor);
    }, scale);
  });
}
