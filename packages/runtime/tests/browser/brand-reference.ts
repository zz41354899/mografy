import type { FrameContext } from '@mografy/runtime';
import { MARK_BOX, LOGO_PIECES } from '../../../../examples/mografy-intro/scenes/logo.js';
export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#17191d' };
export const params = {};
export function setup() {}
export function renderFrame(ctx: FrameContext) {
  const canvas = ctx.canvas, [x0, y0, x1, y1] = MARK_BOX;
  const scale = ctx.width * .34 / (x1! - x0!);
  canvas.save(); canvas.translate(ctx.width / 2, ctx.height / 2); canvas.scale(scale, scale);
  canvas.translate(-(x0! + x1!) / 2, -(y0! + y1!) / 2);
  for (const piece of LOGO_PIECES.slice(0, 3)) {
    canvas.fillStyle = piece.name === 'ribbon' ? '#12b5a5' : '#f2f4f8';
    canvas.fill(new Path2D(piece.d), 'evenodd');
  }
  canvas.restore();
}
