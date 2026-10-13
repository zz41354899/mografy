// Native Canvas is the independent pixel reference for the drawing API.
import type { FrameContext } from '../../src/index.js';
import type { ParameterValues } from '@mografy/core';

export const meta = { width: 320, height: 200, duration: 1, fps: 30, background: '#101820' };
export const params = { api: { name: 'API', type: 'boolean' as const, default: false } };
export function setup() {}
export function renderFrame(ctx: FrameContext, t: number, p: Readonly<ParameterValues>) {
  const c = ctx.canvas, g = ctx.draw;
  (window as unknown as { __drawingApi: unknown }).__drawingApi = g;
  const logo = new Path2D(); logo.rect(0, 0, 22, 22); logo.rect(6, 6, 10, 10);
  const tile = document.createElement('canvas'); tile.width = tile.height = 4;
  const tc = tile.getContext('2d')!; tc.fillStyle = '#ffcc00'; tc.fillRect(0, 0, 4, 4);
  c.fillStyle = '#eeeeee'; c.strokeStyle = '#ff00ff'; c.lineWidth = 10;
  if (p.api) {
    // Initial flags must be fill on / stroke off, even after an unbalanced previous frame.
    const { fill, rect, circle } = g;
    rect(4, 4, 12, 12);
    g.push(); g.translate(150, 80); g.rotate(.2); g.scale(1.1);
    g.opacity(.2); ctx.shadow('#000', 3); ctx.blur(2);
    g.background('#101820');
    g.pop(); rect(4, 4, 12, 12);
    fill('#12b5a5'); rect(22 + t * 8, 10, 40, 24, 6); circle(84, 23, 28);
    g.stroke('#ffffff'); g.strokeWeight(2); g.noFill(); g.ellipse(128, 23, 40, 22);
    g.push(); fill('#ffcc00'); g.noStroke(); g.translate(156, 12); g.rotate(.2); g.scale(1.2, .8); rect(0, 0, 24, 20); g.pop();
    g.strokeCap('round'); g.strokeJoin('round'); g.line(202, 12, 225, 32); g.arc(260, 22, 28, 28, 0, Math.PI);
    g.noStroke(); fill('#f08060'); g.triangle(20, 54, 44, 78, 8, 78);
    g.push(); g.translate(64, 54); g.path(logo, 'evenodd'); g.pop();
    g.textSize(18); g.textFont('Arial', 700); g.textAlign('left', 'top'); g.text('Hello', 100, 54);
    g.push(); g.textSize(30); g.textAlign('center', 'middle'); g.noFill(); g.stroke('#ffffff'); g.text('A', 190, 66, 18); g.pop();
    g.text('World', 215, 54, 44);
    g.image(tile, 20, 100); g.image(tile, 40, 100, 20, 12);
    const gradient = c.createLinearGradient(80, 100, 120, 100); gradient.addColorStop(0, '#fff'); gradient.addColorStop(1, '#12b5a5');
    fill(gradient); rect(80, 100, 40, 18);
    fill(c.createPattern(tile, 'repeat')!); rect(140, 100, 40, 18);
    g.push(); g.noFill(); g.stroke('#88ffcc'); g.opacity(.5); ctx.shadow('#12b5a5', 4, 2, 1); g.rect(210, 100, 42, 22, 4); g.pop();
    // Leave both native and API state dirty; the next frame must reset both.
    if (t > .7) { g.push(); g.noFill(); g.stroke('#ff0000'); g.opacity(.1); g.translate(80, 80); }
    (window as unknown as { __drawing: unknown }).__drawing = { font: c.font, width: g.textWidth('Hello') };
  } else {
    c.fillRect(4, 4, 12, 12);
    c.save(); c.translate(150, 80); c.rotate(.2); c.scale(1.1, 1.1); c.globalAlpha = .2; ctx.shadow('#000', 3); ctx.blur(2);
    c.save(); c.resetTransform(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.shadowColor = 'transparent';
    c.clearRect(0, 0, 320, 200); c.fillStyle = '#101820'; c.fillRect(0, 0, 320, 200); c.restore(); c.restore(); c.fillRect(4, 4, 12, 12);
    c.fillStyle = '#12b5a5'; c.beginPath(); c.roundRect(22 + t * 8, 10, 40, 24, 6); c.fill();
    c.beginPath(); c.arc(84, 23, 14, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.ellipse(128, 23, 20, 11, 0, 0, Math.PI * 2); c.stroke();
    c.save(); c.fillStyle = '#ffcc00'; c.translate(156, 12); c.rotate(.2); c.scale(1.2, .8); c.fillRect(0, 0, 24, 20); c.restore();
    c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(202, 12); c.lineTo(225, 32); c.stroke();
    c.beginPath(); c.arc(260, 22, 14, 0, Math.PI); c.stroke();
    c.fillStyle = '#f08060'; c.beginPath(); c.moveTo(20, 54); c.lineTo(44, 78); c.lineTo(8, 78); c.closePath(); c.fill();
    c.save(); c.translate(64, 54); c.fill(logo, 'evenodd'); c.restore();
    c.font = '700 18px Arial'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('Hello', 100, 54);
    c.save(); c.font = '700 30px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeStyle = '#ffffff'; c.strokeText('A', 190, 66, 18); c.restore();
    c.fillText('World', 215, 54, 44); c.drawImage(tile, 20, 100); c.drawImage(tile, 40, 100, 20, 12);
    const gradient = c.createLinearGradient(80, 100, 120, 100); gradient.addColorStop(0, '#fff'); gradient.addColorStop(1, '#12b5a5');
    c.fillStyle = gradient; c.fillRect(80, 100, 40, 18); c.fillStyle = c.createPattern(tile, 'repeat')!; c.fillRect(140, 100, 40, 18);
    c.save(); c.strokeStyle = '#88ffcc'; c.globalAlpha = .5; ctx.shadow('#12b5a5', 4, 2, 1); c.beginPath(); c.roundRect(210, 100, 42, 22, 4); c.stroke(); c.restore();
    if (t > .7) { c.save(); c.globalAlpha = .1; c.translate(80, 80); }
    (window as unknown as { __drawing: unknown }).__drawing = { font: c.font, width: c.measureText('Hello').width };
  }
}
