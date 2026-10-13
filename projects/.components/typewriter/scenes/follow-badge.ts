import type { FrameContext } from '@mografy/runtime';
import { centeredComponent, params as defaults } from './component-frame.js';
import { followBadge } from './social-components.js';
export { meta, setup } from './component-frame.js';
export const params = { ...defaults, name: { name: "Profile name", type: 'string' as const, default: "Mografy" }, avatar: { name: "Avatar", type: 'string' as const, default: "M" }, label: { name: "Button label", type: 'string' as const, default: "Follow" }, following: { name: "Following label", type: 'string' as const, default: "Following" } };
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  centeredComponent(ctx, time, params, (animationTime, accent) => {
    followBadge(ctx, animationTime, { x: -470, y: -95, color: accent, name: params.name as string, avatar: params.avatar as string, label: params.label as string, following: params.following as string });
  });
}
