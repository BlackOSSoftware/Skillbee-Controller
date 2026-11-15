import { FileText, Film, ImageIcon, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { titleCase } from '@/lib/format';
import type { MediaAsset, MediaType } from '@/types/media';

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const MEDIA_TYPE_META: Record<MediaType, { label: string; icon: LucideIcon; tone: BadgeTone }> = {
  image: { label: 'Image', icon: ImageIcon, tone: 'info' },
  video: { label: 'Video', icon: Film, tone: 'brand' },
  document: { label: 'Document', icon: FileText, tone: 'warning' },
};

export function MediaTypeBadge({ type }: { type: MediaType | string }) {
  const meta = MEDIA_TYPE_META[type as MediaType] ?? { label: titleCase(type), icon: FileText, tone: 'neutral' as BadgeTone };
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone}>
      <Icon className="mr-1 inline size-3" aria-hidden />
      {meta.label}
    </Badge>
  );
}

export function ProviderBadge({ provider }: { provider: string }) {
  return <Badge tone={provider === 'cloudinary' ? 'brand' : 'neutral'}>{provider === 'cloudinary' ? 'Cloudinary' : 'VPS'}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  if (status === 'ready') return <Badge tone="success">Ready</Badge>;
  if (status === 'failed') return <Badge tone="danger">Failed</Badge>;
  if (status === 'pending' || status === 'uploading' || status === 'processing') return <Badge tone="warning">{titleCase(status)}</Badge>;
  return <Badge tone="neutral">{titleCase(status)}</Badge>;
}

export function DeletedBadge() {
  return <Badge tone="danger">Deleted</Badge>;
}

/** USED / UNUSED / UNKNOWN usage badge; total null = still loading. */
export function UsageBadge({ total, error }: { total: number | null; error: boolean }) {
  if (error) return <Badge tone="warning">Unknown</Badge>;
  if (total === null) return <Badge tone="neutral">…</Badge>;
  if (total > 0) return <Badge tone="success">Used · {total}</Badge>;
  return <Badge tone="neutral">Unused</Badge>;
}

/**
 * Thumbnail/preview for grid and list. Images use the Cloudinary secureUrl;
 * videos/documents/local assets get a professional placeholder — never a broken img.
 */
export function MediaThumb({ asset, className }: { asset: MediaAsset; className?: string }) {
  const isImage = asset.mediaType === 'image' && asset.secureUrl;
  const Icon = MEDIA_TYPE_META[asset.mediaType as MediaType]?.icon ?? FileText;
  return (
    <span className={cn('relative flex shrink-0 items-center justify-center overflow-hidden bg-surface-2', className)}>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not optimizable by next/image
        <img src={asset.secureUrl} alt={asset.altText || asset.title} className="size-full object-cover" loading="lazy" />
      ) : (
        <span className="flex flex-col items-center gap-1 text-ink-subtle">
          <Icon className="size-6" aria-hidden />
          {asset.mediaType === 'video' && asset.durationSeconds ? (
            <span className="text-[10px] font-medium tabular-nums">{formatDuration(asset.durationSeconds)}</span>
          ) : null}
        </span>
      )}
      {asset.deletedAt ? (
        <span className="absolute inset-0 flex items-center justify-center bg-canvas/60">
          <Badge tone="danger">Deleted</Badge>
        </span>
      ) : null}
    </span>
  );
}
