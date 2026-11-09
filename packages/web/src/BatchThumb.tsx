import { useState } from 'react';
import { apiPath } from './api.js';

const thumbUrl = (dir: string, version?: number | null) => apiPath(`projects/thumb?dir=${encodeURIComponent(dir)}${version ? `&v=${version}` : ''}`);

export function Thumb({ dir, version, className = '' }: { dir: string; version?: number | null | undefined; className?: string }) {
  const [broken, setBroken] = useState(false);
  return <span className={`bx-thumb ${className}`}>{version !== null && !broken
    ? <img src={thumbUrl(dir, version)} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : <i />}</span>;
}
