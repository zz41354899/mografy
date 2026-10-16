import { useEffect, useState } from 'react';
import type { RenderStatus } from '@mografy/core';
import type { Session } from './session.js';

export function useExportCancellation(job: RenderStatus, session: Session) {
  const [cancelling, setCancelling] = useState(false), [error, setError] = useState('');
  useEffect(() => { setError(''); setCancelling(false); }, [job.id, job.state]);
  const cancel = async () => {
    setCancelling(true); setError('');
    try { await session.cancelRender(job.id); }
    catch (error) { setCancelling(false); setError(error instanceof Error ? error.message : String(error)); }
  };
  return { stopped: !!job.cancelling || cancelling, error, cancel };
}
