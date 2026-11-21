// Editable layers: a scene declares its layers once, and the editor's timeline stores only the changes in a JSON file
// the scene imports (`scenes/timeline.json`). Changes are compiled and trial-rendered with the code, so the player,
// review sheets and every export see the same timing. Each layer has an in and an out point and an enter and an
// exit motion; lengthening a layer only lengthens its hold, the motions keep their own length.
import { clamp, ease } from './math.js';
import { springs } from './motion.js';
import { blurLayer, cached, layer } from './film.js';
import type { Context2D, Target } from './film.js';
import type { LayerEdit, TimelineEdits, TimelineLayer } from '@mografy/core';

/** Enter and exit motions the timeline offers. `none` cuts. */
export const MOTIONS = ['none', 'fade', 'fade-up', 'pop', 'blur-in', 'wipe'] as const;
export type Motion = typeof MOTIONS[number];
/** How long each motion takes, in seconds, and what it starts from. */
const MOTION: Record<Motion, { length: number; curve: (p: number) => number; opacity?: number; y?: number; scale?: number; blur?: number; reveal?: number }> = {
  none: { length: 0, curve: p => p },
  fade: { length: .4, curve: ease.outCubic, opacity: 0 },
  'fade-up': { length: .6, curve: springs.out, opacity: 0, y: 48 },
  pop: { length: .5, curve: springs.pop, opacity: 0, scale: .82 },
  'blur-in': { length: .7, curve: springs.out, opacity: 0, blur: 24 },
  wipe: { length: .6, curve: ease.inOutCubic, reveal: 0 },
};
export const motionLength = (motion: Motion) => MOTION[motion].length;

export interface LayerDeclaration {
  /** Stable id; the scene draws a layer by it. Duplicates made in the editor draw like the layer they copy. */
  id: string;
  name: string;
  in: number;
  out: number;
  enter?: Motion;
  exit?: Motion;
  hidden?: boolean;
  /** The editor cannot move a locked layer. */
  locked?: boolean;
  /** Track colour in the editor. */
  colour?: string;
  /** Where the layer is drawn, shown in the editor. */
  source?: string;
  /** Ids of the scene's `role: 'subtitle'` parameters this layer shows; the editor lists them with the layer. */
  subtitles?: string[];
  /**
   * The layer's drawing does not change with time (a background, a static panel): `draw` and `each` draw it once
   * and reuse its pixels while it is at rest (see `cached`). Its enter and exit motions still apply. `drawFrame`
   * layers draw through the FrameContext and are always drawn.
   */
  still?: boolean;
}
// The edit and layer shapes are the scene contract's (layerEditSchema, timelineEditsSchema, timelineLayerSchema in
// @mografy/core), so the editor, the server and the scene read one definition. Type-only: scenes stay schema-free.
export type { LayerEdit, TimelineEdits, TimelineLayer } from '@mografy/core';
/** A layer's look at one time: multiply it into the drawing, or let `drawLayer` apply it. */
export interface LayerLook {
  opacity: number; y: number; scale: number; blur: number;
  /** 0–1: how much of the frame a wipe has uncovered, left to right. */
  reveal: number;
  /** Seconds since the in point, and 0–1 over the layer's length. */
  local: number; progress: number;
}
export interface Timeline {
  /** Resolved layers, top to bottom. */
  readonly layers: readonly TimelineLayer[];
  /** For `meta.layers`: the editor reads the layers and the edits from here. */
  readonly meta: { file: string; layers: TimelineLayer[]; edits: TimelineEdits };
  get(id: string): TimelineLayer;
  /** null when the layer is hidden or outside its in and out points. */
  look(id: string, time: number): LayerLook | null;
  /** Layers on screen at `time`, bottom first (draw order), with their looks. */
  visible(time: number): { layer: TimelineLayer; look: LayerLook }[];
  /**
   * The layer's own time at film time `time`: its declared window stretched onto where the editor put it, so an
   * existing draw function keeps its timing when the layer is moved or retimed. null when hidden or outside.
   */
  time(id: string, time: number): number | null;
  /**
   * Draw every visible layer bottom first: `draw[layer.base](c, ownTime, look)` inside `drawLayer`, so the editor's
   * order, motions, copies and visibility all apply. `anchor` (per base id) is where rise and scale happen.
   */
  draw(t: Target, time: number, draw: Record<string, (c: Context2D, ownTime: number, look: LayerLook) => void>, anchor?: Record<string, readonly [number, number]>): void;
  /**
   * The same for scenes that draw with the FrameContext (`ctx.draw`): each layer gets the context itself, with its
   * look applied to the shared native context (opacity, rise, scale, wipe; blur is left out).
   */
  drawFrame<C extends { canvas: Context2D }>(ctx: C, time: number, draw: Record<string, (ctx: C, ownTime: number, look: LayerLook) => void>, anchor?: Record<string, readonly [number, number]>): void;
  /**
   * Draw one declared layer, and any copies made in the editor, right here in the scene's own drawing order: for
   * films whose parts share a camera or a pass and cannot be lifted out (the editor's reordering does not apply).
   */
  each(t: Target, id: string, time: number, draw: (c: Context2D, ownTime: number, look: LayerLook) => void, anchor?: readonly [number, number]): void;
}

const isMotion = (v: unknown): v is Motion => typeof v === 'string' && (MOTIONS as readonly string[]).includes(v);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const id = /^[\w-]{1,64}$/;

/** Accept only well-formed edits, so a hand-edited or stale file never breaks the scene. */
export function cleanEdits(input: unknown): TimelineEdits {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>, out: TimelineEdits = {};
  if (raw.layers && typeof raw.layers === 'object') {
    const layers: Record<string, LayerEdit> = {};
    for (const [key, value] of Object.entries(raw.layers as Record<string, unknown>)) {
      if (!id.test(key) || !value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>, edit: LayerEdit = {};
      if (typeof v.name === 'string' && v.name.trim()) edit.name = v.name.slice(0, 120);
      if (num(v.in) !== undefined) edit.in = Math.max(0, num(v.in)!);
      if (num(v.out) !== undefined) edit.out = Math.max(0, num(v.out)!);
      if (isMotion(v.enter)) edit.enter = v.enter;
      if (isMotion(v.exit)) edit.exit = v.exit;
      if (typeof v.hidden === 'boolean') edit.hidden = v.hidden;
      if (typeof v.locked === 'boolean') edit.locked = v.locked;
      if (typeof v.colour === 'string' && /^#[\da-f]{6}$/i.test(v.colour)) edit.colour = v.colour;
      if (Object.keys(edit).length) layers[key] = edit;
    }
    if (Object.keys(layers).length) out.layers = layers;
  }
  if (Array.isArray(raw.added)) {
    const added = raw.added.filter((a): a is { id: string; base: string } => !!a && typeof a === 'object' && id.test(String((a as { id?: unknown }).id)) && id.test(String((a as { base?: unknown }).base)))
      .map(a => ({ id: a.id, base: a.base }));
    if (added.length) out.added = added;
  }
  for (const key of ['removed', 'order'] as const) {
    if (!Array.isArray(raw[key])) continue;
    const list = [...new Set((raw[key] as unknown[]).filter((v): v is string => typeof v === 'string' && id.test(v)))];
    if (list.length) out[key] = list;
  }
  return out;
}

/** Enter and exit lengths for a layer; when it is too short for both, both speed up by the same factor. */
export function layerPhases(l: Pick<TimelineLayer, 'in' | 'out' | 'enter' | 'exit'>) {
  const length = Math.max(0, l.out - l.in);
  let enter = MOTION[l.enter].length, exit = MOTION[l.exit].length, k = 1;
  if (enter + exit > length) { k = (enter + exit) ? length / (enter + exit) : 1; enter *= k; exit *= k; }
  return { enter, exit, hold: Math.max(0, length - enter - exit), k };
}

function apply(look: LayerLook, motion: Motion, p: number) {
  const m = MOTION[motion], v = m.curve(clamp(p));
  if (m.opacity !== undefined) look.opacity *= m.opacity + (1 - m.opacity) * clamp(v);
  if (m.y !== undefined) look.y += m.y * (1 - v);
  if (m.scale !== undefined) look.scale *= m.scale + (1 - m.scale) * v;
  if (m.blur !== undefined) look.blur += m.blur * (1 - clamp(v));
  if (m.reveal !== undefined) look.reveal = Math.min(look.reveal, m.reveal + (1 - m.reveal) * clamp(v));
}

/**
 * Declare the film's layers, top to bottom, and apply the editor's changes:
 * `const tl = timeline([...], edits)` with `import edits from './timeline.json'`, then `meta.layers = tl.meta`.
 */
export function timeline(declarations: readonly LayerDeclaration[], edits: unknown = {}, options: { file?: string; size?: readonly [number, number] } = {}): Timeline {
  const clean = cleanEdits(edits), declared = new Map<string, LayerDeclaration>();
  for (const d of declarations) {
    if (!id.test(d.id)) throw new Error(`timeline: layer id "${d.id}" must be 1–64 letters, digits, _ or -`);
    if (declared.has(d.id)) throw new Error(`timeline: two layers are called "${d.id}"`);
    if (!(d.out > d.in)) throw new Error(`timeline: layer "${d.id}" ends at ${d.out}, before it starts (${d.in})`);
    declared.set(d.id, d);
  }
  const removed = new Set(clean.removed ?? []);
  const resolve = (layerId: string, d: LayerDeclaration): TimelineLayer => {
    const e = clean.layers?.[layerId] ?? {}, edited: (keyof LayerEdit)[] = [];
    const pick = <K extends keyof LayerEdit>(key: K, fallback: NonNullable<LayerEdit[K]>): NonNullable<LayerEdit[K]> => {
      const value = e[key];
      if (value === undefined || value === fallback) return fallback;
      edited.push(key); return value as NonNullable<LayerEdit[K]>;
    };
    const copy = layerId !== d.id;
    const name = pick('name', copy ? `${d.name} copy` : d.name), enter = pick('enter', d.enter ?? 'none'), exit = pick('exit', d.exit ?? 'none');
    const hidden = pick('hidden', d.hidden ?? false);
    const colour = d.colour || e.colour ? pick('colour', d.colour ?? e.colour!) : undefined;
    // A lock the editor sets only stops editing; a declared lock also pins the declared times until it is lifted.
    const locked = pick('locked', d.locked ?? false), pinned = d.locked && locked;
    let start = pinned ? d.in : pick('in', d.in), end = pinned ? d.out : pick('out', d.out);
    if (!(end > start)) { start = d.in; end = d.out; edited.splice(0, edited.length, ...edited.filter(k => k !== 'in' && k !== 'out')); }
    return { id: layerId, base: d.id, name, in: start, out: end, enter, exit, hidden, locked, colour, source: d.source, subtitles: d.subtitles ?? [], edited };
  };
  let list: TimelineLayer[] = declarations.filter(d => !removed.has(d.id)).map(d => resolve(d.id, d));
  for (const a of clean.added ?? []) {
    const base = declared.get(a.base);
    if (!base || declared.has(a.id) || removed.has(a.id) || list.some(l => l.id === a.id)) continue;
    // A copy sits just above the layer it was made from unless the order says otherwise.
    const at = list.findIndex(l => l.id === a.base);
    list.splice(at < 0 ? list.length : at, 0, resolve(a.id, base));
  }
  if (clean.order?.length) {
    const rank = new Map(clean.order.map((v, i) => [v, i]));
    const ordered = list.filter(l => rank.has(l.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    let next = 0;
    list = list.map(l => rank.has(l.id) ? ordered[next++]! : l);
  }
  Object.freeze(list);
  const byId = new Map(list.map(l => [l.id, l]));
  const look = (layerId: string, time: number): LayerLook | null => {
    const l = byId.get(layerId);
    if (!l || l.hidden || time < l.in || time >= l.out) return null;
    const result: LayerLook = { opacity: 1, y: 0, scale: 1, blur: 0, reveal: 1, local: time - l.in, progress: clamp((time - l.in) / (l.out - l.in)) };
    const ph = layerPhases(l);
    if (ph.enter > 0 && time < l.in + ph.enter) apply(result, l.enter, (time - l.in) / ph.enter);
    if (ph.exit > 0 && time > l.out - ph.exit) apply(result, l.exit, (l.out - time) / ph.exit);
    return result;
  };
  const ownTime = (layerId: string, time: number) => {
    const l = byId.get(layerId), d = l && declared.get(l.base);
    if (!l || !d || l.hidden || time < l.in || time >= l.out) return null;
    return d.in + (time - l.in) * (d.out - d.in) / (l.out - l.in);
  };
  const size = options.size ?? [1920, 1080];
  return Object.freeze({
    time: ownTime,
    draw(target: Target, time: number, draw: Record<string, (c: Context2D, own: number, look: LayerLook) => void>, anchor: Record<string, readonly [number, number]> = {}) {
      for (let i = list.length - 1; i >= 0; i--) {
        const l = list[i]!, fn = draw[l.base], own = ownTime(l.id, time), v = own === null ? null : look(l.id, time);
        if (!fn || own === null || !v || v.opacity <= .001 || v.reveal <= .001) continue;
        const plain = v.opacity >= .999 && v.reveal >= .999 && v.blur <= .3 && v.y === 0 && v.scale === 1;
        // Layers at rest draw straight through, exactly as the scene did before it had layers.
        if (plain && declared.get(l.base)?.still) cached(target, `timeline:${l.id}`, '', c => fn(c, own, v));
        else if (plain) { const c = 'withCanvas' in target ? target.canvas : target; c.save(); try { fn(c, own, v); } finally { c.restore(); } }
        else drawLayer(target, l, v, anchor[l.base] ?? [size[0] / 2, size[1] / 2], size, c => fn(c, own, v));
      }
    },
    each(target: Target, base: string, time: number, fn: (c: Context2D, own: number, look: LayerLook) => void, anchor?: readonly [number, number]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const l = list[i]!;
        if (l.base !== base) continue;
        const own = ownTime(l.id, time), v = own === null ? null : look(l.id, time);
        if (own === null || !v || v.opacity <= .001 || v.reveal <= .001) continue;
        const plain = v.opacity >= .999 && v.reveal >= .999 && v.blur <= .3 && v.y === 0 && v.scale === 1;
        if (plain && declared.get(l.base)?.still) cached(target, `timeline:${l.id}`, '', c => fn(c, own, v));
        else if (plain) { const c = 'withCanvas' in target ? target.canvas : target; c.save(); try { fn(c, own, v); } finally { c.restore(); } }
        else drawLayer(target, l, v, anchor ?? [size[0] / 2, size[1] / 2], size, c => fn(c, own, v));
      }
    },
    drawFrame<C extends { canvas: Context2D }>(ctx: C, time: number, draw: Record<string, (ctx: C, own: number, look: LayerLook) => void>, anchor: Record<string, readonly [number, number]> = {}) {
      for (let i = list.length - 1; i >= 0; i--) {
        const l = list[i]!, fn = draw[l.base], own = ownTime(l.id, time), v = own === null ? null : look(l.id, time);
        if (!fn || own === null || !v || v.opacity <= .001 || v.reveal <= .001) continue;
        const c = ctx.canvas, [ax, ay] = anchor[l.base] ?? [size[0] / 2, size[1] / 2];
        c.save();
        try {
          if (v.reveal < 1) { c.beginPath(); c.rect(0, 0, size[0] * v.reveal, size[1]); c.clip(); }
          if (v.y !== 0 || v.scale !== 1) { c.translate(ax, ay + v.y); c.scale(v.scale, v.scale); c.translate(-ax, -ay); }
          c.globalAlpha *= clamp(v.opacity);
          fn(ctx, own, v);
        } finally { c.restore(); }
      }
    },
    layers: list,
    meta: { file: options.file ?? 'scenes/timeline.json', layers: list.map(l => ({ ...l, edited: [...l.edited], subtitles: [...l.subtitles] })), edits: clean },
    get(layerId: string) { const l = byId.get(layerId); if (!l) throw new Error(`timeline: no layer "${layerId}"`); return l; },
    look,
    visible(time: number) {
      const out: { layer: TimelineLayer; look: LayerLook }[] = [];
      for (let i = list.length - 1; i >= 0; i--) { const l = list[i]!, v = look(l.id, time); if (v && v.opacity > .001 && v.reveal > .001) out.push({ layer: l, look: v }); }
      return out;
    },
  });
}

/**
 * Draw one layer with its look: opacity through one `layer` (so its parts fade as one), blur through `blurLayer`,
 * the wipe as a clip, and the rise and scale around `anchor`. `width` and `height` are the film's size.
 */
export function drawLayer(t: Target, l: TimelineLayer, look: LayerLook, anchor: readonly [number, number], size: readonly [number, number], draw: (c: Context2D, look: LayerLook) => void) {
  const inner = (c: Context2D) => {
    c.save();
    if (look.reveal < 1) { c.beginPath(); c.rect(0, 0, size[0] * look.reveal, size[1]); c.clip(); }
    c.translate(anchor[0], anchor[1] + look.y); c.scale(look.scale, look.scale); c.translate(-anchor[0], -anchor[1]);
    draw(c, look);
    c.restore();
  };
  if (look.blur > .3) blurLayer(t, `tl:${l.id}`, look.blur, inner, { alpha: look.opacity });
  else layer(t, `tl:${l.id}`, look.opacity, inner);
}

/**
 * Retime a scene that declares no layers: shot i now ends at `ends[i]` instead of its declared end, and time inside
 * each shot is stretched to fit. The scene still receives its own time, so its code never changes. Returns null when
 * `ends` does not fit the shots (wrong count or not increasing), and the scene plays as declared.
 */
export function shotWarp(shots: readonly { end: number; stop?: number | undefined; title?: string | undefined }[], duration: number, ends: unknown) {
  if (!Array.isArray(ends) || ends.length !== shots.length || !shots.length) return null;
  const next = ends.map(Number);
  if (next.some((e, i) => !Number.isFinite(e) || e <= (i ? next[i - 1]! : 0))) return null;
  const old = shots.map(s => s.end), tail = Math.max(0, duration - old.at(-1)!);
  const spans = old.map((end, i) => ({ s: i ? old[i - 1]! : 0, e: end, s2: i ? next[i - 1]! : 0, e2: next[i]! }));
  const into = (span: typeof spans[number], t: number) => span.s + (t - span.s2) * (span.e - span.s) / (span.e2 - span.s2);
  const out = (span: typeof spans[number], t: number) => span.s2 + (t - span.s) * (span.e2 - span.s2) / (span.e - span.s);
  return {
    duration: next.at(-1)! + tail,
    shots: shots.map((shot, i) => ({ ...shot, end: next[i]!, ...(shot.stop !== undefined ? { stop: Math.min(next[i]!, Math.max(spans[i]!.s2, out(spans[i]!, shot.stop))) } : {}) })),
    /** Film time → the scene's own time. */
    map(t: number) {
      const span = spans.find(x => t < x.e2);
      return span ? into(span, t) : old.at(-1)! + (t - next.at(-1)!);
    },
  };
}

// ---------------------------------------------------------------- shot sequences (scenes that declare no layers)

/** Track colours for shot layers, in shot order. */
export const SHOT_COLOURS: readonly string[] = ['#5fa37a', '#c2668a', '#5b9bd5', '#9a7bd0', '#d4a24c', '#4fb0a5', '#c98a5a', '#8a8f98'];

export interface ShotSequence {
  duration: number;
  shots: { end: number; stop?: number; title?: string }[];
  layers: Timeline['meta'] & { sequence: true };
  /** The segment at film time `t`: the scene's own time and the look of the shot layer; null in a gap. */
  at(t: number): { sceneTime: number; look: LayerLook; layer: TimelineLayer } | null;
}
/**
 * Every shot of a scene as one layer, so the timeline can edit any film without changes to its code: trimming,
 * reordering, repeating or cutting shots re-maps film time onto the scene's own time, and each shot's enter and
 * exit motions are applied to the whole frame. Null when the scene has no shots.
 */
export function shotSequence(shots: readonly { end: number; stop?: number | undefined; title?: string | undefined }[], duration: number, edits: unknown = {}, options: { file?: string } = {}): ShotSequence | null {
  if (!shots.length) return null;
  const declared: LayerDeclaration[] = shots.map((shot, i) => {
    const start = i ? shots[i - 1]!.end : 0;
    return { id: `shot-${i + 1}`, name: shot.title || `Shot ${i + 1}`, in: start, out: Math.max(start + 1 / 30, Math.min(shot.end, duration)), colour: SHOT_COLOURS[i % SHOT_COLOURS.length]!, source: `shot ${i + 1}` };
  });
  const tl = timeline(declared, edits, options);
  const index = new Map(declared.map((d, i) => [d.id, i]));
  const segments = tl.layers.filter(l => !l.hidden).map(l => ({ layer: l, shot: index.get(l.base)!, src: declared[index.get(l.base)!]! })).sort((a, b) => a.layer.in - b.layer.in);
  const end = segments.length ? Math.max(...segments.map(s => s.layer.out)) : duration;
  const outShots = segments.map(s => {
    const shot = shots[s.shot]!, scale = (s.layer.out - s.layer.in) / (s.src.out - s.src.in);
    return { end: s.layer.out, title: s.layer.name, ...(shot.stop !== undefined ? { stop: Math.min(s.layer.out, s.layer.in + (shot.stop - s.src.in) * scale) } : {}) };
  }).filter((shot, i, all) => i === 0 || shot.end > all[i - 1]!.end);
  return {
    duration: end,
    shots: outShots.length ? outShots : [{ end }],
    layers: { ...tl.meta, sequence: true },
    at(t) {
      // Where shots overlap, the one that starts later covers the other.
      let seg = segments.filter(s => t >= s.layer.in && t < s.layer.out).at(-1);
      if (!seg && t >= end - 1e-6) seg = segments.at(-1);
      if (!seg) return null;
      const look = tl.look(seg.layer.id, Math.min(t, seg.layer.out - 1e-6)) ?? { opacity: 1, y: 0, scale: 1, blur: 0, reveal: 1, local: 0, progress: 1 };
      const p = clamp((t - seg.layer.in) / (seg.layer.out - seg.layer.in));
      return { sceneTime: seg.src.in + p * (seg.src.out - seg.src.in), look, layer: seg.layer };
    },
  };
}
/**
 * Draw a whole frame with a shot layer's look: the wipe as a clip, rise and scale around the centre, and opacity
 * as a fade to the background. Used by the player and exports for scenes without their own layers.
 */
export function drawShot(ctx: { canvas: Context2D; width: number; height: number }, background: string, look: LayerLook, draw: () => void) {
  const c = ctx.canvas, w = ctx.width, h = ctx.height;
  c.save();
  if (look.reveal < 1) { c.beginPath(); c.rect(0, 0, w * look.reveal, h); c.clip(); }
  if (look.y !== 0 || look.scale !== 1) { c.translate(w / 2, h / 2 + look.y); c.scale(look.scale, look.scale); c.translate(-w / 2, -h / 2); }
  try { draw(); } finally { c.restore(); }
  const fade = 1 - clamp(look.opacity);
  if (fade > .001) { c.save(); c.globalAlpha = fade; c.fillStyle = background; c.fillRect(0, 0, w, h); c.restore(); }
}
