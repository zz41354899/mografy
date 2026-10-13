// Test-only scene: exercises logical/device unit conversion and runtime guards.
import type { FrameContext } from '../../src/index.js';
import type { ParameterValues } from '@mografy/core';

declare global { interface Window { __seen?: Record<string, unknown> } }

export const meta = { width: 200, height: 100, duration: 4, fps: 30, background: '#202020' };
export const params = {
  cheat: { name: 'cheat', type: 'enum' as const, default: 'none', options: ['none', 'random', 'date', 'perf'] },
};
export function setup() {}
export function renderFrame(ctx: FrameContext, t: number, values: Readonly<ParameterValues>) {
  if (values.cheat === 'random') Math.random();
  if (values.cheat === 'date') Date.now();
  if (values.cheat === 'perf') performance.now();
  const c = ctx.canvas;
  if (t === 0.5) {
    c.save();
    c.shadowBlur = 4; c.shadowOffsetX = 2; c.shadowOffsetY = -1;
    c.filter = 'blur(3px) drop-shadow(2px -1px 5px red)';
    c.setTransform(1, 0, 0, 1, 10, 20);
    const m = c.getTransform();
    const native = c.canvas.getContext('2d')!;
    const nm = native.getTransform();
    window.__seen = {
      logical: { shadowBlur: c.shadowBlur, shadowOffsetX: c.shadowOffsetX, shadowOffsetY: c.shadowOffsetY, filter: c.filter, transform: [m.a, m.b, m.c, m.d, m.e, m.f] },
      native: { shadowBlur: native.shadowBlur, shadowOffsetX: native.shadowOffsetX, shadowOffsetY: native.shadowOffsetY, filter: native.filter, transform: [nm.a, nm.b, nm.c, nm.d, nm.e, nm.f] },
    };
    c.restore();
  }
  window.__seen = { ...window.__seen, beat: ctx.beat(t) };
  // Geometry for the scale comparison: shapes, a shadow and a blur in logical units.
  c.fillStyle = '#e0f070'; c.fillRect(20 + t * 10, 20, 60, 40);
  ctx.shadow('rgba(0,0,0,0.8)', 12, 8, 6);
  c.fillStyle = '#4080ff'; c.beginPath(); c.arc(140, 50, 25, 0, Math.PI * 2); c.fill();
  ctx.shadow('transparent', 0);
  ctx.blur(6); c.fillStyle = '#ff5050'; c.fillRect(100, 70, 60, 14); ctx.blur(0);
  ctx.vignette(0.5);
}
