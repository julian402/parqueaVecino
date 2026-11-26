'use client';

import { useEffect, useState } from 'react';

/** Devuelve `value` solo cuando deja de cambiar durante `delayMs` (evita una consulta por tecla). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
