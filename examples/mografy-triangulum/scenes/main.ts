// Mografy Pro Triangulum: a 42-second "coming soon" promo for the upcoming paid edition, Traditional Chinese, no voice-over (storyboards/storyboard.html, v4).
// Ten beats in one continuous camera, linked by a single light trail: a spark blooms into the galaxy and the name; the galaxy straightens into a timeline
// whose solids are drawn by light; a push-in close-up of dragging a solid's end; design.json with a colour wave; springs drawn in light; subtitles that follow
// their layers; three glass cards with a rack focus; a pull-back to the whole editor; it dissolves into stars, the galaxy collapses and the logo builds.
//  B01 0–3.6 spark → galaxy   B02 3.6–8.2 name          B03 8.2–12.6 motion components   B04 12.6–16.2 close-up drag   B05 16.2–20.4 design system
//  B06 20.4–24.6 physics      B07 24.6–28.4 subtitles   B08 28.4–33 everyday          B09 33–36.4 the whole editor    B10 36.4–42 logo, coming soon
// Drawing and the shot table live in world.ts; logo paths in logo.ts. The galaxy and the deep star field are Three.js point clouds
// (buildParticles in world.ts) rendered through the 3D layer from three.ts and drawn into the frame at their depth between the 2D layers.
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { prepareStage } from './three.js';
import { frame, DUR, BEATS, prepareWorld, buildParticles } from './world.js';

export const meta = {
  width: 1920, height: 1080, duration: 42, fps: 60, background: '#050B10',
  // Present mode: one slide per beat, from the shot table in world.ts; each slide waits on its `stop` frame.
  shots: BEATS.shots,
};

export const params = {};

export async function setup(ctx: SetupContext) {
  // the deep-space ground and the soft sprites are painted once here; the particle clouds are built once and only posed per frame
  const st = await prepareStage(ctx, b => buildParticles(b.THREE), { toneMapping: 'none', antialias: false });
  const glp = st.objects;
  st.renderer.compile(glp.galScene, glp.galCam); st.renderer.compile(glp.fieldScene, glp.fieldCam);
  ctx.assets.stage = st;
  ctx.assets.world = { ...prepareWorld((w: number, h: number) => new OffscreenCanvas(w, h)), glp,
    glx: { px: 1, render: (scene: unknown, cam: unknown) => { st.renderer.render(scene, cam); return st.surface; } } };
}

export function renderFrame(ctx: FrameContext, time: number) {
  // the 3D layer renders at the output's device resolution; point sizes scale with it
  const st = ctx.assets.stage, pw = Math.max(1, Math.round(ctx.width * ctx.renderScale)), ph = Math.max(1, Math.round(ctx.height * ctx.renderScale));
  if (st.surface.width !== pw || st.surface.height !== ph) st.renderer.setSize(pw, ph, false);
  ctx.assets.world.glx.px = ph / 1080;
  ctx.withCanvas(c => frame(c, Math.min(time, DUR - .001), ctx.assets.world));
}
