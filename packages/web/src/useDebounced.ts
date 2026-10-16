import { useCallback, useEffect, useRef } from 'react';

export function useDebounced<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(fn); latest.current = fn;
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback((...args: T) => { clearTimeout(timer.current); timer.current = setTimeout(() => latest.current(...args), ms); }, [ms]);
}
