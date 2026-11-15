'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { ContactEnquiry, SupportStatus } from '@/types/contact';
import { supportStatusLabel } from '../display';
import { useUpdateEnquiryStatus } from '../hooks';

type EnquiryLike = Pick<ContactEnquiry, 'id' | 'referenceNumber' | 'subject' | 'status' | 'name' | 'email'>;

function EnquirySummary({ enquiry }: { enquiry: EnquiryLike }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
      <p className="font-mono text-xs text-ink-subtle">{enquiry.referenceNumber}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-ink">{enquiry.subject}</p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">
        {enquiry.name} · {enquiry.email}
      </p>
    </div>
  );
}

/** Status changes are reversible but alter what the team sees, so they are confirmed. */
export function EnquiryStatusDialog({
  enquiry,
  target,
  onClose,
  onDone,
}: {
  enquiry: EnquiryLike;
  target: SupportStatus;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const update = useUpdateEnquiryStatus();

  function confirm() {
    update.mutate(
      { id: enquiry.id, status: target },
      {
        onSuccess: () => {
          toast.success('Status updated', `Enquiry moved to ${supportStatusLabel(target)}.`);
          onClose();
          onDone?.();
        },
        onError: (e) => toast.error('Could not update status', normalizeApiError(e).message),
      }
    );
  }

  return (
    <ConfirmDialog
      open
      title={`Mark enquiry as ${supportStatusLabel(target)}?`}
      tone={target === 'closed' ? 'danger' : 'primary'}
      confirmLabel={`Set ${supportStatusLabel(target)}`}
      loading={update.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <EnquirySummary enquiry={enquiry} />
          <p>
            Current status: <span className="font-medium text-ink">{supportStatusLabel(enquiry.status)}</span>. The change is
            recorded in the enquiry history and can be reversed at any time.
          </p>
        </div>
      }
    />
  );
}
