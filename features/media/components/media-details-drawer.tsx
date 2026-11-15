'use client';

import { Check, Copy, Download, ExternalLink, LoaderCircle, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import type { ApiErrorBody } from '@/types/api';
import { formatDate, formatRelative, titleCase } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import type { MediaAsset, MediaCategory, MediaReference, MediaVisibility } from '@/types/media';
import {
  formatBytes,
  formatDuration,
  MediaThumb,
  MediaTypeBadge,
  ProviderBadge,
  StatusBadge,
} from '../display';
import { mediaPolicy, useDeleteMedia, useMediaCategories, useMediaDetail, useMediaReferences, useRestoreMedia, useUpdateMedia } from '../hooks';
import { useAuth } from '@/hooks/use-auth';
import { MediaVideoPreview } from './media-video-preview';

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(id).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs text-ink-muted transition hover:bg-surface-2 hover:text-ink"
      title="Copy asset ID"
    >
      {id}
      {copied ? <Check className="size-3 text-success" aria-hidden /> : <Copy className="size-3" aria-hidden />}
    </button>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink" title={typeof children === 'string' ? children : undefined}>
        {children}
      </dd>
    </div>
  );
}

function ReferenceLink({ refItem, kind }: { refItem: MediaReference; kind: 'course' | 'lesson' | 'resource' | 'certificateTemplate' | 'certificate' }) {
  const label = refItem.title || refItem.slug || refItem.id;
  if (kind === 'course') {
    return (
      <Link href={`/learn/courses/${refItem.id}`} className="text-primary hover:underline">
        {label}
      </Link>
    );
  }
  if (kind === 'lesson' && refItem.courseId) {
    return (
      <Link href={`/learn/courses/${refItem.courseId}?lesson=${refItem.id}`} className="text-primary hover:underline">
        {label}
      </Link>
    );
  }
  if (kind === 'certificateTemplate' || kind === 'certificate') {
    return (
      <Link href="/certificates" className="text-primary hover:underline">
        {label}
      </Link>
    );
  }
  return <span className="text-ink">{label}</span>;
}

interface MediaDetailsDrawerProps {
  asset: MediaAsset;
  onClose: () => void;
  onDeleted: () => void;
}

export function MediaDetailsDrawer({ asset, onClose, onDeleted }: MediaDetailsDrawerProps) {
  const { user } = useAuth();
  const toast = useToast();
  // Lesson videos are not MediaAssets — detail/references endpoints do not apply.
  const isLessonVideo = asset.source === 'lesson_video';
  const detail = useMediaDetail(isLessonVideo ? null : asset.id, !isLessonVideo);
  const references = useMediaReferences(asset.id, mediaPolicy.canReadReferences(user) && !isLessonVideo);
  const categories = useMediaCategories();
  const update = useUpdateMedia();
  const remove = useDeleteMedia();
  const restore = useRestoreMedia();

  const current = detail.data ?? asset;
  const canUpdate = mediaPolicy.canUpdate(user);
  const canDelete = mediaPolicy.canDelete(user);
  const canRestore = mediaPolicy.canRestore(user);
  const canRefs = mediaPolicy.canReadReferences(user);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Initialized from the list item; the drawer remounts per selection, so no effect reset is needed.
  const [form, setForm] = useState<{ title: string; description: string; altText: string; category: string; visibility: string }>({
    title: asset.title ?? '',
    description: asset.description ?? '',
    altText: asset.altText ?? '',
    category: asset.category ?? '',
    visibility: asset.visibility ?? 'private',
  });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refs = references.data?.references;
  const refTotal = refs?.total ?? null;
  const refGroups: { key: 'courses' | 'lessons' | 'resources' | 'certificateTemplates' | 'certificates'; label: string }[] = [
    { key: 'courses', label: 'Courses' },
    { key: 'lessons', label: 'Lessons' },
    { key: 'resources', label: 'Resources' },
    { key: 'certificateTemplates', label: 'Certificate Templates' },
    { key: 'certificates', label: 'Issued Certificates' },
  ];

  const isImage = current.mediaType === 'image' && current.secureUrl;
  const isVideo = current.mediaType === 'video';
  const previewUrl = isImage ? current.secureUrl : null;

  async function saveMetadata() {
    try {
      await update.mutateAsync({
        id: current.id,
        input: {
          title: form.title.trim() || undefined,
          description: form.description.trim() || undefined,
          altText: form.altText.trim() || undefined,
          category: (form.category || undefined) as MediaCategory | undefined,
          visibility: (form.visibility || undefined) as MediaVisibility | undefined,
        },
      });
      toast.success('Media updated', 'Metadata saved.');
      setEditing(false);
    } catch (e) {
      toast.error('Update failed', normalizeApiError(e).message);
    }
  }

  async function doDelete() {
    setDeleteError(null);
    try {
      await remove.mutateAsync(current.id);
      toast.success('Media deleted', 'The asset was soft-deleted and can be restored.');
      setConfirmDelete(false);
      onDeleted();
    } catch (e) {
      const { message } = normalizeApiError(e);
      // 409 MEDIA_IN_USE carries { references } in error.details (not an array, so not in fieldErrors).
      const details = isAxiosError<ApiErrorBody>(e) ? e.response?.data?.error?.details : undefined;
      const refsDetail = details as
        | {
            references?: {
              courses?: MediaReference[];
              lessons?: MediaReference[];
              resources?: MediaReference[];
              certificateTemplates?: MediaReference[];
              certificates?: MediaReference[];
            };
          }
        | undefined;
      const list = refsDetail?.references
        ? [
            ...(refsDetail.references.courses ?? []),
            ...(refsDetail.references.lessons ?? []),
            ...(refsDetail.references.resources ?? []),
            ...(refsDetail.references.certificateTemplates ?? []),
            ...(refsDetail.references.certificates ?? []),
          ]
        : [];
      setDeleteError(
        list.length
          ? `${message} Used by: ${list.map((r) => r.title || r.id).join(', ')}`
          : message
      );
      setConfirmDelete(false);
      void references.refetch();
    }
  }

  async function doRestore() {
    try {
      await restore.mutateAsync(current.id);
      toast.success('Media restored', 'The asset is active again.');
    } catch (e) {
      toast.error('Restore failed', normalizeApiError(e).message);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      placement="right"
      title={current.originalFileName}
      description={`${titleCase(current.mediaType)} · ${formatBytes(current.sizeBytes)}`}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {isLessonVideo ? (
            <p className="text-xs text-ink-subtle">Lesson videos are managed from the course curriculum.</p>
          ) : current.deletedAt ? (
            canRestore ? (
              <Button onClick={() => void doRestore()} loading={restore.isPending}>
                <RotateCcw className="size-4" aria-hidden />
                Restore
              </Button>
            ) : null
          ) : (
            <>
              {canUpdate && !editing ? (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden />
                  Edit metadata
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={refTotal !== null && refTotal > 0}
                  title={refTotal !== null && refTotal > 0 ? 'Asset is in use — remove references first' : undefined}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Delete
                </Button>
              ) : null}
            </>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Preview */}
        <div className="overflow-hidden rounded-lg border border-line bg-surface-2">
          {isVideo ? (
            <MediaVideoPreview asset={current} />
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL
            <img src={previewUrl} alt={current.altText || current.title} className="max-h-72 w-full object-contain" />
          ) : (
            <div className="flex h-40 items-center justify-center">
              <MediaThumb asset={current} className="size-full" />
            </div>
          )}
        </div>

        {current.deletedAt ? (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
            This asset was deleted on {formatDate(current.deletedAt)}. Restore it to make it available again.
          </p>
        ) : null}
        {deleteError ? (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {deleteError}
          </p>
        ) : null}

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(current.id)}>
            <Copy className="size-3.5" aria-hidden />
            Copy ID
          </Button>
          {previewUrl ? (
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary">
                <ExternalLink className="size-3.5" aria-hidden />
                Preview
              </Button>
            </a>
          ) : null}
          {previewUrl ? (
            <a href={previewUrl} download={current.originalFileName}>
              <Button size="sm" variant="secondary">
                <Download className="size-3.5" aria-hidden />
                Download
              </Button>
            </a>
          ) : null}
        </div>

        {/* Metadata */}
        {editing ? (
          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold text-ink">Edit metadata</h3>
            <Field id="media-title" label="Title">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
            </Field>
            <Field id="media-description" label="Description">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={1000} />
            </Field>
            {current.mediaType === 'image' ? (
              <Field id="media-alt" label="Alt text">
                <Input value={form.altText} onChange={(e) => setForm({ ...form, altText: e.target.value })} maxLength={300} />
              </Field>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="media-category" label="Category">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.category} value={c.category}>{titleCase(String(c.category))}</option>
                  ))}
                </Select>
              </Field>
              <Field id="media-visibility" label="Access mode">
                <Select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                  <option value="public">Public</option>
                  <option value="protected">Protected</option>
                  <option value="private">Private</option>
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={update.isPending}>Cancel</Button>
              <Button size="sm" onClick={() => void saveMetadata()} loading={update.isPending}>Save changes</Button>
            </div>
          </Card>
        ) : (
          <Card className="p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <MetaRow label="Asset ID"><CopyId id={current.id} /></MetaRow>
              <MetaRow label="Type"><MediaTypeBadge type={current.mediaType} /></MetaRow>
              <MetaRow label="Status"><StatusBadge status={current.processingStatus} /></MetaRow>
              <MetaRow label="Category">{titleCase(String(current.category))}</MetaRow>
              <MetaRow label="Provider"><ProviderBadge provider={current.storageProvider} /></MetaRow>
              <MetaRow label="Access">{titleCase(current.visibility)}</MetaRow>
              <MetaRow label="File name">{current.originalFileName}</MetaRow>
              <MetaRow label="MIME type">{current.mimeType}</MetaRow>
              <MetaRow label="Size">{formatBytes(current.sizeBytes)}</MetaRow>
              {current.width && current.height ? <MetaRow label="Dimensions">{current.width} × {current.height}</MetaRow> : null}
              {current.durationSeconds ? <MetaRow label="Duration">{formatDuration(current.durationSeconds)}</MetaRow> : null}
              <MetaRow label="Download">{current.downloadAllowed ? 'Allowed' : 'Not allowed'}</MetaRow>
              <MetaRow label="Uploaded">{formatDate(current.createdAt)}</MetaRow>
              <MetaRow label="Updated">{formatDate(current.updatedAt)}</MetaRow>
              {current.lastAccessedAt ? <MetaRow label="Last accessed">{formatRelative(current.lastAccessedAt)}</MetaRow> : null}
              {current.courseName ? (
                <MetaRow label="Course">{current.courseName}</MetaRow>
              ) : current.courseId ? (
                <MetaRow label="Course ID"><CopyId id={current.courseId} /></MetaRow>
              ) : null}
              {current.topicName ? <MetaRow label="Module">{current.topicName}</MetaRow> : null}
              {current.lessonTitle ? (
                <MetaRow label="Lesson">{current.lessonTitle}</MetaRow>
              ) : current.lessonId ? (
                <MetaRow label="Lesson ID"><CopyId id={current.lessonId} /></MetaRow>
              ) : null}
            </dl>
            {current.title && current.title !== current.originalFileName ? (
              <p className="mt-3 border-t border-line pt-3 text-sm text-ink">{current.title}</p>
            ) : null}
            {current.description ? (
              <p className="mt-1 text-xs text-ink-muted">{current.description}</p>
            ) : null}
            {current.altText ? (
              <p className="mt-1 text-xs text-ink-subtle">Alt: {current.altText}</p>
            ) : null}
          </Card>
        )}

        {/* Used In */}
        {canRefs && !isLessonVideo && !current.deletedAt ? (
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Used In</h3>
              {references.isPending ? <LoaderCircle className="size-4 animate-spin text-ink-subtle" aria-hidden /> : null}
            </div>
            {references.isError ? (
              <p className="text-xs text-ink-muted">Usage information is unavailable.</p>
            ) : refs ? (
              refTotal === 0 ? (
                <p className="text-xs text-ink-muted">This asset is not referenced by any course, lesson, resource or certificate.</p>
              ) : (
                <div className="space-y-3">
                  {refGroups.map(({ key, label }) => {
                    const list = [...new Map((refs[key] ?? []).map((r) => [r.id, r])).values()];
                    if (!list.length) return null;
                    return (
                      <div key={key}>
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                          {label} ({list.length})
                        </p>
                        <ul className="space-y-1">
                          {list.map((r) => (
                            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                              <ReferenceLink
                                refItem={r}
                                kind={key === 'courses' ? 'course' : key === 'lessons' ? 'lesson' : key === 'certificateTemplates' ? 'certificateTemplate' : key === 'certificates' ? 'certificate' : 'resource'}
                              />
                              <span className="shrink-0 font-mono text-[10px] text-ink-subtle">{r.id}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}
          </Card>
        ) : null}

      </div>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void doDelete()}
        title="Delete media asset?"
        description={`"${current.originalFileName}" will be soft-deleted. ${refTotal && refTotal > 0 ? 'It is currently in use and cannot be deleted.' : 'You can restore it later from the Deleted Media filter.'}`}
        confirmLabel="Delete asset"
        tone="danger"
        loading={remove.isPending}
      />
    </Dialog>
  );
}
