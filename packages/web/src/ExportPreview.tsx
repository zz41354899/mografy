import { useEffect, useRef, useState } from 'react';
import { outputFrameCount } from '@mografy/core';
import type { ExportSize, RenderSettings, SceneProject, Snapshot } from '@mografy/core';
import { createSceneRuntime, renderOutputFrame } from '@mografy/runtime';
import type { SceneRuntime } from '@mografy/runtime';
import { openSceneFrame } from './scene-frame.js';
import type { SceneFrame } from './scene-frame.js';

/** A paused frame using the same canvas layout and effects as the export. */
export function ExportPreview({ snapshot, size, settings, label = 'MP4 frame preview' }: { snapshot: Snapshot; size: ExportSize; settings: RenderSettings; label?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [time] = useState(snapshot.state.playhead), [error, setError] = useState('');
  const project = snapshot.project!, version = snapshot.scene!.version;
  // Snapshot events clone project objects even when the scene inputs are unchanged.
  const spec = JSON.stringify({ seed: project.seed, params: project.params, fonts: project.fonts, audio: project.audio, aspectRatio: project.aspectRatio });
  const { width, height, fit } = size;
  useEffect(() => {
    let cancelled = false, runtime: SceneRuntime | undefined, scratch: SceneFrame | undefined;
    const canvas = document.createElement('canvas');
    const load = async () => {
      const project = JSON.parse(spec) as Pick<SceneProject, 'seed' | 'params' | 'fonts' | 'audio' | 'aspectRatio'>;
      // Render in a throwaway iframe and keep only the pixels, so the version's module is freed.
      scratch = await openSceneFrame(document.body, '/__mografy/scene/' + version + '.js', 'scene-scratch');
      const { scene, canvas: source } = scratch;
      const scale = Math.min(1, 384 / Math.max(width, height));
      runtime = await createSceneRuntime(source, scene, { seed: project.seed, params: project.params, fonts: project.fonts, audio: project.audio,
        aspectRatio: project.aspectRatio, assetBase: '/__mografy/files/', outputSize: { width: Math.round(width * scale), height: Math.round(height * scale), fit } });
      if (cancelled) return;
      const k = Math.max(0, Math.min(outputFrameCount(runtime.meta.duration, settings.fps) - 1, Math.round(time * settings.fps)));
      const pixels = renderOutputFrame(runtime, source, k, settings, project.seed, project.params);
      canvas.width = source.width; canvas.height = source.height;
      const context = canvas.getContext('2d')!, image = context.createImageData(canvas.width, canvas.height);
      image.data.set(pixels); context.putImageData(image, 0, 0);
      container.current?.replaceChildren(canvas); setError('');
    };
    const release = () => { runtime?.dispose(); runtime = undefined; scratch?.remove(); scratch = undefined; };
    void load().catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); }).finally(release);
    return () => { cancelled = true; release(); };
  }, [version, spec, width, height, fit, settings, time]);
  const ratio = width === height ? 'Square' : width * 9 === height * 16 ? 'Landscape 16:9' : width * 16 === height * 9 ? 'Portrait 9:16' : width > height ? 'Landscape' : 'Portrait';
  return <figure className="export-preview"><div ref={container} aria-label={label} role="img" />
    <figcaption>{error || `${ratio} · ${width} × ${height}`}</figcaption></figure>;
}
