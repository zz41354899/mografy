// Mografy blank project: an empty stage until the scene is written.
// Describe the animation to Claude or Codex; they replace this file.
// Read the project root AGENTS.md for authoring instructions.
import type { FrameContext } from '@mografy/runtime';

export const meta = { width: 1920, height: 1080, duration: 4, fps: 30, background: '#f4f3ef' };

export const params = {
  accent: { name: 'Accent', type: 'color' as const, default: '#12b5a5' },
};
type Values = { [K in keyof typeof params]: (typeof params)[K]['default'] };

/** One small dot breathes in the centre; the cycle matches the duration, so the loop is seamless. */
export function renderFrame(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>) {
  const p = input as Values, canvas = ctx.canvas, w = ctx.width, h = ctx.height;
  canvas.fillStyle = meta.background;
  canvas.fillRect(0, 0, w, h);
  const breathe = 0.5 - 0.5 * Math.cos((time / meta.duration) * Math.PI * 2);
  canvas.save();
  canvas.globalAlpha = 0.55 + 0.45 * breathe;
  canvas.fillStyle = p.accent;
  canvas.beginPath();
  canvas.arc(w / 2, h / 2, Math.min(w, h) * (0.010 + 0.004 * breathe), 0, Math.PI * 2);
  canvas.fill();
  canvas.restore();
}
