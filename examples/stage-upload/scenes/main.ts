// Stage example: an API-docs diagram in the blueprint look, for a fictional storage service, Satchel.
// What the system does on its own, so there is no cursor: a file goes from your app to a shareable link, and one
// short annotation per hop says the thing a developer needs to know. Then it fades back to the empty diagram.
import type { FrameContext } from '@mografy/runtime';
import { clamp, lerp, pr, stagger } from '@mografy/runtime';
import { play, wait, set, mark, withStage, createKit, look } from './stage.js';
import type { Rect, Point, IconName } from './stage.js';

const W = 1280, H = 720;
const initial = { step: 0, n1: false, n2: false, n3: false, link: false };
type S = typeof initial;

const Y = 400, NODE_W = 190, NODE_H = 100;
const NODES: [string, IconName, number][] = [['Your app', 'home', 130], ['Upload API', 'send', 395], ['Storage', 'inbox', 660], ['Edge cache', 'clock', 925], ['Viewer', 'users', 1160]];
const nodeRect = (i: number): Rect => [NODES[i]![2] - NODE_W / 2, Y - NODE_H / 2, NODE_W, NODE_H];
const port = (i: number, side: 1 | -1): Point => [NODES[i]![2] + side * NODE_W / 2, Y];

const show = play<S>(initial, [
  mark('Upload'),
  wait(0.7),
  set({ step: 1 }, { duration: 0.9 }), set({ n1: true }),
  wait(1.3),
  set({ step: 2 }, { duration: 1.1 }), set({ n2: true }),
  wait(1.3),
  set({ step: 3 }, { duration: 0.9 }), set({ n3: true }),
  wait(1.1),
  mark('Shareable link'),
  set({ step: 4 }, { duration: 0.8 }), set({ link: true }),
  wait(2.0),
  set({ step: 0, n1: false, n2: false, n3: false, link: false }, { duration: 0.5 }),
  wait(1.0),
], { size: [W, H], layout: () => ({}), loop: true, pointer: false });

export const meta = { width: 1920, height: 1080, duration: show.duration, fps: 30, background: '#0f2d52', shots: show.shots, loop: true };
export const params = { look: { name: 'Look', type: 'enum' as const, default: 'blueprint', options: ['blueprint', 'light', 'dark'] } };
export async function setup() {}

export function renderFrame(ctx: FrameContext, time: number, p: { look: 'blueprint' | 'light' | 'dark' }) {
  const ui = createKit(look(p.look)), L = ui.look, s = show.at(time), scale = ctx.width / W;
  const lit = L.outline ? '#ffffff' : L.dark ? '#f4f4f5' : '#0f766e';
  ctx.withCanvas(c0 => {
    const c = c0 as CanvasRenderingContext2D;
    ui.backdrop(c, ctx.width, ctx.height);
    withStage(c, s, g => {
      // a quiet grid, as on a drawing
      if (L.outline) { g.save(); g.globalAlpha = 0.18; for (let x = 0; x <= W; x += 40) ui.vline(g, x, 0, H, L.line, 1); for (let y = 0; y <= H; y += 40) ui.hline(g, 0, y, W, L.line, 1); g.restore(); }
      ui.text(g, 'From your app to a link', 64, 96, { size: 36, weight: 600, role: 'keep' });
      ui.text(g, 'Satchel · uploads', 64, 138, { size: 18, color: L.mute, role: 'keep' });

      // connectors
      for (let i = 0; i < NODES.length - 1; i++) {
        const a = port(i, 1), b = port(i + 1, -1);
        ui.hline(g, a[0], Y, b[0] - a[0], L.line, 2);
        g.save(); g.fillStyle = L.line; g.beginPath(); g.moveTo(b[0], Y); g.lineTo(b[0] - 9, Y - 5); g.lineTo(b[0] - 9, Y + 5); g.closePath(); g.fill(); g.restore();
      }
      // nodes: the active one lights
      const live = s.value('step') > 0 ? s.num('step') : 0;
      NODES.forEach(([label, icon], i) => {
        const r = nodeRect(i), on = clamp(1 - Math.abs(live - i) * 1.5) * (s.value('step') > 0 || i === 0 ? 1 : 0);
        ui.card(g, r, { radius: 14, fill: L.window });
        if (on > 0.01) { g.save(); g.globalAlpha *= on; ui.stroke(g, r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6, 16, lit, 2); g.restore(); }
        ui.icon(g, icon, r[0] + 30, r[1] + 34, 22, on > 0.5 ? lit : L.mute);
        ui.text(g, label, r[0] + 52, r[1] + 35, { size: 18, weight: 600, role: 'keep', max: NODE_W - 64 });
        ui.bar(g, r[0] + 22, r[1] + 70, [80, 96, 70, 88, 76][i]!, 8);
      });
      // packets along the line; hop 1→2 carries three chunks
      const stepNow = s.value('step'), fading = stepNow === 0 && s.since('step') < 0.35;
      const f = stepNow > 0 ? s.num('step') : fading ? s.prev('step') : -1;
      const alpha = stepNow > 0 ? 1 : fading ? 1 - pr(s.since('step'), 0, 0.3) : 0;
      if (f > 0 && alpha > 0) {
        const hop = Math.min(3, Math.floor(f - 1e-6)), u = f - hop, a = port(hop, 1), b = port(hop + 1, -1);
        const n = hop === 1 ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const uk = clamp((u - stagger(k, n, 0.16)) / (1 - 0.32 * (n > 1 ? 1 : 0)));
          if (uk <= 0 || uk >= 1) continue;
          g.save(); g.globalAlpha *= alpha; ui.dot(g, lerp(a[0], b[0], uk), Y, 6, lit); g.globalAlpha *= 0.25; ui.dot(g, lerp(a[0], b[0], uk), Y, 13, lit); g.restore();
        }
      }
      // one annotation per hop
      const mid = (i: number): Point => [(port(i, 1)[0] + port(i + 1, -1)[0]) / 2, Y];
      ui.callout(g, [mid(0)[0], Y - 6], [mid(0)[0], Y - 120], 'Signed URL, valid 15 min', s.on('n1'), { side: 'above', size: 16 });
      ui.callout(g, [mid(1)[0], Y + 6], [mid(1)[0], Y + 120], 'Resumable 8 MB chunks', s.on('n2'), { side: 'below', size: 16 });
      ui.callout(g, [mid(2)[0], Y - 6], [mid(2)[0], Y - 120], 'Cached at the edge', s.on('n3'), { side: 'above', size: 16 });
      // the result: a link under the viewer
      const lk = s.on('link');
      if (lk > 0.001) {
        const r = nodeRect(4), label = 'satchel.link/x7Q2', w = ui.measure(g, label, { size: 15, weight: 600 }) + 52;
        g.save(); g.globalAlpha *= clamp(lk * 1.4); g.translate(0, (1 - lk) * 10);
        ui.fill(g, r[0] + r[2] / 2 - w / 2, r[1] + r[3] + 26, w, 38, 19, lit);
        ui.icon(g, 'check', r[0] + r[2] / 2 - w / 2 + 22, r[1] + r[3] + 45, 15, L.outline ? L.bg : '#ffffff');
        ui.text(g, label, r[0] + r[2] / 2 - w / 2 + 38, r[1] + r[3] + 46, { size: 15, weight: 600, color: L.outline ? L.bg : '#ffffff', role: 'keep' });
        g.restore();
      }
    }, scale);
  });
}
