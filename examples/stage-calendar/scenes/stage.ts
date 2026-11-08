// Mografy Stage: product UI simplified to what the viewer needs, framed with intent, and every motion has a cause.
//
// A stage film is a state machine played by a script. `play(initial, steps, { layout })` compiles the script once
// into a timeline; `show.at(time)` samples it, so drawing stays a pure function of time. `layout(state)` names the
// rectangles the cursor and camera aim at, and the kit draws windows, phones, placeholder lines, rolling numbers and
// flights from one set of look tokens. Text that does not fit its box, and a loop that does not return home, throw
// a clear error instead of shipping quietly.
import { cameraPath, clamp, ease, lerp, pr, pulse, springEase, springs } from '@mografy/runtime';
import type { CameraKey, Curve, FilmCamera } from '@mografy/runtime';

type C2D = CanvasRenderingContext2D;
export type Rect = [x: number, y: number, width: number, height: number];
export type Point = [x: number, y: number];
export type Value = string | number | boolean | null;
export type State = Record<string, Value>;
export type CursorShape = 'arrow' | 'pointer' | 'text' | 'grab' | 'grabbing' | 'crosshair';
export type Target = string | Point;

// ---------------------------------------------------------------- the script

interface SetOptions { duration?: number; curve?: Curve }
export type Step<S extends State> =
  | { kind: 'wait'; seconds: number }
  | { kind: 'set'; values: Partial<S>; options: SetOptions }
  | { kind: 'move'; to: Target; pace: number }
  | { kind: 'click'; at: Target; then?: Partial<S> | undefined; hold: number }
  | { kind: 'tap'; at: Target; then?: Partial<S> | undefined; hold: number }
  | { kind: 'drag'; from: Target; to: Target; then?: Partial<S> | undefined }
  | { kind: 'type'; key: keyof S & string; text: string; cps: number }
  | { kind: 'focus'; on: Target | null; zoom: number; duration: number }
  | { kind: 'cursor'; visible: boolean }
  | { kind: 'mark'; title: string };

/** Let the picture hold: the payoff, or a beat before the next action. */
export const wait = <S extends State = State>(seconds: number): Step<S> => ({ kind: 'wait', seconds });
/** Change state now. Changes animate (presence and numbers spring) but do not take script time. */
export const set = <S extends State = State>(values: Partial<S>, options: SetOptions = {}): Step<S> => ({ kind: 'set', values, options });
/** Move the cursor to a named rect (its centre) or a point. Duration follows distance, like a hand. */
export const move = <S extends State = State>(to: Target, pace = 1): Step<S> => ({ kind: 'move', to, pace });
/** Move to the target, press, and apply `then` as the press lands, so the change has a visible cause. */
export const click = <S extends State = State>(at: Target, then?: Partial<S>, hold = 0.2): Step<S> => ({ kind: 'click', at, then, hold });
/** A finger tap for phones: no travelling cursor, a press dot appears at the target. */
export const tap = <S extends State = State>(at: Target, then?: Partial<S>, hold = 0.2): Step<S> => ({ kind: 'tap', at, then, hold });
/** Press at `from`, carry to `to` (the cursor closes), release and apply `then`. */
export const drag = <S extends State = State>(from: Target, to: Target, then?: Partial<S>): Step<S> => ({ kind: 'drag', from, to, then });
/** Type `text` into state[key] one character at a time (cps: characters per second). */
export const type = <S extends State = State>(key: keyof S & string, text: string, cps = 22): Step<S> => ({ kind: 'type', key, text, cps });
/** Push the camera in on a named rect (or a point), or back home with `null`. Runs alongside the next steps. */
export const focus = <S extends State = State>(on: Target | null, zoom = 1.6, duration = 1): Step<S> => ({ kind: 'focus', on, zoom, duration });
/** Show or hide the cursor (a fade, alongside the next steps). */
export const cursor = <S extends State = State>(visible: boolean): Step<S> => ({ kind: 'cursor', visible });
/** Start a shot here, for meta.shots, Present mode and review. */
export const mark = <S extends State = State>(title: string): Step<S> => ({ kind: 'mark', title });

export interface PlayOptions<S extends State> {
  /** The stage size, usually meta.width × meta.height. */
  size: [width: number, height: number];
  /** Named rects the cursor and camera aim at, for a settled state. */
  layout: (state: S) => Record<string, Rect>;
  /** The cursor's start (and, for a loop, end) position. Default: right of centre, low. */
  start?: Point;
  /** Which cursor each named rect asks for while the pointer is over it. Unnamed areas use the arrow. */
  cursors?: Record<string, CursorShape>;
  /** The film loops: the script must end in the initial state, with the cursor and camera home. */
  loop?: boolean;
  /** Seconds added after the last step. */
  tail?: number;
  /** false: no cursor at all, for a film about what the system does on its own (taps still show). */
  pointer?: boolean;
  /** Default time for a state change to settle (entering / leaving / numbers). */
  enter?: number; exit?: number; count?: number;
}

interface Change { time: number; value: Value; duration?: number | undefined; curve?: Curve | undefined }
interface Move { start: number; end: number; from: Point; to: Point; drag: boolean }
interface Press { time: number; at: Point; touch: boolean }
interface Show { time: number; visible: boolean }

export interface CursorFrame {
  x: number; y: number; press: number; shape: CursorShape; visible: number; moving: boolean;
  /** 0..1 strength of a finger press, and where it lands (taps never move the cursor). */
  touch: number; tx: number; ty: number;
  /** True from a drag's press to its release: draw the carried object at (x, y). */
  dragging: boolean;
  /** 0..1: how far the carried object is lifted (rises over 0.18 s after the press, lands over 0.2 s after release). */
  lift: number;
}
export interface StageFrame<S extends State> {
  time: number;
  /** The state's value now (the latest change). */
  value<K extends keyof S & string>(key: K): S[K];
  /** The value before the latest change. */
  prev<K extends keyof S & string>(key: K): S[K];
  /** Seconds since `key` last changed (Infinity if it never did). */
  since(key: keyof S & string): number;
  /** 0..1 presence of a truthy value, animated in and out, so parts move instead of popping. */
  on(key: keyof S & string, o?: SetOptions): number;
  /** 0..1 presence of `key === value`. */
  is<K extends keyof S & string>(key: K, value: S[K], o?: SetOptions): number;
  /** A number springing between its values. */
  num(key: keyof S & string, o?: SetOptions): number;
  /** From, to and progress of the latest change of a number, for rolling digits. */
  pair(key: keyof S & string): { from: number; to: number; k: number };
  /** The named rect in the current (settled) state. */
  rect(name: string): Rect;
  cursor: CursorFrame;
  camera: FilmCamera;
  /** The design size the stage was laid out at. */
  size: [width: number, height: number];
  /** The shot at this time. */
  shot: string;
}
export interface Stage<S extends State> {
  initial: S;
  duration: number;
  /** For meta.shots. */
  shots: { end: number; stop: number; title: string }[];
  /** Settled moments worth a still: after every press and every hold. */
  reviewTimes: number[];
  /** Times of presses, for sound or highlights. */
  presses: number[];
  at(time: number): StageFrame<S>;
}

const DEFAULT_ENTER = 0.42, DEFAULT_EXIT = 0.28, DEFAULT_COUNT = 0.7;
const enterCurve = springEase(5.5, 1), exitCurve = ease.inOutCubic, countCurve = springEase(5, 1);
const same = (a: Value, b: Value) => a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Compile a script. Every step's time is decided here: cursor moves take time by distance, presses take a fixed
 * dwell, `wait` holds. The result is a pure lookup, safe in renderFrame.
 */
export function play<S extends State>(initial: S, steps: readonly Step<S>[], o: PlayOptions<S>): Stage<S> {
  const [W, H] = o.size, diag = Math.hypot(W, H);
  const enterD = o.enter ?? DEFAULT_ENTER, exitD = o.exit ?? DEFAULT_EXIT, countD = o.count ?? DEFAULT_COUNT;
  const home: Point = o.start ?? [W * 0.62, H * 0.78];
  const changes = new Map<string, Change[]>(), moves: Move[] = [], presses: Press[] = [], shows: Show[] = [];
  const marks: { time: number; title: string }[] = [], holds: number[] = [];
  const cam: CameraKey[] = [[0, W / 2, H / 2, 1]];
  let t = 0, state: S = { ...initial }, pos: Point = home, settleEnd = 0, camZoom = 1, camAt: Point = [W / 2, H / 2];

  const resolve = (target: Target): Point => {
    if (typeof target !== 'string') return target;
    const r = o.layout(state)[target];
    if (!r) throw new Error(`Stage: no rect named "${target}" in layout(). Named: ${Object.keys(o.layout(state)).join(', ') || 'none'}.`);
    return [r[0] + r[2] / 2, r[1] + r[3] / 2];
  };
  const apply = (values: Partial<S> | undefined, time: number, options: SetOptions = {}) => {
    if (!values) return;
    for (const [key, value] of Object.entries(values) as [string, Value][]) {
      if (!(key in initial)) throw new Error(`Stage: set() names "${key}", which is not in the initial state. Add it there first.`);
      const list = changes.get(key) ?? [];
      list.push({ time, value, duration: options.duration, curve: options.curve });
      changes.set(key, list);
      (state as State)[key] = value;
      const d = options.duration ?? (typeof value === 'number' ? countD : Math.max(enterD, exitD));
      settleEnd = Math.max(settleEnd, time + d * 1.05);
    }
  };
  const travel = (to: Point, pace: number, dragging = false) => {
    const dist = Math.hypot(to[0] - pos[0], to[1] - pos[1]);
    if (dist < 0.5) return;
    const dur = clamp(0.3 + 0.6 * dist / (diag * 0.9), 0.3, 0.95) * pace;
    moves.push({ start: t, end: t + dur, from: pos, to, drag: dragging });
    t += dur; pos = to;
  };

  for (const step of steps) {
    switch (step.kind) {
      case 'wait': holds.push(t + step.seconds * 0.6); t += step.seconds; break;
      case 'set': apply(step.values, t, step.options); break;
      case 'move': travel(resolve(step.to), step.pace); break;
      case 'click': case 'tap': {
        const at = resolve(step.at), touch = step.kind === 'tap';
        if (!touch) { travel(at, 1); t += 0.1; } else t += 0.15;   // a tap has no travelling cursor: pos stays
        presses.push({ time: t, at, touch });
        apply(step.then, t + 0.06);
        t += step.hold; holds.push(t);
        break;
      }
      case 'drag': {
        travel(resolve(step.from), 1); t += 0.12;
        presses.push({ time: t, at: pos, touch: false });
        t += 0.1; travel(resolve(step.to), 1.25, true); t += 0.08;
        apply(step.then, t); t += 0.2; holds.push(t);
        break;
      }
      case 'type': {
        const chars = [...step.text];
        chars.forEach((_, i) => apply({ [step.key]: chars.slice(0, i + 1).join('') } as Partial<S>, t + i / step.cps, { duration: 0 }));
        t += chars.length / step.cps + 0.15;
        break;
      }
      case 'focus': {
        const prev = cam[cam.length - 1]!;
        const at = step.on === null ? [W / 2, H / 2] as Point : resolve(step.on), zoom = step.on === null ? 1 : step.zoom;
        if (t > prev[0] + 1e-3) cam.push([t, camAt[0], camAt[1], camZoom]);
        // A focus that starts before the previous one lands continues from where that one is heading.
        const end = Math.max(t + Math.max(0.05, step.duration), cam[cam.length - 1]![0] + 0.05);
        cam.push([end, at[0], at[1], zoom]);
        camAt = at; camZoom = zoom; settleEnd = Math.max(settleEnd, end);
        break;
      }
      case 'cursor': shows.push({ time: t, visible: step.visible }); settleEnd = Math.max(settleEnd, t + 0.3); break;
      case 'mark': marks.push({ time: t, title: step.title }); break;
    }
  }
  const duration = round3(Math.max(t + (o.tail ?? 0), settleEnd, 0.5));

  if (o.loop) {
    const problems: string[] = [];
    for (const key of Object.keys(initial)) if (!same((state as State)[key]!, initial[key]!)) problems.push(`state.${key} ends as ${JSON.stringify((state as State)[key])}, starts as ${JSON.stringify(initial[key])}`);
    if (Math.hypot(pos[0] - home[0], pos[1] - home[1]) > 1) problems.push(`the cursor ends at ${pos.map(Math.round).join(', ')}, starts at ${home.map(Math.round).join(', ')} (end with move(start))`);
    if (camZoom !== 1 || camAt[0] !== W / 2 || camAt[1] !== H / 2) problems.push('the camera is not home (end with focus(null))');
    const lastShow = shows[shows.length - 1];
    if (lastShow && !lastShow.visible) problems.push('the cursor ends hidden but starts visible');
    if (problems.length) throw new Error(`Stage: this loop has a seam.\n- ${problems.join('\n- ')}\nUndo the first beat on screen, with a cause, so the last frame equals the first.`);
  }

  const camera = cameraPath(cam);
  const shotList = marks.length ? marks : [{ time: 0, title: 'Stage' }];
  const shots = shotList.map((m, i) => {
    const end = round3(i < shotList.length - 1 ? shotList[i + 1]!.time : duration);
    const inShot = holds.filter(h => h > m.time && h <= end);
    return { end, stop: round3(inShot.length ? inShot[inShot.length - 1]! : Math.max(m.time, end - 0.05)), title: m.title };
  }).filter(s => s.end > 0);
  const reviewTimes = [...new Set([0, ...holds, ...presses.map(p => p.time + 0.02), duration].map(round3))].filter(x => x <= duration).sort((a, b) => a - b);

  // ---- sampling
  const hist = (key: string) => changes.get(key) ?? [];
  const latest = (key: string, time: number) => { const list = hist(key); let i = -1; while (i + 1 < list.length && list[i + 1]!.time <= time) i++; return i; };
  const animate = (key: string, time: number, target: (v: Value) => number, dIn: number, dOut: number, curveIn: Curve, curveOut: Curve, so: SetOptions = {}) => {
    let from = target(initial[key]!), to = from, start = -1, dur = 0, curve: Curve = curveIn;
    const valueAt = (x: number) => dur <= 0 ? to : lerp(from, to, curve(pr(x, start, start + dur)));
    for (const c of hist(key)) {
      if (c.time > time) break;
      const next = target(c.value);
      if (next === to) continue;
      const cur = valueAt(c.time), up = next > cur;
      from = cur; to = next; start = c.time;
      dur = so.duration ?? c.duration ?? (up ? dIn : dOut);
      curve = so.curve ?? c.curve ?? (up ? curveIn : curveOut);
    }
    return valueAt(time);
  };
  const cursorAt = (time: number): CursorFrame => {
    let p: Point = home, moving = false, dragging = false;
    for (const m of moves) {
      if (time >= m.end) { p = m.to; dragging = m.drag; continue; }
      if (time > m.start) {
        const k = springs.cursor(pr(time, m.start, m.end)), dx = m.to[0] - m.from[0], dy = m.to[1] - m.from[1], len = Math.hypot(dx, dy) || 1;
        let nx = -dy / len, ny = dx / len; if (ny > 0) { nx = -nx; ny = -ny; }
        const bend = Math.sin(Math.PI * k) * Math.min(len * 0.07, 40);
        p = [lerp(m.from[0], m.to[0], k) + nx * bend, lerp(m.from[1], m.to[1], k) + ny * bend]; moving = true; dragging = m.drag;
      }
      break;
    }
    let press = 0, touch = 0, tp: Point = p;
    for (const pr0 of presses) {
      if (pr0.touch) { const k = pr(time, pr0.time - 0.16, pr0.time) * (1 - pr(time, pr0.time + 0.1, pr0.time + 0.32)); if (k > touch) { touch = k; tp = pr0.at; } }
      else press = Math.max(press, pulse(time, pr0.time, 0.06));
    }
    const lastDrag = moves.find(m => m.drag && time >= m.start - 0.25 && time <= m.end + 0.1);
    const held = moves.some(m => m.drag && time >= m.start - 0.1 && time < m.end + 0.08);
    const lift = moves.reduce((v, m) => m.drag ? Math.max(v, ease.inOutCubic(pr(time, m.start - 0.1, m.start + 0.08)) * (1 - ease.inOutCubic(pr(time, m.end + 0.08, m.end + 0.28)))) : v, 0);
    let visible = 1;
    for (const s of shows) if (time >= s.time) visible = s.visible ? pr(time, s.time, s.time + 0.3) : 1 - pr(time, s.time, s.time + 0.3);
    let shape: CursorShape = 'arrow';
    if (lastDrag || dragging) shape = 'grabbing';
    else if (o.cursors && !moving) {
      const rects = o.layout(stateAt(time));
      for (const [name, sh] of Object.entries(o.cursors)) { const r = rects[name]; if (r && p[0] >= r[0] && p[0] <= r[0] + r[2] && p[1] >= r[1] && p[1] <= r[1] + r[3]) { shape = sh; break; } }
    }
    const allTouch = presses.length > 0 && presses.every(x => x.touch) && !moves.length;
    return { x: p[0], y: p[1], press, shape, visible: allTouch || o.pointer === false ? 0 : visible, moving, touch, tx: tp[0], ty: tp[1], dragging: held, lift };
  };
  const stateAt = (time: number) => {
    const s = { ...initial } as State;
    for (const key of Object.keys(initial)) { const i = latest(key, time); if (i >= 0) s[key] = hist(key)[i]!.value; }
    return s as S;
  };
  const truthy = (v: Value) => (v === false || v === null || v === 0 || v === '' ? 0 : 1);
  const asNum = (v: Value) => (typeof v === 'number' ? v : Number(v) || 0);

  return Object.freeze({
    initial, duration, shots, reviewTimes, presses: presses.map(p => p.time),
    at(time: number): StageFrame<S> {
      const now = stateAt(time);
      const markNow = [...shotList].reverse().find(m => m.time <= time) ?? shotList[0]!;
      return {
        time,
        value: key => now[key],
        prev: key => { const i = latest(key, time); return (i > 0 ? hist(key)[i - 1]!.value : initial[key]) as S[typeof key]; },
        since: key => { const i = latest(key, time); return i < 0 ? Infinity : time - hist(key)[i]!.time; },
        on: (key, so) => clamp(animate(key, time, truthy, enterD, exitD, enterCurve, exitCurve, so), 0, 1.2),
        is: (key, value, so) => animate(key, time, v => (same(v, value) ? 1 : 0), enterD, exitD, enterCurve, exitCurve, so),
        num: (key, so) => animate(key, time, asNum, countD, countD, countCurve, countCurve, so),
        pair: key => {
          const i = latest(key, time); if (i < 0) return { from: asNum(initial[key]!), to: asNum(initial[key]!), k: 1 };
          const c = hist(key)[i]!, before = i > 0 ? hist(key)[i - 1]!.value : initial[key]!;
          return { from: asNum(before), to: asNum(c.value), k: pr(time, c.time, c.time + (c.duration ?? countD)) };
        },
        rect: name => { const r = o.layout(now)[name]; if (!r) throw new Error(`Stage: no rect named "${name}"`); return r; },
        cursor: cursorAt(time),
        camera: camera(time),
        size: [W, H],
        shot: markNow.title,
      };
    },
  });
}

/**
 * Draw the stage through its camera (keys interpolated by the runtime's cameraPath, the same camera math as a film). A stage is laid out
 * at a design size (1280 × 720 for 16:9, 720 × 1280 for 9:16) and scaled to the film, so the kit's sizes read as real
 * UI at about 1.5× and the same scene renders at any output size: pass `scale` = film width / design width.
 */
export function withStage<S extends State>(c: C2D, s: StageFrame<S>, draw: (c: C2D) => void, scale = 1) {
  const cam = s.camera, [w, h] = s.size;
  c.save();
  try { c.scale(scale, scale); c.translate(w / 2, h / 2); c.rotate(cam.roll); c.scale(cam.zoom, cam.zoom); c.translate(-cam.x, -cam.y); draw(c); }
  finally { c.restore(); }
}

// ---------------------------------------------------------------- framing

/**
 * A rect pinned to a corner of the stage with an inset, running off the opposite edges when it is bigger than what is
 * left. Decide the crop first: a window that runs off two edges reads as a real screen; one floating whole in the
 * middle reads as a pasted screenshot.
 */
export function pin(size: [number, number], box: [number, number], corner: 'tl' | 'tr' | 'bl' | 'br' = 'tl', inset: number | Point = 96): Rect {
  const [W, H] = size, [w, h] = box, [ix, iy] = typeof inset === 'number' ? [inset, inset] : inset;
  const x = corner[1] === 'l' ? ix : W - ix - w, y = corner[0] === 't' ? iy : H - iy - h;
  return [x, y, w, h];
}
export const center = (r: Rect): Point => [r[0] + r[2] / 2, r[1] + r[3] / 2];
export const inset = (r: Rect, dx: number, dy = dx): Rect => [r[0] + dx, r[1] + dy, r[2] - 2 * dx, r[3] - 2 * dy];
export const lerpRect = (a: Rect, b: Rect, k: number): Rect => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];

// ---------------------------------------------------------------- looks

/** How many real words stay: all, story text only, lines for all but `keep`, or none (a wireframe: the failure "too little"). */
export type Words = 'all' | 'story' | 'lines' | 'none';
export interface Look {
  name: string; dark: boolean;
  /** Stage background (top, bottom). */
  bg: string; bg2: string;
  /** Window body, sidebar, raised surface (inputs, menus), hover / selected row. */
  window: string; sidebar: string; surface: string; hover: string;
  ink: string; mute: string; faint: string; line: string;
  accent: string; accentInk: string; accentSoft: string;
  /** Placeholder lines. */
  bar: string;
  /** Shadow colour as "r,g,b"; strength 0 removes shadows (blueprint). */
  shadow: string; shadowStrength: number;
  /** Outline instead of fill for windows and cards (blueprint). */
  outline: boolean;
  font: string; mono: string;
  /** Corner radius of windows; controls use about a third. */
  radius: number;
  /** How many real words: all text, story text only (default), or lines for everything but `keep` text. */
  words: Words;
}
const FONT = '"Inter", "Noto Sans TC", system-ui, -apple-system, sans-serif', MONO = '"JetBrains Mono", ui-monospace, monospace';
export const LOOKS: Record<'light' | 'dark' | 'blueprint' | 'minimal', Look> = {
  light: {
    name: 'light', dark: false, bg: '#efeeec', bg2: '#e7e6e3', window: '#ffffff', sidebar: '#f7f7f6', surface: '#ffffff', hover: '#f2f2f0',
    ink: '#1d1d1f', mute: '#6e6e73', faint: '#a1a1a6', line: '#e7e7e4', accent: '#0f766e', accentInk: '#ffffff', accentSoft: '#e3f1ef',
    bar: '#e9e9e6', shadow: '24,24,48', shadowStrength: 1, outline: false, font: FONT, mono: MONO, radius: 22, words: 'story',
  },
  dark: {
    name: 'dark', dark: true, bg: '#0b0b0c', bg2: '#111113', window: '#161618', sidebar: '#121214', surface: '#1e1e21', hover: '#232327',
    ink: '#f4f4f5', mute: '#a1a1aa', faint: '#62626b', line: '#26262a', accent: '#e8e8ea', accentInk: '#0b0b0c', accentSoft: '#2a2a2e',
    bar: '#262629', shadow: '0,0,0', shadowStrength: 1.4, outline: false, font: FONT, mono: MONO, radius: 22, words: 'story',
  },
  blueprint: {
    name: 'blueprint', dark: true, bg: '#0f2d52', bg2: '#0c2646', window: '#12355f', sidebar: '#103059', surface: '#163c6a', hover: '#1a4475',
    ink: '#eaf3ff', mute: '#9cbbe0', faint: '#6d8fb9', line: '#3e6797', accent: '#ffffff', accentInk: '#0f2d52', accentSoft: '#1f4a7e',
    bar: '#2f5684', shadow: '0,0,0', shadowStrength: 0, outline: true, font: FONT, mono: MONO, radius: 14, words: 'story',
  },
  minimal: {
    name: 'minimal', dark: false, bg: '#f4f4f2', bg2: '#efefec', window: '#ffffff', sidebar: '#fafaf9', surface: '#ffffff', hover: '#f4f4f2',
    ink: '#1d1d1f', mute: '#8a8a8e', faint: '#b4b4b8', line: '#ececea', accent: '#1d1d1f', accentInk: '#ffffff', accentSoft: '#efefed',
    bar: '#e8e8e5', shadow: '24,24,48', shadowStrength: 0.8, outline: false, font: FONT, mono: MONO, radius: 22, words: 'lines',
  },
};
/** A look by name, with the brand's tokens laid over it (accent, font, radius…). */
export function look(name: keyof typeof LOOKS = 'light', overrides: Partial<Look> = {}): Look { return { ...LOOKS[name], ...overrides }; }

// ---------------------------------------------------------------- kit

export type IconName = 'search' | 'plus' | 'check' | 'bell' | 'inbox' | 'chart' | 'users' | 'settings' | 'calendar' | 'doc' | 'arrow' | 'chevron' | 'dots' | 'home' | 'card' | 'send' | 'clock' | 'star';
export interface TextOptions {
  size?: number; weight?: number; color?: string; align?: CanvasTextAlign; font?: string;
  /** keep: always words. ui (default): words unless the look says lines. filler: words only when the look says all. */
  role?: 'keep' | 'ui' | 'filler';
  /** The box width the text must fit; overflowing throws unless fit is 'ellipsis'. */
  max?: number; fit?: 'error' | 'ellipsis';
  /** Tracking in em (negative tightens large numbers). Default: -0.02 above 40 px. */
  tracking?: number;
}
export interface WindowOptions {
  /** app: title bar with traffic lights. browser: plus an address field. tabs: plus a tab row. tahoe: the newer macOS
   * window with large lights, a floating sidebar and a tall toolbar. card: one quiet card, no chrome. */
  chrome?: 'app' | 'browser' | 'tabs' | 'tahoe' | 'card';
  url?: string; title?: string; tabs?: string[]; activeTab?: number;
  /** Sidebar width (0 or omitted: none). */
  sidebar?: number;
  /** 0..1: the window steps back while something else (a phone) has the viewer's attention. */
  recede?: number;
}
export interface Body { rect: Rect; content: Rect; sidebar?: Rect | undefined; bar: number }

const FAR_ALPHA = (k: number) => clamp(k);

/** Drawing helpers bound to a look. Sizes are for a 1280 × 720 design stage, drawn 1.5× at 1080p (see withStage). */
export function createKit(lk: Look = LOOKS.light) {
  const L = lk;
  const rr = (c: C2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2))); };
  const fill = (c: C2D, x: number, y: number, w: number, h: number, r: number, color: string) => { rr(c, x, y, w, h, r); c.fillStyle = color; c.fill(); };
  const stroke = (c: C2D, x: number, y: number, w: number, h: number, r: number, color: string, lw = 1.5) => { rr(c, x + lw / 2, y + lw / 2, w - lw, h - lw, r); c.lineWidth = lw; c.strokeStyle = color; c.stroke(); };
  const hline = (c: C2D, x: number, y: number, w: number, color = L.line, lw = 1.5) => { c.fillStyle = color; c.fillRect(x, y - lw / 2, w, lw); };
  const vline = (c: C2D, x: number, y: number, h: number, color = L.line, lw = 1.5) => { c.fillStyle = color; c.fillRect(x - lw / 2, y, lw, h); };
  const dot = (c: C2D, x: number, y: number, r: number, color: string) => { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); c.fillStyle = color; c.fill(); };
  const scaleOf = (c: C2D) => { const m = c.getTransform(); return Math.hypot(m.a, m.b) || 1; };

  /**
   * Layered shadow: a hairline ring, a mid shadow for lift and a long soft one for distance (depth 0..2). The two soft
   * layers are stacked translucent rounded rects instead of shadowBlur, so a window-sized shadow stays cheap under a
   * camera zoom; only the small contact shadow uses shadowBlur.
   */
  const shadow = (c: C2D, r: Rect, radius: number, depth = 1, color = L.window) => {
    if (L.shadowStrength <= 0 || depth <= 0) return;
    const s = L.shadowStrength * depth, [x, y, w, h] = r;
    const soft = (spread: number, dy: number, alpha: number, steps: number) => {
      c.fillStyle = `rgba(${L.shadow},${alpha / steps})`;
      for (let i = 1; i <= steps; i++) { const e = spread * i / steps; rr(c, x - e * 0.6, y - e * 0.4 + dy, w + e * 1.2, h + e * 0.8, radius + e * 0.6); c.fill(); }
    };
    c.save();
    soft(64 * depth, 34 * depth, 0.13 * s, 10);
    soft(18 * depth, 9 * depth, 0.10 * s, 5);
    const k = scaleOf(c); c.shadowColor = `rgba(${L.shadow},${0.10 * s})`; c.shadowBlur = 3 * k; c.shadowOffsetY = 1 * k; fill(c, x, y, w, h, radius, color);
    c.restore();
  };
  /** Fill the stage background: a quiet vertical gradient between the look's two backgrounds. */
  const backdrop = (c: C2D, w: number, h: number) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, L.bg); g.addColorStop(1, L.bg2); c.fillStyle = g; c.fillRect(-w, -h, w * 3, h * 3); };

  const fontOf = (o: TextOptions) => `${o.weight ?? 500} ${o.size ?? 20}px ${o.font ?? L.font}`;
  const withType = <T>(c: C2D, o: TextOptions, fn: () => T): T => {
    c.save(); c.font = fontOf(o); const size = o.size ?? 20, tr = o.tracking ?? (size >= 40 ? -0.02 : size >= 26 ? -0.01 : 0);
    const cc = c as C2D & { letterSpacing?: string }; if ('letterSpacing' in cc) cc.letterSpacing = `${tr * size}px`;
    try { return fn(); } finally { c.restore(); }
  };
  const measure = (c: C2D, s: string, o: TextOptions = {}) => withType(c, o, () => c.measureText(s).width);
  const asLine = (o: TextOptions) => L.words === 'none' ? true : (o.role ?? 'ui') === 'keep' ? false : L.words === 'lines' ? true : (o.role === 'filler' && L.words !== 'all');
  /**
   * Text, or a placeholder line in its place when the look keeps fewer words. Returns the drawn width. With `max`, text
   * that does not fit throws (the layout check), unless `fit: 'ellipsis'` trims it on purpose.
   */
  const text = (c: C2D, s: string, x: number, y: number, o: TextOptions = {}) => {
    const size = o.size ?? 20, align = o.align ?? 'left';
    let value = s, w = measure(c, value, o);
    if (o.max !== undefined && w > o.max + 0.5) {
      if (o.fit !== 'ellipsis') throw new Error(`Stage layout: "${s}" is ${Math.round(w)} px wide at ${size} px, but its box allows ${Math.round(o.max)} px. Shorten the copy, widen the box, or pass fit: 'ellipsis'.`);
      const chars = [...s]; while (chars.length && measure(c, chars.join('') + '…', o) > o.max) chars.pop(); value = chars.join('') + '…'; w = measure(c, value, o);
    }
    if (asLine(o)) {
      const lw = Math.max(size * 1.2, w * 0.86), h = Math.max(6, size * 0.42), x0 = align === 'center' ? x - lw / 2 : align === 'right' ? x - lw : x;
      fill(c, x0, y - h / 2, lw, h, h / 2, o.color && o.color !== L.ink && o.color !== L.mute && o.color !== L.faint ? o.color : L.bar);
      return lw;
    }
    withType(c, o, () => { c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = o.color ?? L.ink; c.fillText(value, x, y); });
    return w;
  };
  /** A placeholder line standing in for copy the story does not need. */
  const bar = (c: C2D, x: number, y: number, w: number, h = 10, color = L.bar) => fill(c, x, y - h / 2, w, h, Math.min(4, h / 2), color);
  /** Several lines down a column: widths in px, `gap` between baselines. */
  const bars = (c: C2D, x: number, y: number, widths: number[], gap = 26, h = 10, color = L.bar) => widths.forEach((w, i) => bar(c, x, y + i * gap, w, h, color));

  const icon = (c: C2D, name: IconName, x: number, y: number, size = 20, color = L.mute) => {
    const s = size / 16; c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 1.5; c.lineCap = 'round'; c.lineJoin = 'round';
    const P = (...p: number[]) => { c.beginPath(); c.moveTo(p[0]!, p[1]!); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i]!, p[i + 1]!); c.stroke(); };
    const O = (cx: number, cy: number, r: number) => { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); };
    const R = (a: number, b: number, w: number, h: number, r = 2) => { rr(c, a, b, w, h, r); c.stroke(); };
    switch (name) {
      case 'search': O(-1, -1, 5); P(3, 3, 6.5, 6.5); break;
      case 'plus': P(-5.5, 0, 5.5, 0); P(0, -5.5, 0, 5.5); break;
      case 'check': P(-5, 0.5, -1.5, 4, 5.5, -4); break;
      case 'bell': c.beginPath(); c.moveTo(-5.5, 3.5); c.lineTo(-4.5, 1.5); c.lineTo(-4.5, -1.5); c.arc(0, -1.5, 4.5, Math.PI, 0); c.lineTo(4.5, 1.5); c.lineTo(5.5, 3.5); c.closePath(); c.stroke(); P(-1.5, 6, 1.5, 6); break;
      case 'inbox': R(-6.5, -5.5, 13, 11); P(-6.5, 1, -2.5, 1, -1.5, 3, 1.5, 3, 2.5, 1, 6.5, 1); break;
      case 'chart': P(-6, 6, -6, -6); P(-6, 6, 6, 6); P(-3, 3, 0, -1, 2.5, 1.5, 6, -3.5); break;
      case 'users': O(-2, -2.5, 2.8); P(-7, 6, -6, 2.5, 2, 2.5, 3, 6); O(4.5, -3, 2.2); P(4.5, 1.5, 6.5, 1.5, 7.5, 4.5); break;
      case 'settings': O(0, 0, 2.5); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; P(Math.cos(a) * 4.5, Math.sin(a) * 4.5, Math.cos(a) * 6.5, Math.sin(a) * 6.5); } break;
      case 'calendar': R(-6.5, -5, 13, 11.5); P(-6.5, -1.5, 6.5, -1.5); P(-3, -7, -3, -3.5); P(3, -7, 3, -3.5); break;
      case 'doc': R(-5, -6.5, 10, 13); P(-2.5, -2, 2.5, -2); P(-2.5, 1, 2.5, 1); P(-2.5, 4, 0.5, 4); break;
      case 'arrow': P(-5.5, 0, 5.5, 0); P(1.5, -4, 5.5, 0, 1.5, 4); break;
      case 'chevron': P(-2, -4, 2, 0, -2, 4); break;
      case 'dots': [-5, 0, 5].forEach(px => { c.beginPath(); c.arc(px, 0, 1.3, 0, Math.PI * 2); c.fill(); }); break;
      case 'home': P(-6, -0.5, 0, -6, 6, -0.5); P(-4.5, -1.5, -4.5, 6, 4.5, 6, 4.5, -1.5); break;
      case 'card': R(-7, -5, 14, 10); P(-7, -1.5, 7, -1.5); break;
      case 'send': P(-6, -1, 6, -6, 1, 6, -1, 1, -6, -1); break;
      case 'clock': O(0, 0, 6); P(0, -3.5, 0, 0, 2.5, 1.5); break;
      case 'star': c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.8 : 6.5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.stroke(); break;
    }
    c.restore();
  };
  const lights = (c: C2D, x: number, y: number, r: number) => {
    const cols = L.outline ? [L.line, L.line, L.line] : L.dark ? ['#4a4a4f', '#4a4a4f', '#4a4a4f'] : ['#ff5f57', '#febc2e', '#28c840'];
    cols.forEach((col, i) => { dot(c, x + i * r * 3.2, y, r, col); if (!L.dark && !L.outline) { c.beginPath(); c.arc(x + i * r * 3.2, y, r - 0.5, 0, Math.PI * 2); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.stroke(); } });
  };

  /**
   * A window: its chrome follows from what you pass. `draw` paints the body inside a clip and receives the body, the
   * content area right of the sidebar, and the sidebar. Windows run off the stage edges freely; decide the crop with pin().
   */
  const windowFrame = (c: C2D, r: Rect, o: WindowOptions, draw: (c: C2D, b: Body) => void) => {
    const chrome = o.chrome ?? 'app', [x, y, w, h] = r, rad = chrome === 'tahoe' ? L.radius * 1.25 : L.radius;
    const recede = clamp(o.recede ?? 0);
    c.save();
    if (recede > 0) { const cx = x + w / 2, cy = y + h / 2, s = 1 - 0.035 * recede; c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); }
    shadow(c, r, rad, 1 - 0.4 * recede);
    if (L.outline) { fill(c, x, y, w, h, rad, L.window); stroke(c, x, y, w, h, rad, L.line, 2); } else fill(c, x, y, w, h, rad, L.window);
    const barH = chrome === 'card' ? 0 : chrome === 'tahoe' ? 76 : chrome === 'tabs' ? 96 : 58;
    rr(c, x, y, w, h, rad); c.save(); c.clip();
    let sidebar: Rect | undefined;
    const sw = o.sidebar ?? 0;
    if (chrome === 'tahoe' && sw > 0) {
      sidebar = [x + 12, y + 12, sw, h - 24];
      fill(c, sidebar[0], sidebar[1], sidebar[2], sidebar[3], rad * 0.75, L.sidebar); stroke(c, sidebar[0], sidebar[1], sidebar[2], sidebar[3], rad * 0.75, L.line, 1.5);
      lights(c, x + 40, y + 42, 9.5);
    } else if (chrome !== 'card') {
      if (chrome !== 'app' || !sw) { fill(c, x, y, w, barH, 0, L.dark ? L.sidebar : L.window); hline(c, x, y + barH, w); }
      lights(c, x + 30, y + 29, 7.5);
      if (chrome === 'browser' || chrome === 'tabs') {
        const uy = chrome === 'tabs' ? y + 58 + 19 : y + 29, uw = Math.min(560, w * 0.42), ux = chrome === 'tabs' ? x + 120 : x + w / 2 - uw / 2;
        if (chrome === 'tabs') {
          (o.tabs ?? ['']).forEach((label, i) => {
            const tx = x + 120 + i * 240, active = i === (o.activeTab ?? 0);
            if (active) fill(c, tx, y + 10, 228, 40, 12, L.surface);
            if (label) text(c, label, tx + 22, y + 30, { size: 17, color: active ? L.ink : L.mute, max: 186, fit: 'ellipsis' }); else bar(c, tx + 22, y + 30, 110, 9);
          });
          hline(c, x, y + 58, w);
        }
        fill(c, ux, uy - 17, uw, 34, 10, L.dark ? L.surface : L.hover);
        if (o.url) text(c, o.url, ux + 18, uy, { size: 16, color: L.mute, role: 'keep', max: uw - 36, fit: 'ellipsis' }); else bar(c, ux + 18, uy, uw * 0.4, 8);
      } else if (o.title) text(c, o.title, x + w / 2, y + 29, { size: 17, weight: 600, color: L.ink, align: 'center' });
      if (chrome === 'app' && sw) { sidebar = [x, y, sw, h]; fill(c, x, y, sw, h, 0, L.sidebar); vline(c, x + sw, y, h); lights(c, x + 30, y + 29, 7.5); hline(c, x + sw, y + barH, w - sw); }
      else if (sw) { sidebar = [x, y + barH, sw, h - barH]; fill(c, x, y + barH, sw, h - barH, 0, L.sidebar); vline(c, x + sw, y + barH, h - barH); }
    }
    const top = chrome === 'tahoe' ? y + barH : chrome === 'app' && sw ? y + barH : y + barH;
    const left = sidebar ? (chrome === 'tahoe' ? sidebar[0] + sidebar[2] + 12 : sidebar[0] + sidebar[2]) : x;
    const content: Rect = [left, top, x + w - left, y + h - top];
    draw(c, { rect: r, content, sidebar, bar: barH });
    c.restore();
    if (L.outline) stroke(c, x, y, w, h, rad, L.line, 2); else stroke(c, x, y, w, h, rad, L.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)', 1);
    if (recede > 0) { c.save(); c.globalAlpha = 0.22 * recede; fill(c, x, y, w, h, rad, L.bg); c.restore(); }
    c.restore();
  };

  /** A sidebar list: the brand and real nav labels (they tell the viewer what product this is), then placeholders. */
  const nav = (c: C2D, side: Rect, o: { brand?: string; mark?: string; items: [IconName, string][]; active?: number; top?: number; filler?: number }) => {
    const [x, y, w] = side; let yy = y + (o.top ?? 104);
    if (o.brand) { if (o.mark) { fill(c, x + 26, yy - 16, 32, 32, 9, o.mark); } text(c, o.brand, x + (o.mark ? 70 : 28), yy, { size: 21, weight: 600, role: 'keep', max: w - 80 }); yy += 62; }
    o.items.forEach(([ic, label], i) => {
      const active = i === (o.active ?? 0);
      if (active) fill(c, x + 14, yy - 22, w - 28, 44, 11, L.dark ? L.hover : L.window);
      if (active && !L.dark && !L.outline) stroke(c, x + 14, yy - 22, w - 28, 44, 11, L.line, 1);
      icon(c, ic, x + 40, yy, 20, active ? L.accent === L.accentInk ? L.ink : L.accent : L.mute);
      text(c, label, x + 64, yy, { size: 18, weight: active ? 600 : 500, color: active ? L.ink : L.mute, max: w - 84 });
      yy += 50;
    });
    yy += 26; for (let i = 0; i < (o.filler ?? 3); i++) { bar(c, x + 30, yy, [96, 132, 110, 80][i % 4]!, 9); yy += 30; }
  };

  const avatar = (c: C2D, x: number, y: number, r: number, label: string, color = L.accent) => {
    dot(c, x, y, r, color); if (label) text(c, label, x, y + 1, { size: r * 0.85, weight: 600, color: '#ffffff', align: 'center', role: 'keep' });
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.strokeStyle = L.window; c.lineWidth = 2.5; c.stroke();
  };
  /** A button; `press` 0..1 squashes it (pass s.cursor.press when the cursor is on it). */
  const button = (c: C2D, r: Rect, label: string, o: { kind?: 'primary' | 'secondary' | 'ghost'; press?: number; size?: number; icon?: IconName } = {}) => {
    const [x, y, w, h] = r, kind = o.kind ?? 'primary', p = o.press ?? 0, rad = Math.min(h / 2, L.radius * 0.5), size = o.size ?? 18;
    c.save(); c.translate(x + w / 2, y + h / 2); c.scale(1 - 0.04 * p, 1 - 0.04 * p); c.translate(-w / 2, -h / 2);
    if (kind === 'primary') fill(c, 0, 0, w, h, rad, L.accent);
    else if (kind === 'secondary') { fill(c, 0, 0, w, h, rad, L.surface); stroke(c, 0, 0, w, h, rad, L.line); }
    const col = kind === 'primary' ? L.accentInk : L.ink, iw = o.icon ? size + 10 : 0, tw = measure(c, label, { size, weight: 600 });
    if (o.icon) icon(c, o.icon, w / 2 - (tw + iw) / 2 + size / 2, h / 2, size, col);
    text(c, label, w / 2 + iw / 2, h / 2 + 1, { size, weight: 600, color: col, align: 'center', role: 'keep', max: w - 24 });
    c.restore();
  };
  /** A status pill; returns its width. `k` 0..1 brings it in (scale and fade). x is the left edge, y the middle. */
  const badge = (c: C2D, x: number, y: number, label: string, o: { color?: string; soft?: string; k?: number; size?: number } = {}) => {
    const size = o.size ?? 15, k = o.k ?? 1, w = measure(c, label, { size, weight: 600 }) + size * 2.2, h = size * 1.9;
    if (k <= 0) return w;
    c.save(); c.globalAlpha *= FAR_ALPHA(k); c.translate(x + w / 2, y); c.scale(0.86 + 0.14 * k, 0.86 + 0.14 * k); c.translate(-w / 2, 0);
    fill(c, 0, -h / 2, w, h, h / 2, o.soft ?? L.accentSoft); dot(c, size * 0.85, 0, size * 0.22, o.color ?? L.accent);
    text(c, label, size * 1.35, 1, { size, weight: 600, color: o.color ?? L.accent, role: 'keep' });
    c.restore(); return w;
  };
  /** An input with an optional caret (solid while typing, blink otherwise: pass blink yourself). */
  const field = (c: C2D, r: Rect, o: { value?: string; placeholder?: string; focus?: number; caret?: boolean; size?: number } = {}) => {
    const [x, y, w, h] = r, size = o.size ?? 18, rad = Math.min(12, h / 2), f = clamp(o.focus ?? 0);
    fill(c, x, y, w, h, rad, L.surface); stroke(c, x, y, w, h, rad, f > 0 ? L.accent : L.line, f > 0 ? 2 : 1.5);
    if (f > 0) { c.save(); c.globalAlpha *= 0.18 * f; stroke(c, x - 4, y - 4, w + 8, h + 8, rad + 4, L.accent, 4); c.restore(); }
    const tx = x + size * 0.9;
    if (o.value) text(c, o.value, tx, y + h / 2 + 1, { size, weight: 400, role: 'keep', max: w - size * 1.8 });
    else if (o.placeholder) text(c, o.placeholder, tx, y + h / 2 + 1, { size, weight: 400, color: L.faint, max: w - size * 1.8 });
    if (o.caret) fill(c, tx + (o.value ? measure(c, o.value, { size, weight: 400 }) : 0) + 2, y + h / 2 - size * 0.62, 2.5, size * 1.24, 1, L.accent);
  };
  /** A dropdown or popover; `k` 0..1 from s.on(): it grows from its top edge instead of popping. */
  const menu = (c: C2D, r: Rect, k: number, draw: (c: C2D, r: Rect) => void) => {
    if (k <= 0.001) return;
    const [x, y, w, h] = r;
    c.save(); c.globalAlpha *= clamp(k * 1.4); c.translate(x + w / 2, y); c.scale(0.97 + 0.03 * k, 0.94 + 0.06 * k); c.translate(-(x + w / 2), -y + (1 - k) * -6);
    shadow(c, r, 14, 0.7, L.surface); fill(c, x, y, w, h, 14, L.surface); stroke(c, x, y, w, h, 14, L.line, 1.5);
    rr(c, x, y, w, h, 14); c.clip(); draw(c, r); c.restore();
  };

  /**
   * Digits that roll only where they changed, like a counter: the old digit slides up and out as the new one comes
   * in from below. `k` 0..1 (from s.pair()). Right-aligned digit columns keep the number from shifting sideways.
   */
  const roll = (c: C2D, from: number, to: number, k: number, x: number, y: number, o: TextOptions & { format?: (n: number) => string } = {}) => {
    const fmt = o.format ?? ((n: number) => Math.round(n).toLocaleString('en-US')), a = fmt(from), b = fmt(to), size = o.size ?? 40;
    const t: TextOptions = { ...o, role: 'keep' };
    if (k >= 1 || a === b) return text(c, b, x, y, t);
    // Columns come from the new string's own kerning (prefix widths), so the settled number matches plain text exactly.
    const n = Math.max(a.length, b.length), A = a.padStart(n, ' '), B = b.padStart(n, ' '), digit = measure(c, '0', t);
    const lead = n - b.length, totalB = measure(c, b, t), total = totalB + lead * digit, align = o.align ?? 'left';
    const x0 = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    const colX = (i: number) => i < lead ? x0 + i * digit : x0 + lead * digit + measure(c, b.slice(0, i - lead), t);
    const lineH = size * 1.2;
    c.save(); c.beginPath(); c.rect(x0 - size, y - lineH / 2, total + size * 2, lineH); c.clip();
    const changed: number[] = []; for (let i = n - 1; i >= 0; i--) if (A[i] !== B[i]) changed.push(i);
    for (let i = 0; i < n; i++) {
      const old = A[i]!, ch = B[i]!, cx = colX(i);
      if (old === ch) { if (ch !== ' ') text(c, ch, cx, y, { ...t, align: 'left' }); continue; }
      const delay = changed.indexOf(i) * 0.06, kk = springs.out(clamp((k - delay) / Math.max(0.2, 1 - delay)));
      if (old !== ' ' && kk < 1) { c.save(); c.globalAlpha *= 1 - kk; text(c, old, cx, y - kk * lineH * 0.8, { ...t, align: 'left' }); c.restore(); }
      if (ch !== ' ' && kk > 0) { c.save(); c.globalAlpha *= kk; text(c, ch, cx, y + (1 - kk) * lineH * 0.8, { ...t, align: 'left' }); c.restore(); }
    }
    c.restore();
    return total;
  };
  /**
   * An object flying from one rect into another along a shallow arc, scaling to fit, then landing with a small settle.
   * `draw` paints it in its own coordinates (0, 0)–(w, h) of the destination size. Drive k with springs.pop or s.on().
   */
  const fly = (c: C2D, from: Rect, to: Rect, k: number, draw: (c: C2D, w: number, h: number) => void, o: { lift?: number; shadowDepth?: number } = {}) => {
    const kk = clamp(k), [fx, fy] = center(from), [tx, ty] = center(to), dist = Math.hypot(tx - fx, ty - fy);
    const lift = (o.lift ?? Math.min(140, dist * 0.18)) * Math.sin(Math.PI * kk);
    const cx = lerp(fx, tx, kk), cy = lerp(fy, ty, kk) - lift, sw = lerp(from[2], to[2], kk), sh = lerp(from[3], to[3], kk);
    const s = 1 + 0.06 * Math.sin(Math.PI * kk);
    c.save(); c.translate(cx, cy); c.scale(s * sw / to[2], s * sh / to[3]); c.rotate(-0.025 * Math.sin(Math.PI * kk) * Math.sign(tx - fx || 1)); c.translate(-to[2] / 2, -to[3] / 2);
    const depth = (o.shadowDepth ?? 0.8) * Math.sin(Math.PI * kk); if (depth > 0.02) shadow(c, [0, 0, to[2], to[3]], 12, depth, L.surface);
    draw(c, to[2], to[3]); c.restore();
  };

  /** A phone; r is the outer body. Phones run off the frame edge: pass a rect that crosses it. `draw` paints the screen. */
  const phone = (c: C2D, r: Rect, draw: (c: C2D, w: number, h: number) => void, o: { time?: string; dark?: boolean; island?: { w: number; h: number; draw?: (c: C2D, w: number, h: number) => void } } = {}) => {
    const [x, y, w, h] = r, bez = w * 0.032, rad = w * 0.165, sx = x + bez, sy = y + bez, sw = w - 2 * bez, sh = h - 2 * bez, srad = rad - bez;
    const body = L.dark ? '#2a2a2d' : '#16161a';
    c.save(); if (L.shadowStrength > 0) { const k = scaleOf(c); c.shadowColor = `rgba(${L.shadow},${0.28 * L.shadowStrength})`; c.shadowBlur = 60 * k; c.shadowOffsetY = 28 * k; } fill(c, x, y, w, h, rad, body); c.restore();
    stroke(c, x + 1, y + 1, w - 2, h - 2, rad - 1, 'rgba(255,255,255,.14)', 2);
    c.save(); rr(c, sx, sy, sw, sh, srad); c.clip(); c.translate(sx, sy); draw(c, sw, sh);
    const ink = o.dark === false ? '#111' : '#fff', status = sw * 0.047;
    if (o.time !== '') {
      text(c, o.time ?? '9:41', sw * 0.17, sw * 0.105, { size: status * 1.05, weight: 600, color: ink, align: 'center', role: 'keep' });
      const gx = sw * 0.78, gy = sw * 0.105; [0, 1, 2, 3].forEach(i => fill(c, gx + i * status * 0.33, gy + status * 0.3 - (i + 1) * status * 0.15, status * 0.2, (i + 1) * status * 0.15, 1, ink));
      stroke(c, gx + status * 1.95, gy - status * 0.3, status * 1.15, status * 0.6, status * 0.16, ink, 1.6); fill(c, gx + status * 2.05, gy - status * 0.2, status * 0.8, status * 0.4, status * 0.1, ink);
    }
    const iw = o.island?.w ?? sw * 0.3, ih = o.island?.h ?? sw * 0.088, ix = sw / 2 - iw / 2, iy = sw * 0.035;
    fill(c, ix, iy, iw, ih, Math.min(ih / 2, sw * 0.06), '#000'); if (o.island?.draw) { c.save(); c.translate(ix, iy); o.island.draw(c, iw, ih); c.restore(); }
    fill(c, sw / 2 - sw * 0.17, sh - sw * 0.04, sw * 0.34, sw * 0.012, sw * 0.006, ink);
    c.restore();
  };
  /** A lock-screen background with the date and a large clock, for phone scenes. */
  const lockScreen = (c: C2D, w: number, h: number, o: { date?: string; time?: string; colors?: [string, string] } = {}) => {
    const g = c.createLinearGradient(0, 0, w * 0.3, h); const [a, b] = o.colors ?? ['#9db0d8', '#b6a3cf']; g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, w, h);
    text(c, o.date ?? 'Tuesday, 12 May', w / 2, w * 0.3, { size: w * 0.055, weight: 600, color: 'rgba(255,255,255,.85)', align: 'center', role: 'keep' });
    text(c, o.time ?? '9:41', w / 2, w * 0.5, { size: w * 0.25, weight: 700, color: 'rgba(255,255,255,.92)', align: 'center', role: 'keep', tracking: -0.035 });
  };
  /** A notification card; `k` 0..1 slides it in from above with a fade. */
  const notification = (c: C2D, r: Rect, k: number, o: { app: string; title: string; body: string; time?: string; color?: string }) => {
    if (k <= 0.001) return;
    const [x, y, w, h] = r, rad = h * 0.26, pad = h * 0.18, ic = h * 0.42;
    c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(0, (1 - k) * -h * 0.5); c.translate(x + w / 2, y + h / 2); c.scale(0.94 + 0.06 * k, 0.94 + 0.06 * k); c.translate(-(x + w / 2), -(y + h / 2));
    fill(c, x, y, w, h, rad, 'rgba(250,250,252,.82)'); stroke(c, x, y, w, h, rad, 'rgba(255,255,255,.6)', 1.5);
    fill(c, x + pad, y + h / 2 - ic / 2, ic, ic, ic * 0.24, o.color ?? L.accent);
    const tx = x + pad * 2 + ic, fs = h * 0.155;
    text(c, o.title, tx, y + h * 0.36, { size: fs, weight: 600, color: '#111', role: 'keep', max: w - (tx - x) - pad - fs * 4, fit: 'ellipsis' });
    if (o.time) text(c, o.time, x + w - pad, y + h * 0.36, { size: fs * 0.85, weight: 400, color: '#777', align: 'right', role: 'keep' });
    text(c, o.body, tx, y + h * 0.64, { size: fs, weight: 400, color: '#333', role: 'keep', max: w - (tx - x) - pad, fit: 'ellipsis' });
    c.restore();
  };
  /**
   * A dark notice pill centred on (x, y); `k` brings it in. With `action` ("Undo"), the action sits at the right end
   * after a divider; give the pill a fixed `width` so layout() can name the action's rect (the right `actionWidth` px of the pill).
   */
  const toast = (c: C2D, x: number, y: number, label: string, k: number, o: { icon?: IconName; size?: number; action?: string; width?: number } = {}) => {
    if (k <= 0.001) return;
    const size = o.size ?? 18, iw = o.icon ? size + 12 : 0, aw = o.action ? measure(c, o.action, { size, weight: 600 }) + size * 2 : 0;
    const w = o.width ?? measure(c, label, { size, weight: 600 }) + iw + aw + size * 2.2, h = size * 2.6, bg = L.dark ? L.surface : '#1d1d1f';
    c.save(); c.globalAlpha *= clamp(k * 1.4); c.translate(x, y + (1 - k) * 16); c.scale(0.95 + 0.05 * k, 0.95 + 0.05 * k);
    shadow(c, [-w / 2, -h / 2, w, h], h / 2, 0.6, bg); fill(c, -w / 2, -h / 2, w, h, h / 2, bg);
    if (o.icon) icon(c, o.icon, -w / 2 + size * 1.1 + size / 2, 0, size, '#fff');
    text(c, label, -w / 2 + size * 1.1 + iw, 1, { size, weight: 600, color: '#fff', role: 'keep', max: w - iw - aw - size * 2.2 });
    if (o.action) { vline(c, w / 2 - aw, -h * 0.28, h * 0.56, 'rgba(255,255,255,.18)'); text(c, o.action, w / 2 - aw / 2, 1, { size, weight: 600, color: 'rgba(255,255,255,.75)', align: 'center', role: 'keep' }); }
    c.restore();
  };
  /** The cursor, from s.cursor. style: arrow (default), large, circle (a soft disc), or touch (only taps show). */
  const pointer = (c: C2D, cur: CursorFrame, o: { style?: 'arrow' | 'large' | 'circle'; scale?: number } = {}) => {
    const style = o.style ?? 'arrow', base = (o.scale ?? 1) * (style === 'large' ? 2.6 : 1.9);
    if (cur.touch > 0) { c.save(); c.globalAlpha *= cur.touch; dot(c, cur.tx, cur.ty, 30 * (o.scale ?? 1) * (1 - 0.15 * cur.touch), 'rgba(40,40,48,.32)'); c.restore(); }
    if (cur.visible <= 0) return;
    c.save(); c.globalAlpha *= cur.visible; c.translate(cur.x, cur.y);
    const squash = 1 - 0.14 * cur.press;
    if (style === 'circle') {
      c.scale(squash, squash); dot(c, 0, 0, 18 * (o.scale ?? 1), L.dark ? 'rgba(255,255,255,.28)' : 'rgba(20,20,28,.22)');
      c.beginPath(); c.arc(0, 0, 18 * (o.scale ?? 1), 0, Math.PI * 2); c.strokeStyle = L.dark ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.stroke(); c.restore(); return;
    }
    c.scale(base * squash, base * squash);
    const k = scaleOf(c);
    c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 3 * k; c.shadowOffsetY = 1 * k;
    c.fillStyle = '#111'; c.strokeStyle = '#fff'; c.lineWidth = 1.3; c.lineJoin = 'round';
    switch (cur.shape) {
      case 'text': c.beginPath(); c.moveTo(-3, -8); c.lineTo(3, -8); c.moveTo(0, -8); c.lineTo(0, 8); c.moveTo(-3, 8); c.lineTo(3, 8); c.lineWidth = 3.2; c.strokeStyle = '#fff'; c.stroke(); c.shadowColor = 'transparent'; c.lineWidth = 1.4; c.strokeStyle = '#111'; c.stroke(); break;
      case 'crosshair': c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.moveTo(0, -8); c.lineTo(0, 8); c.lineWidth = 3.2; c.strokeStyle = '#fff'; c.stroke(); c.shadowColor = 'transparent'; c.lineWidth = 1.4; c.strokeStyle = '#111'; c.stroke(); break;
      case 'pointer': case 'grab': case 'grabbing': {
        const closed = cur.shape === 'grabbing';
        c.translate(-4, -1); c.beginPath();
        if (cur.shape === 'pointer') { c.moveTo(0, 0); c.lineTo(0, -9); c.quadraticCurveTo(1.5, -11, 3, -9); c.lineTo(3, -3); c.lineTo(9, -2); c.quadraticCurveTo(12, -1.5, 12, 2); c.lineTo(11, 9); c.lineTo(2, 9); c.lineTo(-3, 3); c.quadraticCurveTo(-4, 0.5, -1, 0.5); c.closePath(); }
        else { const top = closed ? -3 : -8; c.moveTo(-1, 2); c.lineTo(-1, top + 2); c.quadraticCurveTo(0.5, top, 2, top + 2); c.lineTo(2, top); c.quadraticCurveTo(3.5, top - 2, 5, top); c.lineTo(5, top + 1); c.quadraticCurveTo(6.5, top - 1, 8, top + 1); c.lineTo(8, top + 3); c.quadraticCurveTo(9.5, top + 1, 11, top + 3); c.lineTo(11, 6); c.quadraticCurveTo(10, 10, 6, 10); c.lineTo(3, 10); c.quadraticCurveTo(-2, 9, -1, 2); c.closePath(); }
        c.fill(); c.shadowColor = 'transparent'; c.stroke(); break;
      }
      default: c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 15.5); c.lineTo(3.8, 12); c.lineTo(6.6, 18); c.lineTo(9, 17); c.lineTo(6.3, 11.2); c.lineTo(11.2, 11.2); c.closePath(); c.fill(); c.shadowColor = 'transparent'; c.stroke();
    }
    c.restore();
  };

  /** A surface card: fill, hairline, optional lift (a soft shadow, 0..1). */
  const card = (c: C2D, r: Rect, o: { radius?: number; fill?: string; lift?: number } = {}) => {
    const rad = o.radius ?? L.radius * 0.7, f = o.fill ?? L.surface;
    if (o.lift) shadow(c, r, rad, o.lift, f);
    fill(c, r[0], r[1], r[2], r[3], rad, f); stroke(c, r[0], r[1], r[2], r[3], rad, L.line, L.outline ? 2 : 1.5);
  };
  /** A keycap (⌘, K, ↵…); `press` 0..1 pushes it down. Returns its width. */
  const key = (c: C2D, x: number, y: number, label: string, o: { press?: number; size?: number } = {}) => {
    const size = o.size ?? 44, p = clamp(o.press ?? 0), w = Math.max(size, measure(c, label, { size: size * 0.42, weight: 600 }) + size * 0.6), depth = size * 0.1 * (1 - p);
    fill(c, x, y + size * 0.1, w, size, size * 0.24, L.dark ? '#000000' : 'rgba(0,0,0,.16)');
    fill(c, x, y + size * 0.1 - depth, w, size, size * 0.24, L.dark ? '#2a2a2e' : '#ffffff');
    stroke(c, x, y + size * 0.1 - depth, w, size, size * 0.24, L.line, 1.5);
    text(c, label, x + w / 2, y + size * 0.6 - depth, { size: size * 0.42, weight: 600, align: 'center', role: 'keep' });
    return w;
  };
  /**
   * An annotation: a dashed leader drawn from `from` toward `to`, then a label at `to` (anchored by `side`). `k` 0..1
   * (s.on()): the line draws first, the label follows. Keep each to one short line; the product stays the main thing.
   */
  const callout = (c: C2D, from: Point, to: Point, label: string, k: number, o: { side?: 'left' | 'right' | 'above' | 'below'; size?: number; color?: string } = {}) => {
    if (k <= 0.001) return;
    const draw = clamp(k * 1.6), size = o.size ?? 14, ink = o.color ?? (L.dark ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.45)');
    c.save(); c.strokeStyle = ink; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(from[0], from[1]); c.lineTo(lerp(from[0], to[0], draw), lerp(from[1], to[1], draw)); c.stroke(); c.restore();
    dot(c, from[0], from[1], 3.5 * clamp(k * 3), ink);
    const lk = clamp(pr(k, 0.45, 1)); if (lk <= 0) return;
    const w = measure(c, label, { size, weight: 600 }) + size * 1.8, h = size * 2.4, side = o.side ?? 'right';
    const x = side === 'left' ? to[0] - w : side === 'right' ? to[0] : to[0] - w / 2, y = side === 'above' ? to[1] - h : side === 'below' ? to[1] : to[1] - h / 2;
    c.save(); c.globalAlpha *= lk; c.translate(0, (1 - lk) * 6);
    fill(c, x, y, w, h, h * 0.3, L.dark ? '#f4f4f5' : L.outline ? L.ink : '#1d1d1f');
    text(c, label, x + w / 2, y + h / 2 + 1, { size, weight: 600, align: 'center', color: L.dark || L.outline ? (L.outline ? L.bg : '#0b0b0c') : '#ffffff', role: 'keep' });
    c.restore();
  };

  return { look: L, rr, fill, stroke, hline, vline, dot, shadow, backdrop, measure, text, bar, bars, icon, window: windowFrame, nav, avatar, button, badge, field, menu, roll, fly, phone, lockScreen, notification, toast, pointer, card, key, callout };
}
export type Kit = ReturnType<typeof createKit>;
/** Caret blink: on for the first half of every 0.9 s (pure function of time). */
export const blink = (time: number) => (time % 0.9) < 0.5;
export { springs };
