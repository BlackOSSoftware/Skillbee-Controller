'use client';

import { CircleAlert, Hourglass, Inbox, LoaderCircle, Lock, RefreshCw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { Button } from './button';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-muted" role="status">
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center p-8">
      <Spinner label={label} />
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-24' }: { className?: string }) {
  return <span className={cn('block animate-pulse rounded bg-surface-2', className)} aria-hidden />;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink-subtle">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-xs text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}

/** Counts down from Retry-After so the manual retry cannot hammer a rate-limited API. */
function useCooldown(seconds: number | undefined): number {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    if (!seconds) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  if (!seconds) return 0;
  return Math.max(0, Math.ceil(seconds - (now - startedAt) / 1000));
}

function RateLimitState({ seconds, onRetry, compact }: { seconds: number | undefined; onRetry?: () => void; compact: boolean }) {
  const remaining = useCooldown(seconds);
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-warning" title="API rate limit reached">
        <Hourglass className="size-3.5" aria-hidden />
        Rate limited
      </span>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-warning/10 text-warning">
        <Hourglass className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-ink">Too many requests</p>
      <p className="max-w-md text-xs text-ink-muted">
        The API rate limit was reached. {remaining > 0 ? `You can retry in ${remaining}s.` : 'You can retry now.'}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry} disabled={remaining > 0}>
          <RefreshCw className="size-3.5" aria-hidden />
          {remaining > 0 ? `Retry in ${remaining}s` : 'Try again'}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, compact = false }: ErrorStateProps) {
  const { status, message, retryAfterSeconds } = normalizeApiError(error);
  const forbidden = status === 403;
  const notFound = status === 404;
  const Icon = forbidden ? Lock : CircleAlert;
  const title = forbidden
    ? 'You do not have permission to view this'
    : notFound
      ? 'Not found'
      : status !== null && status >= 500
        ? 'The server had a problem'
        : 'Could not load data';

  if (status === 429) return <RateLimitState seconds={retryAfterSeconds} onRetry={onRetry} compact={compact} />;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-danger" title={message}>
        <Icon className="size-3.5" aria-hidden />
        {forbidden ? 'No permission' : 'Failed to load'}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-danger/10 text-danger">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="max-w-md text-xs text-ink-muted">{message}</p>
      {onRetry && !forbidden ? (
        <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
          <RefreshCw className="size-3.5" aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
