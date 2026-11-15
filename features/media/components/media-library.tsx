'use client';

import {
  CloudUpload,
  FileText,
  Film,
  Grid3X3,
  ImageIcon,
  Images,
  List,
  Play,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { KpiCard, type KpiTone } from '@/components/ui/kpi-card';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative, titleCase } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { mediaService } from '@/services/media.service';
import type { CourseVideo, CourseVideoListParams, MediaAsset, MediaListParams, MediaType } from '@/types/media';
import {
  DeletedBadge,
  formatBytes,
  formatDuration,
  MediaThumb,
  MediaTypeBadge,
  ProviderBadge,
  StatusBadge,
  UsageBadge,
} from '../display';
import { mediaPolicy, useCourseVideos, useMediaCategories, useMediaList, useMediaStorage, useMediaUsageMap } from '../hooks';
import { MediaDetailsDrawer } from './media-details-drawer';
import { MediaUploadDialog } from './media-upload-dialog';

const PAGE_SIZES = [12, 24, 48];
const UNUSED_SCAN_PAGES = 3;
const UNUSED_SCAN_LIMIT = 100;

const QUICK_FILTERS = [
  { key: 'all', label: 'All Media' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'courseVideos', label: 'Course Videos' },
  { key: 'document', label: 'Documents' },
  { key: 'unused', label: 'Unused Media' },
  { key: 'recent', label: 'Recently Uploaded' },
  { key: 'deleted', label: 'Deleted Media' },
] as const;
type QuickFilter = (typeof QUICK_FILTERS)[number]['key'];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'title:asc', label: 'File name' },
  { value: 'sizeBytes:desc', label: 'Largest size' },
  { value: 'sizeBytes:asc', label: 'Smallest size' },
] as const;

const STAT_META: { key: 'total' | MediaType; label: string; hint: string; icon: typeof Images; tone: KpiTone }[] = [
  { key: 'total', label: 'Total Assets', hint: 'All non-deleted media', icon: Images, tone: 'purple' },
  { key: 'image', label: 'Images', hint: 'Cloudinary + local', icon: ImageIcon, tone: 'sky' },
  { key: 'video', label: 'Videos', hint: 'Local VPS storage', icon: Film, tone: 'teal' },
  { key: 'document', label: 'Documents', hint: 'Local VPS storage', icon: FileText, tone: 'amber' },
];

/** Counts from list pagination totals (no aggregate endpoint exists). */
function useMediaStats() {
  const results = useQueries({
    queries: STAT_META.map((s) => ({
      queryKey: [...queryKeys.media.all, 'stat', s.key],
      queryFn: () => dashboardService.count('/admin/media', s.key === 'total' ? {} : { mediaType: s.key }),
    })),
  });
  return STAT_META.reduce(
    (acc, s, i) => {
      acc[s.key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<string, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

/**
 * Unused-media scan: loads up to UNUSED_SCAN_PAGES pages of assets, fetches
 * references for each, and keeps only assets with zero references.
 * Client-side because the list API has no usage filter.
 */
function useUnusedMedia(page: number, limit: number, enabled: boolean) {
  const scan = useQuery({
    queryKey: [...queryKeys.media.all, 'unused-scan'],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const first = await mediaService.list({ page: 1, limit: UNUSED_SCAN_LIMIT, includeDeleted: false });
      const all = [...first.media];
      const totalPages = Math.min(first.pagination.totalPages, UNUSED_SCAN_PAGES);
      for (let p = 2; p <= totalPages; p += 1) {
        const res = await mediaService.list({ page: p, limit: UNUSED_SCAN_LIMIT, includeDeleted: false });
        all.push(...res.media);
      }
      return { assets: all, truncated: first.pagination.totalPages > UNUSED_SCAN_PAGES };
    },
  });

  // Lesson videos are inherently used by their lesson — never "unused".
  const assets = useMemo(() => (scan.data?.assets ?? []).filter((a) => a.source !== 'lesson_video'), [scan.data]);
  const refs = useQueries({
    queries: assets.map((a) => ({
      queryKey: queryKeys.media.references(a.id),
      queryFn: () => mediaService.references(a.id),
      enabled: enabled && scan.isSuccess,
      staleTime: 60_000,
      retry: 1,
    })),
  });

  const unused = useMemo(() => {
    if (!scan.isSuccess) return [];
    return assets.filter((_, i) => {
      const r = refs[i];
      return r?.isSuccess && r.data.references.total === 0;
    });
  }, [scan.isSuccess, assets, refs]);

  const loading = scan.isPending || (scan.isSuccess && refs.some((r) => r.isPending));
  const total = unused.length;
  const start = (page - 1) * limit;
  const pageAssets = useMemo(() => unused.slice(start, start + limit), [unused, start, limit]);
  return {
    assets: pageAssets,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    isPending: loading,
    isError: scan.isError,
    error: scan.error,
    refetch: scan.refetch,
    truncated: scan.data?.truncated ?? false,
    scanned: assets.length,
  };
}

/** Lesson videos merged into All Media come from CourseLesson, not MediaAsset. */
function isLessonVideoAsset(a: MediaAsset): boolean {
  return a.source === 'lesson_video' && Boolean(a.playback?.lessonId);
}

/** Map a Course Videos tab item to the MediaAsset shape the details drawer expects. */
function courseVideoToAsset(v: CourseVideo): MediaAsset {
  return {
    id: v.id,
    title: v.title,
    description: v.description ?? '',
    altText: v.altText ?? '',
    originalFileName: v.originalFileName,
    storedFileName: null,
    mediaType: 'video',
    category: v.category,
    storageProvider: v.storageProvider,
    mimeType: v.mimeType,
    extension: v.extension,
    sizeBytes: v.sizeBytes,
    width: v.width,
    height: v.height,
    durationSeconds: v.durationSeconds,
    checksum: null,
    processingStatus: v.processingStatus,
    visibility: v.visibility,
    downloadAllowed: false,
    ownerId: null,
    courseId: v.courseId,
    lessonId: v.lessonId,
    resourceId: null,
    uploadedBy: null,
    lastAccessedAt: null,
    deletedAt: null,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    source: 'lesson_video',
    courseName: v.courseName,
    courseSlug: v.courseSlug,
    topicId: v.topicId,
    topicName: v.topicName,
    lessonTitle: v.lessonTitle,
    lessonStatus: v.lessonStatus,
    isPreview: v.isPreview,
    hasHls: v.hasHls,
    playback: v.playback,
  };
}

export function MediaLibrary() {
  const { user } = useAuth();
  const canUpload = mediaPolicy.canUpload(user);
  const canRefs = mediaPolicy.canReadReferences(user);

  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('');
  const [sort, setSort] = useState<string>('createdAt:desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<MediaAsset | null>(null);

  const stats = useMediaStats();
  const storage = useMediaStorage(mediaPolicy.canReadStorage(user));
  const categories = useMediaCategories();
  const debounced = useDebouncedValue(search.trim(), 400);

  const [sortBy, sortOrder] = sort.split(':') as [MediaListParams['sortBy'], MediaListParams['sortOrder']];

  const isUnused = quick === 'unused';
  const isDeleted = quick === 'deleted';
  const isCourseVideos = quick === 'courseVideos';

  const params: MediaListParams = {
    page,
    limit,
    search: debounced || undefined,
    mediaType: quick === 'image' || quick === 'video' || quick === 'document' ? quick : undefined,
    category: (category || undefined) as MediaListParams['category'],
    storageProvider: (provider || undefined) as MediaListParams['storageProvider'],
    processingStatus: (status || undefined) as MediaListParams['processingStatus'],
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortBy,
    sortOrder,
    includeDeleted: isDeleted || undefined,
  };

  const list = useMediaList(params, !isUnused && !isCourseVideos);
  const unused = useUnusedMedia(page, limit, isUnused);

  // Course videos live on CourseLesson.content.video (not MediaAsset) — separate endpoint.
  const cvSortBy = (sortBy === 'originalFileName' ? 'title' : sortBy) as CourseVideoListParams['sortBy'];
  const courseVideos = useCourseVideos(
    {
      page,
      limit,
      search: debounced || undefined,
      processingStatus: (status || undefined) as CourseVideoListParams['processingStatus'],
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      sortBy: cvSortBy,
      sortOrder,
    },
    isCourseVideos
  );

  // Client-side access-mode filter (no backend param) on the fetched page.
  const pageAssets = useMemo(
    () => (isUnused ? unused.assets : (list.data?.media ?? [])),
    [isUnused, unused.assets, list.data?.media]
  );
  const assets = useMemo(
    () => (visibility ? pageAssets.filter((a) => a.visibility === visibility) : pageAssets),
    [pageAssets, visibility]
  );
  const usage = useMediaUsageMap(assets, canRefs && !isDeleted);

  const isPending = isCourseVideos ? courseVideos.isPending : isUnused ? unused.isPending : list.isPending;
  const isError = isCourseVideos ? courseVideos.isError : isUnused ? unused.isError : list.isError;
  const error = isCourseVideos ? courseVideos.error : isUnused ? unused.error : list.error;
  const pagination = isCourseVideos ? courseVideos.data?.pagination : isUnused ? unused.pagination : list.data?.pagination;

  // Keep the last non-empty result set rendered (dimmed) while a refetch/mode switch is
  // pending, so the layout height never collapses and the page does not jump-scroll.
  const [lastAssets, setLastAssets] = useState<MediaAsset[]>([]);
  if (!isPending && !isError && assets.length > 0 && assets !== lastAssets) {
    setLastAssets(assets);
  }
  const shownAssets = isPending && assets.length === 0 ? lastAssets : assets;
  const showSkeleton = isPending && shownAssets.length === 0;

  const filtered = Boolean(debounced || quick !== 'all' || category || provider || status || visibility || startDate || endDate);

  function applyQuick(key: QuickFilter) {
    setQuick(key);
    setPage(1);
  }

  function clearAll() {
    setSearch('');
    setQuick('all');
    setCategory('');
    setProvider('');
    setStatus('');
    setVisibility('');
    setStartDate('');
    setEndDate('');
    setSort('createdAt:desc');
    setPage(1);
  }

  const storageUsed = storage.data ? storage.data.totals.localBytes + storage.data.totals.cloudinaryBytes : null;

  const menuFor = (a: MediaAsset): MenuItem[] => [
    { key: 'view', label: 'View details', icon: <ImageIcon className="size-4" />, onSelect: () => setSelected(a) },
    ...(a.deletedAt || isLessonVideoAsset(a)
      ? []
      : [{ key: 'delete', label: 'Delete…', icon: <Trash2 className="size-4" />, tone: 'danger' as const, onSelect: () => setSelected(a) }]),
  ];

  return (
    <>
      <PageHeader
        title="Media Library"
        description="Manage all images, videos and documents across SkillBee."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canUpload ? (
              <Button onClick={() => setUploadOpen(true)}>
                <CloudUpload className="size-4" aria-hidden />
                Upload Media
              </Button>
            ) : null}
            <RefreshButton queryKeys={[queryKeys.media.all]} />
          </div>
        }
      />

      <section aria-label="Media overview" className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {STAT_META.map((s) => {
          const Icon = s.icon;
          return (
            <KpiCard
              key={s.key}
              label={s.label}
              hint={s.hint}
              icon={Icon}
              tone={s.tone}
              value={stats[s.key]?.value ?? null}
              isLoading={stats[s.key]?.isLoading}
              error={stats[s.key]?.error}
            />
          );
        })}
        <KpiCard
          label="Storage Used"
          hint="Local VPS + Cloudinary"
          icon={Images}
          tone="slate"
          value={storageUsed !== null ? formatBytes(storageUsed) : null}
          isLoading={storage.isPending}
          error={storage.error}
        />
        <KpiCard
          label="Unused Assets"
          hint="No references found"
          icon={Trash2}
          tone="coral"
          value={null}
          unavailable="Per-asset scan"
        />
      </section>

      {storage.data ? (
        <Card className="mb-6 min-w-0">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Storage overview</h2>
              <p className="text-xs text-ink-muted">
                {formatBytes(storage.data.totals.localBytes)} on VPS · {formatBytes(storage.data.totals.cloudinaryBytes)} on Cloudinary
                {storage.data.server.usagePercent !== null ? ` · disk ${storage.data.server.usagePercent}% used` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
              <span>{storage.data.localMedia.videos.count} videos · {formatBytes(storage.data.localMedia.videos.totalBytes)}</span>
              <span>{storage.data.localMedia.documents.count} documents · {formatBytes(storage.data.localMedia.documents.totalBytes)}</span>
              <span>{storage.data.cloudinary.images.count} images · {formatBytes(storage.data.cloudinary.images.totalBytes)}</span>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Quick filters">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={quick === f.key}
                onClick={() => applyQuick(f.key)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs',
                  quick === f.key ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/25' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full min-w-0 sm:w-64 lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search name, title or asset ID"
                className="pl-9"
                aria-label="Search media"
              />
            </div>
            {!isCourseVideos ? (
              <>
                <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Filter by category" className="w-full sm:w-auto lg:w-44">
                  <option value="">Any category</option>
                  {(categories.data ?? []).map((c) => (
                    <option key={c.category} value={c.category}>{titleCase(String(c.category))}</option>
                  ))}
                </Select>
                <Select value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} aria-label="Filter by storage provider" className="w-full sm:w-auto lg:w-40">
                  <option value="">Any provider</option>
                  <option value="cloudinary">Cloudinary</option>
                  <option value="local">VPS (local)</option>
                </Select>
              </>
            ) : null}
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by processing status" className="w-full sm:w-auto lg:w-40">
              <option value="">Any status</option>
              <option value="ready">Ready</option>
              <option value="pending">Pending</option>
              <option value="uploading">Uploading</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </Select>
            {!isCourseVideos ? (
              <Select value={visibility} onChange={(e) => { setVisibility(e.target.value); setPage(1); }} aria-label="Filter by access mode" className="w-full sm:w-auto lg:w-36" title="Access filter applies to the loaded page">
                <option value="">Any access</option>
                <option value="public">Public</option>
                <option value="protected">Protected</option>
                <option value="private">Private</option>
              </Select>
            ) : null}
            <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort media" className="w-full sm:w-auto lg:w-40">
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} aria-label="Uploaded from" className="w-full sm:w-auto lg:w-40" />
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} aria-label="Uploaded to" className="w-full sm:w-auto lg:w-40" />
            {filtered ? (
              <Button variant="ghost" onClick={clearAll} className="shrink-0">
                <X className="size-4" aria-hidden />
                Clear
              </Button>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-line p-1">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
                className={cn('rounded-md p-1.5', view === 'grid' ? 'bg-surface-2 text-ink' : 'text-ink-subtle hover:text-ink')}
              >
                <Grid3X3 className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-label="List view"
                aria-pressed={view === 'list'}
                className={cn('rounded-md p-1.5', view === 'list' ? 'bg-surface-2 text-ink' : 'text-ink-subtle hover:text-ink')}
              >
                <List className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          {isUnused ? (
            <p className="text-[11px] text-ink-subtle">
              Unused scan checks up to {UNUSED_SCAN_PAGES * UNUSED_SCAN_LIMIT} assets{unused.truncated ? ' (library is larger — older assets are not scanned)' : ''}.
            </p>
          ) : null}
          {isCourseVideos ? (
            <p className="text-[11px] text-ink-subtle">
              Course videos are stored with their lessons and play through the secure signed playback flow.
            </p>
          ) : null}
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={() => (isCourseVideos ? courseVideos.refetch() : isUnused ? unused.refetch() : list.refetch())} />
        ) : isCourseVideos ? (
          courseVideos.isPending ? (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-full rounded-xl" />
              ))}
            </div>
          ) : (courseVideos.data?.videos.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Film className="size-5" aria-hidden />}
              title={filtered ? 'No course videos match these filters' : 'No course videos yet'}
              description={filtered ? 'Try another search or clear the filters.' : 'Lesson videos uploaded to courses will appear here.'}
              action={filtered ? <Button size="sm" variant="secondary" onClick={clearAll}>Clear filters</Button> : undefined}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {(courseVideos.data?.videos ?? []).map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(courseVideoToAsset(v))}
                    className="group block w-full overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:border-field-border-hover hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <span className="relative block aspect-video w-full bg-surface-2">
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex size-12 items-center justify-center rounded-full bg-primary/90 text-white shadow-lg transition group-hover:scale-105">
                          <Play className="size-5 fill-current" aria-hidden />
                        </span>
                      </span>
                      <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Lesson video
                      </span>
                      {v.processingStatus !== 'ready' ? (
                        <span className="absolute right-2 top-2 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {titleCase(String(v.processingStatus))}
                        </span>
                      ) : null}
                    </span>
                    <span className="block space-y-1.5 px-2.5 py-2">
                      <span className="block truncate text-xs font-medium text-ink group-hover:text-primary" title={v.lessonTitle}>
                        {v.lessonTitle}
                      </span>
                      <span className="block truncate text-[11px] text-ink-subtle" title={v.courseName ?? undefined}>
                        {v.courseName ?? 'Unknown course'}
                      </span>
                      {v.topicName ? (
                        <span className="block truncate text-[11px] text-ink-subtle" title={v.topicName}>
                          {v.topicName}
                        </span>
                      ) : null}
                      <span className="flex items-center justify-between text-[11px] text-ink-muted">
                        <span>{formatBytes(v.sizeBytes)}</span>
                        <span>{formatDate(v.createdAt)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-1">
                        <ProviderBadge provider={v.storageProvider} />
                        <span className="text-[11px] text-ink-subtle">{formatDuration(v.durationSeconds)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : showSkeleton ? (
          view === 'grid' ? (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )
        ) : shownAssets.length === 0 ? (
          <EmptyState
            icon={<Images className="size-5" aria-hidden />}
            title={filtered ? 'No media matches these filters' : 'No media yet'}
            description={
              isUnused
                ? 'Every scanned asset has at least one reference.'
                : filtered
                  ? 'Try another search or clear the filters.'
                  : 'Upload images, videos or documents to get started.'
            }
            action={
              filtered ? (
                <Button size="sm" variant="secondary" onClick={clearAll}>Clear filters</Button>
              ) : canUpload ? (
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <CloudUpload className="size-4" aria-hidden />
                  Upload Media
                </Button>
              ) : undefined
            }
          />
        ) : view === 'grid' ? (
          <ul className={cn('grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6', isPending && 'opacity-60')}>
            {shownAssets.map((a) => {
              const usageInfo = usage.get(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(a)}
                    className="group block w-full overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:border-field-border-hover hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <MediaThumb asset={a} className="aspect-video w-full" />
                    <span className="block space-y-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2">
                      <span className="block truncate text-xs font-medium text-ink group-hover:text-primary" title={a.originalFileName}>
                        {a.originalFileName}
                      </span>
                      <span className="flex flex-wrap items-center gap-1">
                        <MediaTypeBadge type={a.mediaType} />
                        {isLessonVideoAsset(a) ? (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Lesson</span>
                        ) : null}
                        {a.deletedAt ? <DeletedBadge /> : null}
                      </span>
                      <span className="flex items-center justify-between text-[11px] text-ink-muted">
                        <span>{formatBytes(a.sizeBytes)}</span>
                        <span>{formatDate(a.createdAt)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-1">
                        <ProviderBadge provider={a.storageProvider} />
                        <UsageBadge total={usageInfo?.total ?? null} error={usageInfo?.error ?? false} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                <tr>
                  <th scope="col" className="py-2.5 pl-5 pr-3 w-16">Preview</th>
                  <th scope="col" className="px-3 py-2.5">File Name</th>
                  <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Type</th>
                  <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Category</th>
                  <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Size</th>
                  <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Provider</th>
                  <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Uploaded</th>
                  <th scope="col" className="px-3 py-2.5">Used In</th>
                  <th scope="col" className="px-3 py-2.5">Status</th>
                  <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className={cn('divide-y divide-line', isPending && 'opacity-60')}>
                {shownAssets.map((a) => {
                  const usageInfo = usage.get(a.id);
                  return (
                    <tr key={a.id} className="group align-middle transition-colors hover:bg-surface-2/50">
                      <td className="py-2.5 pl-5 pr-3">
                        <MediaThumb asset={a} className="h-10 w-16 rounded-md" />
                      </td>
                      <td className="w-full min-w-48 max-w-0 px-3 py-2.5">
                        <button type="button" onClick={() => setSelected(a)} className="block text-left">
                          <span className="flex items-center gap-1.5 font-medium text-ink group-hover:text-primary">
                            <span className="line-clamp-1">{a.originalFileName}</span>
                            {a.deletedAt ? <DeletedBadge /> : null}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-ink-subtle">
                            {a.mimeType}{a.extension ? ` · .${a.extension}` : ''}
                          </span>
                        </button>
                      </td>
                      <td className="hidden w-px px-3 py-2.5 md:table-cell"><MediaTypeBadge type={a.mediaType} /></td>
                      <td className="hidden w-px px-3 py-2.5 text-xs text-ink-muted lg:table-cell">{titleCase(String(a.category))}</td>
                      <td className="hidden w-px whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-ink-muted lg:table-cell">{formatBytes(a.sizeBytes)}</td>
                      <td className="hidden w-px px-3 py-2.5 xl:table-cell"><ProviderBadge provider={a.storageProvider} /></td>
                      <td className="hidden w-px whitespace-nowrap px-3 py-2.5 text-xs text-ink-muted xl:table-cell" title={formatDate(a.createdAt)}>
                        {formatDate(a.createdAt)}
                        <span className="block text-[11px] text-ink-subtle">{formatRelative(a.createdAt)}</span>
                      </td>
                      <td className="w-px px-3 py-2.5"><UsageBadge total={usageInfo?.total ?? null} error={usageInfo?.error ?? false} /></td>
                      <td className="w-px px-3 py-2.5"><StatusBadge status={a.processingStatus} /></td>
                      <td className="w-px py-2 pl-3 pr-5 text-right">
                        <ActionMenu label={`Actions for ${a.originalFileName}`} items={menuFor(a)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          meta={pagination}
          onPageChange={setPage}
          disabled={isPending || (isUnused ? false : list.isFetching)}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={(size) => { setLimit(size); setPage(1); }}
        />
      </Card>

      {uploadOpen ? <MediaUploadDialog onClose={() => setUploadOpen(false)} onDone={() => { setPage(1); setQuick('all'); }} /> : null}
      {selected ? (
        <MediaDetailsDrawer
          asset={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
