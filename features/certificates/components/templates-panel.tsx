'use client';

import { CircleCheck, Copy, Eye, FileBadge2, PauseCircle, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import { FIELD_TOGGLES, TEMPLATE_STATUSES, type CertificateTemplate, type MediaRef, type TemplateListParams, type TemplateStatus } from '@/types/certificates';
import { formatDateTime } from '@/features/assignments/display';
import { DefaultBadge, FIELD_TOGGLE_LABEL, layoutOf, templateStatusLabel, TemplateStatusBadge, toggleOn } from '../display';
import { useDeleteTemplate, useDuplicateTemplate, useSetDefaultTemplate, useTemplate, useTemplateList, useTemplateStatus } from '../hooks';
import { CertificatePreview, SAMPLE_VALUES } from './certificate-preview';
import { TemplateFormDialog } from './template-form-dialog';
import { isImageSet } from './template-image-field';

const PAGE_SIZES = [10, 20, 50];

type Confirm = { kind: 'status'; template: CertificateTemplate; status: TemplateStatus } | { kind: 'default'; template: CertificateTemplate } | { kind: 'delete'; template: CertificateTemplate } | null;
type Modal = { kind: 'view'; template: CertificateTemplate } | { kind: 'edit'; template: CertificateTemplate } | { kind: 'create' } | null;

function TemplateDetailDialog({
  seed,
  onClose,
  onEdit,
  actions,
}: {
  seed: CertificateTemplate;
  onClose: () => void;
  onEdit: (t: CertificateTemplate) => void;
  actions: (t: CertificateTemplate) => MenuItem[];
}) {
  const detail = useTemplate(seed.id, seed);
  const t = detail.data ?? seed;
  const layout = layoutOf(t.layoutConfiguration);
  const printed = FIELD_TOGGLES.filter((k) => toggleOn(t.fieldConfiguration, k));
  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={t.name}
      description={`Code ${t.templateCode}`}
      footer={
        detail.isError ? undefined : (
          <>
            <div className="mr-auto">
              <ActionMenu label={`More actions for ${t.name}`} items={actions(t).filter((a) => a.key !== 'view' && a.key !== 'edit')} />
            </div>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => onEdit(t)} disabled={detail.isPlaceholderData}>
              <Pencil className="size-4" aria-hidden />
              Edit template
            </Button>
          </>
        )
      }
    >
      {detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <CertificatePreview content={t} values={SAMPLE_VALUES} className={layout.orientation === 'portrait' ? 'mx-auto max-w-sm' : undefined} />
            <p className="mt-2 text-[11px] text-ink-subtle">Layout preview with sample learner details. The server adds the real verification QR code to the PDF.</p>
          </div>
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <TemplateStatusBadge status={t.status} />
              {t.isDefault ? <DefaultBadge /> : null}
            </div>
            {t.description ? <p className="text-sm leading-relaxed text-ink-muted">{t.description}</p> : null}
            <dl className="divide-y divide-line rounded-lg border border-line text-sm">
              {[
                ['Title', t.certificateTitle],
                ['Organization', t.organizationName],
                ['Signatory', [t.authorizedSignatoryName, t.authorizedSignatoryDesignation].filter(Boolean).join(' · ') || 'Not set'],
                ['Page', `${layout.orientation === 'portrait' ? 'Portrait' : 'Landscape'} · ${layout.pageWidth} × ${layout.pageHeight} pt · margin ${layout.margin}`],
                [
                  'Images',
                  [
                    ['Background', t.backgroundImage],
                    ['Logo', t.organizationLogo],
                    ['Signature', t.signatureImage],
                  ]
                    .filter(([, ref]) => isImageSet(ref as MediaRef | null))
                    .map(([label]) => label)
                    .join(' · ') || 'None',
                ],
                ['Updated', formatDateTime(t.updatedAt)],
                ['Created', formatDateTime(t.createdAt)],
              ].map(([k, val]) => (
                <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-3 py-2">
                  <dt className="text-xs text-ink-subtle">{k}</dt>
                  <dd className="min-w-0 break-words text-ink">{val}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Printed fields</p>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_TOGGLES.map((k) => (
                  <span key={k} className={cn('rounded-md border px-1.5 py-0.5 text-[11px]', printed.includes(k) ? 'border-line bg-surface-2 text-ink' : 'border-dashed border-line text-ink-subtle line-through')}>
                    {FIELD_TOGGLE_LABEL[k]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function TemplatesPanel() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TemplateStatus | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [modal, setModal] = useState<Modal>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const debounced = useDebouncedValue(search.trim(), 400);
  const params: TemplateListParams = { page, limit, search: debounced || undefined, status: status || undefined };
  const list = useTemplateList(params);
  const rows = list.data?.templates ?? [];
  const filtered = Boolean(debounced || status);

  const statusMut = useTemplateStatus();
  const defaultMut = useSetDefaultTemplate();
  const duplicateMut = useDuplicateTemplate();
  const deleteMut = useDeleteTemplate();
  const confirmPending = statusMut.isPending || defaultMut.isPending || deleteMut.isPending;

  function duplicate(t: CertificateTemplate) {
    duplicateMut.mutate(t.id, {
      onSuccess: (copy) => {
        toast.success('Template duplicated', `“${copy.name}” was created as a draft.`);
        setModal({ kind: 'view', template: copy });
      },
      onError: (error) => toast.error('Could not duplicate template', normalizeApiError(error).message),
    });
  }

  function runConfirm() {
    if (!confirm) return;
    const done = () => setConfirm(null);
    const fail = (title: string) => (error: unknown) => {
      const { code, message } = normalizeApiError(error);
      toast.error(title, code === 'TEMPLATE_IN_USE' ? 'Issued certificates use this template, so it can’t be deleted. Deactivate it instead.' : message);
      done();
    };
    if (confirm.kind === 'status') {
      statusMut.mutate(
        { id: confirm.template.id, status: confirm.status },
        {
          onSuccess: (t) => {
            toast.success(`Template ${templateStatusLabel(t.status).toLowerCase()}`, t.name);
            done();
          },
          onError: fail('Could not change status'),
        }
      );
    } else if (confirm.kind === 'default') {
      defaultMut.mutate(confirm.template.id, {
        onSuccess: (t) => {
          toast.success('Default template updated', `${t.name} is now used when no template is chosen.`);
          done();
        },
        onError: fail('Could not set default'),
      });
    } else {
      const id = confirm.template.id;
      deleteMut.mutate(id, {
        onSuccess: () => {
          toast.success('Template deleted', confirm.template.name);
          if (rows.length === 1 && page > 1) setPage(page - 1);
          if (modal && 'template' in modal && modal.template.id === id) setModal(null);
          done();
        },
        onError: fail('Could not delete template'),
      });
    }
  }

  const actionsFor = (t: CertificateTemplate): MenuItem[] => [
    { key: 'view', label: 'View & preview', icon: <Eye className="size-4" />, onSelect: () => setModal({ kind: 'view', template: t }) },
    { key: 'edit', label: 'Edit', icon: <Pencil className="size-4" />, onSelect: () => setModal({ kind: 'edit', template: t }) },
    t.status === 'active'
      ? { key: 'deactivate', label: 'Deactivate', icon: <PauseCircle className="size-4" />, onSelect: () => setConfirm({ kind: 'status', template: t, status: 'inactive' }) }
      : { key: 'activate', label: 'Activate', icon: <CircleCheck className="size-4" />, onSelect: () => setConfirm({ kind: 'status', template: t, status: 'active' }) },
    { key: 'default', label: t.isDefault ? 'Default template' : 'Set as default', icon: <Star className="size-4" />, disabled: t.isDefault, onSelect: () => setConfirm({ kind: 'default', template: t }) },
    { key: 'duplicate', label: 'Duplicate', icon: <Copy className="size-4" />, disabled: duplicateMut.isPending, onSelect: () => duplicate(t) },
    { key: 'delete', label: 'Delete', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => setConfirm({ kind: 'delete', template: t }) },
  ];

  const confirmCopy = (() => {
    if (!confirm) return null;
    const t = confirm.template;
    if (confirm.kind === 'status' && confirm.status === 'inactive')
      return {
        title: 'Deactivate this template?',
        label: 'Deactivate',
        tone: 'danger' as const,
        body: (
          <>
            <p>It will no longer be used for new certificates. Certificates already issued are not affected.</p>
            {t.isDefault ? <p className="mt-2 text-warning">This is the default template. Until another default is set, new certificates use the most recently updated active template.</p> : null}
          </>
        ),
      };
    if (confirm.kind === 'status') return { title: 'Activate this template?', label: 'Activate', tone: 'primary' as const, body: <p>It becomes available when issuing certificates.</p> };
    if (confirm.kind === 'default') return { title: `Make “${t.name}” the default?`, label: 'Set as default', tone: 'primary' as const, body: <p>It replaces the current default and is activated if needed. Courses without their own template, and issues without a chosen template, will use it.</p> };
    return {
      title: 'Delete this template?',
      label: 'Delete template',
      tone: 'danger' as const,
      body: <p>Only templates that no certificate has used can be deleted. If it has been used, deactivate it instead so issued certificates keep their history.</p>,
    };
  })();

  return (
    <>
      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Certificate templates</h2>
              <p className="text-xs text-ink-muted">Designs used when certificates are issued. Issued certificates keep a snapshot of their template.</p>
            </div>
            <Button size="sm" onClick={() => setModal({ kind: 'create' })}>
              <Plus className="size-4" aria-hidden />
              New template
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search template name"
                className="pl-9"
                aria-label="Search templates"
                maxLength={200}
              />
            </div>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as TemplateStatus | '');
                setPage(1);
              }}
              className="sm:w-44"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {TEMPLATE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {templateStatusLabel(s)}
                </option>
              ))}
            </Select>
            {filtered ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setPage(1);
                }}
              >
                <X className="size-4" aria-hidden />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isPending && !rows.length ? (
          <EmptyState
            icon={<FileBadge2 className="size-5" aria-hidden />}
            title={filtered ? 'No templates match these filters' : 'No certificate templates yet'}
            description={filtered ? 'Try another name or status.' : 'Create a template to start issuing certificates.'}
            action={filtered ? undefined : <Button size="sm" onClick={() => setModal({ kind: 'create' })}>Create the first template</Button>}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Template</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Title & organization</th>
                    <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Page</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Updated</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="mt-1.5 h-3 w-28" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-16" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-4 w-40" />
                          </td>
                          <td className="hidden px-3 py-3.5 xl:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((t) => {
                        const layout = layoutOf(t.layoutConfiguration);
                        return (
                          <tr key={t.id} className="group transition-colors hover:bg-surface-2/50">
                            <td className="w-full max-w-0 py-3.5 pl-5 pr-3">
                              <button type="button" onClick={() => setModal({ kind: 'view', template: t })} className="block w-full min-w-0 text-left">
                                <span className="flex items-center gap-2">
                                  <span className="truncate font-medium text-ink group-hover:text-primary">{t.name}</span>
                                  {t.isDefault ? <DefaultBadge /> : null}
                                </span>
                                <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-subtle">{t.templateCode}</span>
                              </button>
                            </td>
                            <td className="w-px px-3 py-3.5">
                              <TemplateStatusBadge status={t.status} />
                            </td>
                            <td className="hidden max-w-64 px-3 py-3.5 lg:table-cell">
                              <span className="block truncate text-ink">{t.certificateTitle}</span>
                              <span className="block truncate text-xs text-ink-muted">{t.organizationName}</span>
                            </td>
                            <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted xl:table-cell">
                              {layout.orientation === 'portrait' ? 'Portrait' : 'Landscape'} · {layout.pageWidth}×{layout.pageHeight}
                            </td>
                            <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell">{formatDate(t.updatedAt)}</td>
                            <td className="w-px py-3.5 pl-3 pr-5 text-right">
                              <ActionMenu label={`Actions for ${t.name}`} items={actionsFor(t)} />
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
            <ul className={cn('divide-y divide-line md:hidden', list.isPlaceholderData && 'opacity-60')}>
              {list.isPending
                ? Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="space-y-2 p-4">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-3 w-24" />
                    </li>
                  ))
                : rows.map((t) => (
                    <li key={t.id} className="flex items-start gap-2 p-4">
                      <button type="button" onClick={() => setModal({ kind: 'view', template: t })} className="block min-w-0 flex-1 space-y-1.5 text-left">
                        <span className="block truncate font-medium text-ink">{t.name}</span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <TemplateStatusBadge status={t.status} />
                          {t.isDefault ? <DefaultBadge /> : null}
                          <span className="font-mono text-[11px] text-ink-subtle">{t.templateCode}</span>
                        </span>
                      </button>
                      <ActionMenu label={`Actions for ${t.name}`} items={actionsFor(t)} />
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

      {modal?.kind === 'view' ? (
        <TemplateDetailDialog key={modal.template.id} seed={modal.template} onClose={() => setModal(null)} onEdit={(t) => setModal({ kind: 'edit', template: t })} actions={actionsFor} />
      ) : null}
      {modal?.kind === 'edit' ? <TemplateFormDialog key={modal.template.id} template={modal.template} onClose={() => setModal(null)} onSaved={(t) => setModal({ kind: 'view', template: t })} /> : null}
      {modal?.kind === 'create' ? <TemplateFormDialog onClose={() => setModal(null)} onSaved={(t) => setModal({ kind: 'view', template: t })} /> : null}
      {confirm && confirmCopy ? (
        <ConfirmDialog open title={confirmCopy.title} confirmLabel={confirmCopy.label} tone={confirmCopy.tone} loading={confirmPending} onCancel={() => setConfirm(null)} onConfirm={runConfirm} description={confirmCopy.body} />
      ) : null}
    </>
  );
}
