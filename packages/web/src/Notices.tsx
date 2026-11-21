// Notices under the top bar: a scene that did not apply, a stopped player, cleared settings.
import { useState } from 'react';
import { useT } from './i18n.js';
import type { Snapshot } from '@mografy/core';

export function Notices({ snapshot, stopped }: { snapshot: Snapshot | null; stopped: string }) {
  const t = useT();
  const [dismissedIssues, setDismissedIssues] = useState('');
  const issuesKey = JSON.stringify([snapshot?.projectDir, snapshot?.scene?.version, snapshot?.issues]);
  return <>
    {snapshot?.error ? <div className="notice error" role="alert">
      <p><strong>{t.apNotApplied}</strong> {snapshot.scene ? t.apStillPrevious : t.apNoVersion} {t.apFixBelow}</p>
      <pre>{snapshot.error.message}</pre>
    </div> : null}
    {stopped ? <div className="notice error" role="alert"><p><strong>{t.apStopped}</strong></p><pre>{stopped}</pre></div> : null}
    {snapshot?.issues.length && dismissedIssues !== issuesKey ? <div className="notice warn settings-notice" role="status"><p><strong>{t.apSettingsUpdated}</strong> {t.apCleared} {snapshot.issues.map(i => <span key={i.id} className="issue">{i.id} ({t.apIssue[i.reason] ?? i.reason})</span>)}</p><button className="text-button" onClick={() => setDismissedIssues(issuesKey)} aria-label={t.apDismissSettings}>{t.apDismiss}</button></div> : null}
  </>;
}
