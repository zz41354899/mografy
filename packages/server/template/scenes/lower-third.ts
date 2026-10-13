import type { FrameContext } from '@mografy/runtime';
import { centeredComponent, params as defaults } from './component-frame.js';
import { lowerThird } from './social-components.js';
export { meta, setup } from './component-frame.js';
export const params = { ...defaults, name: { name: "Name", type: 'string' as const, default: "Mografy" }, subtitle: { name: "Subtitle", type: 'string' as const, role: 'subtitle' as const, default: "Motion designer" } };
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  centeredComponent(ctx, time, params, (animationTime, accent) => {
    lowerThird(ctx, animationTime, { x: -480, y: -115, color: accent, name: params.name as string, subtitle: params.subtitle as string });
  });
}
