import type { FrameContext } from '@mografy/runtime';
import { centeredComponent, params as defaults } from './component-frame.js';
import { notificationToast } from './social-components.js';
export { meta, setup } from './component-frame.js';
export const params = { ...defaults, message: { name: "Message", type: 'string' as const, default: "New message" } };
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  centeredComponent(ctx, time, params, (animationTime, accent) => {
    notificationToast(ctx, animationTime, { x: -435, y: -88, color: accent, message: params.message as string });
  });
}
