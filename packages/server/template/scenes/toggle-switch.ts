import type { FrameContext } from '@mografy/runtime';
import { centeredComponent } from './component-frame.js';
import { toggleSwitch } from './social-components.js';
export { meta, params, setup } from './component-frame.js';
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  centeredComponent(ctx, time, params, (animationTime, accent) => {
    toggleSwitch(ctx, animationTime, { x: -220, y: -100, color: accent });
  });
}
