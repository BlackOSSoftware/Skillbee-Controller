'use client';

import { Bell, Eye, Plus, Send } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatNumber } from '@/lib/format';
import { formatDateTime } from '@/features/assignments/display';
import { cn } from '@/lib/cn';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/providers/toast-provider';
import { coursesService } from '@/services/courses.service';
import { usersService } from '@/services/users.service';
import type { Course } from '@/types/courses';
import type { AdminUser } from '@/types/users';
import type {
  AdminNotificationListParams,
  CreateAdminNotificationInput,
  NotificationCampaign,
  NotificationDeliveryChannel,
  NotificationRecipientType,
} from '@/types/notifications';
import {
  useCreateAdminNotification,
  useNotificationCampaign,
  useNotificationCampaigns,
} from '../hooks';

const PAGE_SIZES = [10, 20, 50];

const TYPE_OPTIONS = [
  'custom',
  'course_announcement',
  'account_created',
  'course_enrollment',
  'payment_successful',
  'payment_failed',
  'assignment_submitted',
  'assignment_evaluated',
  'quiz_result',
  'certificate_generated',
  'password_reset',
  'qa_reply',
  'instructor_application',
  'referral_submitted',
  'blog_published',
  'newsletter_subscription',
] as const;

const RECIPIENT_LABELS: Record<NotificationRecipientType, string> = {
  all_students: 'All students',
  selected_students: 'Selected students',
  selected_course_students: 'Students enrolled in a course',
  selected_users: 'Selected users',
};

const DELIVERY_LABELS: Record<NotificationDeliveryChannel, string> = {
  in_app: 'In-app only',
  push: 'Push only',
  both: 'In-app + push',
};

function typeTone(type: string): 'info' | 'success' | 'warning' | 'neutral' {
  if (type === 'course_announcement') return 'info';
  if (type === 'custom') return 'warning';
  if (type.includes('payment') || type.includes('certificate')) return 'success';
  return 'neutral';
}

function deliveryTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'sent': return 'success';
    case 'partial': return 'warning';
    case 'failed': return 'danger';
    case 'skipped': return 'neutral';
    default: return 'neutral';
  }
}

export function NotificationsWorkspace() {
  const [type, setType] = useState('');
  const [readFilter, setReadFilter] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [campaignDetail, setCampaignDetail] = useState<NotificationCampaign | null>(null);

  const params: AdminNotificationListParams = {
    page,
    limit,
    type: type || undefined,
    isRead: readFilter === '' ? undefined : readFilter === 'true',
  };
  const campaigns = useNotificationCampaigns(params);
  const rows = campaigns.data?.data ?? [];
  const filtered = Boolean(type || readFilter);

  function clearFilters() {
    setType('');
    setReadFilter('');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Review notification campaigns and send announcements to students."
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New notification
            </Button>
            <RefreshButton queryKeys={[queryKeys.notifications.admin.lists()]} />
          </div>
        }
      />

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{filtered ? 'Filtered campaigns' : 'All campaigns'}</h2>
            <p className="text-xs text-ink-muted">
              Each row is one notification campaign. Click to view recipient-level delivery details.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Filter by type" className="sm:w-56">
              <option value="">All types</option>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </Select>
            <Select value={readFilter} onChange={(e) => { setReadFilter(e.target.value as typeof readFilter); setPage(1); }} aria-label="Filter by read status" className="sm:w-40">
              <option value="">Any read status</option>
              <option value="false">Unread</option>
              <option value="true">Read</option>
            </Select>
            {filtered ? (
              <Button variant="ghost" onClick={clearFilters} className="shrink-0">Clear filters</Button>
            ) : null}
          </div>
        </div>

        {campaigns.isError ? (
          <ErrorState error={campaigns.error} onRetry={() => campaigns.refetch()} />
        ) : !campaigns.isPending && !rows.length ? (
          <EmptyState
            icon={<Bell className="size-5" aria-hidden />}
            title={filtered ? 'No campaigns match these filters' : 'No notification campaigns yet'}
            description={filtered ? 'Try another filter.' : 'Send your first announcement to students.'}
            action={filtered ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button> : <Button size="sm" onClick={() => setCreateOpen(true)}>New notification</Button>}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Title</th>
                    <th scope="col" className="px-3 py-2.5">Type</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Recipients</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Sent</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Failed</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Skipped</th>
                    <th scope="col" className="px-3 py-2.5">Created</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', campaigns.isPlaceholderData && 'opacity-60')}>
                  {campaigns.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3"><Skeleton className="h-3.5 w-56" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-5 w-24" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-3.5 w-12" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-3.5 w-12" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-3.5 w-12" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-3.5 w-12" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-3.5 w-28" /></td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((c) => (
                        <tr key={c.campaignId} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="max-w-72 py-3.5 pl-5 pr-3">
                            <span className="block truncate font-medium text-ink">{c.title}</span>
                            <span className="block truncate text-xs text-ink-muted">{c.message}</span>
                          </td>
                          <td className="w-px px-3 py-3.5"><Badge tone={typeTone(c.type)}>{c.type.replace(/_/g, ' ')}</Badge></td>
                          <td className="w-px px-3 py-3.5 text-right text-xs font-medium text-ink">{formatNumber(c.recipientCount)}</td>
                          <td className="w-px px-3 py-3.5 text-right text-xs text-ink-muted">{formatNumber(c.delivery.sent)}</td>
                          <td className="w-px px-3 py-3.5 text-right text-xs text-ink-muted">{formatNumber(c.delivery.failed)}</td>
                          <td className="w-px px-3 py-3.5 text-right text-xs text-ink-muted">{formatNumber(c.delivery.skipped)}</td>
                          <td className="w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted" title={formatDateTime(c.createdAt)}>
                            {formatDateTime(c.createdAt)}
                          </td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <button type="button" onClick={() => setCampaignDetail(c)} aria-label={`View campaign ${c.title}`} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
                              <Eye className="size-4" aria-hidden />
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            <ul className={cn('divide-y divide-line md:hidden', campaigns.isPlaceholderData && 'opacity-60')}>
              {campaigns.isPending
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="space-y-2 p-4">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </li>
                  ))
                : rows.map((c) => (
                    <li key={c.campaignId} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={typeTone(c.type)}>{c.type.replace(/_/g, ' ')}</Badge>
                        <Badge tone={deliveryTone(c.delivery.failed > 0 ? 'failed' : c.delivery.sent > 0 ? 'sent' : 'skipped')}>
                          {c.delivery.sent} sent
                        </Badge>
                      </div>
                      <p className="font-medium text-ink">{c.title}</p>
                      <p className="line-clamp-2 text-xs text-ink-muted">{c.message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-ink-subtle">
                          {formatNumber(c.recipientCount)} recipients · {formatDateTime(c.createdAt)}
                        </span>
                        <Button size="sm" variant="secondary" onClick={() => setCampaignDetail(c)}>
                          <Eye className="size-3.5" aria-hidden /> View
                        </Button>
                      </div>
                    </li>
                  ))}
            </ul>
          </>
        )}
        <Pagination
          meta={campaigns.data?.pagination}
          onPageChange={setPage}
          disabled={campaigns.isFetching}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={(size) => { setLimit(size); setPage(1); }}
        />
      </Card>

      {createOpen ? <CreateNotificationDialog onClose={() => setCreateOpen(false)} /> : null}
      {campaignDetail ? <CampaignDetailDrawer campaign={campaignDetail} onClose={() => setCampaignDetail(null)} /> : null}
    </>
  );
}

// ---------------- Campaign detail drawer ----------------

function CampaignDetailDrawer({ campaign, onClose }: { campaign: NotificationCampaign; onClose: () => void }) {
  const detail = useNotificationCampaign(campaign.campaignId);
  const data = detail.data;

  return (
    <Dialog
      open
      onClose={onClose}
      placement="right"
      size="lg"
      title={campaign.title}
      description={`Campaign sent ${formatDateTime(campaign.createdAt)}`}
    >
      {detail.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : data ? (
        <div className="space-y-5">
          {/* Summary */}
          <section aria-label="Campaign summary">
            <p className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2/40 p-3.5 text-sm text-ink">{data.message}</p>
          </section>

          <section aria-label="Delivery stats">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Recipients" value={formatNumber(data.recipientCount)} />
              <StatBox label="Sent" value={formatNumber(data.delivery.sent)} tone="success" />
              <StatBox label="Failed" value={formatNumber(data.delivery.failed)} tone="danger" />
              <StatBox label="Skipped" value={formatNumber(data.delivery.skipped)} tone="neutral" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Partial" value={formatNumber(data.delivery.partial)} tone="warning" />
              <StatBox label="Pending" value={formatNumber(data.delivery.pending)} tone="neutral" />
              <StatBox label="Read" value={formatNumber(data.readCount)} tone="info" />
              <StatBox label="Type" value={data.type.replace(/_/g, ' ')} tone="neutral" />
            </div>
          </section>

          {/* Recipients */}
          <section aria-label="Recipients">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              Recipients ({formatNumber(data.recipients.length)})
            </h3>
            <div className="max-h-96 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2 pl-3 pr-2">Recipient</th>
                    <th scope="col" className="px-2 py-2">Status</th>
                    <th scope="col" className="px-2 py-2">Read</th>
                    <th scope="col" className="px-2 py-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.recipients.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="py-2 pl-3 pr-2">
                        <span className="block font-mono text-xs text-ink">{r.recipientId?.slice(-12) ?? '—'}</span>
                        <span className="block text-[11px] text-ink-subtle">{r.recipientRole ?? 'student'}</span>
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone={deliveryTone(r.deliveryStatus)}>{r.deliveryStatus ?? 'pending'}</Badge>
                      </td>
                      <td className="px-2 py-2 text-xs text-ink-muted">
                        {r.isRead ? `Yes${r.readAt ? ` · ${formatDateTime(r.readAt)}` : ''}` : 'No'}
                      </td>
                      <td className="px-2 py-2 text-xs text-ink-muted">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </Dialog>
  );
}

function StatBox({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }) {
  const tones = {
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-rose-600 dark:text-rose-400',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
    neutral: 'text-ink',
  };
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className={cn('mt-1 text-lg font-bold tabular-nums', tones[tone])}>{value}</p>
    </div>
  );
}

// ---------------- Create ----------------

interface CreateFormState {
  title: string;
  message: string;
  recipientType: NotificationRecipientType;
  deliveryChannel: NotificationDeliveryChannel;
  type: 'custom' | 'course_announcement';
  category: string;
  courseId: string;
  recipientIds: string[];
}

const EMPTY_FORM: CreateFormState = {
  title: '',
  message: '',
  recipientType: 'all_students',
  deliveryChannel: 'both',
  type: 'custom',
  category: '',
  courseId: '',
  recipientIds: [],
};

function CreateNotificationDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const create = useCreateAdminNotification();
  const [v, setV] = useState<CreateFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [confirming, setConfirming] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const debouncedUserSearch = useDebouncedValue(userSearch.trim(), 300);

  const needsCourse = v.recipientType === 'selected_course_students';
  const needsUsers = v.recipientType === 'selected_students' || v.recipientType === 'selected_users';

  const usersQuery = useQuery({
    queryKey: ['notification-recipient-users', debouncedUserSearch],
    queryFn: () => usersService.list({ page: 1, limit: 8, search: debouncedUserSearch || undefined }),
    enabled: confirming || needsUsers,
    staleTime: 30 * 1000,
  });

  function set<K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!v.title.trim()) next.title = 'Title is required.';
    else if (v.title.length > 200) next.title = 'Max 200 characters.';
    if (!v.message.trim()) next.message = 'Message is required.';
    else if (v.message.length > 2000) next.message = 'Max 2,000 characters.';
    if (needsCourse && !v.courseId) next.courseId = 'Select a course.';
    if (needsUsers && !v.recipientIds.length) next.recipientIds = 'Select at least one recipient.';
    if (v.category.length > 80) next.category = 'Max 80 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || create.isPending) return;
    setConfirming(true);
  }

  function confirm() {
    if (create.isPending) return;
    const input: CreateAdminNotificationInput = {
      title: v.title.trim(),
      message: v.message.trim(),
      recipientType: v.recipientType,
      deliveryChannel: v.deliveryChannel,
      type: needsCourse || v.type === 'course_announcement' ? 'course_announcement' : 'custom',
      category: v.category.trim() || undefined,
      ...(needsCourse ? { courseId: v.courseId } : {}),
      ...(needsUsers ? { recipientIds: v.recipientIds } : {}),
    };
    create.mutate(input, {
      onSuccess: (result) => {
        toast.success(
          'Notification sent',
          `${result.created} delivered, ${result.duplicates} duplicate(s) skipped across ${result.recipientCount} recipient(s).`
        );
        setConfirming(false);
        onClose();
      },
      onError: (err) => {
        setConfirming(false);
        toast.error('Could not send notification', normalizeApiError(err).message);
      },
    });
  }

  const audienceSummary = useMemo(() => {
    if (v.recipientType === 'all_students') return 'All active students';
    if (v.recipientType === 'selected_course_students') return v.courseId ? `Enrolled students of selected course` : 'Enrolled students of a course';
    if (needsUsers) return `${v.recipientIds.length} selected ${v.recipientType === 'selected_students' ? 'student(s)' : 'user(s)'}`;
    return RECIPIENT_LABELS[v.recipientType];
  }, [v.recipientType, v.courseId, v.recipientIds.length, needsUsers]);

  return (
    <>
      <Dialog
        open
        onClose={() => !create.isPending && onClose()}
        title="New notification"
        description="Creates one in-app/push notification per resolved recipient."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={create.isPending} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" form="notification-form" disabled={create.isPending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {create.isPending ? 'Sending…' : 'Review & send'}
            </button>
          </div>
        }
      >
        <form id="notification-form" onSubmit={submit} className="space-y-4" noValidate>
          <Field id="ntf-title" label="Title" error={errors.title} hint={`${v.title.length}/200`}>
            <Input id="ntf-title" value={v.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />
          </Field>
          <Field id="ntf-message" label="Message" error={errors.message} hint={`${v.message.length}/2,000`}>
            <Textarea id="ntf-message" rows={4} value={v.message} onChange={(e) => set('message', e.target.value)} maxLength={2000} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="ntf-recipient" label="Audience" error={errors.recipientIds}>
              <Select id="ntf-recipient" value={v.recipientType} onChange={(e) => set('recipientType', e.target.value as NotificationRecipientType)}>
                {(Object.keys(RECIPIENT_LABELS) as NotificationRecipientType[]).map((r) => (
                  <option key={r} value={r}>{RECIPIENT_LABELS[r]}</option>
                ))}
              </Select>
            </Field>
            <Field id="ntf-channel" label="Delivery channel">
              <Select id="ntf-channel" value={v.deliveryChannel} onChange={(e) => set('deliveryChannel', e.target.value as NotificationDeliveryChannel)}>
                {(Object.keys(DELIVERY_LABELS) as NotificationDeliveryChannel[]).map((c) => (
                  <option key={c} value={c}>{DELIVERY_LABELS[c]}</option>
                ))}
              </Select>
            </Field>
          </div>

          {needsCourse ? (
            <CourseSelectField value={v.courseId} onChange={(id) => set('courseId', id)} error={errors.courseId} />
          ) : null}

          {needsUsers ? (
            <UserMultiSelect
              selected={v.recipientIds}
              onChange={(ids) => set('recipientIds', ids)}
              search={userSearch}
              onSearch={setUserSearch}
              users={usersQuery.data?.users ?? []}
              loading={usersQuery.isFetching}
              error={usersQuery.isError ? normalizeApiError(usersQuery.error).message : undefined}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="ntf-type" label="Notification type">
              <Select id="ntf-type" value={v.type} onChange={(e) => set('type', e.target.value as CreateFormState['type'])}>
                <option value="custom">Custom announcement</option>
                <option value="course_announcement">Course announcement</option>
              </Select>
            </Field>
            <Field id="ntf-category" label="Category" error={errors.category} hint="Optional grouping label, e.g. announcement">
              <Input id="ntf-category" value={v.category} onChange={(e) => set('category', e.target.value)} maxLength={80} placeholder="announcement" />
            </Field>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={confirming}
        onClose={() => !create.isPending && setConfirming(false)}
        title="Send this notification?"
        description="This cannot be undone once delivered."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={create.isPending} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60">
              Go back
            </button>
            <button type="button" onClick={confirm} disabled={create.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              <Send className="size-3.5" aria-hidden />
              {create.isPending ? 'Sending…' : 'Send now'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-line bg-surface-2/50 p-3">
            <p className="font-medium text-ink">{v.title}</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-ink-muted">{v.message}</p>
          </div>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-1.5 text-xs">
            <dt className="text-ink-subtle">Audience</dt>
            <dd className="text-ink">{audienceSummary}</dd>
            <dt className="text-ink-subtle">Channel</dt>
            <dd className="text-ink">{DELIVERY_LABELS[v.deliveryChannel]}</dd>
            <dt className="text-ink-subtle">Type</dt>
            <dd className="text-ink">{v.type === 'course_announcement' || needsCourse ? 'course_announcement' : 'custom'}</dd>
          </dl>
          <p className="text-xs text-ink-muted">
            The backend resolves recipients and reports how many notifications were created. Push delivery depends on each
            recipient&apos;s registered devices — check delivery status in the history afterwards.
          </p>
        </div>
      </Dialog>
    </>
  );
}

// ---------------- Course picker ----------------

function CourseSelectField({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['notification-course-picker', debounced],
    queryFn: () => coursesService.list({ page: 1, limit: 8, search: debounced || undefined, sortBy: 'title', sortOrder: 'asc' }),
    enabled: open,
    staleTime: 30 * 1000,
  });
  const rows = query.data?.data ?? [];
  const selected = rows.find((c) => c.id === value);

  return (
    <Field id="ntf-course" label="Course" error={error} hint="Only students actively enrolled in this course are notified.">
      <div className="relative">
        <Input
          value={open ? search : selected ? selected.title : ''}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search courses…"
          aria-label="Search courses"
        />
        {open ? (
          <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-pop">
            {query.isPending ? (
              <li className="p-3"><Skeleton className="h-4 w-full" /></li>
            ) : query.isError ? (
              <li className="p-3 text-xs text-danger">{normalizeApiError(query.error).message}</li>
            ) : !rows.length ? (
              <li className="p-3 text-xs text-ink-muted">No courses match.</li>
            ) : (
              rows.map((c: Course) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(c.id); setOpen(false); setSearch(''); }}
                    className={cn('flex w-full flex-col px-3 py-2 text-left hover:bg-surface-2', c.id === value && 'bg-primary/5')}
                  >
                    <span className="truncate text-sm font-medium text-ink">{c.title}</span>
                    <span className="text-[11px] text-ink-subtle">/{c.slug} · {c.status}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {value && !open ? (
        <button type="button" onClick={() => onChange('')} className="mt-1 text-xs text-ink-muted hover:text-danger">
          Clear selection
        </button>
      ) : null}
    </Field>
  );
}

// ---------------- User multi-select ----------------

function UserMultiSelect({
  selected,
  onChange,
  search,
  onSearch,
  users,
  loading,
  error,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  search: string;
  onSearch: (v: string) => void;
  users: AdminUser[];
  loading: boolean;
  error?: string;
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const nameOf = (u: AdminUser) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <Field id="ntf-users" label={`Recipients (${selected.length} selected)`} hint="Search and pick users — up to 5,000 per send.">
      <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search by name or email…" aria-label="Search users" />
      <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <li key={i} className="p-2.5"><Skeleton className="h-4 w-full" /></li>)
        ) : error ? (
          <li className="p-3 text-xs text-danger">{error}</li>
        ) : !users.length ? (
          <li className="p-3 text-xs text-ink-muted">No users match.</li>
        ) : (
          users.map((u) => (
            <li key={u.id}>
              <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-surface-2">
                <input type="checkbox" checked={selectedSet.has(u.id)} onChange={() => toggle(u.id)} className="size-4 rounded border-line text-primary focus:ring-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{nameOf(u)}</span>
                  <span className="block truncate text-[11px] text-ink-subtle">{u.email}</span>
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
    </Field>
  );
}
