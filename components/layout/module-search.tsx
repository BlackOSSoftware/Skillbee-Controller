'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useAccessibleModules } from '@/hooks/use-module-access';
import { useDismiss } from '@/hooks/use-dismiss';
import { cn } from '@/lib/cn';

/** Searches the modules the current user can open. There is no global content search API. */
export function ModuleSearch() {
  const router = useRouter();
  const modules = useAccessibleModules();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modules.slice(0, 8);
    return modules
      .filter((m) => `${m.label} ${m.description} ${m.group}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [modules, query]);

  function go(href: string) {
    setOpen(false);
    setQuery('');
    router.push(href);
  }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && results[highlight]) {
            e.preventDefault();
            go(results[highlight].href);
          }
        }}
        placeholder="Search modules…"
        aria-label="Search modules"
        className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {open ? (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
          {results.length ? (
            <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
              {results.map((m, index) => {
                const Icon = m.icon;
                return (
                  <li key={m.slug}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => go(m.href)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-sm',
                        index === highlight ? 'bg-surface-2' : undefined
                      )}
                    >
                      <Icon className="size-4 text-ink-subtle" aria-hidden />
                      <span className="flex-1">
                        <span className="block font-medium text-ink">{m.label}</span>
                        <span className="block text-xs text-ink-muted">{m.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-4 text-center text-xs text-ink-muted">No modules match “{query}”.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
