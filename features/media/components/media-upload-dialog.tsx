'use client';

import { AlertCircle, CheckCircle2, CloudUpload, FileText, Film, ImageIcon, Loader2, RotateCcw, X } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/states';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import { mediaService } from '@/services/media.service';
import { useToast } from '@/providers/toast-provider';
import type { MediaCategory, MediaCategoryInfo, MediaType } from '@/types/media';
import { formatBytes } from '../display';
import { useMediaCategories } from '../hooks';

const DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
]);

function mediaTypeOf(file: File): MediaType | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (DOCUMENT_MIMES.has(file.type)) return 'document';
  return null;
}

type ItemStatus = 'queued' | 'uploading' | 'confirming' | 'done' | 'error' | 'cancelled';

interface UploadItem {
  id: string;
  file: File;
  type: MediaType;
  category: MediaCategory;
  status: ItemStatus;
  progress: number;
  error: string | null;
}

let seq = 0;
function nextId() {
  seq += 1;
  return `u${Date.now()}-${seq}`;
}

interface MediaUploadDialogProps {
  onClose: () => void;
  onDone: () => void;
}

export function MediaUploadDialog({ onClose, onDone }: MediaUploadDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const categories = useMediaCategories();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aborts = useRef(new Map<string, AbortController>());
  const running = useRef(false);

  const catalog = categories.data ?? [];

  function compatibleCategories(type: MediaType): MediaCategoryInfo[] {
    return catalog.filter((c) => c.mediaType === type || c.mediaType === 'image|video|document');
  }

  function defaultCategory(type: MediaType): MediaCategory {
    const list = compatibleCategories(type);
    return (list[0]?.category as MediaCategory) ?? 'other';
  }

  function categoryLimit(category: MediaCategory): number | null {
    const c = catalog.find((x) => x.category === category);
    return c?.maxSizeMb ?? null;
  }

  function addFiles(files: FileList | File[]) {
    setFileError(null);
    const next: UploadItem[] = [];
    for (const file of Array.from(files)) {
      const type = mediaTypeOf(file);
      if (!type) {
        setFileError(`"${file.name}" is not a supported image, video or document type.`);
        continue;
      }
      const category = defaultCategory(type);
      const maxMb = categoryLimit(category);
      const item: UploadItem = {
        id: nextId(),
        file,
        type,
        category,
        status: 'queued',
        progress: 0,
        error: null,
      };
      if (maxMb && file.size > maxMb * 1024 * 1024) {
        item.status = 'error';
        item.error = `Exceeds the ${maxMb} MB limit for ${category}.`;
      }
      next.push(item);
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function setCategoryFor(id: string, category: MediaCategory) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, category } : i)));
  }

  function removeItem(id: string) {
    aborts.current.get(id)?.abort();
    aborts.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function uploadOne(item: UploadItem): Promise<boolean> {
    const controller = new AbortController();
    aborts.current.set(item.id, controller);
    updateItem(item.id, { status: 'uploading', progress: 0, error: null });
    try {
      if (item.type === 'image') {
        await mediaService.uploadImage(
          item.file,
          { category: item.category },
          (p) => updateItem(item.id, { progress: p }),
          controller.signal
        );
      } else {
        const init = await mediaService.initiateUpload({
          mediaType: item.type,
          category: item.category,
          originalFileName: item.file.name,
          mimeType: item.file.type,
          sizeBytes: item.file.size,
        });
        if (!init.uploadToken) throw new Error('Upload session did not return a token.');
        updateItem(item.id, { status: 'confirming', progress: 100 });
        await mediaService.uploadContent(init.uploadId, init.uploadToken, item.file, (p) =>
          updateItem(item.id, { status: 'uploading', progress: p })
        );
        await mediaService.confirmUpload({ uploadId: init.uploadId, provider: 'local' });
      }
      updateItem(item.id, { status: 'done', progress: 100 });
      return true;
    } catch (e) {
      const { message } = normalizeApiError(e);
      const cancelled = controller.signal.aborted;
      updateItem(item.id, { status: cancelled ? 'cancelled' : 'error', error: cancelled ? null : message });
      return false;
    } finally {
      aborts.current.delete(item.id);
    }
  }

  async function startAll() {
    if (running.current) return;
    const pending = items.filter((i) => i.status === 'queued' || i.status === 'error' || i.status === 'cancelled');
    if (!pending.length) return;
    running.current = true;
    // Sequential uploads keep VPS/Cloudinary load predictable and progress readable.
    let done = 0;
    for (const item of pending) {
      if (await uploadOne(item)) done += 1;
    }
    running.current = false;
    void queryClient.invalidateQueries({ queryKey: queryKeys.media.all });
    if (done > 0) {
      toast.success(`${done} file${done === 1 ? '' : 's'} uploaded`, 'Media Library updated.');
      onDone();
    }
  }

  const busy = items.some((i) => i.status === 'uploading' || i.status === 'confirming');
  const doneCount = items.filter((i) => i.status === 'done').length;
  const pendingCount = items.filter((i) => i.status === 'queued' || i.status === 'error' || i.status === 'cancelled').length;

  const TypeIcon = (type: MediaType) =>
    type === 'image' ? <ImageIcon className="size-4" aria-hidden /> : type === 'video' ? <Film className="size-4" aria-hidden /> : <FileText className="size-4" aria-hidden />;

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      size="lg"
      title="Upload Media"
      description="Images go to Cloudinary; videos and documents are stored on the VPS. Backend validation rules apply."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {doneCount > 0 ? 'Done' : 'Cancel'}
          </Button>
          <Button onClick={() => void startAll()} disabled={!pendingCount || busy} loading={busy}>
            <CloudUpload className="size-4" aria-hidden />
            {pendingCount ? `Upload ${pendingCount} file${pendingCount === 1 ? '' : 's'}` : 'All uploaded'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'relative flex min-h-40 flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-dashed p-6 text-center transition',
            dragging ? 'border-primary bg-primary/5' : 'border-field-border bg-surface-2/40'
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CloudUpload className="size-6" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Drag & drop files here</p>
            <p className="mt-0.5 text-xs text-ink-muted">Images, videos and documents · multiple files allowed</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
            Browse files
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            aria-label="Choose media files"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {fileError ? (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {fileError}
          </p>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={<CloudUpload className="size-5" aria-hidden />}
            title="No files selected"
            description="Add files to upload them to the Media Library."
          />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const options = compatibleCategories(item.type);
              return (
                <li key={item.id} className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-muted">
                      {TypeIcon(item.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <p className="text-[11px] text-ink-subtle">
                        {formatBytes(item.file.size)} · {item.type}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {item.status === 'done' ? <CheckCircle2 className="size-4 text-success" aria-label="Uploaded" /> : null}
                      {item.status === 'error' ? <AlertCircle className="size-4 text-danger" aria-label="Failed" /> : null}
                      {item.status === 'uploading' || item.status === 'confirming' ? <Loader2 className="size-4 animate-spin text-primary" aria-label="Uploading" /> : null}
                      {item.status === 'queued' || item.status === 'error' || item.status === 'cancelled' ? (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded-md p-1 text-ink-subtle hover:bg-surface-2 hover:text-ink"
                          aria-label={`Remove ${item.file.name}`}
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-12">
                    <Select
                      value={item.category}
                      onChange={(e) => setCategoryFor(item.id, e.target.value as MediaCategory)}
                      disabled={item.status === 'uploading' || item.status === 'confirming' || item.status === 'done'}
                      aria-label={`Category for ${item.file.name}`}
                      className="h-8 w-48 text-xs"
                    >
                      {options.map((c) => (
                        <option key={c.category} value={c.category}>
                          {String(c.category).replace(/_/g, ' ')}
                        </option>
                      ))}
                    </Select>
                    {item.status === 'error' || item.status === 'cancelled' ? (
                      <Button size="sm" variant="secondary" onClick={() => void uploadOne(item)}>
                        <RotateCcw className="size-3.5" aria-hidden />
                        Retry
                      </Button>
                    ) : null}
                    {item.status === 'uploading' || item.status === 'confirming' ? (
                      <Button size="sm" variant="ghost" onClick={() => aborts.current.get(item.id)?.abort()}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                  {item.status === 'uploading' || item.status === 'confirming' ? (
                    <div className="mt-2 pl-12" aria-live="polite">
                      <div className="mb-1 flex justify-between text-[11px] text-ink-muted">
                        <span>{item.status === 'confirming' ? 'Confirming upload…' : 'Uploading…'}</span>
                        <span>{item.progress}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  ) : null}
                  {item.error ? (
                    <p className="mt-2 pl-12 text-[11px] text-danger" role="alert">
                      {item.error}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
