import type { FrameContext } from '@mografy/runtime';
import { componentFrame } from './component-frame.js';
import { popCard } from './components.js';
export { meta, params, setup } from './component-frame.js';
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  componentFrame(ctx, time, params, (animationTime, accent) => {
    const width = ctx.width * 0.44, height = ctx.height * 0.38;
    popCard(ctx, animationTime, { x: (ctx.width - width) / 2, y: (ctx.height - height) / 2, width, height, radius: 32, content: () => {
      const mografy = ctx.draw, x = width / 2, y = height / 2, radius = height * 0.17;
      mografy.fill(accent); mografy.circle(x, y, radius * 2);
      mografy.noFill(); mografy.stroke('#f2f4f8'); mografy.strokeWeight(radius * 0.13); mografy.strokeCap('round');
      mografy.line(x - radius * 0.4, y, x - radius * 0.08, y + radius * 0.3);
      mografy.line(x - radius * 0.08, y + radius * 0.3, x + radius * 0.43, y - radius * 0.3);
    } });
  });
}
