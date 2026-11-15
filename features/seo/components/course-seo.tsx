'use client';

import { GraduationCap, Save, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import { seoService } from '@/services/seo.service';
import type { CourseSeoData, SeoCourseOption, UpdateCourseSeoInput } from '@/types/seo';
import { useCourseSeo, useSeoSettings, useUpdateCourseSeo } from '../hooks';
import {
  isHttpUrl,
  MetaDescriptionField,
  RobotsFields,
  SchemaDataField,
  SeoChecklist,
  SeoGuidance,
  SeoTitleField,
  SerpPreview,
  SocialPreview,
  UrlField,
  type ChecklistItem,
} from './seo-fields';

const SCHEMA_TYPES = ['Course', 'Article', 'WebPage'] as const;

interface FormState {
  seoTitle: string;
  metaDescription: string;
  slug: string;
  canonicalUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  focusKeyword: string;
  schemaType: string;
  schemaData: Record<string, unknown>;
}

function toForm(d: CourseSeoData): FormState {
  return {
    seoTitle: d.seoTitle ?? '',
    metaDescription: d.metaDescription ?? '',
    slug: d.slug ?? '',
    canonicalUrl: d.canonicalUrl ?? '',
    robotsIndex: d.robotsIndex !== false,
    robotsFollow: d.robotsFollow !== false,
    ogTitle: d.ogTitle ?? '',
    ogDescription: d.ogDescription ?? '',
    ogImage: d.ogImage ?? '',
    focusKeyword: d.focusKeyword ?? '',
    schemaType: d.schemaType || 'Course',
    schemaData: d.schemaData ?? {},
  };
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function CourseSeoManager() {
  const toast = useToast();
  const settings = useSeoSettings();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);

  const seo = useCourseSeo(selectedId);
  const update = useUpdateCourseSeo(selectedId ?? '');
  const [v, setV] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [slugConfirm, setSlugConfirm] = useState(false);

  const data = seo.data;

  const [prevStamp, setPrevStamp] = useState(data ? `${data.courseId}:${data.slug}:${data.canonicalUrl}` : undefined);
  if (data && `${data.courseId}:${data.slug}:${data.canonicalUrl}` !== prevStamp) {
    setPrevStamp(`${data.courseId}:${data.slug}:${data.canonicalUrl}`);
    setV(toForm(data));
  }

  const form: FormState = v ?? (data ? toForm(data) : ({} as FormState));
  const dirty = useMemo(() => {
    if (!data || !v) return false;
    return JSON.stringify(v) !== JSON.stringify(toForm(data));
  }, [v, data]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setV((s) => ({ ...(s ?? form), [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.seoTitle.length > 120) next.seoTitle = 'Max 120 characters.';
    if (form.metaDescription.length > 320) next.metaDescription = 'Max 320 characters.';
    if (form.slug && !SLUG_RE.test(form.slug)) next.slug = 'Slug may only contain lowercase letters, numbers and hyphens.';
    if (form.slug.length > 200) next.slug = 'Max 200 characters.';
    if (!isHttpUrl(form.canonicalUrl)) next.canonicalUrl = 'Must be a valid http(s) URL or empty.';
    if (!isHttpUrl(form.ogImage)) next.ogImage = 'Must be a valid http(s) URL or empty.';
    if (form.focusKeyword.length > 100) next.focusKeyword = 'Max 100 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildInput(): UpdateCourseSeoInput {
    return {
      seoTitle: form.seoTitle,
      metaDescription: form.metaDescription,
      slug: form.slug && form.slug !== data?.slug ? form.slug : undefined,
      canonicalUrl: form.canonicalUrl,
      robotsIndex: form.robotsIndex,
      robotsFollow: form.robotsFollow,
      ogTitle: form.ogTitle,
      ogDescription: form.ogDescription,
      ogImage: form.ogImage,
      focusKeyword: form.focusKeyword,
      schemaType: form.schemaType,
      schemaData: form.schemaData,
    };
  }

  function doSave() {
    if (!selectedId || update.isPending) return;
    update.mutate(buildInput(), {
      onSuccess: (saved) => {
        const slugChanged = form.slug && form.slug !== data?.slug;
        toast.success(
          'Course SEO saved',
          slugChanged && saved.slug !== data?.slug
            ? `Slug changed to /${saved.slug}. The backend created a 301 redirect from the old URL.`
            : undefined
        );
        setSlugConfirm(false);
      },
      onError: (err) => {
        setSlugConfirm(false);
        toast.error('Could not save course SEO', normalizeApiError(err).message);
      },
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || update.isPending || !data) return;
    const slugChanged = Boolean(form.slug && form.slug !== data.slug);
    const published = data.status === 'published';
    if (slugChanged && published) {
      setSlugConfirm(true);
      return;
    }
    doSave();
  }

  const siteUrl = settings.data?.siteUrl ?? '';
  const publicUrl = data ? `${siteUrl}${data.publicPath}`.replace(/([^:]\/)\/+/g, '$1') : '';

  const checklist: ChecklistItem[] = data
    ? [
        { label: 'SEO title set', status: form.seoTitle.trim() ? (form.seoTitle.length <= 60 ? 'pass' : 'warn') : 'fail' },
        { label: 'Meta description set', status: form.metaDescription.trim() ? (form.metaDescription.length <= 160 ? 'pass' : 'warn') : 'fail' },
        { label: 'Slug readable', status: SLUG_RE.test(form.slug) && form.slug.length <= 60 ? 'pass' : form.slug ? 'warn' : 'fail', hint: form.slug },
        { label: 'Canonical URL valid', status: !form.canonicalUrl.trim() || isHttpUrl(form.canonicalUrl) ? 'pass' : 'fail' },
        { label: 'Focus keyword set', status: form.focusKeyword.trim() ? 'pass' : 'na' },
        { label: 'Social metadata', status: form.ogTitle.trim() && form.ogDescription.trim() ? 'pass' : 'na' },
        { label: 'Indexing enabled', status: form.robotsIndex ? 'pass' : 'warn', hint: form.robotsIndex ? 'index, follow' : 'noindex — hidden from search' },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Course selector */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses by title" className="pl-9" aria-label="Search courses" />
          </div>
          <CoursePicker
            search={debounced}
            selectedId={selectedId}
            onSelect={(c) => { setSelectedId(c.id); setV(null); setErrors({}); }}
          />
        </div>
        {selectedId && data ? (
          <p className="mt-2 text-xs text-ink-muted">
            Editing SEO for <span className="font-medium text-ink">{data.title}</span> · status:{' '}
            <span className="capitalize">{data.status}</span> · public path <code className="rounded bg-surface-2 px-1">{data.publicPath}</code>
          </p>
        ) : null}
      </Card>

      {!selectedId ? (
        <Card>
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <GraduationCap className="size-8 text-ink-subtle" aria-hidden />
            <p className="text-sm font-medium text-ink">Select a course</p>
            <p className="max-w-sm text-xs text-ink-muted">Search and pick a course above to edit its search metadata, slug and social tags.</p>
          </div>
        </Card>
      ) : seo.isError ? (
        <ErrorState error={seo.error} onRetry={() => seo.refetch()} />
      ) : seo.isPending || !data || !v ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" noValidate>
          <div className="min-w-0 space-y-4">
            {dirty ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300" role="status">
                Unsaved changes.
              </p>
            ) : null}

            <Card className="space-y-4 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-ink">Search metadata</h3>
              <SeoGuidance title="Course SEO tips">
                <p>Include the course topic and outcome in the title. Mention key skills in the description — avoid repeating the title verbatim.</p>
              </SeoGuidance>
              <SeoTitleField id="course-seo-title" value={form.seoTitle} onChange={(v) => set('seoTitle', v)} error={errors.seoTitle} hint="Falls back to the course title when empty" />
              <MetaDescriptionField id="course-meta-desc" value={form.metaDescription} onChange={(v) => set('metaDescription', v)} error={errors.metaDescription} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="course-slug" label="Slug" error={errors.slug} hint={data.status === 'published' ? 'Changing a published slug auto-creates a 301 redirect.' : 'Lowercase letters, numbers, hyphens'}>
                  <Input id="course-slug" value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} maxLength={200} />
                </Field>
                <Field id="course-keyword" label="Focus keyword" error={errors.focusKeyword} hint="Primary term this course targets">
                  <Input id="course-keyword" value={form.focusKeyword} onChange={(e) => set('focusKeyword', e.target.value)} maxLength={100} />
                </Field>
              </div>
              <UrlField id="course-canonical" label="Canonical URL" value={form.canonicalUrl} onChange={(v) => set('canonicalUrl', v)} error={errors.canonicalUrl} hint="Leave empty to auto-generate from the course slug" />
              <RobotsFields idPrefix="course" index={form.robotsIndex} follow={form.robotsFollow} onIndex={(b) => set('robotsIndex', b)} onFollow={(b) => set('robotsFollow', b)} />
            </Card>

            <Card className="space-y-4 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-ink">Social (Open Graph)</h3>
              <SeoTitleField id="course-og-title" value={form.ogTitle} onChange={(v) => set('ogTitle', v)} error={errors.ogTitle} hint="Defaults to SEO title when empty" />
              <MetaDescriptionField id="course-og-desc" value={form.ogDescription} onChange={(v) => set('ogDescription', v)} error={errors.ogDescription} rows={2} />
              <UrlField id="course-og-image" label="OG image URL" value={form.ogImage} onChange={(v) => set('ogImage', v)} error={errors.ogImage} hint="Defaults to the course thumbnail when empty" />
            </Card>

            <Card className="space-y-4 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-ink">Structured data</h3>
              <Field id="course-schema-type" label="Schema type">
                <Select id="course-schema-type" value={form.schemaType} onChange={(e) => set('schemaType', e.target.value)}>
                  {SCHEMA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <SchemaDataField id="course-schema-data" value={form.schemaData} onChange={(v) => set('schemaData', v)} />
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={update.isPending || !dirty}>
                <Save className="size-4" aria-hidden />
                {update.isPending ? 'Saving…' : dirty ? 'Save course SEO' : 'Saved'}
              </Button>
            </div>
            {update.isError ? (
              <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
                {normalizeApiError(update.error).message}
              </p>
            ) : null}
          </div>

          <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
            <SeoChecklist items={checklist} />
            <SerpPreview title={form.seoTitle || data.title} description={form.metaDescription} url={publicUrl} />
            <SocialPreview
              title={form.ogTitle || form.seoTitle || data.title}
              description={form.ogDescription || form.metaDescription}
              image={form.ogImage}
              siteName={settings.data?.siteName}
              siteUrl={siteUrl}
            />
          </aside>
        </form>
      )}

      {/* Published slug change confirmation */}
      <Dialog
        open={slugConfirm}
        onClose={() => !update.isPending && setSlugConfirm(false)}
        title="Change slug of a published course?"
        description="A 301 redirect will be created automatically"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSlugConfirm(false)} disabled={update.isPending} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60">
              Cancel
            </button>
            <button type="button" onClick={doSave} disabled={update.isPending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {update.isPending ? 'Saving…' : 'Change slug & save'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-ink-muted">
          <p>
            This course is <span className="font-medium text-ink">published</span>. Changing its slug from{' '}
            <code className="rounded bg-surface-2 px-1">/{data?.slug}</code> to{' '}
            <code className="rounded bg-surface-2 px-1">/{form.slug}</code> will:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Update the course URL immediately.</li>
            <li>Automatically create a <span className="font-medium text-ink">301 permanent redirect</span> from the old path — handled by the backend, no manual redirect needed.</li>
            <li>Keep the old URL working for search engines and shared links.</li>
          </ul>
        </div>
      </Dialog>
    </div>
  );
}

/** Searchable course picker — uses the seo.manage-guarded course list endpoint. */
function CoursePicker({
  search,
  selectedId,
  onSelect,
}: {
  search: string;
  selectedId: string | null;
  onSelect: (course: SeoCourseOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['seo-course-picker', search],
    queryFn: () => seoService.listCoursesForSeo({ page: 1, limit: 8, search: search || undefined }),
    enabled: open,
    staleTime: 30 * 1000,
  });
  const rows = query.data?.data ?? [];

  return (
    <div className="relative">
      <Button type="button" variant="secondary" onClick={() => setOpen((o) => !o)}>
        {selectedId ? 'Change course' : 'Choose course'}
      </Button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface shadow-pop">
          <ul className="max-h-64 overflow-y-auto p-1">
            {query.isPending ? (
              Array.from({ length: 4 }).map((_, i) => <li key={i} className="p-2"><Skeleton className="h-4 w-full" /></li>)
            ) : query.isError ? (
              <li className="p-3 text-xs text-danger">{normalizeApiError(query.error).message}</li>
            ) : !rows.length ? (
              <li className="p-3 text-xs text-ink-muted">No courses match.</li>
            ) : (
              rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect(c); setOpen(false); }}
                    className={cn('flex w-full flex-col rounded-lg px-2.5 py-2 text-left hover:bg-surface-2', c.id === selectedId && 'bg-primary/5')}
                  >
                    <span className="truncate text-sm font-medium text-ink">{c.title}</span>
                    <span className="text-[11px] text-ink-subtle">/{c.slug} · {c.status}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
