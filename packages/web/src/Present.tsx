// The editor's presentation page (/present): the live project, presented stop by stop; Esc or
// the back button returns to the editor.
// It only reads the project; the editor stays the one place where anything is changed.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Snapshot } from '@mografy/core';
import { useSession } from './session.js';
import { DeckApp } from './deck/deck-app.js';
import type { DeckSource } from './deck/deck-app.js';
import './deck/deck.css';

function sourceOf(snapshot: Snapshot | null): DeckSource | null {
  const scene = snapshot?.scene, project = snapshot?.project;
  if (!scene || !project) return null;
  const defaults = Object.fromEntries(Object.entries(scene.params).map(([id, d]) => [id, d.default]));
  return { version: scene.version, project, values: { ...defaults, ...project.params }, meta: scene.meta };
}

export function PresentRoute() {
  const { snapshot } = useSession();
  const root = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState<DeckApp | null>(null);
  useEffect(() => {
    document.documentElement.classList.add('deck-page');
    document.title = 'Presentation · Mografy';
    const created = new DeckApp(root.current!, { live: true, onBack: () => location.assign('/') });
    setApp(created);
    return () => created.dispose();
  }, []);
  const spec = JSON.stringify(snapshot?.project);
  const shots = JSON.stringify(snapshot?.scene?.meta.shots);
  const source = useMemo(() => sourceOf(snapshot), [snapshot?.scene?.version, spec, snapshot?.scene?.params, shots]);
  useEffect(() => {
    if (!app || !snapshot) return;
    if (source) app.setSource(source); else if (snapshot.error) app.setError('The scene has an error. Fix it in the editor.');
  }, [app, source, snapshot?.error]);
  return <div ref={root} />;
}
