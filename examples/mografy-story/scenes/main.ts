// Why I built Mografy: a 71-second story film from the blog post, Traditional Chinese captions, no voice-over (storyboards/storyboard.html, v3).
// 0–25 s a dark "black box" world: one prompt makes a video, every small edit regenerates everything. The box opens at 27.7 s and
// the frame turns into the blog's light palette: scenes, time, params and components; a +0.5 s edit that touches only the title;
// four people Mografy is for; describing motion to AI; the closing line; the brand logo animation (light) with the URL at the bottom.
//  S01 0–4.5   the question         S02 4.5–9    one prompt, one video     S03 9–13     can we still control it?
//  S04 13–18.5 every edit regenerates S05 18.5–22.5 versions pile up        S06 22.5–30.5 like building a web page (box opens)
//  S07 30.5–37 an editable system    S08 37–42    change only that part     S09 42–54    four people, one line each
//  S10 54–59   describe it to AI     S11 59–64    the final decisions       S12 64–70.75 brand logo, URL
// Drawing and the shot table live in story-world.ts (shots keep their storyboard design times; `sx` slows S06 and S11); logo paths in logo.ts.
import type { FrameContext } from '@mografy/runtime';
import { frame, DUR, BEATS } from './story-world.js';

export const meta = {
  width: 1920, height: 1080, duration: 70.75, fps: 30, background: '#151619',
  // Present mode: one slide per shot, from the shot table in story-world.ts; each slide waits on its `stop` frame.
  shots: BEATS.shots,
};

export const params = {};

export function renderFrame(ctx: FrameContext, time: number) {
  ctx.withCanvas(c => frame(c, Math.min(time, DUR - .001)));
}
