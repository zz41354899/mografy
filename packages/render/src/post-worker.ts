// Runs in a Web Worker inside the headless page: sums one output frame's samples and finishes it
// (glow, grain), while the page's main thread already draws the next frame's samples.
import { FrameAccumulator, finishFrame } from '@mografy/runtime';
import type { MixingSpace, PostSettings } from '@mografy/runtime';

export type PostMessage =
  | { type: 'add'; width: number; height: number; space: MixingSpace; data: ArrayBuffer }
  | { type: 'finish'; settings: PostSettings };

let acc: FrameAccumulator | undefined;
/** A failed add is reported by the next finish, so the page gets exactly one reply per frame. */
let failure: string | undefined;
const scope = self as unknown as { onmessage: ((event: MessageEvent<PostMessage>) => void) | null; postMessage(message: unknown, transfer: Transferable[]): void };

const text = (error: unknown) => error instanceof Error ? error.message : String(error);

scope.onmessage = ({ data: message }) => {
  if (message.type === 'add') {
    try {
      const { width, height, space } = message;
      if (!acc || acc.width !== width || acc.height !== height || acc.space !== space) acc = new FrameAccumulator(width, height, space);
      acc.add(new Uint8Array(message.data));
    } catch (error) { failure ??= text(error); }
    return;
  }
  try {
    if (failure) throw new Error(failure);
    if (!acc) throw new Error('No samples accumulated');
    const out = finishFrame(acc, message.settings);
    scope.postMessage({ data: out.buffer }, [out.buffer]);
  } catch (error) { scope.postMessage({ error: text(error) }, []); }
  finally { acc?.reset(); failure = undefined; }
};
