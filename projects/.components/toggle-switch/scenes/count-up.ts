import type { FrameContext } from '@mografy/runtime';
import { centeredComponent } from './component-frame.js';
import { countUp } from './social-components.js';
export { meta, params, setup } from './component-frame.js';
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  centeredComponent(ctx, time, params, (animationTime, accent) => {
    countUp(ctx, animationTime, { x: 0, y: ctx.height > ctx.width ? -28 : 0, color: accent, value: 1280 });
  }, 960);
}
