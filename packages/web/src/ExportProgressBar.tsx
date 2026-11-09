import type { CSSProperties } from 'react';
import { useT } from './i18n.js';

export function ExportProgressBar({ percentage, indeterminate }: { percentage: number; indeterminate: boolean }) {
  const t = useT();
  return <div className={`export-job-progress ${indeterminate ? 'indeterminate' : ''}`} role="progressbar"
    aria-label={indeterminate ? t.xjFinalizing : t.xjCapture} aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : percentage}>
    <i style={{ '--progress': `${percentage}%` } as CSSProperties} />
  </div>;
}
