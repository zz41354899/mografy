// One scene version in its own same-origin iframe. Browsers never unload an imported module, so a
// long editing session would keep every version's code, module-level images and fonts alive;
// removing the iframe drops its whole module map and document. The player still calls the scene
// directly (same origin), so frames cost the same as before.
import type { SceneModule } from '@mografy/runtime';

export interface SceneFrame {
  /** Shown once the version is ready, so the previous one keeps playing until then. */
  readonly frame: HTMLIFrameElement;
  /** Lives in the iframe's document, so fonts the runtime loads there apply to it. */
  readonly canvas: HTMLCanvasElement;
  readonly scene: SceneModule;
  /** Fade in over whatever is below (the previous version's last frame); resolves when done. */
  show(): Promise<void>;
  remove(): void;
}

export async function openSceneFrame(container: HTMLElement, url: string, className: string): Promise<SceneFrame> {
  const frame = document.createElement('iframe');
  frame.className = className;
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.visibility = 'hidden';
  container.append(frame);
  try {
    // about:blank shares this page's origin and base URL.
    const win = frame.contentWindow, doc = frame.contentDocument;
    if (!win || !doc) throw new Error('Scene frame unavailable');
    doc.documentElement.style.cssText = 'height:100%;background:transparent';
    doc.body.style.cssText = 'margin:0;height:100%;overflow:hidden;background:transparent';
    const canvas = doc.createElement('canvas');
    canvas.className = 'stage-canvas';
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    doc.body.append(canvas);
    // import() compiled in the iframe's realm loads into the iframe's module map.
    const load = new (win as unknown as { Function: FunctionConstructor }).Function('url', 'return import(url)') as (url: string) => Promise<SceneModule>;
    const scene = await load(new URL(url, document.baseURI).href);
    return {
      frame, canvas, scene, remove() { frame.remove(); },
      async show() {
        frame.style.visibility = '';
        // Opacity only, so the compositor runs the fade without layout or repaint of the scene.
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        await frame.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' }).finished.catch(() => {});
      },
    };
  } catch (error) { frame.remove(); throw error; }
}
