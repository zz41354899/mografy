// Mografy starter scene: draw the complete frame for the supplied time.
// Read the project root AGENTS.md for authoring instructions.
import { pr, lerp, ease, clamp } from '@mografy/runtime';
import type { FrameContext, SetupContext } from '@mografy/runtime';

export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#0f1115' };

export const params = {
  title: { name: 'Title', type: 'string' as const, default: 'MOGRAFY' },
  subtitle: { name: 'Subtitle', type: 'string' as const, role: 'subtitle' as const, default: 'Claude creates. Mografy shows.' },
  accent: { name: 'Accent', type: 'color' as const, default: '#12b5a5' },
  energy: { name: 'Energy', type: 'number' as const, default: 1, min: 0, max: 2, step: 0.01 },
  grid: { name: 'Grid', type: 'boolean' as const, default: true },
  vignette: { name: 'Vignette', type: 'number' as const, default: 0.45, min: 0, max: 1, step: 0.01 },
};
type Values = { [K in keyof typeof params]: (typeof params)[K]['default'] };

/** Prepared once: a seeded speckle texture. */
export function setup(ctx: SetupContext) {
  const size = 256, texture = document.createElement('canvas');
  texture.width = size; texture.height = size;
  const canvas = texture.getContext('2d')!, image = canvas.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = Math.floor(ctx.random() * 255);
    image.data.set([n, n, n, 10], i);
  }
  canvas.putImageData(image, 0, 0);
  ctx.assets.texture = texture;
}

export function renderFrame(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>) {
  const p = input as Values, canvas = ctx.canvas, mografy = ctx.draw, w = ctx.width, h = ctx.height, cx = w / 2, cy = h / 2;
  const energy = p.energy;
  const exit = ease.inOutCubic(pr(time, 6.6, 7.6));

  // Background grid drifting slowly to the left.
  if (p.grid) {
    const step = 96, shift = (time * 18 * energy) % step;
    canvas.strokeStyle = 'rgba(255,255,255,0.05)'; canvas.lineWidth = 1;
    canvas.beginPath();
    for (let x = -shift; x <= w; x += step) { canvas.moveTo(x, 0); canvas.lineTo(x, h); }
    for (let y = 0; y <= h; y += step) { canvas.moveTo(0, y); canvas.lineTo(w, y); }
    canvas.stroke();
  }

  // Accent ring: draws on, breathes, then collapses on exit.
  const ringIn = ease.outExpo(pr(time, 0.2, 1.6));
  const ringY = cy + 30;
  const radius = lerp(120, 430, ringIn) * (1 - 0.6 * exit) + Math.sin(time * 2.2) * 10 * energy;
  mografy.push();
  mografy.noFill(); mografy.stroke(p.accent); mografy.strokeWeight(3); mografy.opacity(0.9 * (1 - exit));
  ctx.shadow(p.accent, 24);
  mografy.arc(cx, ringY, radius * 2, radius * 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ringIn);
  mografy.pop();

  // Orbiting dots, positions depend only on time.
  for (let i = 0; i < 6; i++) {
    const appear = ease.outCubic(pr(time, 0.8 + i * 0.12, 1.4 + i * 0.12));
    const angle = time * 0.6 * energy + (i / 6) * Math.PI * 2;
    const r = radius + 34 + 10 * Math.sin(time * 3 + i);
    mografy.fill(i % 2 ? '#f2f4f8' : p.accent);
    mografy.opacity(appear * (1 - exit));
    mografy.circle(cx + Math.cos(angle) * r, ringY + Math.sin(angle) * r, 12 + 6 * ctx.noise(i));
  }
  mografy.opacity(1);

  // Title: letters rise in with a stagger and fall out on exit.
  const title = p.title.toUpperCase();
  mografy.textFont('ABeeZee'); mografy.textSize(148); mografy.textAlign('start', 'alphabetic');
  const widths = [...title].map(ch => mografy.textWidth(ch)), tracking = 18;
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, title.length - 1);
  let x = cx - total / 2;
  [...title].forEach((ch, i) => {
    const appear = ease.outExpo(pr(time, 0.5 + i * 0.07, 1.5 + i * 0.07));
    const fall = ease.inOutCubic(pr(time, 6.4 + i * 0.04, 7.2 + i * 0.04));
    const y = cy + 60 + lerp(90, 0, appear) + fall * 140;
    mografy.opacity(clamp(appear) * (1 - fall));
    mografy.fill('#f2f4f8');
    mografy.text(ch, x, y);
    x += widths[i]! + tracking;
  });

  // Subtitle with a short wipe.
  const sub = ease.outCubic(pr(time, 1.8, 2.6));
  mografy.opacity(sub * (1 - exit));
  mografy.textSize(34); mografy.textAlign('center'); mografy.fill('#9aa4b2');
  mografy.text(p.subtitle, cx, cy + 150 + (1 - sub) * 20);
  mografy.textAlign('start'); mografy.opacity(1);

  // Beat pulse when the project has music.
  const beat = ctx.beat(time);
  if (beat) {
    const pulse = 1 - ease.outCubic(beat.phase);
    mografy.fill(p.accent); mografy.opacity(0.3 + 0.7 * pulse);
    mografy.circle(w - 72, 72, 16 + 16 * pulse * (beat.beatInBar === 0 ? 1.5 : 1));
    mografy.opacity(1);
  }

  // Seeded speckle texture and vignette, drawn inside the canvas.
  const pattern = canvas.createPattern(ctx.assets.texture as HTMLCanvasElement, 'repeat');
  if (pattern) { mografy.fill(pattern); mografy.rect(0, 0, w, h); }
  ctx.vignette(p.vignette);
}
