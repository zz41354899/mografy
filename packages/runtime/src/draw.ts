/** Canvas drawing helpers. Geometry uses logical pixels; angles use radians. */
export type Paint = string | CanvasGradient | CanvasPattern;

export interface DrawingApi {
  fill(color: Paint): void;
  noFill(): void;
  stroke(color: Paint): void;
  noStroke(): void;
  strokeWeight(width: number): void;
  strokeCap(cap: CanvasLineCap): void;
  strokeJoin(join: CanvasLineJoin): void;
  opacity(alpha: number): void;
  push(): void;
  pop(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  scale(x: number, y?: number): void;
  background(color: Paint): void;
  /** Top-left origin; optional uniform corner radius. */
  rect(x: number, y: number, width: number, height: number, radius?: number): void;
  /** Center origin; diameter, not radius. */
  circle(x: number, y: number, diameter: number): void;
  ellipse(x: number, y: number, width: number, height: number): void;
  /** Center origin; an open elliptical arc, with angles in radians. */
  arc(x: number, y: number, width: number, height: number, start: number, end: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void;
  path(path: Path2D, rule?: CanvasFillRule): void;
  textFont(family: string, weight?: string | number): void;
  textSize(size: number): void;
  textAlign(align: CanvasTextAlign, baseline?: CanvasTextBaseline): void;
  text(value: string, x: number, y: number, maxWidth?: number): void;
  textWidth(value: string): number;
  image(source: CanvasImageSource, x: number, y: number, width?: number, height?: number): void;
}

/** Internal factory: one API per runtime, with drawing flags reset before every frame. */
export function createDrawing(c: CanvasRenderingContext2D, width: number, height: number) {
  let fill = true, stroke = false;
  const stack: { fill: boolean; stroke: boolean }[] = [];
  const paint = () => { if (fill) c.fill(); if (stroke) c.stroke(); };
  const font = () => /^(.*?)([\d.]+)px\s+(.+)$/.exec(c.font);
  const draw: DrawingApi = Object.freeze({
    fill(color: Paint) { c.fillStyle = color; fill = true; },
    noFill() { fill = false; },
    stroke(color: Paint) { c.strokeStyle = color; stroke = true; },
    noStroke() { stroke = false; },
    strokeWeight(value: number) { c.lineWidth = value; },
    strokeCap(value: CanvasLineCap) { c.lineCap = value; },
    strokeJoin(value: CanvasLineJoin) { c.lineJoin = value; },
    opacity(value: number) { c.globalAlpha = Math.min(1, Math.max(0, value)); },
    push() { c.save(); stack.push({ fill, stroke }); },
    pop() {
      const saved = stack.pop();
      if (!saved) throw new Error('draw.pop() requires a matching draw.push()');
      c.restore(); fill = saved.fill; stroke = saved.stroke;
    },
    translate(x: number, y: number) { c.translate(x, y); },
    rotate(value: number) { c.rotate(value); },
    scale(x: number, y = x) { c.scale(x, y); },
    background(color: Paint) {
      c.save(); c.resetTransform(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.filter = 'none'; c.shadowColor = 'transparent';
      c.clearRect(0, 0, width, height); c.fillStyle = color; c.fillRect(0, 0, width, height); c.restore();
    },
    rect(x: number, y: number, w: number, h: number, radius = 0) {
      if (radius === 0) { if (fill) c.fillRect(x, y, w, h); if (stroke) c.strokeRect(x, y, w, h); }
      else { c.beginPath(); c.roundRect(x, y, w, h, radius); paint(); }
    },
    circle(x: number, y: number, diameter: number) { c.beginPath(); c.arc(x, y, diameter / 2, 0, Math.PI * 2); paint(); },
    ellipse(x: number, y: number, w: number, h: number) { c.beginPath(); c.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); paint(); },
    arc(x: number, y: number, w: number, h: number, start: number, end: number) {
      c.beginPath();
      if (w === h) c.arc(x, y, w / 2, start, end);
      else c.ellipse(x, y, w / 2, h / 2, 0, start, end);
      paint();
    },
    line(x1: number, y1: number, x2: number, y2: number) {
      if (!stroke) return;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    },
    triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath(); paint();
    },
    path(value: Path2D, rule: CanvasFillRule = 'nonzero') { if (fill) c.fill(value, rule); if (stroke) c.stroke(value); },
    textFont(family: string, weight: string | number = 'normal') { c.font = `${weight} ${font()?.[2] ?? 10}px ${family}`; },
    textSize(size: number) {
      if (!Number.isFinite(size) || size <= 0) throw new Error('draw.textSize() requires a positive finite size');
      const current = font(); c.font = `${current?.[1] ?? ''}${size}px ${current?.[3] ?? 'sans-serif'}`;
    },
    textAlign(align: CanvasTextAlign, baseline?: CanvasTextBaseline) { c.textAlign = align; if (baseline !== undefined) c.textBaseline = baseline; },
    text(value: string, x: number, y: number, maxWidth?: number) {
      if (maxWidth === undefined) { if (fill) c.fillText(value, x, y); if (stroke) c.strokeText(value, x, y); }
      else { if (fill) c.fillText(value, x, y, maxWidth); if (stroke) c.strokeText(value, x, y, maxWidth); }
    },
    textWidth(value: string) { return c.measureText(value).width; },
    image(source: CanvasImageSource, x: number, y: number, w?: number, h?: number) {
      if (w === undefined && h === undefined) c.drawImage(source, x, y);
      else if (w !== undefined && h !== undefined) c.drawImage(source, x, y, w, h);
      else throw new Error('draw.image() requires both width and height, or neither');
    },
  });
  return { draw, reset() { fill = true; stroke = false; stack.length = 0; } };
}
