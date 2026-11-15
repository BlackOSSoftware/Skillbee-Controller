'use client';

import { Archive, CloudUpload, Download, FileText, Info, Paperclip, Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import { ATTACHMENT_VISIBILITIES, RESOURCE_TYPES, type AdminLesson, type AttachmentVisibility, type LessonAttachment, type ResourceType } from '@/types/curriculum';
import { formatDateTime } from '@/features/assignments/display';
import { useDownloadLessonAttachment } from '@/features/learning/hooks';
import { curriculumPolicy, useArchiveAttachment, useAttachmentDetail, useLessonAttachments, useUpdateAttachment, useUploadAttachment } from '../hooks';
import { DOCUMENT_ACCEPT, DOCUMENT_EXT, formatBytes, VISIBILITY_META } from '../display';

const TYPE_LABEL: Record<ResourceType, string> = { pdf: 'PDF', document: 'Document', spreadsheet: 'Spreadsheet', presentation: 'Presentation', archive: 'ZIP archive', text: 'Text' };

function UploadForm({ lesson }: { lesson: AdminLesson }) {
  const toast = useToast();
  const upload = useUploadAttachment(lesson.id);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<AttachmentVisibility>('enrolled');
  const [resourceType, setResourceType] = useState<ResourceType | ''>('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!DOCUMENT_EXT.has(ext)) {
      setError('Use PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT or ZIP.');
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').slice(0, 200));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || upload.isPending) return;
    if (title.trim().length > 200) return setError('Title must be 200 characters or less.');
    if (description.length > 2000) return setError('Description must be 2,000 characters or less.');
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    upload.mutate(
      {
        file,
        meta: { ...(title.trim() ? { title: title.trim() } : {}), ...(description.trim() ? { description: description.trim() } : {}), visibility, ...(resourceType ? { resourceType } : {}) },
        options: { onProgress: setProgress, signal: controller.signal },
      },
      {
        onSuccess: (a) => {
          toast.success('Attachment uploaded', a.title);
          setFile(null);
          setTitle('');
          setDescription('');
          setResourceType('');
          if (inputRef.current) inputRef.current.value = '';
        },
        onError: (err) => {
          if (controller.signal.aborted) return toast.notify({ tone: 'info', title: 'Upload cancelled' });
          const { status, message } = normalizeApiError(err);
          setError(status === 413 ? 'The file is larger than the server limit.' : status === 415 ? 'This file type is not accepted.' : message);
        },
        onSettled: () => {
          setProgress(null);
          abortRef.current = null;
        },
      }
    );
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-lg border border-line p-4">
      <p className="text-sm font-semibold text-ink">Upload a file</p>
      <p className="mt-0.5 text-xs text-ink-muted">PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT or ZIP. Files are stored privately and served only through authorized downloads.</p>
      <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-field-border bg-surface-2/40 px-4 py-3 transition-colors hover:border-primary/50">
        <CloudUpload className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 text-sm">
          {file ? (
            <>
              <span className="block truncate font-medium text-ink">{file.name}</span>
              <span className="text-xs text-ink-subtle">{formatBytes(file.size)}</span>
            </>
          ) : (
            <span className="text-ink-muted">Choose a file…</span>
          )}
        </span>
        <input ref={inputRef} type="file" accept={DOCUMENT_ACCEPT} className="sr-only" aria-label="Attachment file" onChange={(e) => pick(e.target.files?.[0])} disabled={upload.isPending} />
      </label>
      {file ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="at-title" label="Title" hint="Defaults to the file name">
            <Input id="at-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={220} aria-describedby="at-title-msg" />
          </Field>
          <Field id="at-visibility" label="Who can download" hint={VISIBILITY_META[visibility].help}>
            <Select id="at-visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as AttachmentVisibility)} aria-describedby="at-visibility-msg">
              {ATTACHMENT_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {VISIBILITY_META[v].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="at-type" label="File category" hint="Detected from the file when left on Auto">
            <Select id="at-type" value={resourceType} onChange={(e) => setResourceType(e.target.value as ResourceType | '')} aria-describedby="at-type-msg">
              <option value="">Auto</option>
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="at-description" label="Description">
            <Input id="at-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      ) : null}
      {progress !== null ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>{progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Saving…'}</span>
            <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()} disabled={progress >= 1}>
              <X className="size-3.5" aria-hidden />
              Cancel
            </Button>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-danger" role="alert">{error}</p> : null}
      {file ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            disabled={upload.isPending}
          >
            Clear
          </Button>
          <Button type="submit" loading={upload.isPending}>
            Upload
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function AttachmentDialog({ lessonId, attachment, mode, onClose }: { lessonId: string; attachment: LessonAttachment; mode: 'view' | 'edit'; onClose: () => void }) {
  const toast = useToast();
  const detail = useAttachmentDetail(lessonId, attachment.id);
  const update = useUpdateAttachment(lessonId);
  const a = detail.data ?? attachment;
  const [title, setTitle] = useState(attachment.title);
  const [description, setDescription] = useState(attachment.description ?? '');
  const [visibility, setVisibility] = useState<AttachmentVisibility>(attachment.visibility);
  const [sortOrder, setSortOrder] = useState(String(attachment.sortOrder ?? 0));
  const [status, setStatus] = useState(attachment.status);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    if (!title.trim() || title.trim().length > 200) return setError('Title must be 1–200 characters.');
    if (description.length > 2000) return setError('Description must be 2,000 characters or less.');
    const order = Number(sortOrder);
    if (!Number.isInteger(order) || order < 0) return setError('Sort order must be a whole number, 0 or more.');
    const input = {
      ...(title.trim() !== attachment.title ? { title: title.trim() } : {}),
      ...(description !== (attachment.description ?? '') ? { description } : {}),
      ...(visibility !== attachment.visibility ? { visibility } : {}),
      ...(order !== attachment.sortOrder ? { sortOrder: order } : {}),
      ...(status !== attachment.status ? { status } : {}),
    };
    if (!Object.keys(input).length) return onClose();
    update.mutate(
      { fileId: attachment.id, input },
      {
        onSuccess: (updated) => {
          toast.success('Attachment updated', updated.title);
          onClose();
        },
        onError: (err) => setError(normalizeApiError(err).message),
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={update.isPending}
      size="md"
      title={mode === 'edit' ? 'Edit attachment' : 'Attachment details'}
      description={a.originalFileName}
      footer={
        mode === 'edit' ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
              Cancel
            </Button>
            <Button onClick={save} loading={update.isPending}>
              Save
            </Button>
          </>
        ) : undefined
      }
    >
      {detail.isError ? <ErrorState error={detail.error} compact /> : null}
      {mode === 'view' ? (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {[
            ['Title', a.title],
            ['File name', a.originalFileName],
            ['Category', TYPE_LABEL[a.resourceType] ?? a.resourceType],
            ['MIME type', a.mimeType],
            ['Size', formatBytes(a.sizeBytes)],
            ['Visibility', VISIBILITY_META[a.visibility]?.label ?? a.visibility],
            ['Status', a.status === 'active' ? 'Active' : 'Archived'],
            ['Sort order', String(a.sortOrder)],
            ['Uploaded', formatDateTime(a.createdAt)],
            ['Updated', formatDateTime(a.updatedAt)],
            ['Checksum (SHA-256)', a.checksum ? `${a.checksum.slice(0, 16)}…` : '—'],
            ['File stored', a.hasFile ? 'Yes' : 'No'],
          ].map(([k, val]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{k}</dt>
              <dd className="mt-0.5 break-words text-ink">{val}</dd>
            </div>
          ))}
          {a.description ? (
            <div className="col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">Description</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-ink">{a.description}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <div className="space-y-4">
          <Field id="ae-title" label="Title" required>
            <Input id="ae-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={220} />
          </Field>
          <Field id="ae-description" label="Description">
            <Textarea id="ae-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="ae-visibility" label="Visibility">
              <Select id="ae-visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as AttachmentVisibility)}>
                {ATTACHMENT_VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {VISIBILITY_META[v].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="ae-order" label="Sort order">
              <Input id="ae-order" type="number" min={0} step={1} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </Field>
            <Field id="ae-status" label="Status">
              <Select id="ae-status" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}>
                <option value="active">Active</option>
                <option value="archived">Archived (hidden)</option>
              </Select>
            </Field>
          </div>
          {error ? <p className="text-xs text-danger" role="alert">{error}</p> : null}
        </div>
      )}
    </Dialog>
  );
}

export function LessonAttachmentsPanel({ lesson }: { lesson: AdminLesson }) {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = curriculumPolicy.canManageAttachments(user);
  const list = useLessonAttachments(lesson.id, true);
  const archive = useArchiveAttachment(lesson.id);
  const download = useDownloadLessonAttachment();
  const [open, setOpen] = useState<{ attachment: LessonAttachment; mode: 'view' | 'edit' } | null>(null);
  const [archiving, setArchiving] = useState<LessonAttachment | null>(null);
  const rows = list.data ?? [];

  return (
    <div className="space-y-5">
      {canManage ? <UploadForm lesson={lesson} /> : null}
      <section className="rounded-lg border border-line">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-ink">Files ({rows.length})</p>
          {lesson.type === 'resource' ? <span className="text-[11px] text-ink-subtle">Linked to this resource lesson automatically</span> : null}
        </div>
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isPending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !rows.length ? (
          <EmptyState icon={<Paperclip className="size-5" aria-hidden />} title="No attachments yet" description="Uploaded study materials appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-[10px] font-bold uppercase text-ink-muted">{(a.extension || 'file').slice(0, 4)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{a.title}</span>
                    {a.status === 'archived' ? <Badge>Archived</Badge> : null}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {a.originalFileName} · {formatBytes(a.sizeBytes)} · {VISIBILITY_META[a.visibility]?.label ?? a.visibility} · {formatDate(a.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setOpen({ attachment: a, mode: 'view' })} aria-label={`Details for ${a.title}`}>
                    <Info className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Download ${a.title}`}
                    loading={download.isPending && download.variables?.fileId === a.id}
                    disabled={a.status !== 'active' || !a.hasFile}
                    title={a.status !== 'active' ? 'Archived files cannot be downloaded' : 'Authorized download'}
                    onClick={() =>
                      download.mutate(
                        { lessonId: lesson.id, fileId: a.id, filename: a.originalFileName },
                        { onError: (error) => toast.error('Download failed', normalizeApiError(error).message) }
                      )
                    }
                  >
                    {download.isPending && download.variables?.fileId === a.id ? null : <Download className="size-3.5" aria-hidden />}
                  </Button>
                  {canManage ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setOpen({ attachment: a, mode: 'edit' })} aria-label={`Edit ${a.title}`}>
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setArchiving(a)} aria-label={`Archive ${a.title}`}>
                        <Archive className="size-3.5" aria-hidden />
                      </Button>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="flex items-start gap-1.5 text-[11px] text-ink-subtle">
        <FileText className="mt-px size-3.5 shrink-0" aria-hidden />
        Downloads use the same authorization as learners (staff are always allowed); storage paths are never exposed.
      </p>

      {open ? <AttachmentDialog key={open.attachment.id + open.mode} lessonId={lesson.id} attachment={open.attachment} mode={open.mode} onClose={() => setOpen(null)} /> : null}
      <ConfirmDialog
        open={Boolean(archiving)}
        title="Archive this attachment?"
        confirmLabel="Archive"
        loading={archive.isPending}
        onCancel={() => setArchiving(null)}
        onConfirm={() =>
          archiving &&
          archive.mutate(archiving.id, {
            onSuccess: () => {
              toast.success('Attachment archived', archiving.title);
              setArchiving(null);
            },
            onError: (error) => {
              setArchiving(null);
              toast.error('Could not archive attachment', normalizeApiError(error).message);
            },
          })
        }
        description={<p>“{archiving?.title}” is removed for learners. The stored file is deleted only when no other record references it.</p>}
      />
    </div>
  );
}
