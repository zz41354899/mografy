import type { FrameContext } from '../../src/canvas.js';
export const meta = { width: 200, height: 100, duration: 1, fps: 30, background: '#101010' };
export const params = { native: { name: 'Native', type: 'boolean' as const, default: false } };
export function setup() {}
export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const canvas = ctx.canvas, mografy = ctx.draw;
  mografy.fill('#ef7355'); mografy.noStroke();
  const path = new Path2D(); path.rect(10, 10, 70, 60); path.rect(20, 20, 20, 20);
  const draw = () => {
    mografy.noFill(); mografy.stroke('#12b5a5'); mografy.strokeWeight(4);
    canvas.translate(time * 5, 0); ctx.shadow('#ffffff', 3); ctx.blur(0.25);
    canvas.fillStyle = '#123456'; canvas.fillRect(0, 0, 100, 90);
    mografy.circle(55, 50, 30);
  };
  if (p.native) { mografy.push(); canvas.clip(path, 'evenodd'); draw(); mografy.pop(); }
  else ctx.clip(path, draw, 'evenodd');
  try {
    const fail = () => { mografy.noFill(); canvas.translate(80, 50); canvas.filter = 'blur(4px)'; throw new Error('intentional'); };
    if (p.native) { mografy.push(); try { fail(); } finally { mografy.pop(); } }
    else ctx.withCanvas(fail);
  } catch (e) { if (!(e instanceof Error) || e.message !== 'intentional') throw e; }
  // Must draw with restored fill, transform, shadow/filter and no remaining clip.
  mografy.rect(110, 20, 60, 50);
}
