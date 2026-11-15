'use client';

import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { Blog, BlogStatus, UpdateBlogSeoInput } from '@/types/blogs';
import { BLOG_STATUS_LABEL } from '../display';
import { useBlogPreview, useBlogSeo, useCreateBlogCategory, useDeleteBlog, useSetBlogStatus, useUpdateBlogSeo } from '../hooks';

type BlogLike = Pick<Blog, 'id' | 'title' | 'slug' | 'status'>;

// ---------------- Status ----------------

/** Publish / unpublish / archive with confirmation. */
export function BlogStatusDialog({
  blog,
  target,
  onClose,
  onDone,
}: {
  blog: BlogLike;
  target: BlogStatus;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const update = useSetBlogStatus();
  const label = BLOG_STATUS_LABEL[target];

  function confirm() {
    if (update.isPending) return;
    update.mutate(
      { id: blog.id, status: target },
      {
        onSuccess: () => {
          toast.success(`Blog ${label.toLowerCase()}`, target === 'published' ? 'Now visible on the public blog.' : undefined);
          onClose();
          onDone?.();
        },
        onError: (e) => toast.error(`Could not ${label.toLowerCase()} blog`, normalizeApiError(e).message),
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${label} this blog?`}
      description={blog.title}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={update.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {update.isPending ? 'Saving…' : label}
          </button>
        </div>
      }
    >
      <p className="text-sm text-ink-muted">
        {target === 'published'
          ? 'Published blogs appear on the public blog listing and article pages. Title and content are required.'
          : target === 'archived'
            ? 'Archived blogs are hidden from the public site but kept for reference.'
            : 'Draft blogs are hidden from the public site until published.'}
      </p>
    </Dialog>
  );
}

// ---------------- Delete ----------------

/** Soft delete — backend archives + sets deletedAt. */
export function BlogDeleteDialog({
  blog,
  onClose,
  onDone,
}: {
  blog: BlogLike;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const remove = useDeleteBlog();

  function confirm() {
    remove.mutate(blog.id, {
      onSuccess: () => {
        toast.success('Blog deleted', 'The blog was archived and removed from the list.');
        onClose();
        onDone?.();
      },
      onError: (e) => toast.error('Could not delete blog', normalizeApiError(e).message),
    });
  }

  return (
    <ConfirmDialog
      open
      title="Delete this blog?"
      tone="danger"
      confirmLabel="Delete blog"
      loading={remove.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
            <p className="text-sm font-medium text-ink">{blog.title}</p>
            <p className="mt-0.5 text-xs text-ink-muted">/{blog.slug}</p>
          </div>
          <p>
            This is a <span className="font-medium text-ink">soft delete</span>: the blog is archived and hidden from admin
            and public lists but retained in the database.
          </p>
        </div>
      }
    />
  );
}

// ---------------- SEO ----------------

const SEO_LIMITS = {
  seoTitle: 120,
  metaDescription: 320,
  canonicalUrl: 1000,
  ogTitle: 120,
  ogDescription: 320,
  ogImage: 1000,
} as const;

interface SeoForm {
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  schemaType: string;
}

/** Dedicated SEO editor backed by GET/PATCH /admin/blogs/:id/seo. */
export function BlogSeoDialog({ blog, onClose }: { blog: BlogLike; onClose: () => void }) {
  const toast = useToast();
  const seoQuery = useBlogSeo(blog.id);
  const update = useUpdateBlogSeo(blog.id);
  const [v, setV] = useState<SeoForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof SeoForm, string>>>({});

  const data = seoQuery.data;
  const form: SeoForm = v ?? {
    seoTitle: data?.seo.seoTitle ?? '',
    metaDescription: data?.seo.metaDescription ?? '',
    canonicalUrl: data?.seo.canonicalUrl ?? '',
    robotsIndex: data?.seo.robotsIndex !== false,
    robotsFollow: data?.seo.robotsFollow !== false,
    ogTitle: data?.seo.ogTitle ?? '',
    ogDescription: data?.seo.ogDescription ?? '',
    ogImage: data?.seo.ogImage ?? '',
    schemaType: data?.seo.schemaType ?? 'BlogPosting',
  };

  function set<K extends keyof SeoForm>(key: K, value: SeoForm[K]) {
    setV((s) => ({ ...(s ?? form), [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof SeoForm, string>> = {};
    for (const key of ['seoTitle', 'ogTitle'] as const) {
      if (form[key].length > SEO_LIMITS[key]) next[key] = `${SEO_LIMITS[key]} characters or less.`;
    }
    for (const key of ['metaDescription', 'ogDescription'] as const) {
      if (form[key].length > SEO_LIMITS[key]) next[key] = `${SEO_LIMITS[key]} characters or less.`;
    }
    if (form.canonicalUrl.length > SEO_LIMITS.canonicalUrl) next.canonicalUrl = `${SEO_LIMITS.canonicalUrl} characters or less.`;
    if (form.ogImage.length > SEO_LIMITS.ogImage) next.ogImage = `${SEO_LIMITS.ogImage} characters or less.`;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || update.isPending) return;
    const input: UpdateBlogSeoInput = {
      seoTitle: form.seoTitle || undefined,
      metaDescription: form.metaDescription || undefined,
      canonicalUrl: form.canonicalUrl || undefined,
      robotsIndex: form.robotsIndex,
      robotsFollow: form.robotsFollow,
      ogTitle: form.ogTitle || undefined,
      ogDescription: form.ogDescription || undefined,
      ogImage: form.ogImage || undefined,
      schemaType: form.schemaType || undefined,
    };
    update.mutate(input, {
      onSuccess: () => {
        toast.success('SEO settings saved');
        onClose();
      },
      onError: (err) => toast.error('Could not save SEO', normalizeApiError(err).message),
    });
  }

  const serpTitle = form.seoTitle || blog.title;
  const serpDesc = form.metaDescription || '';

  return (
    <Dialog
      open
      onClose={() => !update.isPending && onClose()}
      title="SEO settings"
      description={`${blog.title} · /${data?.slug ?? blog.slug}`}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={update.isPending} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" form="blog-seo-form" disabled={update.isPending || seoQuery.isPending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
            {update.isPending ? 'Saving…' : 'Save SEO'}
          </button>
        </div>
      }
    >
      {seoQuery.isError ? (
        <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
          {normalizeApiError(seoQuery.error).message}
        </div>
      ) : seoQuery.isPending ? (
        <p className="text-sm text-ink-muted">Loading SEO settings…</p>
      ) : (
        <form id="blog-seo-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Search preview</p>
            <p className="truncate text-sm text-primary">{data?.seo.canonicalUrl || 'https://…'}</p>
            <p className="truncate text-base text-ink">{serpTitle}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{serpDesc || 'Add a meta description to control how this post appears in search results.'}</p>
          </div>

          <Field id="seo-title" label="SEO title" error={errors.seoTitle} hint={`${form.seoTitle.length}/${SEO_LIMITS.seoTitle} · defaults to the blog title`}>
            <Input id="seo-title" value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} maxLength={SEO_LIMITS.seoTitle} />
          </Field>
          <Field id="seo-desc" label="Meta description" error={errors.metaDescription} hint={`${form.metaDescription.length}/${SEO_LIMITS.metaDescription}`}>
            <Textarea id="seo-desc" rows={3} value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} maxLength={SEO_LIMITS.metaDescription} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="seo-canonical" label="Canonical URL" error={errors.canonicalUrl} hint="Leave empty to auto-generate">
              <Input id="seo-canonical" value={form.canonicalUrl} onChange={(e) => set('canonicalUrl', e.target.value)} maxLength={SEO_LIMITS.canonicalUrl} placeholder={data?.seo.canonicalUrl || 'https://…'} />
            </Field>
            <Field id="seo-schema" label="Schema type" hint="Structured-data type">
              <Input id="seo-schema" value={form.schemaType} onChange={(e) => set('schemaType', e.target.value)} placeholder="BlogPosting" />
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Robots</legend>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.robotsIndex} onChange={(e) => set('robotsIndex', e.target.checked)} className="size-4 rounded border-line text-primary focus:ring-primary" />
              Allow indexing
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.robotsFollow} onChange={(e) => set('robotsFollow', e.target.checked)} className="size-4 rounded border-line text-primary focus:ring-primary" />
              Allow following links
            </label>
          </fieldset>

          <div className="border-t border-line pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Open Graph (social)</p>
            <div className="space-y-4">
              <Field id="og-title" label="OG title" error={errors.ogTitle} hint={`${form.ogTitle.length}/${SEO_LIMITS.ogTitle}`}>
                <Input id="og-title" value={form.ogTitle} onChange={(e) => set('ogTitle', e.target.value)} maxLength={SEO_LIMITS.ogTitle} />
              </Field>
              <Field id="og-desc" label="OG description" error={errors.ogDescription} hint={`${form.ogDescription.length}/${SEO_LIMITS.ogDescription}`}>
                <Textarea id="og-desc" rows={2} value={form.ogDescription} onChange={(e) => set('ogDescription', e.target.value)} maxLength={SEO_LIMITS.ogDescription} />
              </Field>
              <Field id="og-image" label="OG image URL" error={errors.ogImage} hint={`${form.ogImage.length}/${SEO_LIMITS.ogImage}`}>
                <Input id="og-image" value={form.ogImage} onChange={(e) => set('ogImage', e.target.value)} maxLength={SEO_LIMITS.ogImage} placeholder="https://…" />
              </Field>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  );
}

// ---------------- Preview ----------------

/** Generates a short-lived private preview token and opens it on the public site. */
export function BlogPreviewButton({ blog }: { blog: BlogLike }) {
  const toast = useToast();
  const preview = useBlogPreview();

  function open() {
    preview.mutate(blog.id, {
      onSuccess: (data) => {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        toast.success('Preview opened', `Link expires ${new Date(data.expiresAt).toLocaleTimeString()}.`);
      },
      onError: (e) => toast.error('Could not create preview', normalizeApiError(e).message),
    });
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={preview.isPending}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
    >
      {preview.isPending ? 'Generating…' : 'Preview'}
    </button>
  );
}

// ---------------- Category ----------------

/** Creates a blog category via POST /admin/blogs/categories. */
export function CategoryCreateDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const create = useCreateBlogCategory();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (create.isPending) return;
    if (name.trim().length < 2) {
      setError('Category name must be at least 2 characters.');
      return;
    }
    create.mutate(
      { name: name.trim(), description: description.trim() || undefined, status: 'published' },
      {
        onSuccess: () => {
          toast.success('Category created', name.trim());
          setName('');
          setDescription('');
          onClose();
          onDone?.();
        },
        onError: (err) => {
          const msg = normalizeApiError(err).message;
          setError(msg);
          toast.error('Could not create category', msg);
        },
      }
    );
  }

  return (
    <Dialog
      open={open}
      onClose={() => !create.isPending && onClose()}
      title="New blog category"
      description="Categories group posts on the public blog."
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={create.isPending} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" form="blog-category-form" disabled={create.isPending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
            {create.isPending ? 'Creating…' : 'Create category'}
          </button>
        </div>
      }
    >
      <form id="blog-category-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field id="cat-name" label="Name" error={error ?? undefined} hint="Slug is generated automatically.">
          <Input id="cat-name" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} maxLength={120} required />
        </Field>
        <Field id="cat-desc" label="Description" hint="Optional">
          <Textarea id="cat-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </Field>
      </form>
    </Dialog>
  );
}
