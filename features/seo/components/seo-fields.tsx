'use client';

import { AlertTriangle, CheckCircle2, Circle, Info, Search, Share2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Field, Input, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/cn';

// ---------- Validation helpers ----------

export const SEO_TITLE_MAX = 120;
export const META_DESC_MAX = 320;
export const OG_TITLE_MAX = 120;
export const OG_DESC_MAX = 320;
export const URL_MAX = 1000;

export function isHttpUrl(value: string): boolean {
  if (!value.trim()) return true; // empty = unset, allowed
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isInternalPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

// ---------- Character counter ----------

export function CharCount({ value, max, warnAt }: { value: string; max: number; warnAt?: number }) {
  const len = value.length;
  const over = len > max;
  const warn = !over && warnAt !== undefined && len > warnAt;
  return (
    <span className={cn('text-[11px] tabular-nums', over ? 'text-danger' : warn ? 'text-amber-600 dark:text-amber-400' : 'text-ink-subtle')}>
      {len.toLocaleString('en-IN')}/{max}
      {over ? ' — too long' : warn ? ' — getting long' : ''}
    </span>
  );
}

// ---------- Guidance ----------

export function SeoGuidance({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <Info className="size-3.5 text-primary" aria-hidden />
        {title}
      </summary>
      <div className="mt-2 space-y-1.5 text-ink-muted">{children}</div>
    </details>
  );
}

// ---------- SERP preview ----------

export function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const displayTitle = title.trim() || 'Page title';
  const displayDesc = description.trim() || 'Add a meta description to control how this page appears in search results.';
  return (
    <div className="rounded-lg border border-line bg-white p-3 dark:bg-surface-2/60" aria-label="Search result preview">
      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
        <Search className="size-3" aria-hidden /> Google preview
      </p>
      <p className="truncate text-xs text-ink-subtle">{url || 'https://…'}</p>
      <p className="mt-0.5 line-clamp-1 text-[15px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{displayTitle}</p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#4d5156] dark:text-ink-muted">{displayDesc}</p>
    </div>
  );
}

// ---------- Social (Open Graph) preview ----------

export function SocialPreview({ title, description, image, siteName, siteUrl }: { title: string; description: string; image: string; siteName?: string; siteUrl?: string }) {
  const host = (() => {
    try {
      return siteUrl ? new URL(siteUrl).hostname : '';
    } catch {
      return '';
    }
  })();
  return (
    <div className="overflow-hidden rounded-lg border border-line" aria-label="Social share preview">
      <div className="flex items-center gap-1.5 bg-surface-2/70 px-3 py-1.5">
        <Share2 className="size-3 text-ink-subtle" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">Social preview</span>
      </div>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary OG image URL
        <img src={image} alt="" className="aspect-[1.91/1] w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-surface-2 text-xs text-ink-subtle">
          No image set — falls back to site default
        </div>
      )}
      <div className="space-y-0.5 p-3">
        <p className="truncate text-[11px] uppercase tracking-wide text-ink-subtle">{host || siteName || 'your-site.com'}</p>
        <p className="line-clamp-2 text-sm font-semibold text-ink">{title.trim() || 'Untitled'}</p>
        <p className="line-clamp-2 text-xs text-ink-muted">{description.trim() || 'No description set.'}</p>
      </div>
    </div>
  );
}

// ---------- Robots fields ----------

export function RobotsFields({
  index,
  follow,
  onIndex,
  onFollow,
  idPrefix,
}: {
  index: boolean;
  follow: boolean;
  onIndex: (v: boolean) => void;
  onFollow: (v: boolean) => void;
  idPrefix: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">Robots directives</legend>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" checked={index} onChange={(e) => onIndex(e.target.checked)} className="mt-0.5 size-4 rounded border-line text-primary focus:ring-primary" />
        <span>
          <span className="font-medium">Allow indexing</span>
          <span className="block text-xs text-ink-muted">When off, search engines are told not to include this page in results (noindex).</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" checked={follow} onChange={(e) => onFollow(e.target.checked)} className="mt-0.5 size-4 rounded border-line text-primary focus:ring-primary" />
        <span>
          <span className="font-medium">Allow link following</span>
          <span className="block text-xs text-ink-muted">When off, crawlers will not follow links on this page (nofollow).</span>
        </span>
      </label>
      <p className="text-[11px] text-ink-subtle" id={`${idPrefix}-robots-hint`}>
        Tip: keep indexing on for public content; disable it for login, thank-you or internal pages.
      </p>
    </fieldset>
  );
}

// ---------- SEO checklist ----------

export type ChecklistStatus = 'pass' | 'warn' | 'fail' | 'na';

export interface ChecklistItem {
  label: string;
  status: ChecklistStatus;
  hint?: string;
}

const CHECK_STYLE: Record<ChecklistStatus, { icon: ReactNode; cls: string }> = {
  pass: { icon: <CheckCircle2 className="size-3.5 text-emerald-500" aria-hidden />, cls: 'text-ink' },
  warn: { icon: <AlertTriangle className="size-3.5 text-amber-500" aria-hidden />, cls: 'text-ink' },
  fail: { icon: <Circle className="size-3.5 text-danger" aria-hidden />, cls: 'text-ink' },
  na: { icon: <Circle className="size-3.5 text-ink-subtle" aria-hidden />, cls: 'text-ink-subtle' },
};

export function SeoChecklist({ items, title = 'SEO checklist' }: { items: ChecklistItem[]; title?: string }) {
  const done = items.filter((i) => i.status === 'pass').length;
  return (
    <section aria-label={title} className="rounded-lg border border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</p>
        <span className="text-[11px] tabular-nums text-ink-muted">
          {done}/{items.filter((i) => i.status !== 'na').length} ready
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const s = CHECK_STYLE[item.status];
          return (
            <li key={item.label} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 shrink-0">{s.icon}</span>
              <span className={s.cls}>
                {item.label}
                {item.hint ? <span className="block text-[11px] text-ink-subtle">{item.hint}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] leading-snug text-ink-subtle">
        Checklist reflects metadata completeness only — it is not a ranking score or a guarantee of search performance.
      </p>
    </section>
  );
}

// ---------- Reusable field wrappers ----------

export function SeoTitleField({
  id,
  value,
  onChange,
  error,
  hint,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <Field id={id} label="SEO title" error={error} hint={hint}>
      <div className="flex items-start gap-2">
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={SEO_TITLE_MAX} className="flex-1" />
        <CharCount value={value} max={SEO_TITLE_MAX} warnAt={60} />
      </div>
    </Field>
  );
}

export function MetaDescriptionField({
  id,
  value,
  onChange,
  error,
  hint,
  rows = 3,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  rows?: number;
}) {
  return (
    <Field id={id} label="Meta description" error={error} hint={hint}>
      <div className="space-y-1">
        <Textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} maxLength={META_DESC_MAX} />
        <div className="flex justify-end">
          <CharCount value={value} max={META_DESC_MAX} warnAt={160} />
        </div>
      </div>
    </Field>
  );
}

export function UrlField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  const invalid = value.trim() !== '' && !isHttpUrl(value);
  return (
    <Field id={id} label={label} error={error ?? (invalid ? 'Must be a valid http(s) URL or left empty.' : undefined)} hint={hint}>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={URL_MAX} placeholder={placeholder ?? 'https://…'} inputMode="url" />
    </Field>
  );
}

/** JSON object editor for schemaData with parse validation. */
export function SchemaDataField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  error?: string;
}) {
  const raw = JSON.stringify(value && Object.keys(value).length ? value : {}, null, 2);
  return (
    <Field
      id={id}
      label="Schema data (JSON)"
      error={error}
      hint="Optional structured-data overrides. Must be a valid JSON object — leave {} for defaults."
    >
      <Textarea
        id={id}
        rows={5}
        defaultValue={raw}
        key={raw}
        onChange={(e) => {
          try {
            const parsed: unknown = JSON.parse(e.target.value || '{}');
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              onChange(parsed as Record<string, unknown>);
            }
          } catch {
            // keep last valid value; error surfaces via parent validation if needed
          }
        }}
        className="font-mono text-[13px]"
      />
    </Field>
  );
}
