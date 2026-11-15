'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { CourseCategory } from '@/types/categories';
import { useCreateBlogCategory, useCreateCategory, useUpdateCategory } from '../hooks';
import {
  diffCategory,
  initialCategoryValues,
  selfAndDescendants,
  toBlogCategoryInput,
  toCategoryInput,
  validateBlogCategory,
  validateCategory,
  type BlogCategoryFormValues,
  type CategoryFormValues,
  type FormErrors,
} from '../validation';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fieldErrorsFrom<T extends object>(error: unknown, keys: Array<keyof T>): { fields: FormErrors<T>; message: string } {
  const { message, fieldErrors, code } = normalizeApiError(error);
  const fields: FormErrors<T> = {};
  for (const issue of fieldErrors) {
    const key = issue.path.split('.')[0] as keyof T;
    if (keys.includes(key) && !fields[key]) fields[key] = issue.message;
  }
  if ((code === 'DUPLICATE_SLUG' || code === 'DUPLICATE_KEY') && keys.includes('slug' as keyof T)) fields['slug' as keyof T] = 'This slug is already used.';
  return { fields, message };
}

interface CategoryFormDialogProps {
  mode: 'create' | 'edit';
  category?: CourseCategory;
  all: CourseCategory[];
  onClose: () => void;
}

/** Rendered with a `key` per category so state resets when the target changes. */
export function CategoryFormDialog({ mode, category, all, onClose }: CategoryFormDialogProps) {
  const toast = useToast();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const pending = create.isPending || update.isPending;
  const inFlight = useRef(false);
  const nextOrder = all.length ? Math.max(...all.map((c) => c.sortOrder)) + 1 : 0;
  const [values, setValues] = useState<CategoryFormValues>(() => initialCategoryValues(category, nextOrder));
  const [errors, setErrors] = useState<FormErrors<CategoryFormValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');

  const blocked = category ? selfAndDescendants(category.id, all) : new Set<string>();
  const parentOptions = all.filter((c) => !blocked.has(c.id));

  function set<K extends keyof CategoryFormValues>(key: K, value: CategoryFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || inFlight.current) return;
    setFormError(null);
    const found = validateCategory(values);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    const onError = (error: unknown) => {
      const { fields, message } = fieldErrorsFrom<CategoryFormValues>(error, ['name', 'slug', 'description', 'parentCategoryId', 'status', 'sortOrder']);
      if (normalizeApiError(error).code === 'INVALID_PARENT' || normalizeApiError(error).code === 'CIRCULAR_CATEGORY') fields.parentCategoryId = message;
      setErrors(fields);
      setFormError(message);
      toast.error(mode === 'create' ? 'Could not create category' : 'Could not save category', message);
    };
    const onSettled = () => {
      inFlight.current = false;
    };

    if (mode === 'create') {
      inFlight.current = true;
      create.mutate(toCategoryInput(values), {
        onSuccess: (created) => {
          toast.success('Category created', created.name);
          onClose();
        },
        onError,
        onSettled,
      });
      return;
    }
    if (!category) return;
    const body = diffCategory(category, values);
    if (!Object.keys(body).length) {
      toast.notify({ tone: 'info', title: 'No changes to save' });
      return;
    }
    inFlight.current = true;
    update.mutate(
      { id: category.id, input: body },
      {
        onSuccess: (updated) => {
          toast.success('Category updated', updated.name);
          onClose();
        },
        onError,
        onSettled,
      }
    );
  }

  const formId = `category-form-${mode}`;

  return (
    <Dialog
      open
      onClose={onClose}
      busy={pending}
      size="lg"
      title={mode === 'create' ? 'Create course category' : `Edit ${category?.name ?? 'category'}`}
      description="Categories group courses in the catalogue and filters."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {mode === 'create' ? 'Create category' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        {formError ? (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger sm:col-span-2" role="alert">
            {formError}
          </p>
        ) : null}
        <Field id="cat-name" label="Name" required error={errors.name}>
          <Input
            id="cat-name"
            value={values.name}
            onChange={(e) => {
              set('name', e.target.value);
              if (!slugTouched) set('slug', slugify(e.target.value));
            }}
            placeholder="Quality Assurance"
            aria-invalid={Boolean(errors.name)}
            aria-describedby="cat-name-msg"
          />
        </Field>
        <Field id="cat-slug" label="Slug" error={errors.slug} hint="Generated from the name when empty.">
          <Input
            id="cat-slug"
            value={values.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set('slug', e.target.value);
            }}
            placeholder="quality-assurance"
            aria-invalid={Boolean(errors.slug)}
            aria-describedby="cat-slug-msg"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field id="cat-description" label="Description" error={errors.description} hint={`${values.description.length}/2000`}>
            <Textarea id="cat-description" rows={3} value={values.description} onChange={(e) => set('description', e.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby="cat-description-msg" />
          </Field>
        </div>
        <Field id="cat-parent" label="Parent category" error={errors.parentCategoryId} hint={mode === 'edit' ? 'A category cannot be nested under itself or its children.' : undefined}>
          <Select id="cat-parent" value={values.parentCategoryId} onChange={(e) => set('parentCategoryId', e.target.value)} aria-invalid={Boolean(errors.parentCategoryId)} aria-describedby="cat-parent-msg">
            <option value="">None (top level)</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="cat-status" label="Status">
            <Select id="cat-status" value={values.status} onChange={(e) => set('status', e.target.value as CategoryFormValues['status'])}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <Field id="cat-sort" label="Sort order" error={errors.sortOrder}>
            <Input id="cat-sort" type="number" step={1} value={values.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} aria-invalid={Boolean(errors.sortOrder)} aria-describedby="cat-sort-msg" />
          </Field>
        </div>
        <Field id="cat-image-url" label="Image URL" error={errors.imageUrl} hint="Optional Cloudinary secure URL.">
          <Input id="cat-image-url" value={values.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://res.cloudinary.com/…" aria-invalid={Boolean(errors.imageUrl)} aria-describedby="cat-image-url-msg" />
        </Field>
        <Field id="cat-image-id" label="Image public ID" error={errors.imagePublicId}>
          <Input id="cat-image-id" value={values.imagePublicId} onChange={(e) => set('imagePublicId', e.target.value)} aria-invalid={Boolean(errors.imagePublicId)} aria-describedby="cat-image-id-msg" />
        </Field>
        <Field id="cat-meta-title" label="Meta title" error={errors.metaTitle} hint={`${values.metaTitle.length}/120`}>
          <Input id="cat-meta-title" value={values.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} aria-invalid={Boolean(errors.metaTitle)} aria-describedby="cat-meta-title-msg" />
        </Field>
        <Field id="cat-meta-description" label="Meta description" error={errors.metaDescription} hint={`${values.metaDescription.length}/300`}>
          <Input id="cat-meta-description" value={values.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} aria-invalid={Boolean(errors.metaDescription)} aria-describedby="cat-meta-description-msg" />
        </Field>
      </form>
    </Dialog>
  );
}

export function BlogCategoryFormDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const create = useCreateBlogCategory();
  const inFlight = useRef(false);
  const [values, setValues] = useState<BlogCategoryFormValues>({ name: '', slug: '', description: '', status: 'published' });
  const [errors, setErrors] = useState<FormErrors<BlogCategoryFormValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  function set<K extends keyof BlogCategoryFormValues>(key: K, value: BlogCategoryFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending || inFlight.current) return;
    setFormError(null);
    const found = validateBlogCategory(values);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    inFlight.current = true;
    create.mutate(toBlogCategoryInput(values), {
      onSuccess: (created) => {
        toast.success(
          'Blog category created',
          created.status === 'draft' ? `${created.name} is a draft, so it will not appear in the published list.` : created.name
        );
        onClose();
      },
      onError: (error) => {
        const { fields, message } = fieldErrorsFrom<BlogCategoryFormValues>(error, ['name', 'slug', 'description', 'status']);
        setErrors(fields);
        setFormError(message);
        toast.error('Could not create blog category', message);
      },
      onSettled: () => {
        inFlight.current = false;
      },
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={create.isPending}
      title="Create blog category"
      description="Blog categories organise posts on the public blog."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="blog-category-form" loading={create.isPending}>
            Create category
          </Button>
        </>
      }
    >
      <form id="blog-category-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError ? (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <Field id="blog-cat-name" label="Name" required error={errors.name}>
          <Input
            id="blog-cat-name"
            value={values.name}
            onChange={(e) => {
              set('name', e.target.value);
              if (!slugTouched) set('slug', slugify(e.target.value));
            }}
            placeholder="Regulatory updates"
            aria-invalid={Boolean(errors.name)}
            aria-describedby="blog-cat-name-msg"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="blog-cat-slug" label="Slug" error={errors.slug} hint="Generated from the name when empty.">
            <Input
              id="blog-cat-slug"
              value={values.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
              aria-invalid={Boolean(errors.slug)}
              aria-describedby="blog-cat-slug-msg"
            />
          </Field>
          <Field id="blog-cat-status" label="Status">
            <Select id="blog-cat-status" value={values.status} onChange={(e) => set('status', e.target.value as BlogCategoryFormValues['status'])}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </Select>
          </Field>
        </div>
        <Field id="blog-cat-description" label="Description" error={errors.description} hint={`${values.description.length}/1000`}>
          <Textarea id="blog-cat-description" rows={3} value={values.description} onChange={(e) => set('description', e.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby="blog-cat-description-msg" />
        </Field>
      </form>
    </Dialog>
  );
}
