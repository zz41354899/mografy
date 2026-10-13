import type { FrameContext } from '@mografy/runtime';
import { centeredComponent, params as defaults } from './component-frame.js';
import { aiChat } from './social-components.js';
export { meta, setup } from './component-frame.js';
export const params = { ...defaults, prompt: { name: "Prompt", type: 'string' as const, default: "Hello." }, reply: { name: "Reply", type: 'string' as const, default: "Let's create." }, avatar: { name: "Assistant label", type: 'string' as const, default: "AI" } };
export function renderFrame(ctx: FrameContext, time: number, params: Readonly<Record<string, unknown>>) {
  centeredComponent(ctx, time, params, (animationTime, accent) => {
    aiChat(ctx, animationTime, { x: -350, y: -176, color: accent, prompt: params.prompt as string, reply: params.reply as string, avatar: params.avatar as string });
  });
}
