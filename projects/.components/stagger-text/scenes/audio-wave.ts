import type { FrameContext } from '@mografy/runtime';
import { centeredComponent } from './component-frame.js';
import { audioWave } from './social-components.js';
export { meta, params, setup } from './component-frame.js';
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  centeredComponent(ctx, time, params, (animationTime, accent) => {
    audioWave(ctx, animationTime, { x: 0, y: 0, color: accent });
  });
}
