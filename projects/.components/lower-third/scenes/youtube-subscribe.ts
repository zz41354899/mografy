import type { FrameContext } from '@mografy/runtime';
import { centeredComponent, params as defaults } from './component-frame.js';
import { youtubeSubscribe } from './social-components.js';
export { meta, setup } from './component-frame.js';
export const params = { ...defaults, accent: { ...defaults.accent, default: '#ff0033' }, label: { name: "Button label", type: 'string' as const, default: "Subscribe" }, subscribed: { name: "Subscribed label", type: 'string' as const, default: "Subscribed" } };
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  centeredComponent(ctx, time, params, (animationTime, accent) => {
    youtubeSubscribe(ctx, animationTime, { x: -340, y: -88, color: accent, label: params.label as string, subscribed: params.subscribed as string });
  });
}
