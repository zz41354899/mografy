import { useEffect, useId, useRef, useState } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';

interface ChoiceOption { value: string; label: string }
/** A styled select with keyboard navigation and a single accessible selection. */
export function Choice({ label, value, options, onChange }: { label: string; value: string; options: ChoiceOption[]; onChange(value: string): void }) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const selected = Math.max(0, options.findIndex(o => o.value === value));
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [open, active, id]);
  const choose = (index: number) => { onChange(options[index]!.value); setOpen(false); trigger.current?.focus(); };
  return <div className="export-choice">
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={id} aria-haspopup="listbox"
      aria-activedescendant={open ? `${id}-${active}` : undefined}
      onClick={() => { setActive(selected); setOpen(v => !v); }}
      onKeyDown={e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); setActive(a => open ? (a + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : selected); }
        else if (open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(active); }
        else if (open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
        else if (open && (e.key === 'Home' || e.key === 'End')) { e.preventDefault(); setActive(e.key === 'Home' ? 0 : options.length - 1); }
        else if (e.key === 'Tab') setOpen(false);
      }}><span>{options[selected]?.label ?? value}</span><CaretDownIcon size={15} /></button>
    {open ? <div id={id} ref={menu} className="choice-menu" role="listbox" aria-label={label}>
      {options.map((o, i) => <div id={`${id}-${i}`} key={o.value} role="option" aria-selected={o.value === value} className={i === active ? 'active' : ''}
        onPointerMove={() => setActive(i)} onClick={() => choose(i)}><span>{o.label}</span>{o.value === value ? <CheckIcon size={14} /> : null}</div>)}
    </div> : null}
  </div>;
}
