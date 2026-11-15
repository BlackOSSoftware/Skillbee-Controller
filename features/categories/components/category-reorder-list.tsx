'use client';

import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { CourseCategory } from '@/types/categories';

function move<T>(items: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface CategoryReorderListProps {
  items: CourseCategory[];
  onChange: (items: CourseCategory[]) => void;
  parentName: (id: string | null) => string | null;
  disabled?: boolean;
}

/** Drag-and-drop on pointer devices; the arrow buttons cover keyboard and touch. */
export function CategoryReorderList({ items, onChange, parentName, disabled }: CategoryReorderListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  function moveTo(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    onChange(move(items, from, to));
    setAnnouncement(`${items[from].name} moved to position ${to + 1} of ${items.length}.`);
  }

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <ol className="divide-y divide-line" aria-label="Category order">
        {items.map((c, i) => {
          const parent = parentName(c.parentCategoryId);
          return (
            <li
              key={c.id}
              draggable={!disabled}
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', c.id);
              }}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overIndex !== i) setOverIndex(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) moveTo(dragIndex, i);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={cn(
                'flex items-center gap-2 bg-surface px-2 py-2.5 transition sm:gap-3 sm:px-4',
                dragIndex === i && 'opacity-40',
                overIndex === i && dragIndex !== null && dragIndex !== i && (dragIndex < i ? 'shadow-[inset_0_-2px_0_var(--color-primary)]' : 'shadow-[inset_0_2px_0_var(--color-primary)]'),
                !disabled && 'cursor-grab active:cursor-grabbing'
              )}
            >
              <GripVertical className="hidden size-4 shrink-0 text-ink-subtle sm:block" aria-hidden />
              <span className="w-6 shrink-0 text-center text-xs font-semibold text-ink-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                <span className="block truncate text-xs text-ink-muted">{parent ? `in ${parent}` : 'Top level'}</span>
              </span>
              {c.status === 'inactive' ? <Badge>Inactive</Badge> : null}
              <span className="flex shrink-0">
                <button
                  type="button"
                  onClick={() => moveTo(i, i - 1)}
                  disabled={disabled || i === 0}
                  className="rounded-md p-2 text-ink-subtle hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                  aria-label={`Move ${c.name} up`}
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveTo(i, i + 1)}
                  disabled={disabled || i === items.length - 1}
                  className="rounded-md p-2 text-ink-subtle hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                  aria-label={`Move ${c.name} down`}
                >
                  <ArrowDown className="size-4" />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
