'use client';

import { Check, CloudUpload, ImageIcon, Images, Search } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import { IMAGE_MIME_TYPES, type CourseImageCategory, type MediaAsset } from '@/types/media';
import { mediaPolicy, useMediaImages, useUploadImage } from '../hooks';

/** Backend default IMAGE_MAX_SIZE_MB; the server re-validates and reports its own limit. */
const MAX_IMAGE_MB = 10;
const PAGE_SIZE = 18;

type Tab = 'library' | 'upload';

interface MediaPickerDialogProps {
  title: string;
  category: CourseImageCategory;
  courseId?: string;
  multiple?: boolean;
  /** Hard cap for multi-select (e.g. remaining gallery slots). */
  max?: number;
  initialTab?: Tab;
  onClose: () => void;
  onSelect: (media: MediaAsset[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPickerDialog({ title, category, courseId, multiple = false, max = 20, initialTab, onClose, onSelect }: MediaPickerDialogProps) {
  const { user } = useAuth();
  const toast = useToast();
  const canBrowse = mediaPolicy.canBrowse(user);
  const canUpload = mediaPolicy.canUpload(user);
  const [tab, setTab] = useState<Tab>(initialTab ?? (canBrowse ? 'library' : 'upload'));
  const [search, setSearch] = useState('');
  const [onlyCategory, setOnlyCategory] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaAsset[]>([]);
  const debounced = useDebouncedValue(search.trim(), 400);
  const images = useMediaImages(
    { page, limit: PAGE_SIZE, search: debounced || undefined, category: onlyCategory ? category : undefined },
    canBrowse && tab === 'library'
  );

  const upload = useUploadImage();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function toggle(media: MediaAsset) {
    if (!multiple) {
      setSelected([media]);
      return;
    }
    setSelected((s) => (s.some((m) => m.id === media.id) ? s.filter((m) => m.id !== media.id) : s.length >= max ? s : [...s, media]));
  }

  function chooseFile(next: File | undefined) {
    setFileError(null);
    setProgress(0);
    if (!next) return;
    if (!(IMAGE_MIME_TYPES as readonly string[]).includes(next.type)) {
      setFileError('Use a JPG, PNG, WebP or AVIF image (SVG is not allowed).');
      return;
    }
    if (next.size > MAX_IMAGE_MB * 1024 * 1024) {
      setFileError(`Images must be ${MAX_IMAGE_MB} MB or smaller.`);
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  function startUpload() {
    if (!file || inFlight.current) return;
    inFlight.current = true;
    upload.mutate(
      { file, category, courseId, onProgress: setProgress },
      {
        onSuccess: (media) => {
          toast.success('Image uploaded to Cloudinary', media.originalFileName);
          if (multiple) {
            setSelected((s) => (s.length >= max ? s : [...s, media]));
            setFile(null);
            setPreview(null);
            setTab('library');
          } else {
            onSelect([media]);
            onClose();
          }
        },
        onError: (error) => {
          const { message } = normalizeApiError(error);
          setFileError(message);
          toast.error('Upload failed', message);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  const list = images.data?.media ?? [];
  const selectedIds = new Set(selected.map((m) => m.id));

  return (
    <Dialog
      open
      onClose={onClose}
      busy={upload.isPending}
      size="xl"
      title={title}
      description={category === 'course_thumbnail' ? 'Pick an existing image or upload a new one to Cloudinary. A 16:9 image works best.' : 'Select one or more images for the course gallery.'}
      toolbar={
        <div role="tablist" aria-label="Image source" className="inline-flex rounded-xl border border-line bg-surface-2/60 p-1">
          {canBrowse ? (
            <button type="button" role="tab" aria-selected={tab === 'library'} onClick={() => setTab('library')} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition', tab === 'library' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}>
              <Images className="size-4" aria-hidden />
              Media library
            </button>
          ) : null}
          {canUpload ? (
            <button type="button" role="tab" aria-selected={tab === 'upload'} onClick={() => setTab('upload')} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition', tab === 'upload' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}>
              <CloudUpload className="size-4" aria-hidden />
              Upload new
            </button>
          ) : null}
        </div>
      }
      footer={
        tab === 'library' ? (
          <>
            <p className="mr-auto self-center text-xs text-ink-muted">{selected.length ? `${selected.length} selected` : multiple ? `Select up to ${max}` : 'Select an image'}</p>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!selected.length}
              onClick={() => {
                onSelect(selected);
                onClose();
              }}
            >
              {!multiple ? 'Use image' : selected.length ? `Add ${selected.length} image${selected.length === 1 ? '' : 's'}` : 'Add images'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={upload.isPending}>
              Cancel
            </Button>
            <Button onClick={startUpload} disabled={!file} loading={upload.isPending}>
              <CloudUpload className="size-4" aria-hidden />
              Upload to Cloudinary
            </Button>
          </>
        )
      }
    >
      {!canBrowse && !canUpload ? (
        <EmptyState title="No media access" description="Your role needs media.read to browse or media.upload to upload images." />
      ) : tab === 'library' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by file name or title"
                className="pl-9"
                aria-label="Search images"
              />
            </div>
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={onlyCategory}
                onChange={(e) => {
                  setOnlyCategory(e.target.checked);
                  setPage(1);
                }}
                className="size-3.5 accent-primary"
              />
              Only {category === 'course_thumbnail' ? 'thumbnails' : 'gallery images'}
            </label>
          </div>
          {images.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-full rounded-xl" />
              ))}
            </div>
          ) : images.isError ? (
            <ErrorState error={images.error} onRetry={() => images.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<ImageIcon className="size-5" aria-hidden />}
              title={debounced ? 'No images match this search' : 'No images yet'}
              description={canUpload ? 'Upload a new image to Cloudinary from the “Upload new” tab.' : undefined}
              action={
                canUpload ? (
                  <Button size="sm" onClick={() => setTab('upload')}>
                    <CloudUpload className="size-4" aria-hidden />
                    Upload new
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', images.isPlaceholderData && 'opacity-60')}>
              {list.map((m) => {
                const on = selectedIds.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggle(m)}
                      aria-pressed={on}
                      className={cn(
                        'group relative block w-full overflow-hidden rounded-xl border bg-surface-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                        on ? 'border-primary ring-2 ring-primary/40' : 'border-line hover:border-field-border-hover'
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL */}
                      <img src={m.secureUrl} alt={m.altText || m.title} className="aspect-video w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" />
                      <span className="block truncate px-2 py-1.5 text-[11px] text-ink-muted">
                        {m.originalFileName}
                        {m.width && m.height ? ` · ${m.width}×${m.height}` : ''}
                      </span>
                      {on ? (
                        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-fg shadow">
                          <Check className="size-3.5" aria-hidden />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination meta={images.data?.pagination} onPageChange={setPage} disabled={images.isFetching} />
        </div>
      ) : (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'relative flex min-h-64 flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border-2 border-dashed p-6 text-center transition',
              dragging ? 'border-primary bg-primary/5' : 'border-field-border bg-surface-2/40'
            )}
          >
            {preview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={preview} alt="Selected file preview" className="max-h-64 rounded-xl object-contain shadow-sm" />
                <p className="text-xs text-ink-muted">
                  {file?.name} · {file ? formatBytes(file.size) : ''}
                </p>
                <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
                  Choose a different file
                </Button>
              </>
            ) : (
              <>
                <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CloudUpload className="size-6" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Drag & drop an image here</p>
                  <p className="mt-0.5 text-xs text-ink-muted">JPG, PNG, WebP or AVIF · up to {MAX_IMAGE_MB} MB</p>
                </div>
                <Button size="sm" onClick={() => inputRef.current?.click()}>
                  Browse files
                </Button>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={IMAGE_MIME_TYPES.join(',')}
              className="sr-only"
              aria-label="Choose image file"
              onChange={(e) => {
                chooseFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {upload.isPending ? (
            <div aria-live="polite">
              <div className="mb-1 flex justify-between text-xs text-ink-muted">
                <span>Uploading to Cloudinary…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
          {fileError ? (
            <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
              {fileError}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
