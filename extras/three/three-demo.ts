// An eight-second tour of three.ts: a device with a drawn screen orbits into a hero pose among floating shapes,
// with a 2D gradient behind the 3D layer and 2D type in front of it.
import { clamp, ease, lerp, pr } from '@mografy/runtime';
import type { FrameContext, SetupContext } from '@mografy/runtime';
import { prepareStage, stage, orbit, studioLight, canvasTexture } from './three.js';
import type { Stage, ThreeModule } from './three.js';

export const meta = { width: 1920, height: 1080, duration: 8, fps: 30, background: '#0d0b14' };

export const params = {
  accent: { name: 'Accent colour', type: 'color' as const, default: '#7c5cff' },
};
type Values = { accent: string };
const TITLE = 'Now in 3D';
const outBack = (p: number) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
type Objects = { device: ThreeModule; shapes: { mesh: ThreeModule; base: [number, number, number]; phase: number }[]; accentMaterials: ThreeModule[] };

export async function setup(ctx: SetupContext) {
  ctx.assets.stage = await prepareStage<Objects>(ctx, b => {
    const { THREE, scene } = b;
    studioLight(b, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 6, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb4ff, 1.6); rim.position.set(-6, 2, -4); scene.add(rim);

    // Device: a rounded slab with a screen texture drawn once.
    const device = new THREE.Group();
    const body = new THREE.Mesh(new THREE.RoundedBoxGeometry(2.4, 4.9, 0.28, 6, 0.32),
      new THREE.MeshPhysicalMaterial({ color: 0x1a1a22, metalness: 0.85, roughness: 0.28, clearcoat: 1 }));
    const screenMap = canvasTexture(THREE, 600, 1220, c => {
      const g = c.createLinearGradient(0, 0, 600, 1220); g.addColorStop(0, '#1b1440'); g.addColorStop(1, '#5a3cff');
      c.fillStyle = g; c.fillRect(0, 0, 600, 1220);
      c.fillStyle = '#ffffff'; c.font = '600 120px ABeeZee, sans-serif'; c.textAlign = 'center';
      c.fillText('Mografy', 300, 590); c.font = '400 52px ABeeZee, sans-serif'; c.globalAlpha = .7; c.fillText('three.ts', 300, 680);
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 4.6), new THREE.MeshBasicMaterial({ map: screenMap, toneMapped: false }));
    screen.position.z = 0.145;
    device.add(body, screen);
    scene.add(device);

    // Floating shapes share accent materials so the colour param can restyle them per frame.
    const accentMaterials = [0.15, 0.55].map(r => new THREE.MeshPhysicalMaterial({ color: 0x7c5cff, metalness: 0.2, roughness: r, clearcoat: 0.6 }));
    const geometries = [new THREE.TorusGeometry(0.55, 0.2, 32, 96), new THREE.IcosahedronGeometry(0.6, 0), new THREE.SphereGeometry(0.45, 48, 32), new THREE.TorusKnotGeometry(0.4, 0.13, 160, 24)];
    const spots: [number, number, number][] = [[-3.4, 1.7, -1], [3.4, 2.1, -2], [-3.1, -1.6, 0.5], [3.6, -1.2, 0], [-5.6, 0.2, -4], [5.8, 0.6, -4]];
    const shapes = spots.map((base, i) => {
      const mesh = new THREE.Mesh(geometries[i % geometries.length], accentMaterials[i % 2]);
      mesh.position.set(...base); scene.add(mesh);
      return { mesh, base, phase: ctx.random() * Math.PI * 2 };
    });
    return { device, shapes, accentMaterials };
  });
}

export function renderFrame(ctx: FrameContext, time: number, input: Readonly<Record<string, unknown>>) {
  const p = input as Values, t = time, W = ctx.width, H = ctx.height;
  const s = ctx.assets.stage as Stage<Objects>;

  // 2D background behind the 3D layer.
  ctx.withCanvas(c => {
    const g = c.createRadialGradient(W * .5, H * .45, 0, W * .5, H * .45, W * .7);
    g.addColorStop(0, '#2a2140'); g.addColorStop(1, '#0d0b14');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  });

  const intro = ease.outCubic(pr(t, 0, 2.6));
  stage(ctx, s, ({ camera, objects }) => {
    // Camera swings from a low side angle into a frontal hero pose, then drifts.
    orbit(camera, lerp(-1.1, 0, intro) + .08 * Math.sin(t * .6), lerp(-.25, .06, intro), lerp(14, 10.6, intro), [0, -.3, 0]);
    const d = objects.device;
    d.rotation.set(.12 * Math.sin(t * .8), lerp(Math.PI * .9, 0, ease.inOutCubic(pr(t, .2, 2.8))) + .18 * Math.sin(t * .7), 0);
    d.position.y = .12 * Math.sin(t * 1.3);
    for (const m of objects.accentMaterials) m.color.set(p.accent);
    for (const [i, sh] of objects.shapes.entries()) {
      const pop = outBack(pr(t, .5 + i * .12, 1.3 + i * .12));
      sh.mesh.scale.setScalar(Math.max(0.001, pop));
      sh.mesh.position.set(sh.base[0], sh.base[1] + .25 * Math.sin(t * 1.1 + sh.phase), sh.base[2]);
      sh.mesh.rotation.set(t * .7 + sh.phase, t * .9, 0);
    }
  });

  // 2D type in front of the 3D layer.
  const v = ease.outCubic(pr(t, 3.0, 3.8)), out = 1 - ease.inOutCubic(pr(t, 7.4, 8));
  if (v > 0) {
    const draw = ctx.draw;
    draw.push(); draw.opacity(clamp(v * out)); draw.textFont('ABeeZee', 400); draw.textSize(H * .075);
    draw.textAlign('center', 'alphabetic'); ctx.shadow('#00000099', 24, 0, 4); draw.fill('#ffffff');
    draw.text(TITLE, W / 2, H * .93 + (1 - v) * 20); draw.pop();
  }
  ctx.vignette(.3);
}
