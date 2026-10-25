// Mografy montage v3: a 60-second promo in one continuous camera move (storyboards/storyboard.png).
//  Act I   0–19.2   dark: one comet of light draws the act (S-curve, wave, spiral, three nodes, a line, two arches); the camera
//                   follows its head and flies into it until the light floods the frame.
//  Act II  19.2–38.4 light: the light narrows to an underline → prompt pill → 3D Mografy window (pull back, slider dive, "Done.")
//                   → one outline morphs Write / Tune / Score / Present → a teal dot.
//  Act III 38.4–60  neon: hard cut on the dot → neon pill and fly-through → kinetic type → whip pan to the dark window, which
//                   re-renders calmer → breaks into stars → spiral galaxy → a light arc draws the slogan pill → the dot draws the logo.
// Drawing and the shot table live in montage-world.ts; logo paths in logo.ts. Score: music-src/compose.py → assets/music.mp3.
import type { FrameContext } from '@mografy/runtime';
import { frame, setLang, DUR, SHOTS } from './montage-world.js';

export const meta = {
  width: 1920, height: 1080, duration: 60, fps: 30, background: '#06080C',
  // Present mode slides come from the one shot table in montage-world.ts
  shots: SHOTS.shots,
};

export const params = {
  lang: { name: 'Copy language', type: 'enum' as const, default: 'en', options: ['en', 'zh'] },
};

export function renderFrame(ctx: FrameContext, time: number, p: { lang: string }) {
  setLang(p.lang);
  ctx.withCanvas(c => frame(c, Math.min(time, DUR - .001)));
}
