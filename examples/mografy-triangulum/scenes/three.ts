// Three.js 3D layers for Mografy scenes.
// Build the scene graph once in setup; renderFrame only poses it from time and draws it into the 2D frame.
// Three.js itself is loaded at runtime from the project's assets/three.module.js (see three-d.md).
import type { FrameContext, SetupContext } from '@mografy/runtime';

/** The Three.js module namespace. Typed loosely so projects need no extra packages. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThreeModule = any;

export interface StageOptions {
  /** Project-relative path of the Three.js bundle. Default `assets/three.module.js`. */
  library?: string;
  /** Vertical field of view in degrees. Default 35. */
  fov?: number;
  /** Logical size of the 3D layer. Default: the whole canvas. */
  width?: number; height?: number;
  /** Multisample antialiasing. Default true. */
  antialias?: boolean;
  /** Tone mapping: 'aces' (filmic), 'agx' or 'none'. Default 'aces'. */
  toneMapping?: 'aces' | 'agx' | 'none';
  exposure?: number;
}

/** A prepared 3D layer. `objects` is whatever `build` returned. */
export interface Stage<T> {
  THREE: ThreeModule; scene: ThreeModule; camera: ThreeModule; objects: T;
  width: number; height: number;
  renderer: ThreeModule; surface: OffscreenCanvas;
}

/** What `build` receives: the library, an empty scene and a camera at (0, 0, 10) looking at the origin. */
export interface BuildContext { THREE: ThreeModule; scene: ThreeModule; camera: ThreeModule; renderer: ThreeModule; setup: SetupContext }

const loaded = new Map<string, Promise<ThreeModule>>();

/**
 * In setup: load Three.js, create the WebGL layer and let `build` add meshes, lights and loaded models.
 * Create every object, material, texture and geometry here; renderFrame must only change their properties.
 */
export async function prepareStage<T>(ctx: SetupContext, build: (b: BuildContext) => T | Promise<T>, o: StageOptions = {}): Promise<Stage<T>> {
  const url = ctx.asset(o.library ?? 'assets/three.module.js');
  let pending = loaded.get(url);
  if (!pending) { pending = import(/* @vite-ignore */ url); loaded.set(url, pending); }
  const THREE = await pending.catch((error: unknown) => {
    loaded.delete(url);
    throw new Error(`Three.js failed to load from ${o.library ?? 'assets/three.module.js'}. Copy extras/three/three.module.js into the project's assets/. (${String(error)})`);
  });
  const width = o.width ?? ctx.width, height = o.height ?? ctx.height;
  const surface = new OffscreenCanvas(width, height);
  const gl = surface.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: o.antialias ?? true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL 2 is unavailable in this browser, so the 3D layer cannot render.');
  const renderer = new THREE.WebGLRenderer({ canvas: surface, context: gl, alpha: true, premultipliedAlpha: true, antialias: o.antialias ?? true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = o.toneMapping === 'none' ? THREE.NoToneMapping : o.toneMapping === 'agx' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure ?? 1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov ?? 35, width / height, 0.1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  const objects = await build({ THREE, scene, camera, renderer, setup: ctx });
  // Compile shaders and render once now: the first render allocates render lists, shadow maps and
  // texture uploads, and those must not happen inside renderFrame (they would also slow the first frame).
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  return { THREE, scene, camera, objects, width, height, renderer, surface };
}

export interface LayerOptions {
  /** Where the layer lands in logical canvas units. Default: covering the canvas. */
  x?: number; y?: number; width?: number; height?: number;
  alpha?: number;
}

/**
 * In renderFrame: `pose` sets positions, rotations, materials and the camera for this time, then the
 * 3D layer renders and is drawn into the frame. Draw 2D backgrounds before it and type after it.
 */
export function stage<T>(ctx: FrameContext, s: Stage<T>, pose: (s: Stage<T>) => void, o: LayerOptions = {}) {
  const x = o.x ?? 0, y = o.y ?? 0, w = o.width ?? ctx.width, h = o.height ?? ctx.height;
  // Render at the output's device resolution so previews and 4K exports stay sharp.
  const pw = Math.max(1, Math.round(w * ctx.renderScale)), ph = Math.max(1, Math.round(h * ctx.renderScale));
  if (s.surface.width !== pw || s.surface.height !== ph) s.renderer.setSize(pw, ph, false);
  s.camera.aspect = w / h;
  pose(s);
  s.camera.updateProjectionMatrix();
  s.renderer.render(s.scene, s.camera);
  ctx.withCanvas(c => {
    c.globalAlpha = Math.min(1, Math.max(0, o.alpha ?? 1));
    c.imageSmoothingQuality = 'high';
    c.drawImage(s.surface, x, y, w, h);
  });
}

/** Spherical orbit: a camera position `distance` from `target` at yaw/pitch in radians. */
export function orbit(camera: ThreeModule, yaw: number, pitch: number, distance: number, target: [number, number, number] = [0, 0, 0]) {
  const [tx, ty, tz] = target;
  camera.position.set(
    tx + distance * Math.cos(pitch) * Math.sin(yaw),
    ty + distance * Math.sin(pitch),
    tz + distance * Math.cos(pitch) * Math.cos(yaw),
  );
  camera.lookAt(tx, ty, tz);
}

/**
 * In setup, inside `build`: load a glTF / GLB model from the project (uncompressed; no Draco or Meshopt).
 * Add `scene` to the stage. To play a clip, create an AnimationMixer here and call mixer.setTime(time) per frame.
 */
export async function loadModel(b: BuildContext, path: string): Promise<{ scene: ThreeModule; animations: ThreeModule[] }> {
  const gltf = await new b.THREE.GLTFLoader().loadAsync(b.setup.asset(path));
  return { scene: gltf.scene, animations: gltf.animations };
}

/** In setup, inside `build`: soft studio reflections for metal and glass, without an HDR file. */
export function studioLight(b: BuildContext, intensity = 1) {
  const pmrem = new b.THREE.PMREMGenerator(b.renderer);
  b.scene.environment = pmrem.fromScene(new b.THREE.RoomEnvironment(), 0.04).texture;
  b.scene.environmentIntensity = intensity;
  pmrem.dispose();
}

/**
 * In setup, inside `build`: draw a 2D canvas once and use it as a texture, for labels, screens and
 * posters on 3D surfaces. Text is drawn with the project's registered fonts.
 */
export function canvasTexture(THREE: ThreeModule, width: number, height: number, draw: (c: OffscreenCanvasRenderingContext2D) => void) {
  const surface = new OffscreenCanvas(width, height), c = surface.getContext('2d')!;
  draw(c);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
