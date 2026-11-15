'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

export function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4 rounded-xl border px-3.5 py-3 transition',
        checked ? 'border-primary/30 bg-primary/5' : 'border-line bg-surface-2/30 hover:border-field-border-hover',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-ink-muted">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-5 w-9 rounded-full bg-field-border transition peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20" />
        <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export function SectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function RowButtons({ index, count, onMove, onRemove, label }: { index: number; count: number; onMove: (from: number, to: number) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        className="rounded-md p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink disabled:opacity-30"
        aria-label={`Move ${label} ${index + 1} up`}
      >
        <ArrowUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onMove(index, index + 1)}
        disabled={index === count - 1}
        className="rounded-md p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink disabled:opacity-30"
        aria-label={`Move ${label} ${index + 1} down`}
      >
        <ArrowDown className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-1.5 text-ink-subtle hover:bg-danger/10 hover:text-danger"
        aria-label={`Remove ${label} ${index + 1}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface ListEditorProps<T> {
  label: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  createRow: () => T;
  renderRow: (row: T, index: number, update: (row: T) => void) => ReactNode;
  max: number;
  addLabel: string;
  error?: string;
  emptyText: string;
}

/** Ordered list of editable rows with add / remove / move controls. */
export function ListEditor<T>({ label, rows, onChange, createRow, renderRow, max, addLabel, error, emptyText }: ListEditorProps<T>) {
  return (
    <div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-field-border px-3 py-5 text-center text-xs text-ink-subtle">{emptyText}</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, i) => (
            <li key={i} className="flex items-start gap-2 rounded-xl border border-line bg-surface-2/40 p-2.5">
              <span className="mt-2.5 w-5 shrink-0 text-center text-[11px] font-semibold text-ink-subtle">{i + 1}</span>
              <div className="min-w-0 flex-1">{renderRow(row, i, (next) => onChange(rows.map((r, j) => (j === i ? next : r))))}</div>
              <RowButtons
                index={i}
                count={rows.length}
                label={label}
                onMove={(from, to) => onChange(move(rows, from, to))}
                onRemove={() => onChange(rows.filter((_, j) => j !== i))}
              />
            </li>
          ))}
        </ol>
      )}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange([...rows, createRow()])} disabled={rows.length >= max}>
        <Plus className="size-3.5" aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}

export function StringListEditor({
  idPrefix,
  label,
  values,
  onChange,
  placeholder,
  max,
  maxLength,
  errors,
  errorPath,
  addLabel,
  emptyText,
}: {
  idPrefix: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  max: number;
  maxLength: number;
  errors: Record<string, string>;
  errorPath: string;
  addLabel: string;
  emptyText: string;
}) {
  return (
    <ListEditor
      label={label}
      rows={values}
      onChange={onChange}
      createRow={() => ''}
      max={max}
      addLabel={addLabel}
      emptyText={emptyText}
      error={errors[errorPath]}
      renderRow={(value, i, update) => (
        <>
          <Input
            id={`${idPrefix}-${i}`}
            value={value}
            onChange={(e) => update(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength + 50}
            aria-label={`${label} ${i + 1}`}
            aria-invalid={Boolean(errors[`${errorPath}.${i}`])}
          />
          {errors[`${errorPath}.${i}`] ? <p className="mt-1 text-xs text-danger">{errors[`${errorPath}.${i}`]}</p> : null}
        </>
      )}
    />
  );
}
