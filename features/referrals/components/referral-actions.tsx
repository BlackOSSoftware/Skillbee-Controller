'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { Referral, ReferralStatus } from '@/types/referrals';
import { REFERRAL_STATUS_LABEL } from '../display';
import { useDeleteReferral, useUpdateReferralStatus } from '../hooks';

type ReferralLike = Pick<Referral, 'id' | 'referrerName' | 'referrerEmail' | 'friendName' | 'status'>;

function ReferralSummary({ referral }: { referral: ReferralLike }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
      <p className="truncate text-sm font-medium text-ink">
        {referral.referrerName} → {referral.friendName}
      </p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">{referral.referrerEmail}</p>
    </div>
  );
}

const NOTES_MAX = 5000;

/** Status change with optional admin notes (backend statusBody supports both). */
export function ReferralStatusDialog({
  referral,
  target,
  onClose,
  onDone,
}: {
  referral: ReferralLike & { adminNotes?: string };
  target: ReferralStatus;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const update = useUpdateReferralStatus();
  const [notes, setNotes] = useState(referral.adminNotes ?? '');
  const [touched, setTouched] = useState(false);
  const tooLong = notes.trim().length > NOTES_MAX;
  const notesError = touched && tooLong ? `Notes are limited to ${NOTES_MAX.toLocaleString()} characters.` : undefined;

  function confirm() {
    setTouched(true);
    if (tooLong || update.isPending) return;
    update.mutate(
      {
        id: referral.id,
        input: { status: target, adminNotes: notes.trim() ? notes.trim() : undefined },
      },
      {
        onSuccess: () => {
          toast.success('Status updated', `Referral marked as ${REFERRAL_STATUS_LABEL[target]}.`);
          onClose();
          onDone?.();
        },
        onError: (e) => toast.error('Could not update status', normalizeApiError(e).message),
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Mark as ${REFERRAL_STATUS_LABEL[target]}?`}
      description={`${referral.referrerName} referred ${referral.friendName} · currently ${REFERRAL_STATUS_LABEL[referral.status]}`}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={update.isPending || tooLong}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {update.isPending ? 'Saving…' : `Set ${REFERRAL_STATUS_LABEL[target]}`}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <ReferralSummary referral={referral} />
        <Field id="ref-status-notes" label="Admin notes (optional)" error={notesError} hint="Internal only — never shown to referrers or friends.">
          <Textarea
            id="ref-status-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Called the friend, interested in SQL course…"
            aria-invalid={Boolean(notesError)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

/** Soft-delete confirmation — the record is hidden, never permanently removed. */
export function ReferralDeleteDialog({
  referral,
  onClose,
  onDone,
}: {
  referral: ReferralLike;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const remove = useDeleteReferral();

  function confirm() {
    remove.mutate(referral.id, {
      onSuccess: () => {
        toast.success('Referral deleted', 'The referral was soft-deleted and removed from the list.');
        onClose();
        onDone?.();
      },
      onError: (e) => toast.error('Could not delete referral', normalizeApiError(e).message),
    });
  }

  return (
    <ConfirmDialog
      open
      title="Delete this referral?"
      tone="danger"
      confirmLabel="Delete referral"
      loading={remove.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <ReferralSummary referral={referral} />
          <p>
            This is a <span className="font-medium text-ink">soft delete</span>: the referral is hidden from the admin list but
            retained in the database. It cannot be restored from this screen.
          </p>
        </div>
      }
    />
  );
}
