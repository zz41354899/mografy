// A contact sheet of the full-canvas samples; each sample also has its own project.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import * as scene0 from './stagger-text.js';
import * as scene1 from './typewriter.js';
import * as scene2 from './pop-card.js';
import * as scene3 from './progress-bar.js';
import * as scene4 from './pulse-dots.js';
import * as scene5 from './logo-reveal.js';
import * as scene6 from './social-card.js';
import * as scene7 from './youtube-subscribe.js';
import * as scene8 from './ai-chat.js';
import * as scene9 from './like-burst.js';
import * as scene10 from './follow-badge.js';
import * as scene11 from './notification-toast.js';
import * as scene12 from './lower-third.js';
import * as scene13 from './count-up.js';
import * as scene14 from './toggle-switch.js';
import * as scene15 from './audio-wave.js';

const samples = [
  { name: 'Stagger text', scene: scene0 },
  { name: 'Typewriter', scene: scene1 },
  { name: 'Pop card', scene: scene2 },
  { name: 'Progress bar', scene: scene3 },
  { name: 'Pulse dots', scene: scene4 },
  { name: 'Logo reveal', scene: scene5 },
  { name: 'Social card', scene: scene6 },
  { name: 'YouTube subscribe', scene: scene7 },
  { name: 'AI chat', scene: scene8 },
  { name: 'Like burst', scene: scene9 },
  { name: 'Follow badge', scene: scene10 },
  { name: 'Notification toast', scene: scene11 },
  { name: 'Lower third', scene: scene12 },
  { name: 'Count up', scene: scene13 },
  { name: 'Toggle switch', scene: scene14 },
  { name: 'Audio wave', scene: scene15 }
];
export const meta = { width: 2400, height: 1560, duration: 8, fps: 30, background: '#17191d' };
export const params = { speed: { name: 'Speed', type: 'number' as const, default: 1, min: .25, max: 2, step: .05 } };
export function setup(_ctx: SetupContext) {}
export function renderFrame(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>) {
  const mografy = ctx.draw;
  mografy.textFont('ABeeZee', 400); mografy.textSize(28); mografy.textAlign('left', 'middle');
  mografy.fill('#f2f4f8'); mografy.text('Mografy / 16 motion components', 24, 38);
  samples.forEach(({ name, scene }, i) => {
    const x = i % 4 * 600, y = 72 + Math.floor(i / 4) * 372;
    const crop = new Path2D(); crop.rect(x + 12, y + 12, 576, 324);
    ctx.clip(crop, () => {
      mografy.translate(x + 12, y + 12); mografy.scale(.3);
      scene.renderFrame({ ...ctx, width: 1920, height: 1080 }, time, { ...Object.fromEntries(Object.entries(scene.params).map(([key, definition]) => [key, definition.default])), speed: input.speed });
    });
    mografy.fill('#9399a3'); mografy.textSize(22); mografy.text(name, x + 24, y + 355);
  });
}
