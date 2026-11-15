import { FileText, FolderOpen, PlayCircle, Radio, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AttachmentVisibility, LessonStatus, LessonType, VideoProcessingStatus } from '@/types/curriculum';

export const LESSON_TYPE_META: Record<LessonType, { label: string; icon: LucideIcon; tone: string }> = {
  video: { label: 'Video', icon: PlayCircle, tone: 'text-indigo-600 dark:text-indigo-300' },
  text: { label: 'Text', icon: FileText, tone: 'text-teal-700 dark:text-teal-300' },
  live: { label: 'Live session', icon: Radio, tone: 'text-rose-600 dark:text-rose-300' },
  resource: { label: 'Resources', icon: FolderOpen, tone: 'text-amber-700 dark:text-amber-300' },
};

function Pill({ label, dot, text }: { label: string; dot: string; text: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium', text)}>
      <span className={cn('size-1.5 rounded-full', dot)} aria-hidden />
      {label}
    </span>
  );
}

const STATUS_STYLE: Record<LessonStatus, { label: string; dot: string; text: string }> = {
  draft: { label: 'Draft', dot: 'bg-warning', text: 'text-warning' },
  published: { label: 'Published', dot: 'bg-success', text: 'text-success' },
  archived: { label: 'Archived', dot: 'bg-ink-subtle', text: 'text-ink-subtle' },
};

export function LessonStatusBadge({ status }: { status: LessonStatus | string }) {
  return <Pill {...(STATUS_STYLE[status as LessonStatus] ?? STATUS_STYLE.draft)} />;
}

export function lessonStatusLabel(status: string): string {
  return STATUS_STYLE[status as LessonStatus]?.label ?? status;
}

const VIDEO_STYLE: Record<VideoProcessingStatus, { label: string; dot: string; text: string }> = {
  pending: { label: 'Pending processing', dot: 'bg-warning', text: 'text-warning' },
  processing: { label: 'Processing', dot: 'bg-info', text: 'text-info' },
  ready: { label: 'Ready', dot: 'bg-success', text: 'text-success' },
  failed: { label: 'Processing failed', dot: 'bg-danger', text: 'text-danger' },
};

export function VideoStatusBadge({ status }: { status: VideoProcessingStatus }) {
  return <Pill {...(VIDEO_STYLE[status] ?? VIDEO_STYLE.pending)} />;
}

export const VISIBILITY_META: Record<AttachmentVisibility, { label: string; help: string }> = {
  enrolled: { label: 'Enrolled learners', help: 'Downloadable by learners enrolled in the course.' },
  preview: { label: 'Preview', help: 'Available to signed-in learners who can open the lesson.' },
  instructor_only: { label: 'Instructors only', help: 'Hidden from learners; staff only.' },
};

/** `durationSeconds` → "12:05" or "1:02:00". */
export function formatClock(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** `datetime-local` uses local wall time; the API stores ISO instants. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Mirrors `storageConfig.allowedVideoMimeTypes` / `allowedDocumentMimeTypes` and extensions. */
export const VIDEO_ACCEPT = '.mp4,.webm,.mov,.avi,video/mp4,video/webm,video/quicktime,video/x-msvideo';
export const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']);
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';
export const DOCUMENT_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip']);
