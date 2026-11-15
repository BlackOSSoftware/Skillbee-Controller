'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { Faq } from '@/types/faqs';
import { useDeleteFaq } from '../hooks';

/** Delete confirmation — backend soft-deletes (deletedAt). */
export function FaqDeleteDialog({
  faq,
  onClose,
  onDone,
}: {
  faq: Pick<Faq, 'id' | 'question' | 'status'>;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const remove = useDeleteFaq();

  function confirm() {
    remove.mutate(faq.id, {
      onSuccess: () => {
        toast.success('FAQ deleted', 'The FAQ was removed from the list.');
        onClose();
        onDone?.();
      },
      onError: (e) => toast.error('Could not delete FAQ', normalizeApiError(e).message),
    });
  }

  return (
    <ConfirmDialog
      open
      title="Delete this FAQ?"
      tone="danger"
      confirmLabel="Delete FAQ"
      loading={remove.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
            <p className="text-sm font-medium text-ink">{faq.question}</p>
          </div>
          <p>
            This is a <span className="font-medium text-ink">soft delete</span>: the FAQ is hidden from admin and public lists
            but retained in the database.
          </p>
        </div>
      }
    />
  );
}
