import mascotUrl from './assets/mografy-mascot.png';
import { useT } from './i18n.js';

/** The homepage keyframe mascot accompanies exports, including background jobs. */
export function ExportMascot({ paused = false, compact = false }: { paused?: boolean; compact?: boolean }) {
  const t = useT();
  return <div className={`export-mascot ${paused ? 'is-stopping' : ''} ${compact ? 'export-mascot-mini' : ''}`} role="img" aria-label={t.xjMascot}>
    <img className="export-mascot-character" src={mascotUrl} alt="" aria-hidden="true" width={1254} height={1254} draggable={false} />
  </div>;
}
