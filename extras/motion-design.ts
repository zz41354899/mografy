// An asset-free teaching scene for references/codex-motion-design.md.
// Copy into a project's scenes/ folder. This module runs only in the browser.
import { clamp, ease, lerp, pr } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';

export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#F6F4EF' };
export const params = {};
export function setup() {}

function delayedSettle(time: number) {
  const u = pr(time, 5.4, 5.85);
  return u > 0 && u < 1 ? 6 * Math.sin(u * Math.PI * 2) * Math.exp(-4 * u) * (1 - u) : 0;
}

export function renderFrame(ctx: FrameContext, time: number) {
  const c = ctx.canvas;
  // Uniform fitting keeps the reference geometry intact when testing other sizes.
  const scale = Math.min(ctx.width / meta.width, ctx.height / meta.height);
  ctx.withCanvas(() => {
    c.translate(ctx.width / 2, ctx.height / 2);
    c.scale(scale, scale);
    c.translate(-960, -540);
    c.lineCap = 'round';
    c.lineWidth = 18;
    const baseline = 662;
    const initialWidth = 660;
    const text = 'Find your focus.';
    c.font = '600 112px sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    const textWidth = c.measureText(text).width;

    if (time < 1.8) {
      const strokes = [
        { x: 550, y: 420, start: 0, end: 0.8 },
        { x: 860, y: 590, start: 0.12, end: 0.98 },
        { x: 1170, y: 470, start: 0.24, end: 1.2 },
      ];
      strokes.forEach((stroke, index) => {
        const u = ease.outCubic(pr(time, stroke.start, stroke.end));
        const x = lerp(stroke.x, 630 + index * 220, u);
        const y = lerp(stroke.y, baseline, u) - (index === 0 ? 28 * Math.sin(Math.PI * u) : 0);
        const length = lerp(150, 220, u);
        c.strokeStyle = index === 0 || u > 0.7 ? '#078E83' : '#82918D';
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + length, y);
        c.stroke();
      });
      return;
    }

    const reveal = ease.inOutCubic(pr(time, 1.8, 2.8));
    const retract = ease.inOutCubic(pr(time, 4.6, 5.4));
    const lineWidth = lerp(lerp(initialWidth, textWidth, reveal), 96, retract) + delayedSettle(time);
    c.strokeStyle = '#078E83';
    c.beginPath();
    c.moveTo(960 - lineWidth / 2, baseline);
    c.lineTo(960 + lineWidth / 2, baseline);
    c.stroke();

    // The type stays in its reading pose; a mask reveals it without reflow or drift.
    ctx.withCanvas(() => {
      c.beginPath();
      c.rect(960 - textWidth / 2 - 4, 442, (textWidth + 8) * clamp(reveal, 0, 1), 180);
      c.clip();
      c.fillStyle = '#182423';
      c.fillText(text, 960 - textWidth / 2, 595);
    });
  });
}
