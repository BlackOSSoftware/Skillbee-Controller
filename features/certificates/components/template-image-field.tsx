'use client';

import { ImagePlus, ImageOff, RefreshCw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import type { MediaRef } from '@/types/certificates';
import { IMAGE_MIME_TYPES } from '@/types/media';
import { useUploadTemplateImage } from '../hooks';

/** Backend default IMAGE_MAX_SIZE_MB; the server re-validates and reports its own limit. */
const MAX_IMAGE_MB = 10;

export const isImageSet = (ref: MediaRef | null | undefined) => Boolean(ref?.mediaAssetId || ref?.storageKey || ref?.url);

interface TemplateImageFieldProps {
  id: string;
  label: string;
  hint: string;
  value: MediaRef | null;
  onChange: (value: MediaRef | null) => void;
  /** Thumbnail box shape, e.g. wide for backgrounds. */
  aspect: 'wide' | 'square' | 'signature';
  onBusyChange?: (busy: boolean) => void;
}

export function TemplateImageField({ id, label, hint, value, onChange, aspect, onBusyChange }: TemplateImageFieldProps) {
  const upload = useUploadTemplateImage();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = isImageSet(value);

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError('Use a JPG, PNG, WebP or AVIF image.');
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`Images must be ${MAX_IMAGE_MB} MB or smaller.`);
      return;
    }
    setProgress(0);
    onBusyChange?.(true);
    upload.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: (asset) => onChange({ mediaAssetId: asset.id, url: asset.secureUrl ?? null, originalFileName: asset.originalFileName || file.name, storageKey: null }),
        onError: (e) => setError(normalizeApiError(e).message),
        onSettled: () => {
          setProgress(null);
          onBusyChange?.(false);
          if (input.current) input.current.value = '';
        },
      }
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line p-3">
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-line bg-surface-2',
          aspect === 'wide' ? 'h-14 w-20' : aspect === 'signature' ? 'h-12 w-24' : 'size-14'
        )}
      >
        {value?.url ? (
          // Cloudinary delivery URL from the media library (public CDN, not server storage).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt={`${label} preview`} className={cn('size-full', aspect === 'wide' ? 'object-cover' : 'object-contain p-1')} />
        ) : set ? (
          <span className="px-1 text-center text-[10px] text-ink-subtle">On server</span>
        ) : (
          <ImageOff className="size-4 text-ink-subtle" aria-hidden />
        )}
        {progress !== null ? (
          <span className="absolute inset-0 flex items-center justify-center bg-surface/80 text-[11px] font-medium tabular-nums text-ink">{progress}%</span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="truncate text-[11px] text-ink-subtle">{set ? value?.originalFileName || 'Image set' : hint}</p>
        {error ? (
          <p className="mt-0.5 text-[11px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <input
        ref={input}
        id={id}
        type="file"
        accept={IMAGE_MIME_TYPES.join(',')}
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
        aria-label={`Upload ${label.toLowerCase()}`}
      />
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="secondary" onClick={() => input.current?.click()} loading={upload.isPending}>
          {set ? <RefreshCw className="size-3.5" aria-hidden /> : <ImagePlus className="size-3.5" aria-hidden />}
          {set ? 'Replace' : 'Upload'}
        </Button>
        {set ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={upload.isPending}
            className="rounded-md p-1.5 text-ink-subtle hover:bg-danger/10 hover:text-danger disabled:opacity-40"
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
