'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { InstructorAppStatus, InstructorApplication } from '@/types/instructor-applications';
import { APPLICATION_STATUS_LABEL } from '../display';
import { useDeleteApplication, useUpdateApplicationStatus } from '../hooks';

type ApplicationLike = Pick<InstructorApplication, 'id' | 'fullName' | 'email' | 'status'>;

function ApplicationSummary({ application }: { application: ApplicationLike }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
      <p className="truncate text-sm font-medium text-ink">{application.fullName}</p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">{application.email}</p>
    </div>
  );
}

const NOTES_MAX = 5000;

/** Status change with optional admin notes (backend statusBody supports both). */
export function ApplicationStatusDialog({
  application,
  target,
  onClose,
  onDone,
}: {
  application: ApplicationLike & { adminNotes?: string };
  target: InstructorAppStatus;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const update = useUpdateApplicationStatus();
  const [notes, setNotes] = useState(application.adminNotes ?? '');
  const [touched, setTouched] = useState(false);
  const tooLong = notes.trim().length > NOTES_MAX;
  const notesError = touched && tooLong ? `Notes are limited to ${NOTES_MAX.toLocaleString()} characters.` : undefined;

  function confirm() {
    setTouched(true);
    if (tooLong || update.isPending) return;
    update.mutate(
      {
        id: application.id,
        input: { status: target, adminNotes: notes.trim() ? notes.trim() : undefined },
      },
      {
        onSuccess: () => {
          toast.success('Status updated', `Application moved to ${APPLICATION_STATUS_LABEL[target]}.`);
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
      title={`Mark as ${APPLICATION_STATUS_LABEL[target]}?`}
      description={`${application.fullName} · currently ${APPLICATION_STATUS_LABEL[application.status]}`}
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
            {update.isPending ? 'Saving…' : `Set ${APPLICATION_STATUS_LABEL[target]}`}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <ApplicationSummary application={application} />
        <Field id="app-status-notes" label="Admin notes (optional)" error={notesError} hint="Saved with the application for the review team.">
          <Textarea
            id="app-status-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Strong industry background, schedule interview…"
            aria-invalid={Boolean(notesError)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

/** Soft-delete confirmation — the record is hidden, never permanently removed. */
export function ApplicationDeleteDialog({
  application,
  onClose,
  onDone,
}: {
  application: ApplicationLike;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const remove = useDeleteApplication();

  function confirm() {
    remove.mutate(application.id, {
      onSuccess: () => {
        toast.success('Application deleted', 'The application was soft-deleted and removed from the list.');
        onClose();
        onDone?.();
      },
      onError: (e) => toast.error('Could not delete application', normalizeApiError(e).message),
    });
  }

  return (
    <ConfirmDialog
      open
      title="Delete this application?"
      tone="danger"
      confirmLabel="Delete application"
      loading={remove.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <ApplicationSummary application={application} />
          <p>
            This is a <span className="font-medium text-ink">soft delete</span>: the application and its resume are hidden from
            the admin list but retained in the database. It cannot be restored from this screen.
          </p>
        </div>
      }
    />
  );
}

