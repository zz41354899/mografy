// Bundled showcase. Copied into a real scene project on first launch.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { staggerText, typewriter, popCard, progressBar, pulseDots, logoReveal } from './components.js';

export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#17191d' };
export const params = {
  accent: { name: 'Accent', type: 'color' as const, default: '#12b5a5' },
  speed: { name: 'Speed', type: 'number' as const, default: 1, min: 0.25, max: 2, step: 0.05 },
};
export function setup(_ctx: SetupContext) {}

export function renderFrame(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>) {
  const p = input as { accent: string; speed: number }, mografy = ctx.draw;
  const demoTime = time * p.speed % 4;
  mografy.textFont('ABeeZee', 400); mografy.textAlign('left', 'middle');
  mografy.fill(p.accent); mografy.textSize(22); mografy.text('MOGRAFY / COMPONENTS', 120, 92);
  mografy.fill('#f2f4f8'); mografy.textSize(60); mografy.text('A little motion, ready to use.', 120, 170);
  mografy.fill('#9399a3'); mografy.textSize(25); mografy.text('Six scene functions. One canvas. Your own style.', 120, 232);
  const names = ['Stagger text', 'Typewriter', 'Pop card', 'Progress bar', 'Pulse dots', 'Logo reveal'];
  const code = ['staggerText(ctx, time, options)', 'typewriter(ctx, time, options)', 'popCard(ctx, time, options)', 'progressBar(ctx, time, options)', 'pulseDots(ctx, time, options)', 'logoReveal(ctx, time, options)'];
  names.forEach((name, i) => {
    const x = 120 + i % 3 * 570, y = 308 + Math.floor(i / 3) * 330;
    ctx.withCanvas(() => {
      mografy.translate(x, y); mografy.fill('#202328'); mografy.rect(0, 0, 540, 302, 20);
      mografy.fill('#777f8b'); mografy.textSize(18); mografy.text(`0${i + 1}`, 26, 34);
      switch (i) {
        case 0: staggerText(ctx, demoTime, { text: 'Hello, motion.', x: 42, y: 132, size: 54 }); break;
        case 1: typewriter(ctx, demoTime, { text: 'Create something.', x: 42, y: 132, size: 45, duration: 1.8, color: p.accent }); break;
        case 2: popCard(ctx, demoTime, { x: 92, y: 68, width: 356, height: 112, content: () => {
          mografy.fill(p.accent); mografy.circle(45, 56, 26);
          mografy.fill('#f2f4f8'); mografy.textSize(27); mografy.text('You are all set.', 76, 56);
        } }); break;
        case 3: progressBar(ctx, demoTime, { x: 42, y: 124, width: 456, height: 16, duration: 2.5, color: p.accent }); break;
        case 4: pulseDots(ctx, demoTime, { x: 226, y: 132, diameter: 20, spacing: 44, color: p.accent }); break;
        case 5: logoReveal(ctx, demoTime, { x: 270, y: 122, diameter: 142, color: p.accent }); break;
      }
      mografy.fill('#f2f4f8'); mografy.textSize(27); mografy.text(name, 26, 228);
      mografy.fill('#9399a3'); mografy.textSize(17); mografy.text(code[i]!, 26, 270);
    });
  });
  mografy.fill('#777f8b'); mografy.textSize(20); mografy.text('Available in every new project: scenes/components.ts', 120, 1020);
}
