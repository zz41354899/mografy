import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';

/** Where the person is in a short flow: steps before `current` are done, `current` is now, the rest come next. */
export function Steps({ items, current }: { items: string[]; current: number }) {
  return <ol className="steps" aria-label={items.join(' → ')}>
    {items.map((label, i) => <li key={label} className={i < current ? 'done' : i === current ? 'now' : ''} aria-current={i === current ? 'step' : undefined}>
      <span>{i < current ? <CheckIcon size={11} weight="bold" /> : i + 1}</span>{label}
    </li>)}
  </ol>;
}
