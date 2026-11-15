'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import type { Enrollment, EnrollmentRecord, EnrollmentStatus } from '@/types/enrollments';
import { useUpdateEnrollmentStatus } from '../hooks';
import { EnrollmentStatusBadge, STATUS_OPTIONS, statusLabel } from '../display';

interface EnrollmentStatusDialogProps {
  enrollment: Enrollment;
  initialStatus?: EnrollmentStatus;
  onClose: () => void;
  /** Replaces `onClose` after a successful update when set. */
  onUpdated?: (record: EnrollmentRecord) => void;
}

function learnerName(e: Enrollment): string {
  return e.student ? [e.student.firstName, e.student.lastName].filter(Boolean).join(' ') || e.student.email : 'Learner';
}

export function EnrollmentStatusDialog({ enrollment, initialStatus, onClose, onUpdated }: EnrollmentStatusDialogProps) {
  const toast = useToast();
  const update = useUpdateEnrollmentStatus();
  const inFlight = useRef(false);
  const options = STATUS_OPTIONS.filter((o) => o.status !== enrollment.status);
  const [status, setStatus] = useState<EnrollmentStatus>(initialStatus && initialStatus !== enrollment.status ? initialStatus : options[0].status);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const selected = STATUS_OPTIONS.find((o) => o.status === status);

  function submit() {
    if (inFlight.current) return;
    if (reason.length > 2000) {
      setError('Reason must be 2000 characters or less.');
      return;
    }
    inFlight.current = true;
    setError(null);
    update.mutate(
      { id: enrollment.id, status, reason: reason.trim() || undefined },
      {
        onSuccess: (record) => {
          toast.success(`Enrollment ${statusLabel(record.status).toLowerCase()}`, `${learnerName(enrollment)} · ${enrollment.course?.title ?? 'course'}`);
          if (onUpdated) onUpdated(record);
          else onClose();
        },
        onError: (e) => {
          const { message } = normalizeApiError(e);
          setError(message);
          toast.error('Status change failed', message);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={update.isPending}
      title="Change enrollment status"
      description={`${learnerName(enrollment)} · ${enrollment.course?.title ?? 'Course'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button variant={selected?.tone === 'danger' ? 'danger-solid' : 'primary'} onClick={submit} loading={update.isPending}>
            Set to {statusLabel(status)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          Current status <EnrollmentStatusBadge status={enrollment.status} />
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink">New status</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {options.map((o) => (
              <label
                key={o.status}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 transition-colors',
                  status === o.status ? 'border-primary bg-primary/5' : 'border-field-border hover:border-field-border-hover'
                )}
              >
                <input type="radio" name="enrollment-status" value={o.status} checked={status === o.status} onChange={() => setStatus(o.status)} className="mt-0.5 accent-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{o.label}</span>
                  <span className="block text-xs text-ink-muted">{o.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="enrollment-status-reason" label="Reason" hint={`Optional · saved to the enrollment history (${reason.length}/2000)`}>
          <Textarea id="enrollment-status-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Payment refunded" aria-describedby="enrollment-status-reason-msg" />
        </Field>
        {error ? (
          <p className="rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
