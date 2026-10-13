import type { FrameContext } from '@mografy/runtime';
import { centeredComponent, params as defaults } from './component-frame.js';
import { likeBurst } from './social-components.js';
export { meta, setup } from './component-frame.js';
export const params = { ...defaults, accent: { ...defaults.accent, default: '#ff6687' } };
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  centeredComponent(ctx, time, params, (animationTime, accent) => {
    likeBurst(ctx, animationTime, { x: 0, y: 0, color: accent });
  });
}
