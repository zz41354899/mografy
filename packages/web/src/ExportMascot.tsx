import mascotUrl from './assets/mografy-mascot.png';

/** The homepage keyframe mascot accompanies exports, including background jobs. */
export function ExportMascot({ paused = false, compact = false }: { paused?: boolean; compact?: boolean }) {
  return <div className={`export-mascot ${paused ? 'is-stopping' : ''} ${compact ? 'export-mascot-mini' : ''}`} role="img" aria-label="Export loading animation">
    <img className="export-mascot-character" src={mascotUrl} alt="" aria-hidden="true" width={1254} height={1254} draggable={false} />
  </div>;
}
