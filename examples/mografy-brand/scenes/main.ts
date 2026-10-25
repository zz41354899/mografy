import { clamp, pr } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';
import { setupFrame, scope, at, spring, inOut, inOutQuart, outQuint, mix, TEAL } from './kit.js';
import { LOGO_PIECES } from './logo.js';

export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#121417' };
export const params = {};
export async function setup() {}

// Official geometry, untouched. Inverse lockup on charcoal: ink → white, ribbon keeps #12B5A5.
const PIECES = LOGO_PIECES.map(p => ({ ...p, path: new Path2D(p.d), fill: p.color.toUpperCase() === '#12B5A5' ? TEAL : '#FFFFFF' }));
const LOGO = { x0: 15.2, y0: 26.5, x1: 1147.5, y1: 226 };
const MARK = { x0: 15.2, y0: 26.5, x1: 403.5, y1: 226 };

// Centerline of the ribbon (SVG units), traced from its medial axis, plus a lead-in from off frame.
const SPINE: [number, number][] = [[79, 52], [96, 48], [115, 46.5], [134, 49.5], [152, 56], [166, 72], [178, 92], [190, 116], [202, 140], [214, 160], [228, 170], [244, 160], [258, 138], [270, 116], [280, 102], [287, 96]];
const LEAD: [number, number][] = [[-640, 210], [-470, 250], [-300, 210], [-150, 120], [-40, 64], [30, 52]];
function smoothPolyline(points: [number, number][], steps = 10) {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!, p1 = points[i]!, p2 = points[i + 1]!, p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}
const TRACK = smoothPolyline([...LEAD, ...SPINE]);
const CUM = TRACK.reduce<number[]>((acc, p, i) => (acc.push(i ? acc[i - 1]! + Math.hypot(p[0] - TRACK[i - 1]![0], p[1] - TRACK[i - 1]![1]) : 0), acc), []);
const TOTAL = CUM[CUM.length - 1]!;
const SPINE_START = CUM[TRACK.findIndex(p => p[0] >= 79)]!;
const TRACK_PATH = (() => { const p = new Path2D(); TRACK.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); return p; })();
const pointAt = (len: number): [number, number] => {
  const i = Math.max(1, CUM.findIndex(c => c >= len));
  const a = TRACK[i - 1]!, b = TRACK[i]!, t = clamp((len - CUM[i - 1]!) / Math.max(1e-6, CUM[i]! - CUM[i - 1]!), 0, 1);
  return [mix(a[0], b[0], t), mix(a[1], b[1], t)];
};

export function renderFrame(ctx: FrameContext, time: number) {
  setupFrame(ctx);
  const exit = at(time, 7.3, 7.95, inOut);

  // Barely-there lift behind the logo; it breathes in with the reveal and leaves with the exit.
  scope(ctx, c => {
    const glow = at(time, .6, 2.6, inOut) * (1 - exit);
    const g = c.createRadialGradient(960, 540, 0, 960, 540, 760);
    g.addColorStop(0, `rgba(30, 36, 40, ${glow})`); g.addColorStop(1, 'rgba(18, 20, 23, 0)');
    c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
  });

  // Mark first (centered, larger), then it travels left as the wordmark arrives.
  const lock = at(time, 2.25, 3.35, inOutQuart);
  const markScale = 1.18, lockScale = .8;
  const s = mix(markScale, lockScale, lock);
  const markCx = (MARK.x0 + MARK.x1) / 2, logoCx = (LOGO.x0 + LOGO.x1) / 2, cy = (LOGO.y0 + LOGO.y1) / 2;
  const ox = 960 - mix(markCx, logoCx, lock) * s;
  const oy = 540 - cy * s;

  scope(ctx, c => {
    c.globalAlpha = 1 - exit;
    const shrink = 1 - exit * .025;
    c.translate(960, 540); c.scale(shrink, shrink); c.translate(-960, -540);
    c.translate(ox, oy); c.scale(s, s);

    // 1 — Teal gesture: one stroke sweeps in and draws the ribbon's own path.
    const head = at(time, .45, 1.75, t => inOutQuart(t) * .35 + outQuint(t) * .65) * TOTAL;
    const tailLen = mix(260, 0, at(time, 1.35, 1.95, inOut));
    const tail = Math.max(0, head - tailLen);
    if (head > 0 && head - tail > .5 && time < 2.1) {
      scope(ctx, c2 => {
        c2.strokeStyle = TEAL; c2.lineCap = 'round'; c2.lineJoin = 'round';
        c2.lineWidth = mix(7, 16, at(time, 1.0, 1.7));
        c2.setLineDash([head - tail, TOTAL * 2]); c2.lineDashOffset = -tail;
        c2.stroke(TRACK_PATH);
      });
    }
    // Ribbon fills in behind the head, following the same path.
    const filled = head - SPINE_START;
    if (filled > 0) {
      const clip = new Path2D();
      for (let l = SPINE_START; l <= Math.min(head, TOTAL); l += 4) { const [x, y] = pointAt(l); clip.moveTo(x + 50, y); clip.arc(x, y, 50, 0, Math.PI * 2); }
      if (head >= TOTAL - 1) clip.rect(0, 0, 420, 260);
      ctx.clip(clip, () => scope(ctx, c2 => { c2.fillStyle = PIECES[1]!.fill; c2.fill(PIECES[1]!.path, 'evenodd'); }));
    }

    // 2 — Arches rise into place with a short anticipation and a controlled settle.
    [0, 2].forEach((idx, k) => {
      const start = 1.25 + k * .14;
      const rise = spring(time, start, .62, .14);
      if (rise <= 0) return;
      const piece = PIECES[idx]!, [bx, by, bw, bh] = piece.box;
      const dip = Math.sin(pr(time, start - .12, start) * Math.PI) * 3;
      scope(ctx, c2 => {
        c2.beginPath(); c2.rect(bx - 6, by - 40, bw + 12, bh + 46); c2.clip();
        c2.translate(0, (1 - rise) * (bh + 10) + dip);
        c2.fillStyle = piece.fill; c2.fill(piece.path, 'evenodd');
      });
      // Redraw the ribbon on top where it overlaps the left arch, as in the original stacking.
      if (idx === 0 && filled > 0) {
        const clip = new Path2D();
        for (let l = SPINE_START; l <= Math.min(head, TOTAL); l += 4) { const [x, y] = pointAt(l); clip.moveTo(x + 50, y); clip.arc(x, y, 50, 0, Math.PI * 2); }
        if (head >= TOTAL - 1) clip.rect(0, 0, 420, 260);
        ctx.clip(clip, () => scope(ctx, c2 => { c2.fillStyle = PIECES[1]!.fill; c2.fill(PIECES[1]!.path, 'evenodd'); }));
      }
    });

    // 3 — Wordmark follows with a slight offset, letter by letter, rising from a baseline mask.
    PIECES.slice(3).forEach((piece, i) => {
      const start = 2.55 + i * .065;
      const a = outQuint(pr(time, start, start + .75));
      if (a <= 0) return;
      const [bx, , bw] = piece.box;
      scope(ctx, c2 => {
        c2.beginPath(); c2.rect(bx - 10, 30, bw + 20, 200); c2.clip();
        c2.globalAlpha *= clamp(a * 1.4, 0, 1);
        c2.translate(0, (1 - a) * 70);
        c2.fillStyle = piece.fill; c2.fill(piece.path, 'evenodd');
      });
    });
  });
}
