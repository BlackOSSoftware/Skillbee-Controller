'use client';

import {
  AtSign,
  Briefcase,
  Building2,
  Camera,
  Globe,
  Mail,
  MessageCircle,
  Play,
  RefreshCw,
  Save,
  Send,
  Share2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import type { SiteContact, SiteSettingsAdmin, SocialLinks, UpdateSiteSettingsInput } from '@/types/site-settings';
import { usePublicSiteSettings, useSiteSettingsAdmin, useUpdateSiteSettings } from '../hooks';

const CONTACT_FIELDS: { key: keyof SiteContact; label: string; hint?: string; textarea?: boolean; max: number }[] = [
  { key: 'companyName', label: 'Company name', max: 200 },
  { key: 'email', label: 'Primary email', hint: 'Public contact email', max: 254 },
  { key: 'phone', label: 'Phone', max: 30 },
  { key: 'alternatePhone', label: 'Alternate phone', max: 30 },
  { key: 'whatsappNumber', label: 'WhatsApp number', max: 30 },
  { key: 'address', label: 'Address', textarea: true, max: 500 },
  { key: 'city', label: 'City', max: 120 },
  { key: 'state', label: 'State', max: 120 },
  { key: 'country', label: 'Country', max: 120 },
  { key: 'postalCode', label: 'Postal code', max: 20 },
  { key: 'gstin', label: 'GSTIN', hint: '15-character Indian GST identification number', max: 15 },
  { key: 'businessHours', label: 'Business hours', hint: 'e.g. Mon–Fri, 9:00–18:00 IST', textarea: true, max: 500 },
];

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string }[] = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'twitter', label: 'X / Twitter' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

const SOCIAL_ICONS: Record<keyof SocialLinks, typeof Globe> = {
  facebook: Globe,
  instagram: Camera,
  linkedin: Briefcase,
  youtube: Play,
  twitter: AtSign,
  telegram: Send,
  whatsapp: MessageCircle,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s\-()]{7,20}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

interface FormState {
  contact: SiteContact;
  socialLinks: SocialLinks;
}

const EMPTY_CONTACT: SiteContact = {
  companyName: '', email: '', phone: '', alternatePhone: '', whatsappNumber: '',
  address: '', city: '', state: '', country: '', postalCode: '', gstin: '', businessHours: '',
};
const EMPTY_SOCIAL: SocialLinks = {
  facebook: '', instagram: '', linkedin: '', youtube: '', twitter: '', telegram: '', whatsapp: '',
};

function toForm(s: SiteSettingsAdmin): FormState {
  return {
    contact: { ...EMPTY_CONTACT, ...(s.contact ?? {}) },
    socialLinks: { ...EMPTY_SOCIAL, ...(s.socialLinks ?? {}) },
  };
}

export function SiteSettingsWorkspace() {
  const toast = useToast();
  const settings = useSiteSettingsAdmin();
  const update = useUpdateSiteSettings();
  const [v, setV] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const data = settings.data;
  const form: FormState = v ?? (data ? toForm(data) : { contact: EMPTY_CONTACT, socialLinks: EMPTY_SOCIAL });

  const [prevStamp, setPrevStamp] = useState(data?.updatedAt);
  if (data && data.updatedAt !== prevStamp) {
    setPrevStamp(data.updatedAt);
    setV(toForm(data));
  }

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

  function setContact<K extends keyof SiteContact>(key: K, value: SiteContact[K]) {
    setV((s) => ({ ...(s ?? form), contact: { ...(s ?? form).contact, [key]: value } }));
    setErrors((e) => ({ ...e, [`contact.${key}`]: undefined }));
  }

  function setSocial<K extends keyof SocialLinks>(key: K, value: SocialLinks[K]) {
    setV((s) => ({ ...(s ?? form), socialLinks: { ...(s ?? form).socialLinks, [key]: value } }));
    setErrors((e) => ({ ...e, [`social.${key}`]: undefined }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const c = form.contact;
    if (c.email && !EMAIL_RE.test(c.email)) next['contact.email'] = 'Invalid email address.';
    for (const key of ['phone', 'alternatePhone', 'whatsappNumber'] as const) {
      if (c[key] && !PHONE_RE.test(c[key])) next[`contact.${key}`] = 'Use digits, spaces, +, - or parentheses (7–20 chars).';
    }
    if (c.gstin && !GSTIN_RE.test(c.gstin.trim().toUpperCase())) next['contact.gstin'] = 'Invalid GSTIN — expected 15 characters (e.g. 22AAAAA0000A1Z5).';
    for (const f of SOCIAL_FIELDS) {
      const url = form.socialLinks[f.key];
      if (url && !/^https?:\/\//i.test(url)) next[`social.${f.key}`] = 'Must start with http:// or https://.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || update.isPending) return;
    const input: UpdateSiteSettingsInput = {
      contact: { ...form.contact, gstin: form.contact.gstin.trim().toUpperCase() },
      socialLinks: form.socialLinks,
    };
    update.mutate(input, {
      onSuccess: () => toast.success('Site settings saved', 'Public contact and social info updated.'),
      onError: (err) => toast.error('Could not save settings', normalizeApiError(err).message),
    });
  }

  if (settings.isError) {
    return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  }
  if (!data || !v) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const configuredSocial = SOCIAL_FIELDS.filter((f) => form.socialLinks[f.key].trim());

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <div className="min-w-0 space-y-4">
        {dirty ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300" role="status">
            You have unsaved changes — save before leaving this page.
          </p>
        ) : null}

        <Card className="space-y-4 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Building2 className="size-4 text-primary" aria-hidden /> Contact information
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CONTACT_FIELDS.map((f) => (
              <div key={f.key} className={f.textarea ? 'sm:col-span-2' : undefined}>
                <Field
                  id={`contact-${f.key}`}
                  label={f.label}
                  hint={f.hint}
                  error={errors[`contact.${f.key}`]}
                >
                  {f.textarea ? (
                    <Textarea id={`contact-${f.key}`} rows={2} value={form.contact[f.key]} onChange={(e) => setContact(f.key, e.target.value as SiteContact[typeof f.key])} maxLength={f.max} />
                  ) : (
                    <Input id={`contact-${f.key}`} value={form.contact[f.key]} onChange={(e) => setContact(f.key, e.target.value as SiteContact[typeof f.key])} maxLength={f.max} />
                  )}
                </Field>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Share2 className="size-4 text-primary" aria-hidden /> Social media links
          </h2>
          <p className="text-xs text-ink-muted">Leave a field empty to hide that platform on the public site.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SOCIAL_FIELDS.map((f) => {
              const Icon = SOCIAL_ICONS[f.key];
              return (
                <Field key={f.key} id={`social-${f.key}`} label={f.label} error={errors[`social.${f.key}`]}>
                  <div className="relative">
                    <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                    <Input
                      id={`social-${f.key}`}
                      value={form.socialLinks[f.key]}
                      onChange={(e) => setSocial(f.key, e.target.value)}
                      placeholder="https://…"
                      maxLength={500}
                      className="pl-9"
                      inputMode="url"
                    />
                  </div>
                </Field>
              );
            })}
          </div>
        </Card>

        <PublicSettingsCard />
      </div>

      <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
        <Card className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-ink">Social preview</h3>
          {configuredSocial.length === 0 ? (
            <p className="text-xs text-ink-muted">No social links configured yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {configuredSocial.map((f) => {
                const Icon = SOCIAL_ICONS[f.key];
                return (
                  <li key={f.key} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2">
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-ink">{f.label}</span>
                      <span className="block truncate text-[11px] text-ink-subtle">{form.socialLinks[f.key]}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-ink">Contact summary</h3>
          <dl className="space-y-2 text-xs">
            {[
              ['Company', form.contact.companyName || '—'],
              ['Email', form.contact.email || '—'],
              ['Phone', form.contact.phone || '—'],
              ['WhatsApp', form.contact.whatsappNumber || '—'],
              ['Location', [form.contact.city, form.contact.state, form.contact.country].filter(Boolean).join(', ') || '—'],
              ['GSTIN', form.contact.gstin || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="shrink-0 text-ink-subtle">{label}</dt>
                <dd className="min-w-0 truncate text-right text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

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
    </form>
  );
}

// ---------------- Public verification ----------------

function PublicSettingsCard() {
  const publicSettings = usePublicSiteSettings(false);
  const [showPublic, setShowPublic] = useState(false);

  function load() {
    setShowPublic(true);
    publicSettings.refetch();
  }

  const pub = publicSettings.data;
  const configuredSocial = pub ? SOCIAL_FIELDS.filter((f) => pub.socialLinks[f.key]) : [];

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Globe className="size-4 text-primary" aria-hidden /> Public endpoint check
          </h3>
          <p className="text-xs text-ink-muted">
            GET /site-settings returns only public contact/social fields — private admin data is never exposed.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={load} disabled={publicSettings.isFetching}>
          <RefreshCw className={cn('size-3.5', publicSettings.isFetching && 'animate-spin')} aria-hidden />
          {showPublic ? 'Refresh' : 'Load public view'}
        </Button>
      </div>

      {showPublic ? (
        publicSettings.isError ? (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {normalizeApiError(publicSettings.error).message}
          </p>
        ) : publicSettings.isPending || !pub ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {[
                ['Company', pub.contact.companyName],
                ['Email', pub.contact.email],
                ['Phone', pub.contact.phone],
                ['WhatsApp', pub.contact.whatsappNumber],
                ['Address', [pub.contact.address, pub.contact.city, pub.contact.state, pub.contact.country, pub.contact.postalCode].filter(Boolean).join(', ')],
                ['GSTIN', pub.contact.gstin],
                ['Business hours', pub.contact.businessHours],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="w-24 shrink-0 text-ink-subtle">{label}</dt>
                  <dd className="min-w-0 break-words text-ink">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Social links ({configuredSocial.length})</p>
              {configuredSocial.length === 0 ? (
                <p className="text-xs text-ink-muted">None configured publicly.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {configuredSocial.map((f) => {
                    const Icon = SOCIAL_ICONS[f.key];
                    return (
                      <li key={f.key}>
                        <a
                          href={pub.socialLinks[f.key]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted hover:border-primary/40 hover:text-ink"
                        >
                          <Icon className="size-3.5" aria-hidden /> {f.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-ink-subtle">
              <Mail className="mt-0.5 size-3 shrink-0" aria-hidden />
              Public values are cached server-side for up to 5 minutes after a save.
            </p>
          </div>
        )
      ) : null}
    </Card>
  );
}
