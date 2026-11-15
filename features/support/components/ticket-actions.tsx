'use client';

import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import { useUsersList } from '@/features/users/hooks';
import type { SupportStatus, SupportTicket } from '@/types/contact';
import { supportStatusLabel } from '@/features/contact/display';
import { useAssignTicket, useUpdateTicketStatus } from '../hooks';

type TicketLike = Pick<SupportTicket, 'id' | 'ticketNumber' | 'subject' | 'status' | 'student'>;

function TicketSummary({ ticket }: { ticket: TicketLike }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
      <p className="font-mono text-xs text-ink-subtle">{ticket.ticketNumber}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-ink">{ticket.subject}</p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">{ticket.student?.email ?? 'Unknown student'}</p>
    </div>
  );
}

export function TicketStatusDialog({
  ticket,
  target,
  onClose,
  onDone,
}: {
  ticket: TicketLike;
  target: SupportStatus;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const update = useUpdateTicketStatus();

  function confirm() {
    update.mutate(
      { id: ticket.id, status: target },
      {
        onSuccess: () => {
          toast.success('Status updated', `Ticket moved to ${supportStatusLabel(target)}. The student was notified by email.`);
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
      title={`Mark ticket as ${supportStatusLabel(target)}?`}
      tone={target === 'closed' ? 'danger' : 'primary'}
      confirmLabel={`Set ${supportStatusLabel(target)}`}
      loading={update.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <TicketSummary ticket={ticket} />
          <p>
            Current status: <span className="font-medium text-ink">{supportStatusLabel(ticket.status)}</span>. The student is
            notified by email and the change is recorded in the ticket history.
          </p>
        </div>
      }
    />
  );
}

/** Staff picklist: only users whose role grants `enquiries.manage` can own tickets. */
function useStaffOptions() {
  const admin = useUsersList({ page: 1, limit: 100, role: 'admin' });
  const superAdmin = useUsersList({ page: 1, limit: 100, role: 'super_admin' });
  const instructor = useUsersList({ page: 1, limit: 100, role: 'instructor' });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const list of [admin.data?.users, superAdmin.data?.users, instructor.data?.users]) {
      for (const u of list ?? []) {
        if (u.status !== 'active') continue;
        const slug = u.role?.slug;
        const perms = u.role?.permissions ?? [];
        const canManage = slug === 'super_admin' || perms.includes('enquiries.manage');
        if (!canManage) continue;
        map.set(u.id, `${u.firstName} ${u.lastName}`.trim() || u.email);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [admin.data, superAdmin.data, instructor.data]);
}

export function TicketAssignDialog({
  ticket,
  onClose,
  onDone,
}: {
  ticket: TicketLike & { assignedTo?: string | null; assignee?: { id: string; firstName: string; lastName: string; email: string } | null };
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const assign = useAssignTicket();
  const staff = useStaffOptions();
  const [selected, setSelected] = useState<string>(ticket.assignedTo ?? '');

  function save() {
    assign.mutate(
      { id: ticket.id, assignedTo: selected || null },
      {
        onSuccess: () => {
          toast.success('Assignment updated');
          onClose();
          onDone?.();
        },
        onError: (e) => toast.error('Could not assign ticket', normalizeApiError(e).message),
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Assign ticket"
      description={`${ticket.ticketNumber} · ${ticket.subject}`}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={assign.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {assign.isPending ? 'Saving…' : 'Save assignment'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <TicketSummary ticket={ticket} />
        <Field id="ticket-assignee" label="Assignee" hint="Only active admins, super admins and instructors are listed.">
          <Select id="ticket-assignee" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
