import type { ReactNode } from 'react';

/** One block of the right panel: a small label (with an optional action on the right) over a card. */
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return <section className="section"><header><h2>{title}</h2>{aside}</header><div className="section-card">{children}</div></section>;
}
