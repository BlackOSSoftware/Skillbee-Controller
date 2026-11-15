'use client';

import { Building2, Globe, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { SeoSettings, SeoSocialLink, SitemapSettings, UpdateSeoSettingsInput } from '@/types/seo';
import { useSeoSettings, useUpdateSeoSettings } from '../hooks';
import {
  isHttpUrl,
  MetaDescriptionField,
  RobotsFields,
  SeoGuidance,
  SeoTitleField,
  SerpPreview,
  SocialPreview,
  UrlField,
  SEO_TITLE_MAX,
  META_DESC_MAX,
} from './seo-fields';

interface FormState {
  siteName: string;
  siteUrl: string;
  defaultSeoTitle: string;
  defaultMetaDescription: string;
  defaultOgImage: string;
  defaultRobotsIndex: boolean;
  defaultRobotsFollow: boolean;
  organizationName: string;
  organizationLogo: string;
  organizationDescription: string;
  organizationSocialLinks: SeoSocialLink[];
  sitemapSettings: SitemapSettings;
  robotsTxtContent: string;
}

function toForm(s: SeoSettings): FormState {
  return {
    siteName: s.siteName ?? '',
    siteUrl: s.siteUrl ?? '',
    defaultSeoTitle: s.defaultSeoTitle ?? '',
    defaultMetaDescription: s.defaultMetaDescription ?? '',
    defaultOgImage: s.defaultOgImage ?? '',
    defaultRobotsIndex: s.defaultRobotsIndex !== false,
    defaultRobotsFollow: s.defaultRobotsFollow !== false,
    organizationName: s.organizationName ?? '',
    organizationLogo: s.organizationLogo ?? '',
    organizationDescription: s.organizationDescription ?? '',
    organizationSocialLinks: (s.organizationSocialLinks ?? []).map((l) => ({ platform: l.platform, url: l.url })),
    sitemapSettings: {
      enabled: s.sitemapSettings?.enabled !== false,
      includeCourses: s.sitemapSettings?.includeCourses !== false,
      includePages: s.sitemapSettings?.includePages !== false,
      changefreqCourses: s.sitemapSettings?.changefreqCourses ?? 'weekly',
      changefreqPages: s.sitemapSettings?.changefreqPages ?? 'monthly',
      maxUrlsPerSitemap: s.sitemapSettings?.maxUrlsPerSitemap ?? 5000,
    },
    robotsTxtContent: s.robotsTxtContent ?? '',
  };
}

const CHANGEFREQ = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'] as const;

export function GlobalSeoSettings() {
  const toast = useToast();
  const settings = useSeoSettings();
  const update = useUpdateSeoSettings();
  const [v, setV] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const data = settings.data;
  const form: FormState = v ?? (data ? toForm(data) : ({} as FormState));

  // Reset form when fresh server data arrives (after save or first load).
  const [prevStamp, setPrevStamp] = useState(data?.updatedAt);
  if (data && data.updatedAt !== prevStamp) {
    setPrevStamp(data.updatedAt);
    setV(toForm(data));
  }

  const dirty = useMemo(() => {
    if (!data || !v) return false;
    return JSON.stringify(v) !== JSON.stringify(toForm(data));
  }, [v, data]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setV((s) => ({ ...(s ?? form), [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function setSitemap<K extends keyof SitemapSettings>(key: K, value: SitemapSettings[K]) {
    setV((s) => ({ ...(s ?? form), sitemapSettings: { ...(s ?? form).sitemapSettings, [key]: value } }));
  }

  function setSocial(i: number, patch: Partial<SeoSocialLink>) {
    setV((s) => {
      const links = [...(s ?? form).organizationSocialLinks];
      links[i] = { ...links[i], ...patch };
      return { ...(s ?? form), organizationSocialLinks: links };
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!isHttpUrl(form.siteUrl) || !form.siteUrl.trim()) next.siteUrl = 'Site URL must be a valid http(s) URL.';
    if (form.defaultSeoTitle.length > SEO_TITLE_MAX) next.defaultSeoTitle = `Max ${SEO_TITLE_MAX} characters.`;
    if (form.defaultMetaDescription.length > META_DESC_MAX) next.defaultMetaDescription = `Max ${META_DESC_MAX} characters.`;
    if (!isHttpUrl(form.defaultOgImage)) next.defaultOgImage = 'Must be a valid http(s) URL or empty.';
    if (!isHttpUrl(form.organizationLogo)) next.organizationLogo = 'Must be a valid http(s) URL or empty.';
    for (const [i, l] of form.organizationSocialLinks.entries()) {
      if (l.url.trim() && !isHttpUrl(l.url)) next[`social-${i}`] = 'Must be a valid http(s) URL.';
    }
    if (form.robotsTxtContent.length > 10000) next.robotsTxtContent = 'robots.txt content must be 10,000 characters or less.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || update.isPending) return;
    const input: UpdateSeoSettingsInput = {
      siteName: form.siteName,
      siteUrl: form.siteUrl.replace(/\/$/, ''),
      defaultSeoTitle: form.defaultSeoTitle,
      defaultMetaDescription: form.defaultMetaDescription,
      defaultOgImage: form.defaultOgImage,
      defaultRobotsIndex: form.defaultRobotsIndex,
      defaultRobotsFollow: form.defaultRobotsFollow,
      organizationName: form.organizationName,
      organizationLogo: form.organizationLogo,
      organizationDescription: form.organizationDescription,
      organizationSocialLinks: form.organizationSocialLinks.filter((l) => l.url.trim()),
      sitemapSettings: form.sitemapSettings,
      robotsTxtContent: form.robotsTxtContent,
    };
    update.mutate(input, {
      onSuccess: () => toast.success('SEO settings saved', 'Global defaults updated across the site.'),
      onError: (err) => toast.error('Could not save settings', normalizeApiError(err).message),
    });
  }

  if (settings.isError) {
    return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  }
  if (!data || !v) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {dirty ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300" role="status">
          You have unsaved changes — save before leaving this page.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* Website identity */}
          <Card className="space-y-4 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Globe className="size-4 text-primary" aria-hidden /> Website identity
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="seo-site-name" label="Site name" hint="Used in titles and structured data">
                <Input id="seo-site-name" value={form.siteName} onChange={(e) => set('siteName', e.target.value)} maxLength={120} />
              </Field>
              <UrlField id="seo-site-url" label="Site URL" value={form.siteUrl} onChange={(v) => set('siteUrl', v)} error={errors.siteUrl} hint="Canonical base for all generated URLs" />
            </div>
          </Card>

          {/* Default metadata */}
          <Card className="space-y-4 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-ink">Default search metadata</h2>
            <SeoGuidance title="Writing good titles & descriptions">
              <p>Keep titles under ~60 characters and front-load the most important words. Descriptions should be 150–160 characters, written for humans — answer what the page offers, not a keyword list.</p>
            </SeoGuidance>
            <SeoTitleField id="seo-default-title" value={form.defaultSeoTitle} onChange={(v) => set('defaultSeoTitle', v)} hint="Fallback title when a page has no specific SEO title" />
            <MetaDescriptionField id="seo-default-desc" value={form.defaultMetaDescription} onChange={(v) => set('defaultMetaDescription', v)} />
            <UrlField id="seo-default-og" label="Default Open Graph image" value={form.defaultOgImage} onChange={(v) => set('defaultOgImage', v)} error={errors.defaultOgImage} hint="1200×630px recommended. Used when a page has no OG image." />
            <RobotsFields
              idPrefix="seo-default"
              index={form.defaultRobotsIndex}
              follow={form.defaultRobotsFollow}
              onIndex={(b) => set('defaultRobotsIndex', b)}
              onFollow={(b) => set('defaultRobotsFollow', b)}
            />
          </Card>

          {/* Organization */}
          <Card className="space-y-4 p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Building2 className="size-4 text-primary" aria-hidden /> Organization
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="seo-org-name" label="Organization name">
                <Input id="seo-org-name" value={form.organizationName} onChange={(e) => set('organizationName', e.target.value)} maxLength={200} />
              </Field>
              <UrlField id="seo-org-logo" label="Organization logo URL" value={form.organizationLogo} onChange={(v) => set('organizationLogo', v)} error={errors.organizationLogo} />
            </div>
            <Field id="seo-org-desc" label="Organization description" hint={`${form.organizationDescription.length}/500`}>
              <Textarea id="seo-org-desc" rows={2} value={form.organizationDescription} onChange={(e) => set('organizationDescription', e.target.value)} maxLength={500} />
            </Field>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Social profiles</p>
                <Button type="button" size="sm" variant="secondary" onClick={() => setV((s) => ({ ...(s ?? form), organizationSocialLinks: [...(s ?? form).organizationSocialLinks, { platform: '', url: '' }] }))}>
                  <Plus className="size-3.5" aria-hidden /> Add link
                </Button>
              </div>
              {form.organizationSocialLinks.length === 0 ? (
                <p className="text-xs text-ink-muted">No social profiles configured.</p>
              ) : (
                <ul className="space-y-2">
                  {form.organizationSocialLinks.map((l, i) => (
                    <li key={i} className="flex flex-col gap-2 rounded-lg border border-line p-2.5 sm:flex-row sm:items-center">
                      <Input value={l.platform} onChange={(e) => setSocial(i, { platform: e.target.value })} placeholder="Platform (e.g. twitter)" maxLength={50} className="sm:w-40" aria-label={`Platform ${i + 1}`} />
                      <Input value={l.url} onChange={(e) => setSocial(i, { url: e.target.value })} placeholder="https://…" maxLength={500} className="flex-1" aria-label={`URL ${i + 1}`} />
                      {errors[`social-${i}`] ? <p className="text-xs text-danger sm:w-full">{errors[`social-${i}`]}</p> : null}
                      <button type="button" onClick={() => setV((s) => ({ ...(s ?? form), organizationSocialLinks: (s ?? form).organizationSocialLinks.filter((_, j) => j !== i) }))} aria-label={`Remove social link ${i + 1}`} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-danger">
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Sitemap */}
          <Card className="space-y-4 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-ink">Sitemap</h2>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.sitemapSettings.enabled} onChange={(e) => setSitemap('enabled', e.target.checked)} className="size-4 rounded border-line text-primary focus:ring-primary" />
              Sitemap enabled
            </label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={form.sitemapSettings.includeCourses} onChange={(e) => setSitemap('includeCourses', e.target.checked)} className="size-4 rounded border-line text-primary focus:ring-primary" />
                Include courses
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={form.sitemapSettings.includePages} onChange={(e) => setSitemap('includePages', e.target.checked)} className="size-4 rounded border-line text-primary focus:ring-primary" />
                Include pages
              </label>
              <Field id="seo-cf-courses" label="Course change frequency">
                <Select id="seo-cf-courses" value={form.sitemapSettings.changefreqCourses} onChange={(e) => setSitemap('changefreqCourses', e.target.value)}>
                  {CHANGEFREQ.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>
              </Field>
              <Field id="seo-cf-pages" label="Page change frequency">
                <Select id="seo-cf-pages" value={form.sitemapSettings.changefreqPages} onChange={(e) => setSitemap('changefreqPages', e.target.value)}>
                  {CHANGEFREQ.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>
              </Field>
              <Field id="seo-max-urls" label="Max URLs per sitemap" hint="10 – 50,000">
                <Input id="seo-max-urls" type="number" min={10} max={50000} value={form.sitemapSettings.maxUrlsPerSitemap} onChange={(e) => setSitemap('maxUrlsPerSitemap', Math.max(10, Math.min(50000, Number(e.target.value) || 5000)))} />
              </Field>
            </div>
          </Card>

          {/* robots.txt */}
          <Card className="space-y-3 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-ink">robots.txt</h2>
            <Field id="seo-robots-txt" label="Custom robots.txt content" error={errors.robotsTxtContent} hint={`${form.robotsTxtContent.length.toLocaleString('en-IN')}/10,000 · leave default to use generated rules`}>
              <Textarea id="seo-robots-txt" rows={8} value={form.robotsTxtContent} onChange={(e) => set('robotsTxtContent', e.target.value)} className="font-mono text-[13px]" />
            </Field>
          </Card>
        </div>

        {/* Preview column */}
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <SerpPreview
            title={form.defaultSeoTitle || form.siteName}
            description={form.defaultMetaDescription}
            url={form.siteUrl || 'https://…'}
          />
          <SocialPreview
            title={form.defaultSeoTitle || form.siteName}
            description={form.defaultMetaDescription}
            image={form.defaultOgImage}
            siteName={form.siteName}
            siteUrl={form.siteUrl}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending || !dirty}>
              <Save className="size-4" aria-hidden />
              {update.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>
          {update.isError ? (
            <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
              {normalizeApiError(update.error).message}
            </p>
          ) : null}
        </aside>
      </div>
    </form>
  );
}
