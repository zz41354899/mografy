import type { FrameContext } from '@mografy/runtime';
import { centeredComponent, params as defaults } from './component-frame.js';
import { socialCard } from './social-components.js';
export { meta, setup } from './component-frame.js';
export const params = { ...defaults, name: { name: "Profile name", type: 'string' as const, default: "Mografy" }, avatar: { name: "Avatar", type: 'string' as const, default: "M" }, caption: { name: "Caption", type: 'string' as const, default: "Made to move." } };
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  centeredComponent(ctx, time, params, (animationTime, accent) => {
    socialCard(ctx, animationTime, { x: -310, y: -315, color: accent, name: params.name as string, avatar: params.avatar as string, caption: params.caption as string });
  }, 720);
}
