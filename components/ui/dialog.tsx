'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Non-scrolling bar between the header and the scrollable body. */
  toolbar?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** 'right' renders a full-height side drawer. */
  placement?: 'center' | 'right';
  /** Blocks Escape/backdrop close while a request is in flight. */
  busy?: boolean;
}

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'h-[96vh] max-w-7xl sm:h-[92vh]' };

/** Open dialogs, innermost last; only the topmost one reacts to Escape / Tab. */
const openStack: string[] = [];

/** Scroll-lock counter: only restore overflow when the last lock is released. */
let scrollLockCount = 0;
let savedOverflow = '';

function acquireScrollLock() {
  if (scrollLockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}

function releaseScrollLock() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedOverflow;
    savedOverflow = '';
  }
}

export function Dialog({ open, onClose, title, description, children, footer, toolbar, size = 'md', placement = 'center', busy = false }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    busyRef.current = busy;
    onCloseRef.current = onClose;
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('input, select, textarea, button:not([data-dialog-close])');
    (first ?? panel)?.focus();

    openStack.push(titleId);

    function onKey(event: KeyboardEvent) {
      if (openStack[openStack.length - 1] !== titleId) return;
      if (event.key === 'Escape' && !busyRef.current) onCloseRef.current();
      if (event.key === 'Tab' && panel) {
        const focusables = [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!focusables.length) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    acquireScrollLock();
    return () => {
      const index = openStack.lastIndexOf(titleId);
      if (index !== -1) openStack.splice(index, 1);
      document.removeEventListener('keydown', onKey);
      releaseScrollLock();
      restoreFocus.current?.focus?.();
    };
  }, [open, titleId]);

  if (!open) return null;

  return (
    <div className={cn('fixed inset-0 z-[60] flex', placement === 'right' ? 'justify-end' : 'items-end justify-center p-0 sm:items-center sm:p-4')}>
      <div className="absolute inset-0 bg-overlay animate-[fade-in_180ms_ease-out]" onClick={() => !busy && onClose()} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col border-line bg-surface shadow-pop focus:outline-none',
          placement === 'right'
            ? 'h-full max-w-lg border-l animate-[drawer-in_260ms_cubic-bezier(0.16,1,0.3,1)]'
            : cn('max-h-[92vh] rounded-t-xl border sm:rounded-xl animate-[dialog-in_220ms_cubic-bezier(0.16,1,0.3,1)]', sizes[size])
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            data-dialog-close
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-ink-subtle hover:bg-surface-2 hover:text-ink disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>
        {toolbar ? <div className="border-b border-line px-4 py-3 sm:px-6">{toolbar}</div> : null}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-4 sm:px-6">{footer}</div> : null}
      </div>
    </div>
  );
}
