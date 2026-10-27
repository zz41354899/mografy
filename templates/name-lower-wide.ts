// Wide lower third: a short comet of light runs in and draws a line, the name sharpens in above it as the head
// passes each letter, the role settles in below; on the way out the copy blurs away and the line retracts into a dot.
import type { FrameContext } from '@mografy/runtime';
import { exitOf, safeGuide, safeParam, stage, type C2D, type TemplateInfo } from './kit.js';
import { H, K, P, W, bez, bloom, blurLayer, clamp, dot, eio, eo, comet, glow, kin, look, mkPath, montageParams, pAt, rgba, specLinear, textW, vignette } from './montage.js';

export const template = {
  id: 'name-lower-wide', name: 'Wide lower third', category: 'caption', aspect: '16:9',
  summary: 'A comet draws a line, the name sharpens in above it as the light passes, the role follows; it exits into a dot.',
  agentHint: 'Name and role over an interview or talking-head shot in a landscape film. Name 1–3 words, role under ~40 characters. Play it with `backdrop: false` over your footage; the soft-focus speaker underneath is only a stand-in.',
  principles: ['follow-through', 'staging', 'timing', 'secondary action'],
} satisfies TemplateInfo;

export const meta = { width: 1920, height: 1080, duration: 4, fps: 30, background: '#06080C' };

export const params = {
  name: { name: 'Name', type: 'string' as const, default: 'Maya Chen' },
  role: { name: 'Role', type: 'string' as const, default: 'Founder, Northwind' },
  ...montageParams('night'), ...safeParam,
};

const LX = 160, NY = 772, LY = 838, RY = 888, NS = 80, RS = 32;

/** Stand-in for the film's own picture: a soft-focus interview frame, the speaker on the right third. */
function picture(c: CanvasRenderingContext2D, g: string) {
  const light = g === 'light', neon = g === 'neon';
  const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, light ? '#EFE6DC' : neon ? '#0B0D15' : '#1E2533'); bg.addColorStop(1, light ? '#CBD7E6' : neon ? '#121A2B' : '#2A2236');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  // Out-of-focus room lights behind the speaker.
  glow(c, 430, 290, 300, light ? '#FFE7C4' : '#FFC98A', light ? .55 : .3);
  glow(c, 700, 560, 150, '#FFD9A8', light ? .35 : .22);
  glow(c, 1710, 250, 230, light ? '#BFE3FF' : K.sky, light ? .45 : .2);
  glow(c, 250, 760, 170, '#FFB27A', light ? .25 : .16);
  // The speaker, a little out of focus: long hair, face, neck, shoulders with an open collar, a warm rim light.
  blurLayer(c, 'nl-speaker', 7, x => {
    const hair = light ? '#3B2F2B' : '#1A1517';
    x.fillStyle = hair; x.beginPath(); x.ellipse(1240, 392, 112, 122, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.roundRect(1130, 390, 220, 260, [0, 0, 60, 60]); x.fill();
    const skin = x.createRadialGradient(1205, 400, 10, 1240, 440, 160); skin.addColorStop(0, light ? '#E6BC9F' : '#BE9078'); skin.addColorStop(1, light ? '#B08068' : '#6E4C3E');
    x.fillStyle = skin; x.fillRect(1206, 500, 68, 140);
    x.beginPath(); x.ellipse(1240, 428, 84, 106, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = hair; x.beginPath(); x.ellipse(1250, 340, 104, 54, -.12, 0, Math.PI * 2); x.fill();
    const body = x.createLinearGradient(0, 620, 0, H); body.addColorStop(0, light ? '#5C6B80' : '#3A4458'); body.addColorStop(1, light ? '#37424F' : '#161B25');
    x.beginPath(); x.moveTo(760, H); x.bezierCurveTo(790, 760, 960, 660, 1160, 630); x.lineTo(1320, 630); x.bezierCurveTo(1520, 660, 1690, 760, 1720, H); x.closePath(); x.fillStyle = body; x.fill();
    x.beginPath(); x.moveTo(1196, 628); x.lineTo(1240, 708); x.lineTo(1284, 628); x.closePath(); x.fillStyle = skin; x.fill();
    x.beginPath(); x.moveTo(764, H); x.bezierCurveTo(794, 762, 962, 662, 1160, 632); x.strokeStyle = rgba('#FFC98A', light ? .3 : .45); x.lineWidth = 6; x.stroke();
  }, { bounds: [740, 240, 1000, 840], res: .5 });
  const dk = c.createLinearGradient(0, H * .45, 0, H); dk.addColorStop(0, 'rgba(4,6,10,0)'); dk.addColorStop(1, `rgba(4,6,10,${light ? .22 : .5})`);
  c.fillStyle = dk; c.fillRect(0, H * .45, W, H * .55);
  if (!light) vignette(c, .45);
}

/** A soft oval scrim behind the copy, so it reads over any picture and with `backdrop: false`. */
function scrim(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, col: string, a: number) {
  if (a <= 0) return;
  c.save(); c.translate(cx, cy); c.scale(rx / ry, 1);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, ry); [[0, 1], [.3, .9], [.55, .58], [.78, .22], [1, 0]].forEach(([o, k]) => g.addColorStop(o!, rgba(col, a * k!)));
  c.fillStyle = g; c.fillRect(-ry, -ry, ry * 2, ry * 2); c.restore();
}

export function renderFrame(ctx: FrameContext, time: number, p: Readonly<Record<string, unknown>>) {
  const lk = look(p), d = meta.duration, out = exitOf(time, d, .55);
  stage(ctx, '16:9', c => {
    if (p.backdrop !== false) picture(c, lk.g);
    const light = lk.g === 'light', ink = light ? K.ink : '#FFFFFF', mut = light ? '#4B5563' : '#B4BECB';
    const name = String(p.name), role = String(p.role);
    const L = Math.max(textW(c, name, NS, 600), textW(c, role, RS, 500)) + 48;
    scrim(c, LX + L / 2, LY, L / 2 + 330, 250, light ? '#FFFFFF' : lk.g === 'neon' ? '#000000' : '#05070C', (light ? .5 : .66) * eo(P(time, 0, .4)) * (1 - out));

    // The comet enters on a short curve from below and runs along the line.
    const path = mkPath([...bez([LX - 150, LY + 96], [LX - 90, LY + 60], [LX - 70, LY], [LX, LY], 30), [LX + L, LY]]);
    const s = path.len * eo(P(time, .12, 1.15)), head = pAt(path, s), lineEnd = clamp(head[0], LX, LX + L);
    // Exit: the line retracts into a dot at its start, the dot fades last.
    const ret = eio(P(time, d - .62, d - .2)), x1 = lineEnd - (lineEnd - LX) * ret, dotA = P(time, d - .4, d - .3) * (1 - P(time, d - .16, d));
    if (x1 - LX > 1) {
      const line = (x: C2D) => { x.fillStyle = specLinear(x, LX, 0, LX + L, 0, [K.teal, K.sky, K.violet]); x.beginPath(); x.roundRect(LX, LY - 1.75, x1 - LX, 3.5, 1.75); x.fill(); };
      line(c);
      if (!light && time > 1.0) bloom(c, line, { radius: 7, strength: .7 * P(time, 1.0, 1.4), halo: .5, bounds: [LX - 20, LY - 20, L + 40, 40] });
    }
    const trailA = 1 - P(time, 1.15, 1.5);
    if (trailA > 0 && time > .12) {
      const emit = (x: C2D) => { comet(x, path, s, { len: 520, lw: 3.6, step: 16 }); dot(x, head[0], head[1], 6, light ? K.teal : '#FFFFFF'); };
      c.save(); c.globalAlpha *= trailA; emit(c); c.restore();
      bloom(c, emit, { radius: 9, strength: (light ? .5 : 1.1) * trailA, halo: .9, mode: light ? 'source-over' : 'lighter', bounds: [LX - 200, LY - 140, L + 280, 280] });
    }
    if (dotA > 0) {
      c.save(); c.globalCompositeOperation = light ? 'source-over' : 'lighter'; glow(c, LX, LY, 70, K.teal, .4 * dotA); c.restore();
      dot(c, LX, LY, 6, light ? K.teal : '#FFFFFF', dotA);
    }

    // The name is written by the head as it passes; the role settles in once the line lands.
    kin(c, name, LX, NY, NS, ink, time - .1, { al: 'left', w: 600, out, lift: .25,
      prog: (_i, gx) => Math.max(eo(clamp((head[0] - gx - 20) / 220)), eo(P(time, 1.15, 1.7))) });
    kin(c, role, LX + 2, RY, RS, mut, time - .95, { al: 'left', w: 500, st: .014, d: .45, tint: false, out });
    safeGuide(c, '16:9', p.safeGuide);
  });
}
