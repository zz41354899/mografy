// AI chat stream: a chat set like a printed interview. "YOU" in orange Anton with a rule, the prompt rises word
// by word; "NORTHWIND AI" follows, three dots think, and the reply streams in word by word behind an orange caret.
import type { FrameContext } from '@mografy/runtime';
import { at, ease, exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { MX, SANS, W, charLine, editorialParams, glyph, measure, page, paper, txt, wordLine, wrapLines, type Ink, type Page } from './editorial.js';

export const template = {
  id: 'ai-chat-stream', name: 'AI chat stream', category: 'screen', aspect: '9:16',
  pair: 'ai-chat-stream-wide',
  summary: 'A chat set like a printed interview: the prompt rises, dots think, and the reply streams in word by word.',
  agentHint: 'Show an AI feature answering. Prompt under ~60 characters, reply under ~200 (about 30 words; longer replies stream too fast to read). Speaker labels are SPEAKERS in the file.',
  principles: ['timing', 'staging', 'anticipation', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1080, height: 1920, duration: 6, fps: 30, background: '#FFFFFF' };

export const params = {
  prompt: { name: 'Prompt', type: 'string' as const, default: 'Write a launch post for our new planner' },
  reply: { name: 'Reply', type: 'string' as const, default: 'Meet the planner your team will actually open. Northwind turns scattered tasks into one calm week, so you spend less time planning and more time shipping.' },
  ...editorialParams, ...safeParam,
};

const SPEAKERS = ['You', 'Northwind AI'], RIGHT = W - MX - 60, LABEL = 58;
const ASK: Ink = { size: 70, color: '', family: SANS, weight: 800 }, ANSWER: Ink = { size: 50, color: '', family: SANS, weight: 600 };
const ASK_LH = 84, ANSWER_LH = 70, AI0 = 1.25, STREAM0 = 2.25, PER_WORD = .072;
/** Baseline offsets below a label for the first line of each turn. */
const ASK_SIZE_OFFSET = 74, ANSWER_SIZE_OFFSET = 60;

/** A speaker label in orange Anton, then a rule that runs out to the right margin. */
function speaker(c: C2D, pg: Page, name: string, y: number, time: number, start: number, exitAt: number, out: number) {
  const boxes = charLine(c, name.toUpperCase(), MX, y, LABEL, time, start, { color: pg.accent, align: 'left', stagger: .03, exitAt, fx: () => ({ alpha: 1 - out }) });
  const end = boxes.length ? boxes[boxes.length - 1]![1] + 28 : MX, k = at(time, start + .15, start + .7, ease.inOutCubic);
  c.save(); c.globalAlpha *= 1 - out; c.fillStyle = pg.ink; c.fillRect(end, y - 20, (RIGHT - end) * k, 2); c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const pg = page(p), d = meta.duration, out = exitOf(time, d, .55);
  stage(ctx, '9:16', c => {
    paper(c, p, pg);
    const ask = wrapLines(c, String(p.prompt), RIGHT - MX, ASK).slice(0, 3);
    const answer = wrapLines(c, String(p.reply), RIGHT - MX, ANSWER).slice(0, 8);
    // Centre the interview on the page from its measured height.
    const h = LABEL + 40 + ask.length * ASK_LH + 90 + LABEL + 40 + answer.length * ANSWER_LH;
    const y0 = Math.max(240, 930 - h / 2) + LABEL;
    const yAsk = y0 + 40 + ASK_SIZE_OFFSET, yAi = y0 + 40 + ask.length * ASK_LH + 90 + LABEL, yAns = yAi + 40 + ANSWER_SIZE_OFFSET;

    // Turn 1: the person.
    speaker(c, pg, SPEAKERS[0]!, y0, time, .1, d - .6, out);
    // The prompt leaves with the reply (a lift and a fade), so no clipped descenders linger in its mask.
    c.save(); c.globalAlpha *= 1 - out; c.translate(0, -out * 30);
    ask.forEach((ln, i) => wordLine(c, ln, MX, yAsk + i * ASK_LH, { ...ASK, color: pg.ink }, time, .3 + i * .16, { stagger: .05 }));
    c.restore();

    // Turn 2: the assistant. Dots think, then the reply streams word by word.
    speaker(c, pg, SPEAKERS[1]!, yAi, time, AI0, d - .55, out);
    const stream = time - STREAM0;
    if (time > AI0 + .3 && stream < .05) {
      const a = at(time, AI0 + .3, AI0 + .5) * (1 - at(time, STREAM0 - .1, STREAM0 + .05));
      for (let i = 0; i < 3; i++) {
        const bump = Math.max(0, Math.sin((time - AI0) * 7 - i * .9));
        c.save(); c.globalAlpha *= a * (.35 + .65 * bump); c.fillStyle = pg.accent;
        c.beginPath(); c.arc(MX + 14 + i * 42, yAns - 18 - bump * 12, 13, 0, Math.PI * 2); c.fill(); c.restore();
      }
    }
    let n = 0, cx = MX, cy = yAns;
    const total = answer.reduce((a, l) => a + l.split(' ').length, 0), shown = Math.max(0, Math.floor(stream / PER_WORD) + 1);
    c.save(); c.globalAlpha *= 1 - out; c.translate(0, -out * 30);
    const space = measure(c, ' ', ANSWER);
    answer.forEach((ln, li) => {
      let x = MX; const y = yAns + li * ANSWER_LH;
      for (const word of ln.split(' ')) {
        const t = STREAM0 + n * PER_WORD, k = at(time, t, t + .16, ease.outQuint);
        if (k > 0) { const w = txt(c, word, x, y + (1 - k) * 8, { ...ANSWER, color: pg.ink, alpha: k }); cx = x + w; cy = y; }
        x += measure(c, word, ANSWER) + space; n++;
      }
    });
    // Caret: rides the end of the stream and leaves when the reply is complete; a closing mark drops in its place.
    const tEnd = STREAM0 + (total - 1) * PER_WORD + .16;
    if (stream >= 0 && time < tEnd + .2 && shown <= total) { c.fillStyle = pg.accent; c.fillRect(cx + 10, cy - 42, 24, 52); }
    c.restore();
    const drop = spring(time, tEnd + .1, .45, .28);
    if (drop > 0) glyph(c, '”', RIGHT - 30, yAns + (answer.length - 1) * ANSWER_LH + 120 - (1 - drop) * 120, 190, pg.accent, { alpha: Math.min(1, drop * 3) * (1 - out) });
    safeGuide(c, '9:16', p.safeGuide);
  });
}

