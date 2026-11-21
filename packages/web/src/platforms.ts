// The shapes the major platforms take for uploaded video. Most platforms share one of four shapes, so the export
// dialog offers the shape and lists the platforms that use it; the short side then sets the resolution.
export interface Shape { id: string; w: number; h: number; platforms: string }

export const SHAPES: readonly Shape[] = [
  { id: '16:9', w: 16, h: 9, platforms: 'YouTube · X · LinkedIn' },
  { id: '9:16', w: 9, h: 16, platforms: 'Reels · TikTok · Shorts' },
  { id: '1:1', w: 1, h: 1, platforms: 'Instagram · X · LinkedIn' },
  { id: '4:5', w: 4, h: 5, platforms: 'Instagram · Facebook · Threads' },
];
export const SHORT_SIDES = [{ side: 720, label: '720p' }, { side: 1080, label: '1080p' }, { side: 2160, label: '4K' }] as const;

const even = (n: number) => Math.round(n / 2) * 2;
export const sizeOf = (shape: Pick<Shape, 'w' | 'h'>, side: number) => shape.w >= shape.h
  ? { width: even(side * shape.w / shape.h), height: side }
  : { width: side, height: even(side * shape.h / shape.w) };
export const shapeOf = (width: number, height: number) => SHAPES.find(s => width * s.h === height * s.w);
