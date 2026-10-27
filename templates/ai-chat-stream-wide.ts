// AI chat: the prompt types into the glass pill, the send button lights, the pill rises and becomes the user's message
// in a chat window, and the reply streams in under it with a teal caret.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, spring, stage, type C2D, type TemplateInfo } from './kit.js';
import { K, P, bloom, clamp, conic, dot, drawPlane, eio, eo, ground, layer, lerp, lerpPts, look, montageParams, pillUI, planeProj, polyPath, rr, rrPts, setFont, spark, texture, vignette } from './montage.js';

export const template = {
  id: 'ai-chat-stream-wide', name: 'AI chat stream', category: 'screen', aspect: '16:9', pair: 'ai-chat-stream',
  summary: 'A prompt types into the glass pill, the pill rises into a chat window as the user message, and the reply streams in with a teal caret.',
  agentHint: 'Show an AI feature answering. Prompt one line (under ~44 characters), reply 1–3 sentences (under ~190 characters). The chat window is a stand-in: restyle `chat()`; never use a real AI brand name or logo.',
  principles: ['anticipation', 'timing', 'staging', 'slow in and slow out'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 6, fps: 30, background: '#F4F6F8' };

export const params = {
  prompt: { name: 'Prompt', type: 'string' as const, default: 'Write a launch post for our new planner' },
  reply: { name: 'Reply', type: 'string' as const, default: 'Meet the planner your team will actually open. Northwind turns scattered tasks into one calm week, so you spend less time planning and more time shipping.' },
  ...montageParams('light'), ...safeParam,
};

type Pt = [number, number];
const CW = 1240, CH = 620, PW = 1100, PH = 108;
// chat layout, local units
const UB = { right: CW - 52, y: 104, h: 64, font: 25 }, RX = 112, RY = 230, RLH = 50, RFONT = 31, RMAX = 1000;
// timing
const T_TYPE = .4, CPS = 34, CPS_REPLY = 100;
function wrap(c: C2D, text: string, size: number, max: number) {
  setFont(c, size, 500); const lines: string[] = []; let ln = '';
  for (const w of text.split(' ')) { const nx = ln ? `${ln} ${w}` : w; if (ln && c.measureText(nx).width > max) { lines.push(ln); ln = w; } else ln = nx; }
  if (ln) lines.push(ln); return lines;
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, dark = lk.dark, out = exitOf(time, d, .55), flow = time * .55;
  const prompt = String(p.prompt), reply = String(p.reply), plen = [...prompt].length;
  const typed = T_TYPE + plen / CPS, sendAt = typed + .18, rise0 = sendAt + .22, rise1 = rise0 + .7;
  const streamAt = rise1 + .35, streamEnd = streamAt + [...reply].length / CPS_REPLY;
  stage(ctx, '16:9', c => {
    ground(c, p, time);
    // ---- the chat window enters on a tilt as the pill rises, then lies flat to be read
    const k = eio(P(time, rise0, rise1)), sw = spring(time, rise0 - .05, .95, .08), back = eio(P(time, d - .6, d));
    const o = { u: CW / 2, v: CH / 2, px: 960, py: lerp(640, 556, sw) - 12 * back, s: lerp(.8, .9, sw) * lerp(1, .93, back), yaw: lerp(-.34, 0, sw), pitch: lerp(.16, 0, sw), roll: 0 };
    const proj = planeProj(o) as (x: number, y: number) => Pt;
    const win = clamp(P(time, rise0, rise0 + .45)) * (1 - P(time, d - .4, d));
    setFont(c, UB.font, 500); const ubw = c.measureText(prompt).width + 56, ubx = UB.right - ubw;
    if (win > 0) {
      const outline = rrPts(CW / 2, CH / 2, CW, CH, 24, 160).map(q => proj(q[0], q[1]));
      layer(c, 'chat', win, (x: C2D) => {
        // soft elliptical shadow: one gradient fill (a blurred outline needs a buffer of a new size every frame)
        const sc = proj(CW / 2, CH + 40), rw = Math.abs(outline[80]![0] - outline[0]![0]) * .6;
        x.save(); x.translate(sc[0], sc[1]); x.scale(1, .35);
        const g = x.createRadialGradient(0, 0, 0, 0, 0, rw); g.addColorStop(0, dark ? 'rgba(0,0,0,.55)' : 'rgba(28,46,64,.1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(-rw, -rw, rw * 2, rw * 2); x.restore();
        polyPath(x, outline); x.fillStyle = dark ? '#0E1219' : '#FFFFFF'; x.fill();
        const [tex, ts] = texture(x, 'chat', CW, CH, .9, (t: C2D) => chat(t, time, reply, streamAt, streamEnd, rise1, ubx, ubw, prompt, dark));
        drawPlane(x, tex, ts, CW, CH, proj, 16, 10);
      });
    }

    // ---- the prompt pill: opens from a point, types, sends, then morphs into the user's message bubble
    const pa = clamp(P(time, 0, .12));
    if (time < rise1 + .02 && pa > 0) {
      const open = spring(time, .02, .55, .14), w = lerp(PH, PW, open), h = PH;
      const n = (time - T_TYPE) * CPS, send = P(time, sendAt, sendAt + .1), pulse = P(time, sendAt + .05, sendAt + .35);
      const from = rrPts(960, 540, w, h, h / 2, 200), to = rrPts(ubx + ubw / 2, UB.y + UB.h / 2, ubw, UB.h, UB.h / 2, 200).map(q => proj(q[0], q[1]));
      const pts = k > 0 ? lerpPts(from, to, k) : from, m = k > 0 ? [lerp(960, proj(ubx + ubw / 2, UB.y + UB.h / 2)[0], k), lerp(540, proj(ubx + ubw / 2, UB.y + UB.h / 2)[1], k)] as Pt : [960, 540] as Pt;
      c.save(); c.globalAlpha *= pa;
      // body
      c.save(); if (!dark) { c.shadowColor = `rgba(28,46,64,${.13 * (1 - k)})`; c.shadowBlur = 48; c.shadowOffsetY = 14; }
      polyPath(c, pts); c.fillStyle = k > 0 ? bubbleFill(dark, k) : (dark ? '#0B0E14' : '#FFFFFF'); c.fill(); c.restore();
      // typing happens inside the flat pill; once it rises, the words ride along into the bubble
      if (k <= 0) pillUI(c, 960, 540, w, h, prompt, n, send, { dark, body: false, rimA: 0, icon: true, caret: n < plen + 3, now: time, pulse, textA: P(time, .32, .45) });
      else {
        const fs = lerp(h * .33, UB.font * o.s, k), tl = proj(ubx + 28, UB.y + UB.h / 2), x0 = lerp(960 - w / 2 + h * .82, tl[0], k), y0 = lerp(541, tl[1], k);
        setFont(c, fs, 500); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = dark ? K.fg : K.ink; c.globalAlpha *= 1 - P(k, .9, 1);
        c.fillText(prompt, x0, y0);
      }
      // conic rim, blooming while the pill is the whole picture
      const rimA = 1 - eo(k);
      if (rimA > 0) {
        const st = (x: C2D) => { polyPath(x, pts); x.strokeStyle = conic(x, m[0], m[1], flow); x.lineWidth = lerp(3.2, 2, k); x.lineJoin = 'round'; x.stroke(); };
        c.save(); c.globalAlpha *= rimA; st(c); c.restore();
        if (k < .34) bloom(c, st, { radius: 16, strength: .9 * (1 - k * 3), mode: dark ? 'lighter' : 'source-over', halo: .7, bounds: [256, 160, 1408, 544] });
      }
      c.restore();
    }
    if (dark) vignette(c, .45);
    safeGuide(c, '16:9', p.safeGuide);
  });
}

const bubbleFill = (dark: boolean, k: number) => {
  const a = dark ? [11, 14, 20] : [255, 255, 255], b = dark ? [18, 52, 52] : [228, 247, 244];
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i]!, k))).join(',')})`;
};

/** The chat window: header, the user's message (once the pill has landed), thinking dots, the streamed reply, composer. */
function chat(c: C2D, time: number, reply: string, streamAt: number, streamEnd: number, landed: number, ubx: number, ubw: number, prompt: string, dark: boolean) {
  const bg = dark ? '#0E1219' : '#FFFFFF', line = dark ? '#252C38' : '#E2E7EC', fg = dark ? K.fg : K.ink, mut = dark ? '#7F8A99' : '#8A95A3', panel = dark ? '#131822' : '#F5F7F9';
  rr(c, 0, 0, CW, CH, 24); c.fillStyle = bg; c.fill(); c.strokeStyle = line; c.lineWidth = 1.5; c.stroke();
  [0, 1, 2].forEach(i => dot(c, 32 + i * 21, 38, 6.5, dark ? '#2B3240' : '#DCE2E8'));
  spark(c, CW / 2 - 118, 38, 11, time); setFont(c, 18, 600); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText('Northwind Assistant', CW / 2 - 98, 39);
  c.fillStyle = line; c.fillRect(0, 76, CW, 1.5);
  // the user's message: drawn here once the pill has become it
  const ub = P(time, landed - .06, landed + .04);
  if (ub > 0) {
    c.save(); c.globalAlpha *= ub; rr(c, ubx, UB.y, ubw, UB.h, UB.h / 2); c.fillStyle = dark ? '#123434' : '#E4F7F4'; c.fill();
    setFont(c, UB.font, 500); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(prompt, ubx + 28, UB.y + UB.h / 2); c.restore();
  }
  // assistant: avatar, thinking dots, then the reply streams in
  const av = P(time, landed + .05, landed + .3);
  if (av > 0) {
    c.save(); c.globalAlpha *= av; dot(c, 66, RY, 24, dark ? '#16202A' : '#F0FAF8'); spark(c, 66, RY, 13, time); c.restore();
    if (time < streamAt + .05) [0, 1, 2].forEach(i => dot(c, RX + 6 + i * 20, RY, 5.5, mut, av * (.35 + .65 * Math.max(0, Math.sin(time * 9 - i * .9)))));
  }
  const n = Math.floor((time - streamAt) * CPS_REPLY);
  if (n > 0) {
    const lines = wrap(c, reply, RFONT, RMAX); setFont(c, RFONT, 500); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = fg;
    let left = n, cx = RX, cy = RY;
    for (const [i, ln] of lines.entries()) {
      if (left <= 0) break; const chars = [...ln], s = chars.slice(0, left).join(''); left -= chars.length + 1;
      cy = RY + i * RLH; c.fillText(s, RX, cy); cx = RX + c.measureText(s).width;
    }
    // the teal caret rides the end of the stream, then blinks
    if (time < streamEnd + .1 || (time * 1.6) % 1 < .6) { c.fillStyle = K.teal; c.fillRect(cx + 4, cy - 17, 3, 34); }
  }
  // composer
  rr(c, 48, CH - 104, CW - 96, 64, 32); c.fillStyle = panel; c.fill();
  setFont(c, 20, 500); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = mut; c.fillText('Ask Northwind anything', 84, CH - 71);
  dot(c, CW - 88, CH - 72, 20, dark ? '#222936' : '#E3E8EC');
}
