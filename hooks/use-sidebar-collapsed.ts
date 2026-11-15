'use client';

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'skillbee-admin-sidebar-collapsed';

function readStored(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Desktop sidebar collapse state, persisted in localStorage.
 * Collapsed = icons only (w-16), expanded = icons + labels (w-64).
 * Uses lazy initializer to avoid SSR mismatch and setState-in-effect.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(readStored);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
