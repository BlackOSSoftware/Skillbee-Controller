'use client';

import { CloudUpload, Link2, PlayCircle, RefreshCw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { AdminLesson, VideoProvider } from '@/types/curriculum';
import { formatDateTime } from '@/features/assignments/display';
import { curriculumPolicy, useDeleteVideo, useUpdateLesson, useUploadVideo, useVideoStatus } from '../hooks';
import { formatBytes, formatClock, VIDEO_ACCEPT, VIDEO_MIME, VideoStatusBadge } from '../display';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{children}</dd>
    </div>
  );
}

export function LessonVideoPanel({ lesson }: { lesson: AdminLesson }) {
  const { user } = useAuth();
  const toast = useToast();
  const video = lesson.content.video;
  const isVideoLesson = lesson.type === 'video';
  const status = useVideoStatus(lesson.id, isVideoLesson && Boolean(video));
  const upload = useUploadVideo();
  const remove = useDeleteVideo();
  const update = useUpdateLesson();
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [provider, setProvider] = useState<VideoProvider>(video?.source === 'external' ? video.provider : 'youtube');
  const [externalUrl, setExternalUrl] = useState(video?.source === 'external' ? video.externalUrl ?? '' : '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const canUpload = curriculumPolicy.canUploadVideo(user);
  const canDelete = curriculumPolicy.canDeleteVideo(user);
  const canWrite = curriculumPolicy.canWriteLessons(user);

  // Leaving the editor cancels an in-flight upload instead of letting it finish unseen
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!isVideoLesson) {
    return <EmptyState icon={<PlayCircle className="size-5" aria-hidden />} title="This is not a video lesson" description="Change the lesson type to Video in Basic information to upload or link a video." />;
  }

  function startUpload(file: File) {
    setFileError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!VIDEO_MIME.has(file.type) && !['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
      setFileError('Use an MP4, WebM, MOV or AVI file.');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    upload.mutate(
      { id: lesson.id, file, options: { onProgress: setProgress, signal: controller.signal } },
      {
        onSuccess: () => toast.success(video ? 'Video replaced' : 'Video uploaded', file.name),
        onError: (error) => {
          if (controller.signal.aborted) {
            toast.notify({ tone: 'info', title: 'Upload cancelled' });
            return;
          }
          const { status: code, message } = normalizeApiError(error);
          setFileError(code === 413 ? 'The file is larger than the server limit.' : code === 415 ? 'This file type is not accepted.' : message);
        },
        onSettled: () => {
          setProgress(null);
          abortRef.current = null;
          if (fileRef.current) fileRef.current.value = '';
        },
      }
    );
  }

  function saveExternal() {
    setUrlError(null);
    try {
      new URL(externalUrl);
    } catch {
      setUrlError('Enter a full URL, e.g. https://www.youtube.com/watch?v=…');
      return;
    }
    update.mutate(
      { id: lesson.id, input: { video: { source: 'external', provider, externalUrl: externalUrl.trim() } } },
      {
        onSuccess: () => toast.success('External video linked'),
        onError: (error) => toast.error('Could not link video', normalizeApiError(error).message),
      }
    );
  }

  const live = status.data;
  const processing = live?.processingStatus ?? video?.processingStatus ?? null;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Current video</p>
            <p className="text-xs text-ink-muted">Stored on the course media server; learners stream it through short-lived playback tokens.</p>
          </div>
          {video && processing ? <VideoStatusBadge status={processing} /> : null}
        </div>
        {!video ? (
          <p className="px-4 py-5 text-sm text-ink-subtle">No video yet. Upload a file or link an external video below.</p>
        ) : (
          <div className="px-4 py-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Fact label="Source">{video.source === 'external' ? `External · ${video.provider}` : 'Uploaded file'}</Fact>
              {video.source === 'uploaded' ? (
                <>
                  <Fact label="File">{video.originalFileName ?? '—'}</Fact>
                  <Fact label="Size">{formatBytes(video.sizeBytes)}</Fact>
                  <Fact label="Format">{video.mimeType ?? '—'}</Fact>
                  <Fact label="Qualities">{(live?.availableQualities ?? video.availableQualities).join(', ') || '—'}</Fact>
                  <Fact label="Uploaded">{formatDateTime(live?.uploadedAt ?? video.uploadedAt)}</Fact>
                  {video.durationSeconds ? <Fact label="Duration">{formatClock(video.durationSeconds)}</Fact> : null}
                  <Fact label="Streaming">{live?.hasHls ?? video.hasHls ? 'HLS' : 'Progressive (HTTP Range)'}</Fact>
                </>
              ) : (
                <div className="col-span-2 min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">URL</dt>
                  <dd className="mt-0.5 break-all text-sm text-ink">{video.externalUrl}</dd>
                </div>
              )}
            </dl>
            {status.isError ? <div className="mt-3"><ErrorState error={status.error} compact /></div> : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {video.source === 'uploaded' ? (
                <Button size="sm" variant="ghost" onClick={() => status.refetch()} loading={status.isFetching}>
                  {status.isFetching ? null : <RefreshCw className="size-3.5" aria-hidden />}
                  Check status
                </Button>
              ) : null}
              {processing === 'pending' || processing === 'processing' ? <span className="text-xs text-ink-subtle">Checking every few seconds until processing finishes.</span> : null}
              {canDelete ? (
                <Button size="sm" variant="ghost" className="ml-auto text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-3.5" aria-hidden />
                  Remove video
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {canUpload ? (
        <section className="rounded-lg border border-line p-4">
          <p className="text-sm font-semibold text-ink">{video?.source === 'uploaded' ? 'Replace video file' : 'Upload video file'}</p>
          <p className="mt-0.5 text-xs text-ink-muted">MP4, WebM, MOV or AVI. Replacing removes the old file once no other lesson uses it.</p>
          {progress !== null ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-ink-muted">
                <span>{progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Processing on the server…'}</span>
                <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()} disabled={progress >= 1}>
                  <X className="size-3.5" aria-hidden />
                  Cancel
                </Button>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </div>
          ) : (
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-field-border bg-surface-2/40 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.03]">
              <CloudUpload className="size-6 text-primary" aria-hidden />
              <span className="text-sm font-medium text-ink">Choose a video file</span>
              <span className="text-xs text-ink-subtle">Large files can take a while; keep this panel open until it finishes.</span>
              <input
                ref={fileRef}
                type="file"
                accept={VIDEO_ACCEPT}
                className="sr-only"
                aria-label="Video file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) startUpload(f);
                }}
              />
            </label>
          )}
          {fileError ? <p className="mt-2 text-xs text-danger" role="alert">{fileError}</p> : null}
        </section>
      ) : null}

      {canWrite ? (
        <section className="rounded-lg border border-line p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Link2 className="size-4 text-ink-subtle" aria-hidden />
            Link an external video
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-end">
            <Field id="lv-provider" label="Provider">
              <Select id="lv-provider" value={provider} onChange={(e) => setProvider(e.target.value as VideoProvider)}>
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field id="lv-external" label="Video URL" error={urlError ?? undefined}>
              <Input id="lv-external" type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} aria-invalid={Boolean(urlError)} aria-describedby="lv-external-msg" />
            </Field>
            <Button onClick={saveExternal} loading={update.isPending} disabled={!externalUrl.trim()}>
              Save link
            </Button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Remove this video?"
        confirmLabel="Remove video"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          remove.mutate(lesson.id, {
            onSuccess: (l) => {
              setConfirmDelete(false);
              toast.success('Video removed', l.status === 'draft' && lesson.status === 'published' ? 'The lesson was moved back to draft.' : undefined);
            },
            onError: (error) => {
              setConfirmDelete(false);
              toast.error('Could not remove video', normalizeApiError(error).message);
            },
          })
        }
        description={<p>The lesson loses its video. The stored file is deleted only if no other lesson uses it. A published video lesson returns to draft.</p>}
      />
    </div>
  );
}
