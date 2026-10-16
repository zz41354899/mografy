import { useState } from 'react';
import type { Snapshot } from '@mografy/core';
import type { Session } from './session.js';

const filesUrl = (projectDir: string, file: string) => `/__mografy/files/${file.slice(projectDir.length + 1).split(/[\\/]/).map(encodeURIComponent).join('/')}`;

export function FrameReview({ snapshot, session }: { snapshot: Snapshot; session: Session }) {
  const [review, setReview] = useState<{ files: string[] } | null>(null);
  const [reviewing, setReviewing] = useState(false), [reviewMessage, setReviewMessage] = useState('');
  return <div className="inspector-footer">
    <details className="review-tools"><summary>Frame review</summary><p className="panel-help">Create sheets of key frames to check the animation.</p><button className="review-button" disabled={reviewing || !snapshot.scene} onClick={() => { setReviewing(true); setReviewMessage(''); session.review().then(setReview, e => setReviewMessage(String(e.message))).finally(() => setReviewing(false)); }}>{reviewing ? 'Making sheets…' : 'Create review sheets'}</button>
    {review ? <ul className="files">{review.files.map(f => <li key={f}><a href={filesUrl(snapshot.projectDir, f)} target="_blank" rel="noreferrer">{f.split(/[\\/]/).pop()}</a></li>)}</ul> : null}
    {reviewMessage ? <p className="error-text">{reviewMessage}</p> : null}</details>
  </div>;
}

