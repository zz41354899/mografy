// Timeline edits as pure functions over (layers, edits). The player shows the result at once; the server then
// compiles the same edits into the scene. Only changes are stored: a field equal to the declaration is dropped.
import { layerPhases, MOTIONS as RUNTIME_MOTIONS } from '@mografy/runtime';
import type { LayersMeta, TimelineEdits, TimelineLayer } from '@mografy/core';

export type LayerMotion = TimelineLayer['enter'];
// Motions and their lengths come from the runtime that draws them, so the timeline shows what the film plays.
export const MOTIONS: readonly LayerMotion[] = RUNTIME_MOTIONS;
export const MIN_LENGTH = 1 / 30;

export interface TimelineState { layers: TimelineLayer[]; edits: TimelineEdits }
export const stateOf = (meta: LayersMeta): TimelineState => ({ layers: structuredClone(meta.layers), edits: structuredClone(meta.edits) });

/** Enter, exit and hold lengths for a layer (`layerPhases` in the runtime). */
export const phases = layerPhases;

type Field = 'name' | 'in' | 'out' | 'enter' | 'exit' | 'hidden' | 'colour' | 'locked';
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** Set fields on one layer; edits keep only what differs from what the server last said was declared. */
export function setLayer(state: TimelineState, id: string, change: Partial<Pick<TimelineLayer, Field>>, declared?: Partial<Pick<TimelineLayer, Field>>): TimelineState {
  const layer = state.layers.find(l => l.id === id);
  if (!layer) return state;
  const next: TimelineLayer = { ...layer, ...change };
  if (next.in !== undefined) next.in = r4(Math.max(0, next.in));
  if (next.out !== undefined) next.out = r4(next.out);
  if (next.out - next.in < MIN_LENGTH) return state;
  const editsFor = { ...(state.edits.layers?.[id] ?? {}) } as Record<Field, unknown>;
  for (const key of Object.keys(change) as Field[]) {
    const value = next[key];
    if (declared && declared[key] === value) delete editsFor[key];
    else editsFor[key] = value;
  }
  const layers = { ...(state.edits.layers ?? {}) };
  if (Object.keys(editsFor).length) layers[id] = editsFor as NonNullable<TimelineEdits['layers']>[string]; else delete layers[id];
  const edited = new Set(layer.edited);
  for (const key of Object.keys(change) as Field[]) { if (key in editsFor) edited.add(key); else edited.delete(key); }
  return {
    layers: state.layers.map(l => l.id === id ? { ...next, edited: [...edited] } : l),
    edits: clean({ ...state.edits, layers }),
  };
}

/** The declared value of each field the user has not changed, for dropping edits that return to it. */
export function declaredOf(layer: TimelineLayer, original?: TimelineLayer): Partial<Pick<TimelineLayer, Field>> {
  const out: Partial<Pick<TimelineLayer, Field>> = {};
  if (!original) return out;
  for (const key of ['name', 'in', 'out', 'enter', 'exit', 'hidden', 'colour', 'locked'] as Field[]) if (!original.edited.includes(key)) (out as Record<string, unknown>)[key] = original[key];
  return out;
}

/** Move a layer by `dt`, keeping its length, within [0, duration]. */
export function moveLayer(state: TimelineState, id: string, start: number, duration: number, declared?: Partial<Pick<TimelineLayer, Field>>) {
  const l = state.layers.find(x => x.id === id);
  if (!l || l.locked) return state;
  const length = l.out - l.in, at = Math.min(Math.max(0, start), Math.max(0, duration - length));
  return setLayer(state, id, { in: at, out: at + length }, declared);
}
/** Move one end of a layer; the other end stays. */
export function trimLayer(state: TimelineState, id: string, edge: 'in' | 'out', t: number, duration: number, declared?: Partial<Pick<TimelineLayer, Field>>) {
  const l = state.layers.find(x => x.id === id);
  if (!l || l.locked) return state;
  return edge === 'in'
    ? setLayer(state, id, { in: Math.min(Math.max(0, t), l.out - MIN_LENGTH) }, declared)
    : setLayer(state, id, { out: Math.max(Math.min(duration, t), l.in + MIN_LENGTH) }, declared);
}

const usedIds = (state: TimelineState) => new Set([...state.layers.map(l => l.id), ...(state.edits.removed ?? []), ...(state.edits.added ?? []).map(a => a.id)]);
/** A copy above the layer, drawn like its base; it gets its own id. */
export function duplicateLayer(state: TimelineState, id: string, copySuffix: string): { state: TimelineState; id?: string } {
  const l = state.layers.find(x => x.id === id);
  if (!l) return { state };
  const used = usedIds(state);
  let n = 2, copy = `${l.base}-copy`;
  while (used.has(copy)) copy = `${l.base}-copy-${n++}`;
  const name = `${l.name}${copySuffix}`;
  const at = state.layers.findIndex(x => x.id === id);
  const layers = [...state.layers];
  layers.splice(at, 0, { ...l, id: copy, name, locked: false, edited: ['name', 'in', 'out'] });
  const order = layers.map(x => x.id);
  return {
    id: copy,
    state: {
      layers,
      edits: clean({
        ...state.edits, added: [...(state.edits.added ?? []), { id: copy, base: l.base }], order,
        layers: { ...(state.edits.layers ?? {}), [copy]: { name, in: l.in, out: l.out, ...(l.enter !== 'none' ? { enter: l.enter } : {}), ...(l.exit !== 'none' ? { exit: l.exit } : {}), ...(l.hidden ? { hidden: true } : {}) } },
      }),
    },
  };
}
/** Remove a layer. A copy disappears from the file; a declared layer is listed as removed (undo brings it back). */
export function removeLayer(state: TimelineState, id: string): TimelineState {
  const l = state.layers.find(x => x.id === id);
  if (!l) return state;
  const added = state.edits.added ?? [], isCopy = added.some(a => a.id === id);
  const layers = { ...(state.edits.layers ?? {}) }; delete layers[id];
  return {
    layers: state.layers.filter(x => x.id !== id),
    edits: clean({
      ...state.edits, layers,
      added: added.filter(a => a.id !== id),
      removed: isCopy ? state.edits.removed : [...(state.edits.removed ?? []), id],
      order: state.edits.order?.filter(x => x !== id),
    }),
  };
}
/** Move a layer to another place in the stack (0 = top); the whole order is stored. */
export function reorderLayer(state: TimelineState, id: string, to: number): TimelineState {
  const from = state.layers.findIndex(l => l.id === id);
  const target = Math.min(Math.max(0, to), state.layers.length - 1);
  if (from < 0 || from === target) return state;
  const layers = [...state.layers];
  const [moved] = layers.splice(from, 1);
  layers.splice(target, 0, moved!);
  return { layers, edits: clean({ ...state.edits, order: layers.map(l => l.id) }) };
}

/** Drop every change to one layer. Returns null when the declaration is not known here (the server resolves it). */
export function revertLayer(state: TimelineState, id: string): TimelineEdits {
  const layers = { ...(state.edits.layers ?? {}) }; delete layers[id];
  return clean({ ...state.edits, layers });
}

function clean(edits: TimelineEdits): TimelineEdits {
  const out: TimelineEdits = {};
  if (edits.layers && Object.keys(edits.layers).length) out.layers = edits.layers;
  if (edits.added?.length) out.added = edits.added;
  if (edits.removed?.length) out.removed = edits.removed;
  if (edits.order?.length) out.order = edits.order;
  return out;
}

/** Shortest shot the timeline allows, in seconds. */
export const MIN_SHOT = .2;
/**
 * Move one end of shot `index` to `t`. The right end pushes the later shots along, so each keeps its length;
 * the left end is the boundary with the previous shot, so only those two change.
 */
export function retimeShot(ends: readonly number[], index: number, edge: 'in' | 'out', t: number): number[] {
  const r = (v: number) => Math.round(v * 1000) / 1000, start = index ? ends[index - 1]! : 0, end = ends[index]!;
  if (edge === 'out') { const delta = Math.max(MIN_SHOT - (end - start), t - end); return ends.map((v, i) => i < index ? v : r(v + delta)); }
  if (index === 0) return [...ends];
  const before = index > 1 ? ends[index - 2]! : 0;
  const at = Math.min(end - MIN_SHOT, Math.max(before + MIN_SHOT, t));
  return ends.map((v, i) => i === index - 1 ? r(at) : v);
}

/** Track colours offered in the editor: distinct in lightness as well as hue, all readable under white labels. */
export const LAYER_COLOURS = ['#5fa37a', '#2f7c74', '#5b9bd5', '#5f50bd', '#9a7bd0', '#c2668a', '#c98a5a', '#d4a24c', '#8a8f98'] as const;

/** Snap targets in seconds: bars and beats, the playhead, other layers' edges, the start and the end. */
export interface SnapTarget { t: number; kind: 'bar' | 'beat' | 'playhead' | 'edge' | 'start' | 'end' }
export function snapTargets(state: TimelineState, exclude: string, duration: number, playhead: number, beats: { t: number; bar: boolean }[]): SnapTarget[] {
  const out: SnapTarget[] = [{ t: 0, kind: 'start' }, { t: duration, kind: 'end' }, { t: playhead, kind: 'playhead' }];
  for (const l of state.layers) if (l.id !== exclude) out.push({ t: l.in, kind: 'edge' }, { t: l.out, kind: 'edge' });
  for (const b of beats) out.push({ t: b.t, kind: b.bar ? 'bar' : 'beat' });
  return out;
}
/** The nearest target within `tolerance` seconds of any of `times` (for a move, both ends), and the shift to it. */
export function snap(times: number[], targets: SnapTarget[], tolerance: number): { shift: number; target: SnapTarget } | null {
  let best: { shift: number; target: SnapTarget } | null = null;
  const priority = { playhead: 0, edge: 1, start: 1, end: 1, bar: 2, beat: 3 } as const;
  for (const t of times) for (const target of targets) {
    const shift = target.t - t;
    if (Math.abs(shift) > tolerance) continue;
    if (!best || Math.abs(shift) < Math.abs(best.shift) - 1e-6 || (Math.abs(Math.abs(shift) - Math.abs(best.shift)) < 1e-6 && priority[target.kind] < priority[best.target.kind])) best = { shift, target };
  }
  return best;
}

/** Undo history of edit states, capped. */
export class History {
  private past: TimelineState[] = []; private future: TimelineState[] = [];
  push(before: TimelineState) { this.past.push(before); if (this.past.length > 200) this.past.shift(); this.future = []; }
  undo(current: TimelineState) { const s = this.past.pop(); if (s) this.future.push(current); return s; }
  redo(current: TimelineState) { const s = this.future.pop(); if (s) this.past.push(current); return s; }
  clear() { this.past = []; this.future = []; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}

// ---------------------------------------------------------------- shot sequences
// Layers that are the scene's shots in order: they stay contiguous from 0, so every change is "set the lengths in
// this order, then lay them out again". All ins and outs are written, which is what the scene needs to re-map time.

/** Lay the layers out back to back in their current order, from 0, keeping each one's length (or `lengths`). */
export function layoutSequence(state: TimelineState, lengths?: Map<string, number>): TimelineState {
  let at = 0, next = state;
  for (const l of state.layers) {
    const length = Math.max(MIN_SHOT, lengths?.get(l.id) ?? l.out - l.in);
    next = setLayer(next, l.id, { in: at, out: at + length });
    at += length;
  }
  return next;
}
/**
 * Trim one end of a sequence layer. Each end is the boundary with its neighbour, so only the two shots that share it
 * change and every other shot stays where it is. The last shot's right end changes the film's length.
 */
export function trimSequence(state: TimelineState, id: string, edge: 'in' | 'out', t: number): TimelineState {
  const i = state.layers.findIndex(l => l.id === id), l = state.layers[i];
  if (!l) return state;
  const lengths = new Map<string, number>();
  const [a, b] = edge === 'in' ? [state.layers[i - 1], l] : [l, state.layers[i + 1]];
  if (!a) return state;
  if (!b) { lengths.set(a.id, Math.max(MIN_SHOT, t - a.in)); return layoutSequence(state, lengths); }
  const at = Math.min(b.out - MIN_SHOT, Math.max(a.in + MIN_SHOT, t));
  lengths.set(a.id, at - a.in); lengths.set(b.id, b.out - at);
  return layoutSequence(state, lengths);
}
/** Slide a shot between its neighbours: it keeps its length, the shots before and after give and take the time. */
export function slideSequence(state: TimelineState, id: string, start: number): TimelineState {
  const i = state.layers.findIndex(l => l.id === id), l = state.layers[i];
  const prev = state.layers[i - 1], next = state.layers[i + 1];
  if (!l || !prev) return state;
  const length = l.out - l.in, max = next ? next.out - MIN_SHOT - length : Infinity;
  const at = Math.min(max, Math.max(prev.in + MIN_SHOT, start));
  const lengths = new Map<string, number>([[prev.id, at - prev.in], [l.id, length]]);
  if (next) lengths.set(next.id, next.out - (at + length));
  return layoutSequence(state, lengths);
}
/** Remove a shot from the sequence; the later ones close the gap. */
export function removeFromSequence(state: TimelineState, id: string) { return layoutSequence(removeLayer(state, id)); }
/** Repeat a shot right after itself. */
export function duplicateInSequence(state: TimelineState, id: string, copySuffix: string) {
  const result = duplicateLayer(state, id, copySuffix);
  if (!result.id) return result;
  // duplicateLayer puts the copy above (before) the original; a sequence repeats it after.
  const layers = [...result.state.layers], from = layers.findIndex(x => x.id === result.id);
  const [copy] = layers.splice(from, 1); layers.splice(from + 1, 0, copy!);
  return { id: result.id, state: layoutSequence({ layers, edits: { ...result.state.edits, order: layers.map(x => x.id) } }) };
}
/** Move a shot to another place in the order; times follow. */
export function reorderSequence(state: TimelineState, id: string, to: number) { return layoutSequence(reorderLayer(state, id, to)); }
