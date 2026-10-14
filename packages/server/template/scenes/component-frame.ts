// Full-canvas animation scope. Scene names stay in the player, outside the artwork.
import type { FrameContext, SetupContext } from '@mografy/runtime';
export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#17191d' };
export const params = {
  accent: { name: 'Accent', type: 'color' as const, default: '#12b5a5' },
  speed: { name: 'Speed', type: 'number' as const, default: 1, min: 0.25, max: 2, step: 0.05 },
};
export function setup(_ctx: SetupContext) {}
export function componentFrame(
  ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>,
  draw: (animationTime: number, accent: string) => void,
) {
  const p = input as { accent: string; speed: number };
  ctx.draw.textFont('ABeeZee', 400); ctx.draw.textAlign('left', 'middle');
  ctx.withCanvas(() => {
    draw(time * p.speed % 4, p.accent);
  });
}

/** Landscape keeps its design space; portrait sizes the subject for a centered composition. */
export function centeredComponent(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>, draw: (animationTime: number, accent: string) => void, portraitWidth = 960) {
  componentFrame(ctx, time, input, (animationTime, accent) => {
    const portrait = ctx.height > ctx.width;
    ctx.draw.translate(ctx.width / 2, ctx.height / 2);
    ctx.draw.scale(portrait
      ? Math.min(ctx.width * .82 / portraitWidth, ctx.height * .64 / 900)
      : Math.min(ctx.width / 1920, ctx.height / 1080));
    draw(animationTime, accent);
  });
}
