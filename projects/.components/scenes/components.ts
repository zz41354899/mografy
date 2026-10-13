// Reusable scene functions. Every animation is calculated from time, with no playback state.
import { clamp, ease, lerp, pr } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';

type Position = { x: number; y: number; start?: number; duration?: number };
type TextOptions = Position & { text: string; color?: string; size?: number; font?: string };
const progress = (time: number, o: Position) => pr(time, o.start ?? 0, (o.start ?? 0) + (o.duration ?? 0.8));
const font = (ctx: FrameContext, o: TextOptions) => {
  ctx.draw.textFont(o.font ?? 'ABeeZee', 400); ctx.draw.textSize(o.size ?? 56);
  ctx.draw.textAlign('left', 'middle'); ctx.draw.fill(o.color ?? '#f2f4f8'); ctx.draw.noStroke();
};

/** Letters rise with a stagger; x is the left edge and y is the baseline's visual center. */
export function staggerText(ctx: FrameContext, time: number, o: TextOptions & { stagger?: number; lift?: number }) {
  ctx.withCanvas(() => {
    const mografy = ctx.draw; font(ctx, o);
    let x = o.x;
    [...o.text].forEach((letter, i) => {
      const start = (o.start ?? 0) + i * (o.stagger ?? 0.055);
      const amount = ease.outExpo(pr(time, start, start + (o.duration ?? 0.65)));
      mografy.opacity(amount); mografy.text(letter, x, o.y + (1 - amount) * (o.lift ?? 32));
      x += mografy.textWidth(letter);
    });
  });
}

/** Reveal characters, including a time-based caret; never uses a timer. */
export function typewriter(ctx: FrameContext, time: number, o: TextOptions & { caret?: boolean }) {
  ctx.withCanvas(() => {
    const mografy = ctx.draw; font(ctx, o);
    const letters = [...o.text], amount = progress(time, o);
    const text = letters.slice(0, Math.floor(letters.length * amount)).join('');
    mografy.text(text, o.x, o.y);
    if (time >= (o.start ?? 0) && o.caret !== false && (amount < 1 || Math.floor((time - (o.start ?? 0)) * 2) % 2 === 0)) {
      const size = o.size ?? 56;
      mografy.rect(o.x + mografy.textWidth(text) + 7, o.y - size * 0.4, 3, size * 0.8);
    }
  });
}

/** An entering card; render optional contents in the card's local coordinate system. */
export function popCard(ctx: FrameContext, time: number, o: Position & { width: number; height: number; color?: string; radius?: number; content?: (ctx: FrameContext) => void }) {
  ctx.withCanvas(() => {
    const mografy = ctx.draw, amount = ease.outExpo(progress(time, o));
    mografy.translate(o.x + o.width / 2, o.y + o.height / 2 + (1 - amount) * 32);
    mografy.scale(lerp(0.88, 1, amount)); mografy.translate(-o.width / 2, -o.height / 2);
    mografy.opacity(amount); mografy.noStroke(); mografy.fill(o.color ?? '#25282e');
    ctx.shadow('#00000055', 22, 0, 8);
    mografy.rect(0, 0, o.width, o.height, o.radius ?? 20);
    ctx.shadow('transparent', 0);
    o.content?.(ctx);
  });
}

/** A rounded progress bar; target is a fraction in 0..1. */
export function progressBar(ctx: FrameContext, time: number, o: Position & { width: number; height?: number; target?: number; color?: string; track?: string }) {
  ctx.withCanvas(() => {
    const mografy = ctx.draw, height = o.height ?? 12;
    mografy.noStroke(); mografy.fill(o.track ?? '#343840'); mografy.rect(o.x, o.y, o.width, height, height / 2);
    const path = new Path2D(); path.roundRect(o.x, o.y, o.width, height, height / 2);
    ctx.clip(path, () => {
      mografy.fill(o.color ?? '#12b5a5');
      mografy.rect(o.x, o.y, o.width * clamp(o.target ?? 1) * ease.inOutCubic(progress(time, o)), height);
    });
  });
}

/** Three deterministic loading dots, staggered by time. */
export function pulseDots(ctx: FrameContext, time: number, o: Position & { color?: string; diameter?: number; spacing?: number; period?: number }) {
  ctx.withCanvas(() => {
    const mografy = ctx.draw, diameter = o.diameter ?? 14;
    mografy.noStroke(); mografy.fill(o.color ?? '#12b5a5');
    const period = Math.max(0.01, o.period ?? 1.2), elapsed = Math.max(0, time - (o.start ?? 0));
    for (let i = 0; i < 3; i++) {
      const wave = (Math.sin(elapsed / period * Math.PI * 2 - i * 0.8) + 1) / 2;
      mografy.opacity(time < (o.start ?? 0) ? 0 : 0.3 + wave * 0.7);
      mografy.circle(o.x + i * (o.spacing ?? 28), o.y - wave * 10, diameter * (0.8 + wave * 0.2));
    }
  });
}

/** A simple logo lockup: a drawing ring and a fading wordmark. */
export function logoReveal(ctx: FrameContext, time: number, o: Position & { text?: string; color?: string; diameter?: number; font?: string }) {
  ctx.withCanvas(() => {
    const mografy = ctx.draw, amount = ease.outExpo(progress(time, o)), diameter = o.diameter ?? 112;
    const color = o.color ?? '#12b5a5';
    mografy.opacity(amount); mografy.noFill(); mografy.stroke(color); mografy.strokeWeight(2);
    mografy.arc(o.x, o.y, diameter, diameter, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * amount);
    mografy.noStroke(); mografy.fill('#f2f4f8'); mografy.textFont(o.font ?? 'ABeeZee', 400);
    mografy.textSize(diameter * 0.14); mografy.textAlign('center', 'middle');
    mografy.text(o.text ?? 'MOGRAFY', o.x, o.y);
  });
}
