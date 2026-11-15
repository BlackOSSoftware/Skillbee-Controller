'use client';

import { Eye, FileText, Pencil, Plus, Power } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { formatDateTime } from '@/features/assignments/display';
import { cn } from '@/lib/cn';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/providers/toast-provider';
import type { CreateEmailTemplateInput, EmailTemplate, TemplateVariable, UpdateEmailTemplateInput } from '@/types/email';
import { TEMPLATE_VARIABLES } from '@/types/email';
import { useCreateEmailTemplate, useEmailTemplates, useSetTemplateStatus, useUpdateEmailTemplate } from '../hooks';
import { EmailPreviewFrame, PreviewDeviceToggle, type PreviewDevice } from './email-preview';
import { SAMPLE_VARIABLES } from '../preview';

export function EmailTemplatesPanel() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [preview, setPreview] = useState<EmailTemplate | null>(null);
  const [statusTarget, setStatusTarget] = useState<EmailTemplate | null>(null);

  const list = useEmailTemplates();
  const rows = useMemo(() => {
    const all = list.data ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((t) => {
      if (statusFilter === 'active' && !t.isActive) return false;
      if (statusFilter === 'inactive' && t.isActive) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
    });
  }, [list.data, search, statusFilter]);

  const filtered = Boolean(search.trim() || statusFilter);

  return (
    <>
      <PageHeader
        title="Email Templates"
        description="Manage transactional email templates and their activation status."
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Plus className="size-4" aria-hidden />
              New template
            </Button>
            <RefreshButton queryKeys={[queryKeys.emailTemplates.all]} />
          </div>
        }
      />

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{filtered ? 'Filtered templates' : 'All templates'}</h2>
            <p className="text-xs text-ink-muted">{rows.length} of {list.data?.length ?? 0} templates · system templates are seeded by the backend.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, slug or subject" className="sm:max-w-xs" aria-label="Search templates" />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status" className="sm:w-40">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            {filtered ? <Button variant="ghost" onClick={() => { setSearch(''); setStatusFilter(''); }} className="shrink-0">Clear</Button> : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !rows.length ? (
          <EmptyState
            icon={<FileText className="size-5" aria-hidden />}
            title={filtered ? 'No templates match' : 'No templates yet'}
            description={filtered ? 'Try another search or filter.' : 'Create your first email template.'}
            action={filtered ? <Button size="sm" variant="secondary" onClick={() => { setSearch(''); setStatusFilter(''); }}>Clear filters</Button> : <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>New template</Button>}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Template</th>
                    <th scope="col" className="px-3 py-2.5">Slug</th>
                    <th scope="col" className="px-3 py-2.5">Subject</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Variables</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Updated</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((t) => (
                    <tr key={t.id} className="group align-top transition-colors hover:bg-surface-2/50">
                      <td className="max-w-56 py-3.5 pl-5 pr-3">
                        <span className="block truncate font-medium text-ink">{t.name}</span>
                        {t.isSystem ? <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-ink-subtle">system</span> : null}
                      </td>
                      <td className="w-px px-3 py-3.5"><code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-muted">{t.slug}</code></td>
                      <td className="max-w-64 px-3 py-3.5"><span className="block truncate text-xs text-ink-muted">{t.subject}</span></td>
                      <td className="hidden w-px px-3 py-3.5 text-xs tabular-nums text-ink-muted lg:table-cell">{t.variables.length}</td>
                      <td className="w-px px-3 py-3.5">
                        <Badge tone={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell" title={formatDateTime(t.updatedAt)}>
                        {formatDateTime(t.updatedAt)}
                      </td>
                      <td className="w-px py-3 pl-3 pr-5">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => setPreview(t)} aria-label={`Preview ${t.name}`} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
                            <Eye className="size-4" aria-hidden />
                          </button>
                          <button type="button" onClick={() => { setEditing(t); setEditorOpen(true); }} aria-label={`Edit ${t.name}`} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
                            <Pencil className="size-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatusTarget(t)}
                            aria-label={t.isActive ? `Deactivate ${t.name}` : `Activate ${t.name}`}
                            className={cn('rounded-md p-1.5 hover:bg-surface-2', t.isActive ? 'text-ink-muted hover:text-amber-600' : 'text-ink-muted hover:text-emerald-600')}
                          >
                            <Power className="size-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {rows.map((t) => (
                <li key={t.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{t.name}</span>
                    <Badge tone={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
                    {t.isSystem ? <Badge tone="neutral">system</Badge> : null}
                  </div>
                  <p className="truncate font-mono text-[11px] text-ink-subtle">{t.slug}</p>
                  <p className="line-clamp-1 text-xs text-ink-muted">{t.subject}</p>
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setPreview(t)}><Eye className="size-3.5" aria-hidden /> Preview</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setEditing(t); setEditorOpen(true); }}><Pencil className="size-3.5" aria-hidden /> Edit</Button>
                    <Button size="sm" variant="secondary" onClick={() => setStatusTarget(t)}>
                      <Power className="size-3.5" aria-hidden /> {t.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {editorOpen ? (
        <TemplateEditorDialog template={editing} onClose={() => setEditorOpen(false)} />
      ) : null}
      {preview ? <TemplatePreviewDialog template={preview} onClose={() => setPreview(null)} /> : null}
      {statusTarget ? <TemplateStatusDialog template={statusTarget} onClose={() => setStatusTarget(null)} /> : null}
    </>
  );
}

// ---------------- Editor ----------------

interface EditorState {
  name: string;
  slug: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: TemplateVariable[];
  isActive: boolean;
}

function toEditorState(t: EmailTemplate | null): EditorState {
  return {
    name: t?.name ?? '',
    slug: t?.slug ?? '',
    subject: t?.subject ?? '',
    htmlBody: t?.htmlBody ?? '',
    textBody: t?.textBody ?? '',
    variables: (t?.variables ?? []) as TemplateVariable[],
    isActive: t?.isActive ?? true,
  };
}

function TemplateEditorDialog({ template, onClose }: { template: EmailTemplate | null; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateEmailTemplate();
  const update = useUpdateEmailTemplate(template?.id ?? '');
  const [v, setV] = useState<EditorState>(() => toEditorState(template));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const pending = create.isPending || update.isPending;
  const isEdit = Boolean(template);

  function set<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function toggleVar(variable: TemplateVariable) {
    set('variables', v.variables.includes(variable) ? v.variables.filter((x) => x !== variable) : [...v.variables, variable]);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!v.name.trim() || v.name.length < 2) next.name = 'Name must be at least 2 characters.';
    else if (v.name.length > 120) next.name = 'Max 120 characters.';
    if (!isEdit && v.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug.trim())) next.slug = 'Slug may only contain lowercase letters, numbers and hyphens.';
    if (!v.subject.trim()) next.subject = 'Subject is required.';
    else if (v.subject.length > 200) next.subject = 'Max 200 characters.';
    if (!v.htmlBody.trim()) next.htmlBody = 'HTML body is required.';
    else if (v.htmlBody.length > 50000) next.htmlBody = 'Max 50,000 characters.';
    if (!v.textBody.trim()) next.textBody = 'Text body is required.';
    else if (v.textBody.length > 20000) next.textBody = 'Max 20,000 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || pending) return;
    const onErr = (err: unknown) => toast.error(isEdit ? 'Could not update template' : 'Could not create template', normalizeApiError(err).message);
    if (isEdit && template) {
      const input: UpdateEmailTemplateInput = {
        name: v.name.trim(),
        subject: v.subject,
        htmlBody: v.htmlBody,
        textBody: v.textBody,
        variables: v.variables,
      };
      update.mutate(input, {
        onSuccess: () => { toast.success('Template updated'); onClose(); },
        onError: onErr,
      });
    } else {
      const input: CreateEmailTemplateInput = {
        name: v.name.trim(),
        slug: v.slug.trim() || undefined,
        subject: v.subject,
        htmlBody: v.htmlBody,
        textBody: v.textBody,
        variables: v.variables,
        isActive: v.isActive,
      };
      create.mutate(input, {
        onSuccess: () => { toast.success('Template created'); onClose(); },
        onError: onErr,
      });
    }
  }

  const usedVars = useMemo(() => {
    const found = new Set<string>();
    const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    for (const body of [v.subject, v.htmlBody, v.textBody]) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(body))) found.add(m[1]);
    }
    return [...found];
  }, [v.subject, v.htmlBody, v.textBody]);

  return (
    <Dialog
      open
      onClose={() => !pending && onClose()}
      title={isEdit ? `Edit ${template!.name}` : 'New email template'}
      description={isEdit ? `Slug: ${template!.slug} · ${template!.isSystem ? 'system template' : 'custom template'}` : 'Use {{variable}} placeholders — only supported variables are substituted at send time.'}
      size="full"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" form="template-form" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create template'}
          </button>
        </div>
      }
    >
      <form id="template-form" onSubmit={submit} className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" noValidate>
        <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="tpl-name" label="Name" error={errors.name}>
            <Input id="tpl-name" value={v.name} onChange={(e) => set('name', e.target.value)} maxLength={120} />
          </Field>
          {!isEdit ? (
            <Field id="tpl-slug" label="Slug" error={errors.slug} hint="Optional — derived from name when empty">
              <Input id="tpl-slug" value={v.slug} onChange={(e) => set('slug', e.target.value)} maxLength={80} placeholder="welcome-email" />
            </Field>
          ) : null}
        </div>
        <Field id="tpl-subject" label="Subject" error={errors.subject} hint="Supports {{variables}}">
          <Input id="tpl-subject" value={v.subject} onChange={(e) => set('subject', e.target.value)} maxLength={200} />
        </Field>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Field id="tpl-html" label="HTML body" error={errors.htmlBody} hint={`${v.htmlBody.length.toLocaleString('en-IN')}/50,000`}>
            <Textarea id="tpl-html" rows={10} value={v.htmlBody} onChange={(e) => set('htmlBody', e.target.value)} className="font-mono text-[13px]" />
          </Field>
          <Field id="tpl-text" label="Text body" error={errors.textBody} hint={`${v.textBody.length.toLocaleString('en-IN')}/20,000`}>
            <Textarea id="tpl-text" rows={10} value={v.textBody} onChange={(e) => set('textBody', e.target.value)} className="font-mono text-[13px]" />
          </Field>
        </div>

        <fieldset className="rounded-lg border border-line p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Variables</legend>
          {usedVars.length ? (
            <p className="mb-2 text-xs text-ink-muted">
              Detected in content:{' '}
              {usedVars.map((u) => (
                <code key={u} className={cn('mr-1 rounded px-1 py-0.5 text-[11px]', TEMPLATE_VARIABLES.includes(u as TemplateVariable) ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-danger/10 text-danger')}>
                  {`{{${u}}}`}
                </code>
              ))}
              {!usedVars.every((u) => TEMPLATE_VARIABLES.includes(u as TemplateVariable)) ? (
                <span className="text-danger"> — unsupported variables are stripped at send time.</span>
              ) : null}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => toggleVar(variable)}
                aria-pressed={v.variables.includes(variable)}
                title={`Sample: ${SAMPLE_VARIABLES[variable]}`}
                className={cn(
                  'rounded-md border px-2 py-1 font-mono text-[11px] transition-colors',
                  v.variables.includes(variable)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-line text-ink-muted hover:border-primary/40 hover:text-ink'
                )}
              >
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-subtle">Only variables declared here are substituted — the backend also enforces this allowlist.</p>
        </fieldset>

        {!isEdit ? (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} className="size-4 rounded border-line text-primary focus:ring-primary" />
            Active (available for sending immediately)
          </label>
        ) : null}
        </div>

        <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start" aria-label="Live email preview">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Live preview — sample data</p>
            <PreviewDeviceToggle device={device} onChange={setDevice} />
          </div>
          <EmailPreviewFrame
            subject={v.subject}
            htmlBody={v.htmlBody}
            textBody={v.textBody}
            device={device}
            className="h-[560px]"
          />
          <p className="mt-2 text-[11px] leading-snug text-ink-subtle">
            Preview substitutes sample values for {'{{variables}}'} and never sends email. The final email is rendered by the backend with real data.
          </p>
        </aside>
      </form>
    </Dialog>
  );
}

// ---------------- Preview ----------------

function TemplatePreviewDialog({ template, onClose }: { template: EmailTemplate; onClose: () => void }) {
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Preview — ${template.name}`}
      description={`Slug: ${template.slug} · ${template.isActive ? 'active' : 'inactive'} · design v${template.designVersion ?? 0}`}
      size="xl"
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2">
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Rendered with sample data</p>
          <PreviewDeviceToggle device={device} onChange={setDevice} />
        </div>
        <EmailPreviewFrame
          subject={template.subject}
          htmlBody={template.htmlBody}
          textBody={template.textBody}
          device={device}
          className="h-[560px]"
        />
        <p className="text-[11px] text-ink-subtle">
          {'{{variables}}'} are replaced with realistic sample values for preview only — no email is sent. The backend
          renders the final email with real data and HTML-escapes all values.
        </p>
      </div>
    </Dialog>
  );
}

// ---------------- Status ----------------

function TemplateStatusDialog({ template, onClose }: { template: EmailTemplate; onClose: () => void }) {
  const toast = useToast();
  const setStatus = useSetTemplateStatus();
  const activating = !template.isActive;

  function confirm() {
    setStatus.mutate(
      { id: template.id, isActive: activating },
      {
        onSuccess: () => {
          toast.success(activating ? 'Template activated' : 'Template deactivated', template.name);
          onClose();
        },
        onError: (e) => toast.error('Could not update status', normalizeApiError(e).message),
      }
    );
  }

  return (
    <ConfirmDialog
      open
      title={activating ? 'Activate this template?' : 'Deactivate this template?'}
      tone={activating ? 'primary' : 'danger'}
      confirmLabel={activating ? 'Activate' : 'Deactivate'}
      loading={setStatus.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-2">
          <p className="font-medium text-ink">{template.name}</p>
          <p className="text-xs text-ink-muted">
            {activating
              ? 'The template becomes available for sending. This does not send any emails by itself.'
              : 'The template will no longer be used for new sends. Existing delivery logs are unaffected.'}
          </p>
        </div>
      }
    />
  );
}
