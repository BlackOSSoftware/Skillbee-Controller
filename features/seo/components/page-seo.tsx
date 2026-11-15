'use client';

import { FileText, Save } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import type { PageSeo, SeoBreadcrumb, SeoPageIdentifier, UpdatePageSeoInput } from '@/types/seo';
import { SEO_PAGE_IDENTIFIERS } from '@/types/seo';
import { usePageSeo, useSeoSettings, useUpdatePageSeo } from '../hooks';
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

const SCHEMA_TYPES = ['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage', 'FAQPage', 'ItemPage'] as const;

interface FormState {
  pagePath: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
  canonicalUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  schemaType: string;
  schemaData: Record<string, unknown>;
  breadcrumbs: SeoBreadcrumb[];
}

function toForm(p: PageSeo): FormState {
  return {
    pagePath: p.pagePath ?? '',
    seoTitle: p.seoTitle ?? '',
    metaDescription: p.metaDescription ?? '',
    slug: p.slug ?? '',
    canonicalUrl: p.canonicalUrl ?? '',
    robotsIndex: p.robotsIndex !== false,
    robotsFollow: p.robotsFollow !== false,
    ogTitle: p.ogTitle ?? '',
    ogDescription: p.ogDescription ?? '',
    ogImage: p.ogImage ?? '',
    schemaType: p.schemaType || 'WebPage',
    schemaData: p.schemaData ?? {},
    breadcrumbs: (p.breadcrumbs ?? []).map((b) => ({ name: b.name, path: b.path })),
  };
}

const PAGE_LABELS: Record<SeoPageIdentifier, string> = {
  home: 'Home',
  courses: 'Courses',
  about: 'About',
  contact: 'Contact',
  pricing: 'Pricing',
  blog: 'Blog',
  login: 'Login',
  register: 'Register',
};

export function PageSeoManager() {
  const toast = useToast();
  const settings = useSeoSettings();
  const [selected, setSelected] = useState<SeoPageIdentifier>('home');
  const page = usePageSeo(selected);
  const update = useUpdatePageSeo(selected);
  const [v, setV] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const data = page.data;

  const [prevStamp, setPrevStamp] = useState(data ? `${data.id}:${data.updatedAt}` : undefined);
  if (data && `${data.id}:${data.updatedAt}` !== prevStamp) {
    setPrevStamp(`${data.id}:${data.updatedAt}`);
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

  function setCrumb(i: number, patch: Partial<SeoBreadcrumb>) {
    setV((s) => {
      const crumbs = [...(s ?? form).breadcrumbs];
      crumbs[i] = { ...crumbs[i], ...patch };
      return { ...(s ?? form), breadcrumbs: crumbs };
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (form.seoTitle.length > 120) next.seoTitle = 'Max 120 characters.';
    if (form.metaDescription.length > 320) next.metaDescription = 'Max 320 characters.';
    if (form.ogTitle.length > 120) next.ogTitle = 'Max 120 characters.';
    if (form.ogDescription.length > 320) next.ogDescription = 'Max 320 characters.';
    if (!isHttpUrl(form.canonicalUrl)) next.canonicalUrl = 'Must be a valid http(s) URL or empty.';
    if (!isHttpUrl(form.ogImage)) next.ogImage = 'Must be a valid http(s) URL or empty.';
    if (form.pagePath && !form.pagePath.startsWith('/')) next.pagePath = 'Page path must start with /.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || update.isPending || !data) return;
    const input: UpdatePageSeoInput = {
      pagePath: form.pagePath || undefined,
      seoTitle: form.seoTitle,
      metaDescription: form.metaDescription,
      slug: form.slug || undefined,
      canonicalUrl: form.canonicalUrl,
      robotsIndex: form.robotsIndex,
      robotsFollow: form.robotsFollow,
      ogTitle: form.ogTitle,
      ogDescription: form.ogDescription,
      ogImage: form.ogImage,
      schemaType: form.schemaType,
      schemaData: form.schemaData,
      breadcrumbs: form.breadcrumbs.filter((b) => b.name.trim() && b.path.trim()),
    };
    update.mutate(input, {
      onSuccess: () => toast.success('Page SEO saved', `${PAGE_LABELS[selected]} metadata updated.`),
      onError: (err) => toast.error('Could not save page SEO', normalizeApiError(err).message),
    });
  }

  const siteUrl = settings.data?.siteUrl ?? '';
  const pageUrl = data ? `${siteUrl}${data.pagePath}`.replace(/([^:]\/)\/+/g, '$1') : '';

  const checklist: ChecklistItem[] = data && v
    ? [
    { label: 'SEO title set', status: form.seoTitle.trim() ? (form.seoTitle.length <= 60 ? 'pass' : 'warn') : 'fail', hint: form.seoTitle.trim() ? `${form.seoTitle.length} chars` : 'Empty — falls back to site default' },
    { label: 'Meta description set', status: form.metaDescription.trim() ? (form.metaDescription.length <= 160 ? 'pass' : 'warn') : 'fail' },
    { label: 'Canonical URL valid', status: !form.canonicalUrl.trim() || isHttpUrl(form.canonicalUrl) ? 'pass' : 'fail', hint: form.canonicalUrl || 'Auto-generated from site URL + path' },
    { label: 'Social title & description', status: form.ogTitle.trim() && form.ogDescription.trim() ? 'pass' : form.ogTitle.trim() || form.ogDescription.trim() ? 'warn' : 'na', hint: 'Falls back to SEO title/description when empty' },
    { label: 'OG image configured', status: form.ogImage.trim() ? 'pass' : 'na', hint: form.ogImage ? undefined : 'Uses site default OG image' },
    { label: 'Robots directives valid', status: 'pass', hint: `${form.robotsIndex ? 'index' : 'noindex'}, ${form.robotsFollow ? 'follow' : 'nofollow'}` },
    { label: 'Breadcrumbs defined', status: form.breadcrumbs.length ? 'pass' : 'na', hint: `${form.breadcrumbs.length} item(s)` },
    ]
    : [];

  return (
    <div className="space-y-4">
      {/* Page selector */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Select a page</h2>
            <p className="text-xs text-ink-muted">Only built-in public pages support SEO records — {SEO_PAGE_IDENTIFIERS.length} available.</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pages">
            {SEO_PAGE_IDENTIFIERS.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={selected === id}
                onClick={() => setSelected(id)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  selected === id ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-ink-muted hover:text-ink'
                )}
              >
                {PAGE_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {page.isError ? (
        <ErrorState error={page.error} onRetry={() => page.refetch()} />
      ) : page.isPending || !data || !v ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" noValidate>
          <div className="min-w-0 space-y-4">
            {dirty ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300" role="status">
                Unsaved changes — save before switching pages.
              </p>
            ) : null}

            <Card className="space-y-4 p-4 sm:p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FileText className="size-4 text-primary" aria-hidden /> Search metadata
              </h3>
              <SeoGuidance title="Page-level SEO tips">
                <p>Each page should have a unique title and description. Avoid duplicating the homepage metadata — describe what this specific page offers.</p>
              </SeoGuidance>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="page-path" label="Page path" error={errors.pagePath} hint="Public URL path, e.g. /about">
                  <Input id="page-path" value={form.pagePath} onChange={(e) => set('pagePath', e.target.value)} maxLength={500} />
                </Field>
                <Field id="page-slug" label="Slug" hint="Optional vanity slug">
                  <Input id="page-slug" value={form.slug} onChange={(e) => set('slug', e.target.value)} maxLength={200} />
                </Field>
              </div>
              <SeoTitleField id="page-seo-title" value={form.seoTitle} onChange={(v) => set('seoTitle', v)} error={errors.seoTitle} />
              <MetaDescriptionField id="page-meta-desc" value={form.metaDescription} onChange={(v) => set('metaDescription', v)} error={errors.metaDescription} />
              <UrlField id="page-canonical" label="Canonical URL" value={form.canonicalUrl} onChange={(v) => set('canonicalUrl', v)} error={errors.canonicalUrl} hint="Leave empty to auto-generate from site URL + page path" />
              <RobotsFields idPrefix="page" index={form.robotsIndex} follow={form.robotsFollow} onIndex={(b) => set('robotsIndex', b)} onFollow={(b) => set('robotsFollow', b)} />
            </Card>

            <Card className="space-y-4 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-ink">Social (Open Graph)</h3>
              <SeoTitleField id="page-og-title" value={form.ogTitle} onChange={(v) => set('ogTitle', v)} error={errors.ogTitle} hint="Defaults to SEO title when empty" />
              <MetaDescriptionField id="page-og-desc" value={form.ogDescription} onChange={(v) => set('ogDescription', v)} error={errors.ogDescription} rows={2} hint="Defaults to meta description when empty" />
              <UrlField id="page-og-image" label="OG image URL" value={form.ogImage} onChange={(v) => set('ogImage', v)} error={errors.ogImage} />
            </Card>

            <Card className="space-y-4 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-ink">Structured data & breadcrumbs</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="page-schema-type" label="Schema type">
                  <Select id="page-schema-type" value={form.schemaType} onChange={(e) => set('schemaType', e.target.value)}>
                    {SCHEMA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
              </div>
              <SchemaDataField id="page-schema-data" value={form.schemaData} onChange={(v) => set('schemaData', v)} />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">Breadcrumbs</p>
                  <Button type="button" size="sm" variant="secondary" disabled={form.breadcrumbs.length >= 10} onClick={() => set('breadcrumbs', [...form.breadcrumbs, { name: '', path: '' }])}>
                    Add crumb
                  </Button>
                </div>
                {form.breadcrumbs.length === 0 ? (
                  <p className="text-xs text-ink-muted">No breadcrumbs — the page will use its default trail.</p>
                ) : (
                  <ul className="space-y-2">
                    {form.breadcrumbs.map((b, i) => (
                      <li key={i} className="flex flex-col gap-2 rounded-lg border border-line p-2.5 sm:flex-row sm:items-center">
                        <Input value={b.name} onChange={(e) => setCrumb(i, { name: e.target.value })} placeholder="Name" maxLength={120} className="sm:w-48" aria-label={`Crumb ${i + 1} name`} />
                        <Input value={b.path} onChange={(e) => setCrumb(i, { path: e.target.value })} placeholder="/path" maxLength={500} className="flex-1" aria-label={`Crumb ${i + 1} path`} />
                        <button type="button" onClick={() => set('breadcrumbs', form.breadcrumbs.filter((_, j) => j !== i))} aria-label={`Remove crumb ${i + 1}`} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-danger">
                          <span className="text-xs">✕</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={update.isPending || !dirty}>
                <Save className="size-4" aria-hidden />
                {update.isPending ? 'Saving…' : dirty ? 'Save page SEO' : 'Saved'}
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
            <SerpPreview title={form.seoTitle || data.seoTitle || PAGE_LABELS[selected]} description={form.metaDescription} url={pageUrl} />
            <SocialPreview
              title={form.ogTitle || form.seoTitle || PAGE_LABELS[selected]}
              description={form.ogDescription || form.metaDescription}
              image={form.ogImage}
              siteName={settings.data?.siteName}
              siteUrl={siteUrl}
            />
          </aside>
        </form>
      )}
    </div>
  );
}
