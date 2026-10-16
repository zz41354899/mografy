import type { CSSProperties } from 'react';

export function ExportProgressBar({ percentage, indeterminate }: { percentage: number; indeterminate: boolean }) {
  return <div className={`export-job-progress ${indeterminate ? 'indeterminate' : ''}`} role="progressbar"
    aria-label={indeterminate ? 'Finalizing export' : 'Frame capture'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : percentage}>
    <i style={{ '--progress': `${percentage}%` } as CSSProperties} />
  </div>;
}
