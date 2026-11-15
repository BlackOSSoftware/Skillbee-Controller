'use client';

import { UserRound, X } from 'lucide-react';
import { useCallback, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useDismiss } from '@/hooks/use-dismiss';
import { normalizeApiError } from '@/lib/api-error';
import { useLearnerSearch } from './lookups';

export interface LearnerOption {
  id: string;
  name: string;
}

/** Learner combobox for list filters; searches students by name or email (needs users:read). */
export function LearnerFilter({ value, onChange }: { value: LearnerOption | null; onChange: (v: LearnerOption | null) => void }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const debounced = useDebouncedValue(text.trim(), 350);
  const results = useLearnerSearch(debounced, open);
  if (value) {
    return (
      <span className="inline-flex h-10 min-w-0 items-center gap-2 rounded-md border border-primary/30 bg-primary/[0.06] pl-3 pr-1.5 text-sm text-ink sm:w-56">
        <UserRound className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{value.name}</span>
        <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-ink-subtle hover:bg-surface-2 hover:text-ink" aria-label="Clear learner filter">
          <X className="size-3.5" />
        </button>
      </span>
    );
  }
  const users = results.data?.users ?? [];
  return (
    <div ref={ref} className="relative sm:w-56">
      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Filter by learner"
        className="pl-9"
        aria-label="Filter by learner"
        aria-expanded={open && debounced.length >= 2}
        role="combobox"
        aria-controls={listId}
      />
      {open && debounced.length >= 2 ? (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-pop">
          {results.isPending ? (
            <li className="px-3 py-2 text-xs text-ink-subtle">Searching…</li>
          ) : results.isError ? (
            <li className="px-3 py-2 text-xs text-danger">{normalizeApiError(results.error).message}</li>
          ) : !users.length ? (
            <li className="px-3 py-2 text-xs text-ink-subtle">No learners found</li>
          ) : (
            users.map((u) => {
              const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
              return (
                <li key={u.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ id: u.id, name });
                      setText('');
                      setOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-surface-2"
                  >
                    <span className="block truncate text-sm text-ink">{name}</span>
                    <span className="block truncate text-xs text-ink-muted">{u.email}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
