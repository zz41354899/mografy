import type { AspectRatio } from '@mografy/core';

export function AspectRatioToggle({ value, onChange, disabled = false, label }: { value: AspectRatio; onChange(value: AspectRatio): void; disabled?: boolean; label: string }) {
  return <div className="aspect-toggle" role="group" aria-label={label}>
    {(['16:9', '9:16'] as const).map(ratio => <button key={ratio} type="button" disabled={disabled} aria-pressed={value === ratio}
      aria-label={ratio === '16:9' ? 'Landscape 16:9' : 'Portrait 9:16'} title={ratio === '16:9' ? 'Landscape 16:9' : 'Portrait 9:16'}
      onClick={() => onChange(ratio)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        {ratio === '16:9' ? <rect x="3" y="7" width="18" height="10" rx="2" /> : <rect x="7" y="3" width="10" height="18" rx="2" />}
      </svg><span>{ratio}</span>
    </button>)}
  </div>;
}
