import type { ReactNode } from 'react';

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return <section className="section"><header><h2>{title}</h2>{aside}</header>{children}</section>;
}

