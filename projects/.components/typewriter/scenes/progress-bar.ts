import type { FrameContext } from '@mografy/runtime';
import { componentFrame } from './component-frame.js';
import { progressBar } from './components.js';
export { meta, params, setup } from './component-frame.js';
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  componentFrame(ctx, time, params, (animationTime, accent) => {
    const width = ctx.width * 0.72, height = ctx.height * 0.028;
    progressBar(ctx, animationTime, { x: (ctx.width - width) / 2, y: (ctx.height - height) / 2, width, height, duration: 2.5, color: accent });
  });
}
