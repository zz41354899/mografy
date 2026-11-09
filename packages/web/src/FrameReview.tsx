import { useState } from 'react';
import type { Snapshot } from '@mografy/core';
import { apiPath } from './api.js';
import type { Session } from './session.js';
import { useT } from './i18n.js';

const filesUrl = (projectDir: string, file: string) => apiPath(`files/${file.slice(projectDir.length + 1).split(/[\\/]/).map(encodeURIComponent).join('/')}`);

export function FrameReview({ snapshot, session }: { snapshot: Snapshot; session: Session }) {
  const t = useT();
  const [review, setReview] = useState<{ files: string[] } | null>(null);
  const [reviewing, setReviewing] = useState(false), [reviewMessage, setReviewMessage] = useState('');
  return <div className="inspector-footer">
    <details className="review-tools"><summary>{t.frTitle}</summary><p className="panel-help">{t.frHelp}</p><button className="review-button" disabled={reviewing || !snapshot.scene} onClick={() => { setReviewing(true); setReviewMessage(''); session.review().then(setReview, e => setReviewMessage(String(e.message))).finally(() => setReviewing(false)); }}>{reviewing ? t.frMaking : t.frCreate}</button>
    {review ? <ul className="files">{review.files.map(f => <li key={f}><a href={filesUrl(snapshot.projectDir, f)} target="_blank" rel="noreferrer">{f.split(/[\\/]/).pop()}</a></li>)}</ul> : null}
    {reviewMessage ? <p className="error-text">{reviewMessage}</p> : null}</details>
  </div>;
}

