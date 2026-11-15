import { formatNumber } from '@/lib/format';
import type { Pagination as PaginationMeta } from '@/types/api';
import { Button } from './button';

interface PaginationProps {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({ meta, onPageChange, disabled, pageSizeOptions, onPageSizeChange }: PaginationProps) {
  if (!meta || meta.total === 0) return null;
  const totalPages = Math.max(1, meta.totalPages);
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3 sm:flex-row">
      <div className="flex items-center gap-3">
        <p className="text-xs text-ink-muted">
          Showing <span className="font-medium text-ink">{formatNumber(from)}</span>–
          <span className="font-medium text-ink">{formatNumber(to)}</span> of{' '}
          <span className="font-medium text-ink">{formatNumber(meta.total)}</span>
        </p>
        {pageSizeOptions && onPageSizeChange ? (
          <select
            value={meta.limit}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="Rows per page"
            disabled={disabled}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={disabled || meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>
          Previous
        </Button>
        <span className="text-xs text-ink-muted">
          Page {meta.page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || meta.page >= totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
