'use client';

import { ImageIcon, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { Blog, BlogFeaturedImage, CreateBlogInput } from '@/types/blogs';
import type { MediaAsset } from '@/types/media';
import { MediaPickerDialog } from '@/features/media/components/media-picker-dialog';
import { BLOG_STATUS_LABEL, BlogStatusBadge } from '../display';
import { useBlogCategories, useCreateBlog, useUpdateBlog } from '../hooks';

const TITLE_MAX = 200;
const SLUG_MAX = 200;
const EXCERPT_MAX = 500;
const CONTENT_MAX = 200000;
const TAGS_MAX = 30;

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tags: string;
  categoryIds: string[];
  isFeatured: boolean;
  featuredImage: BlogFeaturedImage | null;
}

function toForm(blog?: Blog | null): FormState {
  return {
    title: blog?.title ?? '',
    slug: blog?.slug ?? '',
    excerpt: blog?.excerpt ?? '',
    content: blog?.content ?? '',
    tags: (blog?.tags ?? []).join(', '),
    categoryIds: blog?.categoryIds ?? [],
    isFeatured: blog?.isFeatured ?? false,
    featuredImage: blog?.featuredImage ?? null,
  };
}

function slugifyLocal(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function mediaToFeaturedImage(m: MediaAsset): BlogFeaturedImage {
  const ext = m.mimeType.split('/')[1] || 'jpg';
  return {
    provider: 'cloudinary',
    publicId: m.publicId ?? '',
    secureUrl: m.secureUrl ?? '',
    width: m.width ?? undefined,
    height: m.height ?? undefined,
    format: ext,
    bytes: m.sizeBytes,
  };
}

/** Full-screen blog editor — create (always draft) or edit. */
export function BlogEditorDialog({
  open,
  blog,
  onClose,
  onDone,
}: {
  open: boolean;
  blog: Blog | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const create = useCreateBlog();
  const update = useUpdateBlog();
  const categories = useBlogCategories();
  const [v, setV] = useState<FormState>(() => toForm(blog));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(blog?.slug));
  const pending = create.isPending || update.isPending;
  const isEdit = Boolean(blog);

  const dirty = useMemo(() => {
    if (!blog) return v.title.trim() !== '' || v.content.trim() !== '';
    const f = toForm(blog);
    return (
      v.title !== f.title ||
      v.slug !== f.slug ||
      v.excerpt !== f.excerpt ||
      v.content !== f.content ||
      v.tags !== f.tags ||
      v.isFeatured !== f.isFeatured ||
      JSON.stringify(v.categoryIds) !== JSON.stringify(f.categoryIds) ||
      JSON.stringify(v.featuredImage) !== JSON.stringify(f.featuredImage)
    );
  }, [v, blog]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function onTitleChange(title: string) {
    setV((s) => ({
      ...s,
      title,
      slug: slugTouched ? s.slug : slugifyLocal(title).slice(0, SLUG_MAX),
    }));
    setErrors((e) => ({ ...e, title: undefined, slug: undefined }));
  }

  function parseTags(raw: string): string[] {
    return [...new Set(raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, TAGS_MAX);
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (v.title.trim().length < 3) next.title = 'Title must be at least 3 characters.';
    else if (v.title.trim().length > TITLE_MAX) next.title = `Title must be ${TITLE_MAX} characters or less.`;
    if (v.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug.trim())) {
      next.slug = 'Slug may only contain lowercase letters, numbers and hyphens.';
    } else if (v.slug.trim().length > SLUG_MAX) {
      next.slug = `Slug must be ${SLUG_MAX} characters or less.`;
    }
    if (v.excerpt.length > EXCERPT_MAX) next.excerpt = `Excerpt must be ${EXCERPT_MAX} characters or less.`;
    if (!v.content.trim()) next.content = 'Content is required.';
    else if (v.content.length > CONTENT_MAX) next.content = `Content must be ${CONTENT_MAX.toLocaleString()} characters or less.`;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || pending) return;
    const input: CreateBlogInput = {
      title: v.title.trim(),
      slug: v.slug.trim() || undefined,
      excerpt: v.excerpt.trim() || undefined,
      content: v.content,
      categoryIds: v.categoryIds,
      tags: parseTags(v.tags),
      isFeatured: v.isFeatured,
      featuredImage: v.featuredImage,
    };
    if (isEdit && blog) {
      update.mutate(
        { id: blog.id, input },
        {
          onSuccess: () => {
            toast.success('Blog saved', blog.status === 'published' && v.slug !== blog.slug ? 'Slug changed — a 301 redirect was created for the old URL.' : undefined);
            onClose();
            onDone?.();
          },
          onError: (err) => toast.error('Could not save blog', normalizeApiError(err).message),
        }
      );
    } else {
      create.mutate(input, {
        onSuccess: () => {
          toast.success('Blog created', 'New blogs start as drafts — publish when ready.');
          onClose();
          onDone?.();
        },
        onError: (err) => toast.error('Could not create blog', normalizeApiError(err).message),
      });
    }
  }

  function handleClose() {
    if (pending) return;
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  }

  function toggleCategory(id: string) {
    setV((s) => ({
      ...s,
      categoryIds: s.categoryIds.includes(id) ? s.categoryIds.filter((c) => c !== id) : [...s.categoryIds, id],
    }));
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        title={isEdit ? 'Edit blog' : 'New blog'}
        description={
          isEdit && blog
            ? `${BLOG_STATUS_LABEL[blog.status]} · ${blog.readingTime} min read · ${blog.viewsCount} views`
            : 'Created as a draft — publish when ready.'
        }
        size="full"
        busy={pending}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-ink-muted">
              {isEdit && blog ? <BlogStatusBadge status={blog.status} /> : 'Draft'}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" form="blog-form" disabled={pending || !dirty && isEdit}>
                {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create draft'}
              </Button>
            </div>
          </div>
        }
      >
        <form id="blog-form" onSubmit={submit} className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]" noValidate>
          <div className="min-w-0 space-y-4">
            <Field id="blog-title" label="Title" error={errors.title} hint={`${v.title.trim().length.toLocaleString('en-IN')}/${TITLE_MAX}`}>
              <Input id="blog-title" value={v.title} onChange={(e) => onTitleChange(e.target.value)} maxLength={TITLE_MAX} required />
            </Field>
            <Field id="blog-slug" label="Slug" error={errors.slug} hint="Leave empty to auto-generate from the title. Changing a published slug creates a 301 redirect.">
              <Input id="blog-slug" value={v.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugifyLocal(e.target.value)); }} maxLength={SLUG_MAX} placeholder="auto-generated" />
            </Field>
            <Field id="blog-excerpt" label="Excerpt" error={errors.excerpt} hint={`${v.excerpt.length}/${EXCERPT_MAX} · short summary shown in listings`}>
              <Textarea id="blog-excerpt" rows={2} value={v.excerpt} onChange={(e) => set('excerpt', e.target.value)} maxLength={EXCERPT_MAX} />
            </Field>
            <Field
              id="blog-content"
              label="Content"
              error={errors.content}
              hint={`${v.content.length.toLocaleString('en-IN')}/${CONTENT_MAX.toLocaleString('en-IN')} · HTML allowed, sanitized server-side`}
            >
              <Textarea id="blog-content" rows={18} value={v.content} onChange={(e) => set('content', e.target.value)} className="font-mono text-[13px]" required />
            </Field>
          </div>

          <aside className="min-w-0 space-y-4">
            <section aria-label="Featured image" className="rounded-lg border border-line p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Featured image</p>
              {v.featuredImage?.secureUrl ? (
                <div className="relative overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL */}
                  <img src={v.featuredImage.secureUrl} alt="Featured" className="aspect-video w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => set('featuredImage', null)}
                    aria-label="Remove featured image"
                    className="absolute right-1.5 top-1.5 rounded-md bg-overlay/70 p-1 text-white hover:bg-overlay"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-field-border bg-surface-2/40 text-ink-muted transition hover:border-primary/50 hover:text-ink"
                >
                  <ImageIcon className="size-6" aria-hidden />
                  <span className="text-xs font-medium">Choose image</span>
                </button>
              )}
            </section>

            <section aria-label="Categories" className="rounded-lg border border-line p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Categories</p>
              {categories.isPending ? (
                <p className="text-xs text-ink-muted">Loading…</p>
              ) : (categories.data ?? []).length === 0 ? (
                <p className="text-xs text-ink-muted">No categories yet — create one from the Blogs page.</p>
              ) : (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                  {(categories.data ?? []).map((c) => (
                    <li key={c.id}>
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={v.categoryIds.includes(c.id)}
                          onChange={() => toggleCategory(c.id)}
                          className="size-4 rounded border-line text-primary focus:ring-primary"
                        />
                        <span className="truncate">{c.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Tags" className="rounded-lg border border-line p-3">
              <Field id="blog-tags" label="Tags" hint="Comma-separated, max 30">
                <Input id="blog-tags" value={v.tags} onChange={(e) => set('tags', e.target.value)} placeholder="csv, validation, gmp" />
              </Field>
            </section>

            <section aria-label="Options" className="rounded-lg border border-line p-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={v.isFeatured}
                  onChange={(e) => set('isFeatured', e.target.checked)}
                  className="size-4 rounded border-line text-primary focus:ring-primary"
                />
                Feature this post
              </label>
            </section>
          </aside>
        </form>
      </Dialog>

      {pickerOpen ? (
        <MediaPickerDialog
          title="Choose featured image"
          category="course_thumbnail"
          multiple={false}
          onClose={() => setPickerOpen(false)}
          onSelect={(media) => {
            const m = media[0];
            if (m?.secureUrl) set('featuredImage', mediaToFeaturedImage(m));
          }}
        />
      ) : null}
    </>
  );
}
