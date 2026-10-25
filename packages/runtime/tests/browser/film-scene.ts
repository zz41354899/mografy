// Exercises the whole-film helpers: camera, layers, one-pass blur, bloom and shadow-blurred text.
import { blurLayer, blurText, bloom, cameraPath, layer, withCamera } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';

export const meta = { width: 400, height: 200, duration: 4, fps: 30, background: '#101418' };
export const params = { mode: { name: 'Mode', type: 'enum' as const, default: 'all', options: ['all', 'blurText', 'filterText', 'overlap', 'filters', 'glowFull', 'glowBounds', 'shadowFrame', 'shadowLayer'] } };
export function setup() {}

const cam = cameraPath([[0, 200, 100, 1], [2, 230, 90, 1.6, .05], [4, 200, 100, 1.2]]);
export function renderFrame(ctx: FrameContext, time: number, p: { mode: string }) {
  const c = ctx.canvas;
  if (p.mode === 'blurText' || p.mode === 'filterText') {
    if (p.mode === 'blurText') blurText(ctx, 'Blur', 60, 130, { size: 90, color: '#ffffff', family: 'sans-serif', weight: 700 }, 6);
    else ctx.withCanvas(x => { x.filter = 'blur(6px)'; x.font = '700 90px sans-serif'; x.fillStyle = '#ffffff'; x.fillText('Blur', 60, 130); });
    return;
  }
  if (p.mode === 'overlap') {
    layer(ctx, 'pair', .5, x => { x.fillStyle = '#ffffff'; x.fillRect(50, 50, 150, 100); x.fillRect(150, 50, 150, 100); });
    return;
  }
  if (p.mode === 'glowFull' || p.mode === 'glowBounds') {
    withCamera(ctx, cam(1.3), x => {
      const light = (y: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => { y.fillStyle = '#ffc15a'; y.fillRect(180, 80, 40, 40); };
      const bounds = p.mode === 'glowBounds' ? [180, 80, 40, 40] as const : undefined;
      bloom(x, light, { radius: 8, ...(bounds ? { bounds } : {}) });
      blurLayer(x, 'b', 6, y => { y.fillStyle = '#4af'; y.fillRect(100, 120, 60, 30); }, bounds ? { bounds: [100, 120, 60, 30] } : {});
    });
    return;
  }
  if (p.mode === 'shadowFrame' || p.mode === 'shadowLayer') {
    const card = (y: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => { y.shadowColor = 'rgba(0,0,0,.8)'; y.shadowBlur = 20; y.shadowOffsetY = 12; y.fillStyle = '#eef2f5'; y.fillRect(120, 40, 160, 90); };
    if (p.mode === 'shadowFrame') ctx.withCanvas(x => { x.globalAlpha = .98; card(x); });
    else layer(ctx, 'shadow', .98, card);
    return;
  }
  if (p.mode === 'filters') {
    ctx.withCanvas(x => { for (let i = 0; i < 5; i++) { x.filter = 'blur(2px)'; x.fillStyle = '#fff'; x.fillRect(20 + i * 60, 80, 40, 40); } });
    return;
  }
  withCamera(ctx, cam(time), x => {
    blurLayer(x, 'haze', 14, y => { y.fillStyle = '#2a6cff'; y.beginPath(); y.arc(120, 80, 60, 0, 7); y.fill(); y.fillStyle = '#ff7a6b'; y.fillRect(220, 60, 120, 80); });
    layer(x, 'card', .7, y => { y.fillStyle = '#eef2f5'; y.fillRect(140, 60, 120, 80); y.fillStyle = '#1bc6b4'; y.fillRect(150, 70, 60, 20); });
    bloom(x, y => { y.fillStyle = '#ffc15a'; y.beginPath(); y.arc(300, 150, 10, 0, 7); y.fill(); }, { radius: 10 });
    x.fillStyle = '#ffc15a'; x.beginPath(); x.arc(300, 150, 10, 0, 7); x.fill();
  });
  blurText(ctx, 'Focus', 20, 180, { size: 30, color: '#ffffff', weight: 600 }, 4 * (1 - Math.min(1, time / 2)));
  c.globalAlpha = 1;
}
