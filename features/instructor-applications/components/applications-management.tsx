'use client';

import { Eye, FileText, FileUser, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type {
  ExpertiseLevel,
  InstructorAppStatus,
  InstructorApplication,
  InstructorApplicationListParams,
} from '@/types/instructor-applications';
import { ApplicationStatusBadge, APPLICATION_STATUS_LABEL, APPLICATION_STATUSES, ExpertiseBadge } from '../display';
import { APPLICATION_STATUSES as STAT_KEYS, useApplicationList, useApplicationStats, type ApplicationStatKey } from '../hooks';
import { ApplicationDeleteDialog, ApplicationStatusDialog } from './application-actions';
import { ApplicationDrawer } from './application-drawer';

const PAGE_SIZES = [10, 20, 50];

const EXPERTISE_LEVELS: ExpertiseLevel[] = ['Expert', 'Proficient', 'Competent', 'Beginner'];

const INSTRUCTOR_SUBJECTS = [
  'Computerized System Validation',
  'Laboratory Information Management System',
  'Manufacturing Execution System',
  'Drug Regulatory Affairs',
  'Pharmacovigilance',
  'Clinical Research and Clinical Trial',
  'Medical Writing',
  'Clinical Data Management System',
  'Pharmaceutical Validation (Process, Cleaning, HVAC, Water System etc.)',
  'Pharmaceutical GMP',
  'Pharmaceutical Quality Management System',
  'SAP S4 HANA',
  'QMS',
  'Cleaning Validation',
  'Pharmaceutical Engineering',
  'C, C++, JAVA, Python, other development languages',
  'SQL',
  'Any Other Course',
] as const;

const STAT_CARD: Record<ApplicationStatKey, { label: string; hint: string; icon: typeof FileUser; tone: 'purple' | 'sky' | 'amber' | 'teal' | 'coral' | 'slate' }> = {
  all: { label: 'Total applications', hint: 'Excludes deleted', icon: FileUser, tone: 'purple' },
  pending: { label: 'Pending', hint: 'Awaiting review', icon: FileText, tone: 'sky' },
  reviewing: { label: 'Reviewing', hint: 'Under review', icon: Eye, tone: 'amber' },
  shortlisted: { label: 'Shortlisted', hint: 'Candidates', icon: FileUser, tone: 'slate' },
  approved: { label: 'Approved', hint: 'Accepted', icon: FileText, tone: 'teal' },
  rejected: { label: 'Rejected', hint: 'Declined', icon: Trash2, tone: 'coral' },
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
] as const;

export function ApplicationsManagement() {
  const stats = useApplicationStats();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InstructorAppStatus | ''>('');
  const [expertSubject, setExpertSubject] = useState('');
  const [expertiseLevel, setExpertiseLevel] = useState<ExpertiseLevel | ''>('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewing, setViewing] = useState<InstructorApplication | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ application: InstructorApplication; target: InstructorAppStatus } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InstructorApplication | null>(null);

  const debounced = useDebouncedValue(search.trim(), 350);
  const params: InstructorApplicationListParams = {
    page,
    limit,
    search: debounced || undefined,
    status: status || undefined,
    expertSubject: expertSubject || undefined,
    expertiseLevel: expertiseLevel || undefined,
    sort,
  };
  const list = useApplicationList(params);
  const rows = list.data?.data ?? [];
  const filtered = Boolean(debounced || status || expertSubject || expertiseLevel || sort !== 'newest');

  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  function applyStat(key: ApplicationStatKey) {
    setStatus(key === 'all' ? '' : key);
    setPage(1);
  }

  const statActive = (key: ApplicationStatKey) => (key === 'all' ? !status : status === key);

  function clearAll() {
    setSearch('');
    setStatus('');
    setExpertSubject('');
    setExpertiseLevel('');
    setSort('newest');
    setPage(1);
  }

  const menu = (a: InstructorApplication): MenuItem[] => [
    { key: 'view', label: 'View application', icon: <Eye className="size-4" />, onSelect: () => setViewing(a) },
    ...APPLICATION_STATUSES.filter((s) => s !== a.status).map((s) => ({
      key: `status-${s}`,
      label: `Mark as ${APPLICATION_STATUS_LABEL[s]}…`,
      icon: <FileText className="size-4" />,
      onSelect: () => setStatusDialog({ application: a, target: s }),
    })),
    { key: 'delete', label: 'Delete application…', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => setDeleteTarget(a) },
  ];

  return (
    <>
      <PageHeader
        title="Instructor Applications"
        description="Become-an-instructor submissions — review, shortlist and manage applicants."
        actions={<RefreshButton queryKeys={[queryKeys.instructorApplications.all]} />}
      />

      <section aria-label="Application overview" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {STAT_KEYS.map((key) => {
          const meta = STAT_CARD[key];
          const Icon = meta.icon;
          return (
            <KpiCard
              key={key}
              label={meta.label}
              hint={meta.hint}
              icon={Icon}
              tone={meta.tone}
              value={stats[key].value}
              isLoading={stats[key].isLoading}
              error={stats[key].error}
              active={statActive(key)}
              onClick={() => applyStat(key)}
            />
          );
        })}
      </section>

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{filtered ? 'Filtered applications' : 'All applications'}</h2>
            <p className="text-xs text-ink-muted">Search matches name, email or phone.</p>
          </div>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="flex min-w-0 gap-2 xl:w-72 xl:shrink-0">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <Input type="search" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} placeholder="Search applicants" className="pl-9" aria-label="Search applicants" />
              </div>
              {filtered ? (
                <span className="shrink-0 xl:hidden">
                  <Button variant="ghost" onClick={clearAll}>
                    <X className="size-4" aria-hidden />
                    Clear
                  </Button>
                </span>
              ) : null}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              <Select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as InstructorAppStatus | '')} aria-label="Filter by status">
                <option value="">Any status</option>
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {APPLICATION_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
              <Select value={expertSubject} onChange={(e) => resetPage(setExpertSubject)(e.target.value)} aria-label="Filter by subject">
                <option value="">Any subject</option>
                {INSTRUCTOR_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select value={expertiseLevel} onChange={(e) => resetPage(setExpertiseLevel)(e.target.value as ExpertiseLevel | '')} aria-label="Filter by expertise level">
                <option value="">Any level</option>
                {EXPERTISE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => resetPage(setSort)(e.target.value as 'newest' | 'oldest')} aria-label="Sort applications">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <div className="hidden xl:block" />
            </div>
            {filtered ? (
              <span className="hidden shrink-0 xl:block">
                <Button variant="ghost" onClick={clearAll}>
                  <X className="size-4" aria-hidden />
                  Clear
                </Button>
              </span>
            ) : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isPending && !rows.length ? (
          <EmptyState
            icon={<FileUser className="size-5" aria-hidden />}
            title={filtered ? 'No applications match these filters' : 'No applications yet'}
            description={filtered ? 'Try another search, status, subject or level filter.' : 'Become-an-instructor submissions will appear here.'}
            action={
              filtered ? (
                <Button size="sm" variant="secondary" onClick={clearAll}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Applicant</th>
                    <th scope="col" className="px-3 py-2.5">Phone</th>
                    <th scope="col" className="px-3 py-2.5">Expert subject</th>
                    <th scope="col" className="px-3 py-2.5">Level</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Applied</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3">
                            <Skeleton className="h-3.5 w-36" />
                            <Skeleton className="mt-1.5 h-3 w-44" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-3.5 w-24" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-3.5 w-40" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-20" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-20" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-3.5 w-20" />
                          </td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((a) => (
                        <tr key={a.id} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="py-3.5 pl-5 pr-3">
                            <button type="button" onClick={() => setViewing(a)} className="block text-left">
                              <span className="block font-medium text-ink group-hover:text-primary">{a.fullName}</span>
                              <span className="mt-0.5 block text-xs text-ink-muted">{a.email}</span>
                            </button>
                          </td>
                          <td className="w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted">{a.phone}</td>
                          <td className="w-full min-w-48 max-w-0 px-3 py-3.5">
                            <button type="button" onClick={() => setViewing(a)} className="block w-full text-left">
                              <span className="block truncate text-ink">{a.expertSubject}</span>
                              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-subtle">
                                <FileText className="size-3" aria-hidden />
                                {a.resume.originalFileName}
                              </span>
                            </button>
                          </td>
                          <td className="w-px px-3 py-3.5">
                            <ExpertiseBadge level={a.expertiseLevel} />
                          </td>
                          <td className="w-px px-3 py-3.5">
                            <ApplicationStatusBadge status={a.status} />
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell" title={formatDate(a.createdAt)}>
                            {formatDate(a.createdAt)}
                            <span className="block text-[11px] text-ink-subtle">{formatRelative(a.createdAt)}</span>
                          </td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for ${a.fullName}`} items={menu(a)} />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            <ul className={cn('divide-y divide-line md:hidden', list.isPlaceholderData && 'opacity-60')}>
              {list.isPending
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="space-y-2 p-4">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </li>
                  ))
                : rows.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <FileUser className="size-4" aria-hidden />
                      </span>
                      <button type="button" onClick={() => setViewing(a)} className="min-w-0 flex-1 space-y-1 text-left">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{a.fullName}</span>
                          <ApplicationStatusBadge status={a.status} />
                        </span>
                        <span className="block truncate text-xs text-ink-muted">{a.email} · {a.phone}</span>
                        <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-subtle">
                          <Badge tone="neutral">{a.expertSubject}</Badge>
                          <ExpertiseBadge level={a.expertiseLevel} />
                          <span>{formatDate(a.createdAt)}</span>
                        </span>
                      </button>
                      <ActionMenu label={`Actions for ${a.fullName}`} items={menu(a)} />
                    </li>
                  ))}
            </ul>
          </>
        )}
        <Pagination
          meta={list.data?.pagination}
          onPageChange={setPage}
          disabled={list.isFetching}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
        />
      </Card>

      {viewing ? <ApplicationDrawer key={viewing.id} seed={viewing} onClose={() => setViewing(null)} /> : null}
      {statusDialog ? (
        <ApplicationStatusDialog
          application={statusDialog.application}
          target={statusDialog.target}
          onClose={() => setStatusDialog(null)}
          onDone={() => setViewing(null)}
        />
      ) : null}
      {deleteTarget ? <ApplicationDeleteDialog application={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={() => setViewing(null)} /> : null}
    </>
  );
}
