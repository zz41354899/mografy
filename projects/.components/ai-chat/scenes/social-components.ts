// Common UI motion, drawn with Canvas. Every state is derived from time.
import { ease, lerp, pr } from '@mografy/runtime';
import type { FrameContext } from '@mografy/runtime';

type Options = { x: number; y: number; color?: string; start?: number };
const WHITE = '#f2f4f8', PANEL = '#25282e', MUTED = '#9399a3';
const ink = (o: Options) => o.color ?? '#12b5a5';
const elapsed = (time: number, o: Options) => time - (o.start ?? 0);
function enter(ctx: FrameContext, time: number, o: Options, draw: (time: number) => void) {
  ctx.withCanvas(() => {
    const localTime = elapsed(time, o), amount = ease.outExpo(pr(localTime, 0, .65));
    const mografy = ctx.draw;
    mografy.translate(o.x, o.y + (1 - amount) * 28); mografy.opacity(amount);
    mografy.noStroke(); mografy.textFont('ABeeZee', 400); mografy.textAlign('left', 'middle');
    draw(localTime);
  });
}
function text(ctx: FrameContext, value: string, x: number, y: number, size: number, color = WHITE) {
  ctx.draw.noStroke(); ctx.draw.fill(color); ctx.draw.textSize(size); ctx.draw.text(value, x, y);
}
/** Measured wrapping also handles CJK and long words without horizontal squeezing. */
function lines(ctx: FrameContext, value: string, size: number, width: number, maxLines: number) {
  ctx.draw.textSize(size);
  const result: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const letter of [...paragraph]) {
      if (line && ctx.draw.textWidth(line + letter) > width) {
        const space = line.lastIndexOf(' ');
        result.push((space > 0 ? line.slice(0, space) : line).trimEnd());
        line = (space > 0 ? line.slice(space + 1) : '') + letter;
      } else line += letter;
    }
    result.push(line.trim());
  }
  if (result.length > maxLines) {
    result.length = maxLines;
    let last = result[maxLines - 1]!;
    while (last && ctx.draw.textWidth(last + '…') > width) last = [...last].slice(0, -1).join('');
    result[maxLines - 1] = last + '…';
  }
  return result;
}
function textLines(ctx: FrameContext, values: string[], x: number, y: number, size: number, color = WHITE) {
  values.forEach((value, i) => text(ctx, value, x, y + i * size * 1.3, size, color));
}
function panel(ctx: FrameContext, width: number, height: number, radius = 32) {
  ctx.shadow('#00000044', 28, 0, 12); ctx.draw.fill(PANEL); ctx.draw.rect(0, 0, width, height, radius); ctx.shadow('transparent', 0);
}
function check(ctx: FrameContext, x: number, y: number, size: number, color = WHITE) {
  ctx.withCanvas(() => {
    const mografy = ctx.draw;
    mografy.noFill(); mografy.stroke(color); mografy.strokeWeight(size * .11); mografy.strokeCap('round');
    mografy.line(x - size * .38, y, x - size * .08, y + size * .28);
    mografy.line(x - size * .08, y + size * .28, x + size * .42, y - size * .3);
  });
}
const heart = new Path2D('M0 34 C-12 23 -43 2 -43 -20 C-43 -47 -13 -54 0 -31 C13 -54 43 -47 43 -20 C43 2 12 23 0 34 Z');
const bell = new Path2D('M-26 17 L-21 6 L-21 -10 Q-21 -32 0 -32 Q21 -32 21 -10 L21 6 L26 17 Z M-8 27 Q0 39 8 27');
const cursor = new Path2D('M0 0 L0 58 L15 43 L27 68 L38 63 L26 38 L47 37 Z');
function bellIcon(ctx: FrameContext, x: number, y: number, size: number, rotation = 0) {
  ctx.withCanvas(() => {
    const mografy = ctx.draw;
    mografy.translate(x, y); mografy.scale(size / 80); mografy.rotate(rotation);
    mografy.noFill(); mografy.stroke(WHITE); mografy.strokeWeight(5); mografy.strokeJoin('round'); mografy.strokeCap('round'); mografy.path(bell);
  });
}
function clickCursor(ctx: FrameContext, time: number, x: number, y: number, clickTime = 1.3) {
  ctx.withCanvas(() => {
    const mografy = ctx.draw, move = ease.inOutCubic(pr(time, .35, clickTime));
    mografy.translate(x + (1 - move) * 150, y + (1 - move) * 130);
    const ring = pr(time, clickTime, clickTime + .4);
    if (ring > 0 && ring < 1) {
      mografy.push(); mografy.opacity(1 - ring); mografy.noFill(); mografy.stroke(WHITE); mografy.strokeWeight(3); mografy.circle(0, 0, 20 + ring * 90); mografy.pop();
    }
    const press = Math.sin(pr(time, clickTime - .1, clickTime + .15) * Math.PI);
    mografy.scale(1 - press * .12); mografy.noStroke(); mografy.fill(WHITE); ctx.shadow('#00000099', 9, 0, 3); mografy.path(cursor);
  });
}

/** A post card, with a profile, abstract artwork and a compact action row. */
export function socialCard(ctx: FrameContext, time: number, o: Options & { name?: string; avatar?: string; caption?: string }) {
  enter(ctx, time, o, localTime => {
    const mografy = ctx.draw; panel(ctx, 620, 630);
    mografy.fill(ink(o)); mografy.circle(70, 70, 64);
    text(ctx, lines(ctx, o.avatar ?? 'M', 35, 50, 1)[0]!, 51, 70, 35);
    textLines(ctx, lines(ctx, o.name ?? 'Mografy', 36, 460, 1), 120, 70, 36);
    const crop = new Path2D(); crop.roundRect(28, 130, 564, 380, 20);
    ctx.clip(crop, () => {
      mografy.fill('#1a3637'); mografy.rect(28, 130, 564, 380);
      const rotate = Math.sin(localTime * .9) * .12;
      mografy.translate(310, 320); mografy.rotate(rotate);
      mografy.fill(ink(o)); mografy.rect(-135, -135, 270, 270, 58);
      mografy.fill('#f2f4f8'); mografy.circle(85, -60, 125);
      mografy.fill('#1a3637'); mografy.circle(-30, 58, 110);
    });
    ctx.withCanvas(() => { mografy.translate(62, 573); mografy.scale(.54); mografy.fill(ink(o)); mografy.path(heart); });
    const caption = lines(ctx, o.caption ?? 'Made to move.', 28, 420, 2);
    textLines(ctx, caption, 102, caption.length === 1 ? 573 : 552, 28, MUTED);
    mografy.noFill(); mografy.stroke(MUTED); mografy.strokeWeight(3);
    const bookmark = new Path2D('M548 552 L570 552 L570 585 L559 578 L548 585 Z'); mografy.path(bookmark);
  });
}

/** Simulated subscribe click and bell ring; no external subscription action. */
export function youtubeSubscribe(ctx: FrameContext, time: number, o: Options & { label?: string; subscribed?: string }) {
  enter(ctx, time, o, localTime => {
    const mografy = ctx.draw, clicked = localTime >= 1.3;
    mografy.fill(clicked ? PANEL : ink(o)); mografy.rect(0, 0, 680, 176, 88);
    if (clicked) check(ctx, 85, 88, 46, ink(o));
    else { mografy.fill(WHITE); mografy.triangle(61, 59, 61, 117, 107, 88); }
    textLines(ctx, lines(ctx, clicked ? (o.subscribed ?? 'Subscribed') : (o.label ?? 'Subscribe'), 56, 398, 1), 144, 88, 56);
    const wiggle = clicked ? Math.sin((localTime - 1.3) * 24) * .3 * (1 - pr(localTime, 1.3, 2.2)) : 0;
    bellIcon(ctx, 599, 90, 65, wiggle);
    if (localTime < 2.5) clickCursor(ctx, localTime, 465, 104);
  });
}

/** A compact chat exchange: prompt, thinking dots, then a typed reply. */
export function aiChat(ctx: FrameContext, time: number, o: Options & { prompt?: string; reply?: string; avatar?: string; centered?: boolean }) {
  enter(ctx, time, o, localTime => {
    const mografy = ctx.draw;
    const portrait = ctx.height > ctx.width, promptX = portrait ? 200 : 290, promptWidth = portrait ? 500 : 410;
    const prompt = lines(ctx, o.prompt ?? 'Hello.', 44, promptWidth - 88, 3);
    const response = lines(ctx, o.reply ?? "Let's create.", 44, 440, 3);
    const promptHeight = Math.max(140, prompt.length * 57.2 + 48), replyY = promptHeight + 52;
    const replyHeight = Math.max(160, response.length * 57.2 + 48);
    if (o.centered) mografy.translate(0, -(replyY + replyHeight) / 2);
    mografy.fill(PANEL); mografy.rect(promptX, 0, promptWidth, promptHeight, 38);
    textLines(ctx, prompt, promptX + 44, prompt.length === 1 ? 70 : 48, 44);
    const reply = ease.outCubic(pr(localTime, .6, 1));
    mografy.push(); mografy.opacity(reply); mografy.fill(ink(o)); mografy.rect(0, replyY, 610, replyHeight, 38);
    textLines(ctx, lines(ctx, o.avatar ?? 'AI', 30, 76, 1), 30, replyY + replyHeight / 2, 30);
    if (localTime < 1.4) {
      for (let i = 0; i < 3; i++) mografy.circle(182 + i * 36, replyY + replyHeight / 2 - Math.sin(localTime * 8 - i) * 7, 14);
    } else {
      const value = o.reply ?? "Let's create.";
      const visible = [...value].slice(0, Math.floor([...value].length * pr(localTime, 1.4, 2.2))).join('');
      textLines(ctx, lines(ctx, visible, 44, 440, 3), 126, replyY + (response.length === 1 ? 80 : 48), 44);
    }
    mografy.pop();
  });
}

/** A heart fills and emits a short radial burst. */
export function likeBurst(ctx: FrameContext, time: number, o: Options) {
  enter(ctx, time, o, localTime => {
    const mografy = ctx.draw, hit = pr(localTime, .8, 1.45), bounce = Math.sin(hit * Math.PI) * .22;
    ctx.withCanvas(() => {
      mografy.scale(3.8 * (1 + bounce));
      if (localTime < .8) { mografy.noFill(); mografy.stroke(WHITE); mografy.strokeWeight(3); }
      else { mografy.fill(ink(o)); mografy.noStroke(); }
      mografy.path(heart);
    });
    if (hit > 0 && hit < 1) {
      mografy.stroke(ink(o)); mografy.strokeWeight(8); mografy.strokeCap('round');
      for (let i = 0; i < 8; i++) {
        const angle = i / 8 * Math.PI * 2, a = 215 + hit * 55, b = a + (1 - hit) * 45;
        mografy.line(Math.cos(angle) * a, Math.sin(angle) * a - 18, Math.cos(angle) * b, Math.sin(angle) * b - 18);
      }
    }
  });
}

/** Profile + Follow becomes Following after a simulated click. */
export function followBadge(ctx: FrameContext, time: number, o: Options & { name?: string; avatar?: string; label?: string; following?: string }) {
  enter(ctx, time, o, localTime => {
    const mografy = ctx.draw, followed = localTime >= 1.3;
    if (ctx.height > ctx.width) {
      panel(ctx, 640, 500, 38);
      mografy.fill(ink(o)); mografy.circle(320, 105, 120);
      mografy.textAlign('center', 'middle');
      textLines(ctx, lines(ctx, o.avatar ?? 'M', 52, 90, 1), 320, 105, 52);
      textLines(ctx, lines(ctx, o.name ?? 'Mografy', 48, 544, 1), 320, 220, 48);
      mografy.fill(followed ? '#343840' : ink(o)); mografy.rect(126, 300, 388, 116, 58);
      textLines(ctx, lines(ctx, followed ? (o.following ?? 'Following') : (o.label ?? 'Follow'), 40, 332, 1), 320, 358, 40);
      if (localTime < 2.4) clickCursor(ctx, localTime, 395, 370);
      return;
    }
    panel(ctx, 940, 190, 38);
    mografy.fill(ink(o)); mografy.circle(100, 95, 90); text(ctx, o.avatar ?? 'M', 77, 95, 45);
    textLines(ctx, lines(ctx, o.name ?? 'Mografy', 44, 440, 1), 180, 95, 44);
    mografy.fill(followed ? '#343840' : ink(o)); mografy.rect(660, 47, 232, 96, 48);
    mografy.textAlign('center', 'middle'); textLines(ctx, lines(ctx, followed ? (o.following ?? 'Following') : (o.label ?? 'Follow'), 32, 208, 1), 776, 95, 32);
    if (localTime < 2.4) clickCursor(ctx, localTime, 795, 113);
  });
}

/** A notification enters, rings its bell, and drains its lifetime indicator. */
export function notificationToast(ctx: FrameContext, time: number, o: Options & { message?: string }) {
  enter(ctx, time, o, localTime => {
    const mografy = ctx.draw, portrait = ctx.height > ctx.width;
    const width = portrait ? 640 : 870, height = portrait ? 310 : 176;
    panel(ctx, width, height, 32);
    mografy.fill(ink(o)); mografy.circle(84, 83, 86);
    bellIcon(ctx, 84, 82, 54, Math.sin(localTime * 20) * .18 * (1 - pr(localTime, .3, 1.1)));
    const message = lines(ctx, o.message ?? 'New message', 46, width - 200, portrait ? 4 : 2);
    textLines(ctx, message, 166, message.length === 1 ? 83 : 65, 46);
    const clip = new Path2D(); clip.roundRect(0, 0, width, height, 32);
    ctx.clip(clip, () => { mografy.fill(ink(o)); mografy.rect(0, height - 6, width * (1 - pr(localTime, .6, 3.7)), 6); });
  });
}

/** A two-line name plate with a drawing accent rail. */
export function lowerThird(ctx: FrameContext, time: number, o: Options & { name?: string; subtitle?: string }) {
  enter(ctx, time, o, localTime => {
    const mografy = ctx.draw, portrait = ctx.height > ctx.width;
    const panelWidth = portrait ? 680 : 960, height = portrait ? 290 : 230;
    const width = panelWidth * ease.outExpo(pr(localTime, 0, .75));
    const clip = new Path2D(); clip.rect(0, -10, width, height + 20);
    ctx.clip(clip, () => {
      mografy.fill(PANEL); mografy.rect(0, 0, panelWidth, height, 22);
      mografy.fill(ink(o)); mografy.rect(0, 0, 9, height);
      textLines(ctx, lines(ctx, o.name ?? 'Mografy', 62, panelWidth - 110, 1), 62, 86, 62);
      textLines(ctx, lines(ctx, o.subtitle ?? 'Motion designer', 34, panelWidth - 110, portrait ? 3 : 2), 62, 160, 34, MUTED);
    });
  });
}

/** A number counts up with a small underline; no extra dashboard labels. */
export function countUp(ctx: FrameContext, time: number, o: Options & { value?: number }) {
  enter(ctx, time, o, localTime => {
    const mografy = ctx.draw, amount = ease.outCubic(pr(localTime, 0, 2.2));
    const value = Math.round((o.value ?? 1280) * amount).toLocaleString('en-US');
    mografy.textAlign('center', 'middle'); text(ctx, value, 0, 0, 220);
    mografy.fill(ink(o)); mografy.rect(-180, 155, 360 * amount, 8, 4);
  });
}

/** A large switch glides from off to on. */
export function toggleSwitch(ctx: FrameContext, time: number, o: Options) {
  enter(ctx, time, o, localTime => {
    const mografy = ctx.draw, amount = ease.inOutCubic(pr(localTime, .65, 1.45));
    mografy.fill('#343840'); mografy.rect(0, 0, 440, 200, 100);
    mografy.push(); mografy.opacity(amount); mografy.fill(ink(o)); mografy.rect(0, 0, 440, 200, 100); mografy.pop();
    mografy.fill(WHITE); mografy.circle(lerp(100, 340, amount), 100, 164);
  });
}

/** A deterministic pill waveform that can be scrubbed in either direction. */
export function audioWave(ctx: FrameContext, time: number, o: Options & { bars?: number }) {
  enter(ctx, time, o, localTime => {
    const mografy = ctx.draw, bars = Math.max(3, Math.min(40, Math.round(o.bars ?? 19)));
    for (let i = 0; i < bars; i++) {
      const envelope = Math.sin((i + .5) / bars * Math.PI);
      const wave = .3 + .7 * (Math.sin(localTime * 5 + i * .75) + 1) / 2;
      const height = 38 + envelope * wave * 360;
      mografy.fill(i % 3 === 0 ? WHITE : ink(o));
      mografy.rect((i - (bars - 1) / 2) * 48 - 12, -height / 2, 24, height, 12);
    }
  });
}
