import type { FrameContext } from '@mografy/runtime';
import { componentFrame } from './component-frame.js';
import { pulseDots } from './components.js';
export { meta, params, setup } from './component-frame.js';
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  componentFrame(ctx, time, params, (animationTime, accent) => {
    const spacing = ctx.width * (ctx.height > ctx.width ? .15 : .065);
    pulseDots(ctx, animationTime, { x: ctx.width / 2 - spacing, y: ctx.height / 2, diameter: Math.min(ctx.width, ctx.height) * 0.065, spacing, color: accent });
  });
}
