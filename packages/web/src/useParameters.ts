import { useEffect, useMemo, useRef, useState } from 'react';
import type { ParameterValue, ParameterValues, Snapshot } from '@mografy/core';
import type { Session } from './session.js';
import { useDebounced } from './useDebounced.js';

/** Optimistic parameter values and batched saves are scoped to the displayed project. */
export function useParameters(snapshot: Snapshot | null, session: Session) {
  const dir = snapshot?.projectDir;
  const [local, setLocal] = useState<{ dir: string | undefined; values: ParameterValues }>({ dir, values: {} });
  const [error, setError] = useState('');
  const active = useRef(dir); active.current = dir;
  const pending = useRef<ParameterValues>({});
  useEffect(() => { pending.current = {}; setError(''); }, [dir]);
  const defaults = useMemo(() => Object.fromEntries(Object.entries(snapshot?.scene?.params ?? {}).map(([id, definition]) => [id, definition.default])), [snapshot?.scene?.params]);
  const saved = snapshot?.project?.params;
  const values = useMemo<ParameterValues>(() => {
    const values = { ...defaults, ...saved };
    if (local.dir === dir) for (const [id, value] of Object.entries(local.values)) if (id in defaults) values[id] = value;
    return values;
  }, [defaults, saved, local, dir]);

  useEffect(() => {
    setLocal(local => {
      if (local.dir !== dir) return { dir, values: {} };
      const values = { ...local.values };
      let changed = false;
      for (const id of Object.keys(values)) {
        if (saved?.[id] === values[id] || (!(id in (saved ?? {})) && defaults[id] === values[id]) || !(id in defaults)) {
          delete values[id]; changed = true;
        }
      }
      return changed ? { dir, values } : local;
    });
  }, [dir, saved, defaults]);

  const save = useDebounced((expected: string | undefined) => {
    if (expected !== dir) return;
    const params = pending.current; pending.current = {};
    if (Object.keys(params).length) void session.patchProject({ params }).catch(error => {
      if (active.current === expected) setError(String(error.message));
    });
  }, 200);
  const onChange = (id: string, value: ParameterValue) => {
    setError('');
    setLocal(local => ({ dir, values: { ...(local.dir === dir ? local.values : {}), [id]: value } }));
    pending.current[id] = value; save(dir);
  };
  const onReset = (id: string) => {
    delete pending.current[id]; setError('');
    setLocal(local => ({ dir, values: { ...(local.dir === dir ? local.values : {}), [id]: defaults[id]! } }));
    void session.patchProject({ params: { [id]: null } }).catch(error => { if (active.current === dir) setError(String(error.message)); });
  };
  return { values, error, onChange, onReset };
}
