'use client';

import {
  Check,
  ChevronDown,
  CircleAlert,
  CloudUpload,
  FileText,
  Globe,
  ImageIcon,
  Images,
  IndianRupee,
  ListChecks,
  Search,
  Settings2,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate, titleCase } from '@/lib/format';
import { displayName } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import { COURSE_LEVELS, COURSE_TYPES, CURRENCIES, DURATION_UNITS, type Course, type CourseInput, type CourseType } from '@/types/courses';
import type { MediaAsset } from '@/types/media';
import { useCourseCategories } from '@/features/categories/hooks';
import { useStaffRoster } from '@/features/instructors/hooks';
import { MediaPickerDialog } from '@/features/media/components/media-picker-dialog';
import { mediaPolicy } from '@/features/media/hooks';
import { useCreateCourse, useUpdateCourse } from '../hooks';
import { formatMoney, levelLabel } from '../display';
import {
  COURSE_FORM_TABS,
  diffCourseInput,
  initialCourseValues,
  tabOfField,
  toCourseInput,
  validateCourseForm,
  type CourseFormErrors,
  type CourseFormTab,
  type CourseFormValues,
} from '../form';
import { coursePolicy } from '../policy';
import { ListEditor, StringListEditor, Toggle, move } from './form-controls';

const SECTIONS: Record<CourseFormTab, { label: string; hint: string; icon: LucideIcon }> = {
  basics: { label: 'Basics', hint: 'Title, summary, people', icon: FileText },
  content: { label: 'Content', hint: 'Objectives, FAQs, tags', icon: ListChecks },
  media: { label: 'Media', hint: 'Thumbnail & gallery', icon: ImageIcon },
  pricing: { label: 'Pricing', hint: 'Price, sale & tax', icon: IndianRupee },
  settings: { label: 'Settings', hint: 'Certificate & access', icon: Settings2 },
  seo: { label: 'SEO', hint: 'Search appearance', icon: Globe },
};

interface CourseFormDialogProps {
  mode: 'create' | 'edit';
  course?: Course;
  onClose: () => void;
  /** Replaces `onClose` after a successful save when set. */
  onSaved?: (course: Course) => void;
}

type PickerState = { target: 'thumbnail' | 'gallery'; tab: 'library' | 'upload' } | null;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

function serverErrors(error: unknown): { fields: CourseFormErrors; message: string } {
  const { message, fieldErrors, code } = normalizeApiError(error);
  const fields: CourseFormErrors = {};
  for (const issue of fieldErrors) if (issue.path && !fields[issue.path]) fields[issue.path] = issue.message;
  if (code === 'INVALID_CATEGORIES') fields.categoryIds = message;
  if (code === 'INVALID_INSTRUCTORS') fields.instructorIds = message;
  if (code === 'INVALID_MEDIA') fields['thumbnail.secureUrl'] = message;
  if (/slug/i.test(message) && (code === 'DUPLICATE_KEY' || code === 'DUPLICATE_SLUG')) fields.slug = 'This slug is already used.';
  return { fields, message };
}

function Panel({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-line bg-surface p-4 sm:p-5', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Rendered with a `key` per course so state resets when the target changes. */
export function CourseFormDialog({ mode, course, onClose, onSaved }: CourseFormDialogProps) {
  const { user } = useAuth();
  const toast = useToast();
  const canPickCategories = coursePolicy.canPickCategories(user);
  const canPickInstructors = coursePolicy.canPickInstructors(user);
  const canBrowseMedia = mediaPolicy.canBrowse(user);
  const canUploadMedia = mediaPolicy.canUpload(user);
  const categories = useCourseCategories(canPickCategories);
  const roster = useStaffRoster(canPickInstructors);
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const pending = createCourse.isPending || updateCourse.isPending;
  // isPending updates after re-render; this blocks a second submit fired in the same tick
  const inFlight = useRef(false);

  const [values, setValues] = useState<CourseFormValues>(() => initialCourseValues(course));
  const [errors, setErrors] = useState<CourseFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [tab, setTab] = useState<CourseFormTab>('basics');
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [staffSearch, setStaffSearch] = useState('');
  const [picker, setPicker] = useState<PickerState>(null);
  const [manualMedia, setManualMedia] = useState(false);

  function patch(next: Partial<CourseFormValues>, clear: string[] = []) {
    setValues((v) => ({ ...v, ...next }));
    if (clear.length) {
      setErrors((e) => {
        const copy = { ...e };
        for (const key of Object.keys(copy)) if (clear.some((c) => key === c || key.startsWith(`${c}.`))) delete copy[key];
        return copy;
      });
    }
  }

  function patchNested<K extends 'pricing' | 'seo' | 'certificate' | 'enrollment' | 'expiry' | 'liveSession'>(key: K, next: Partial<CourseFormValues[K]>, clear: string[] = []) {
    setValues((v) => ({ ...v, [key]: { ...v[key], ...next } }));
    if (clear.length) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !clear.includes(k))));
  }

  const tabErrors = new Set(Object.keys(errors).map(tabOfField));

  function showErrors(found: CourseFormErrors) {
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) setTab(tabOfField(first));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || inFlight.current) return;
    setFormError(null);
    const found = validateCourseForm(values);
    if (Object.keys(found).length) {
      showErrors(found);
      return;
    }
    const onError = (error: unknown) => {
      const { fields, message } = serverErrors(error);
      showErrors(fields);
      setFormError(message);
      toast.error(mode === 'create' ? 'Could not create course' : 'Could not save course', message);
    };
    const onSettled = () => {
      inFlight.current = false;
    };

    if (mode === 'create') {
      const body: CourseInput = toCourseInput(values);
      if (!canPickInstructors) delete body.instructorIds;
      if (!canPickCategories) delete body.categoryIds;
      inFlight.current = true;
      createCourse.mutate(body, {
        onSuccess: (created) => {
          toast.success('Course created', `${created.title} was saved as a draft.`);
          if (onSaved) onSaved(created);
          else onClose();
        },
        onError,
        onSettled,
      });
      return;
    }

    if (!course) return;
    const omit: Array<'instructorIds' | 'categoryIds'> = [];
    if (!canPickInstructors) omit.push('instructorIds');
    if (!canPickCategories) omit.push('categoryIds');
    const body = diffCourseInput(course, values, omit);
    if (!Object.keys(body).length) {
      toast.notify({ tone: 'info', title: 'No changes to save' });
      return;
    }
    inFlight.current = true;
    updateCourse.mutate(
      { id: course.id, input: body },
      {
        onSuccess: (updated) => {
          toast.success('Course updated', updated.title);
          if (onSaved) onSaved(updated);
          else onClose();
        },
        onError,
        onSettled,
      }
    );
  }

  function applyPicked(media: MediaAsset[]) {
    if (!picker) return;
    const rows = media.filter((m) => m.secureUrl && m.publicId).map((m) => ({ secureUrl: m.secureUrl as string, publicId: m.publicId as string }));
    if (picker.target === 'thumbnail') {
      if (rows[0]) patch({ thumbnail: rows[0] }, ['thumbnail']);
    } else {
      const existing = new Set(values.gallery.map((g) => g.publicId));
      patch({ gallery: [...values.gallery, ...rows.filter((r) => !existing.has(r.publicId))].slice(0, 20) }, ['gallery']);
    }
  }

  const formId = `course-form-${mode}`;
  const err = (path: string) => errors[path];
  const p = values.pricing;
  const hasThumb = /^https?:\/\//.test(values.thumbnail.secureUrl) && Boolean(values.thumbnail.publicId);

  const staffOptions = (() => {
    const members = roster.data?.members ?? [];
    const known = new Set(members.map((m) => m.id));
    const assignedElsewhere = (course?.instructors ?? []).filter((i) => !known.has(i.id));
    const term = staffSearch.trim().toLowerCase();
    const all = [
      ...members.map((m) => ({ id: m.id, name: displayName(m), email: m.email, role: m.role?.name ?? '' })),
      ...assignedElsewhere.map((i) => ({ id: i.id, name: displayName(i), email: i.email, role: '' })),
    ];
    return term ? all.filter((o) => o.name.toLowerCase().includes(term) || o.email.toLowerCase().includes(term)) : all;
  })();

  function toggleId(key: 'categoryIds' | 'instructorIds', id: string) {
    const current = values[key];
    patch({ [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] }, [key]);
  }

  const readiness = [
    { label: 'Title', done: values.title.trim().length >= 3 },
    { label: 'Description', done: values.description.trim().length > 0 },
    { label: 'Thumbnail', done: hasThumb },
    { label: 'Category', done: values.categoryIds.length > 0 },
    { label: 'Instructor', done: values.instructorIds.length > 0 },
  ];
  const readyCount = readiness.filter((r) => r.done).length;

  const regular = Number(p.regularPrice) || 0;
  const sale = p.salePrice.trim() ? Number(p.salePrice) : null;
  const saleEnded = Boolean(p.saleEndAt) && new Date(p.saleEndAt).getTime() < new Date().getTime();
  const discount = sale !== null && regular > 0 && sale < regular ? Math.round(((regular - sale) / regular) * 100) : 0;

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        busy={pending}
        size="full"
        title={mode === 'create' ? 'Create course' : `Edit course`}
        description={mode === 'create' ? 'New courses are saved as drafts. Publish from the course actions once it is ready.' : course?.title}
        footer={
          <>
            <p className="mr-auto hidden self-center text-xs text-ink-muted sm:block">
              {mode === 'edit' ? 'Only changed fields are saved.' : 'You can keep editing after the draft is created.'}
            </p>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              {mode === 'create' ? 'Create draft' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Course form sections" className="lg:sticky lg:top-0 lg:self-start">
            <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible">
              {COURSE_FORM_TABS.map((t) => {
                const { label, hint, icon: Icon } = SECTIONS[t];
                const active = tab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t)}
                    className={cn(
                      'group flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-left transition lg:py-2.5',
                      active ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                    )}
                  >
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-ink-muted group-hover:text-ink')}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {label}
                        {tabErrors.has(t) ? <span className="size-1.5 rounded-full bg-danger" aria-label="has errors" /> : null}
                      </span>
                      <span className="hidden text-[11px] font-normal text-ink-subtle lg:block">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 hidden rounded-lg border border-line bg-surface-2/50 p-4 lg:block">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink">Publish readiness</p>
                <span className="text-[11px] font-semibold text-primary">
                  {readyCount}/{readiness.length}
                </span>
              </div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(readyCount / readiness.length) * 100}%` }} />
              </div>
              <ul className="space-y-1.5">
                {readiness.map((r) => (
                  <li key={r.label} className={cn('flex items-center gap-2 text-xs', r.done ? 'text-ink' : 'text-ink-subtle')}>
                    <span className={cn('flex size-4 items-center justify-center rounded-full', r.done ? 'bg-success text-white' : 'border border-field-border')}>
                      {r.done ? <Check className="size-2.5" aria-hidden /> : null}
                    </span>
                    {r.label}
                  </li>
                ))}
                <li className="flex items-center gap-2 text-xs text-ink-subtle">
                  <span className="size-4 rounded-full border border-dashed border-field-border" />
                  At least one lesson
                </li>
              </ul>
            </div>
          </nav>

          <form id={formId} onSubmit={handleSubmit} noValidate className="min-w-0 space-y-5">
            {formError ? (
              <p className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-xs text-danger" role="alert">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {formError}
              </p>
            ) : null}

            {tab === 'basics' ? (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
                <div className="space-y-5 xl:col-span-3">
                  <Panel title="Course details" description="What learners see first in the catalogue.">
                    <div className="space-y-4">
                      <Field id="course-title" label="Title" required error={err('title')}>
                        <Input
                          id="course-title"
                          value={values.title}
                          onChange={(e) => patch({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) }, ['title', 'slug'])}
                          placeholder="GMP Fundamentals for Pharma Professionals"
                          className="h-11 text-base font-medium"
                          aria-invalid={Boolean(err('title'))}
                          aria-describedby="course-title-msg"
                        />
                      </Field>
                      <Field id="course-slug" label="URL slug" error={err('slug')} hint="Lowercase words joined by hyphens. Generated from the title when empty.">
                        <div className="flex rounded-lg shadow-sm">
                          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-field-border bg-surface-2 px-3 text-xs text-ink-muted">/courses/</span>
                          <Input
                            id="course-slug"
                            value={values.slug}
                            onChange={(e) => {
                              setSlugTouched(true);
                              patch({ slug: e.target.value }, ['slug']);
                            }}
                            placeholder="gmp-fundamentals"
                            className="rounded-l-none shadow-none"
                            aria-invalid={Boolean(err('slug'))}
                            aria-describedby="course-slug-msg"
                          />
                        </div>
                      </Field>
                      <Field id="course-short" label="Short description" error={err('shortDescription')} hint={`${values.shortDescription.length}/500 · shown on course cards`}>
                        <Textarea id="course-short" rows={2} value={values.shortDescription} onChange={(e) => patch({ shortDescription: e.target.value }, ['shortDescription'])} aria-invalid={Boolean(err('shortDescription'))} aria-describedby="course-short-msg" />
                      </Field>
                      <Field id="course-description" label="Description" error={err('description')} hint="Required to publish. HTML is sanitized by the backend.">
                        <Textarea id="course-description" rows={8} value={values.description} onChange={(e) => patch({ description: e.target.value }, ['description'])} aria-invalid={Boolean(err('description'))} aria-describedby="course-description-msg" />
                      </Field>
                    </div>
                  </Panel>
                  <Panel title="Format" description="Delivery type, level, language and expected duration.">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                      <Field id="course-type" label="Course type" error={err('courseType')} hint="Free = direct enroll · Pre-recorded = paid checkout · Live session = application review">
                        <Select
                          id="course-type"
                          value={values.courseType}
                          onChange={(e) => patch({ courseType: e.target.value as CourseType }, ['courseType', 'pricing.type'])}
                          aria-invalid={Boolean(err('courseType'))}
                          aria-describedby="course-type-msg"
                        >
                          {COURSE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t === 'FREE' ? 'Free' : t === 'PRE_RECORDED' ? 'Pre-recorded' : 'Live session'}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field id="course-level" label="Level">
                        <Select id="course-level" value={values.level} onChange={(e) => patch({ level: e.target.value as CourseFormValues['level'] })}>
                          {COURSE_LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {levelLabel(l)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field id="course-language" label="Language" error={err('language')}>
                        <Input id="course-language" value={values.language} onChange={(e) => patch({ language: e.target.value }, ['language'])} placeholder="en" aria-invalid={Boolean(err('language'))} aria-describedby="course-language-msg" />
                      </Field>
                      <Field id="course-duration" label="Duration" error={err('durationValue')}>
                        <Input id="course-duration" type="number" min={0} step="any" value={values.durationValue} onChange={(e) => patch({ durationValue: e.target.value }, ['durationValue'])} aria-invalid={Boolean(err('durationValue'))} aria-describedby="course-duration-msg" />
                      </Field>
                      <Field id="course-duration-unit" label="Unit">
                        <Select id="course-duration-unit" value={values.durationUnit} onChange={(e) => patch({ durationUnit: e.target.value as CourseFormValues['durationUnit'] })}>
                          {DURATION_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {titleCase(u)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  </Panel>
                  {values.courseType === 'LIVE_SESSION' ? (
                    <Panel title="Live session" description="Batch schedule for this live course. Seats use the enrollment limit; fee uses pricing.">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field id="live-batch" label="Batch name" error={err('liveSession.batchName')}>
                          <Input id="live-batch" value={values.liveSession.batchName} onChange={(e) => patchNested('liveSession', { batchName: e.target.value }, ['liveSession.batchName'])} placeholder="Test Batch November 2026" aria-invalid={Boolean(err('liveSession.batchName'))} aria-describedby="live-batch-msg" />
                        </Field>
                        <Field id="live-mode" label="Session mode" error={err('liveSession.sessionMode')}>
                          <Input id="live-mode" value={values.liveSession.sessionMode} onChange={(e) => patchNested('liveSession', { sessionMode: e.target.value }, ['liveSession.sessionMode'])} placeholder="Live Online" aria-invalid={Boolean(err('liveSession.sessionMode'))} aria-describedby="live-mode-msg" />
                        </Field>
                        <Field id="live-start" label="Start date" error={err('liveSession.startDate')}>
                          <Input id="live-start" type="date" value={values.liveSession.startDate} onChange={(e) => patchNested('liveSession', { startDate: e.target.value }, ['liveSession.startDate', 'liveSession.endDate'])} aria-invalid={Boolean(err('liveSession.startDate'))} aria-describedby="live-start-msg" />
                        </Field>
                        <Field id="live-end" label="End date" error={err('liveSession.endDate')}>
                          <Input id="live-end" type="date" value={values.liveSession.endDate} onChange={(e) => patchNested('liveSession', { endDate: e.target.value }, ['liveSession.endDate'])} aria-invalid={Boolean(err('liveSession.endDate'))} aria-describedby="live-end-msg" />
                        </Field>
                        <div className="md:col-span-2">
                          <Field id="live-schedule" label="Session schedule" error={err('liveSession.sessionSchedule')} hint="e.g. Mon/Wed/Fri 7–9 PM IST">
                            <Textarea id="live-schedule" rows={2} value={values.liveSession.sessionSchedule} onChange={(e) => patchNested('liveSession', { sessionSchedule: e.target.value }, ['liveSession.sessionSchedule'])} aria-invalid={Boolean(err('liveSession.sessionSchedule'))} aria-describedby="live-schedule-msg" />
                          </Field>
                        </div>
                      </div>
                    </Panel>
                  ) : null}
                </div>

                <div className="space-y-5 xl:col-span-2">
                  <Panel title="Categories" description={`${values.categoryIds.length} selected · required to publish`}>
                    {!canPickCategories ? (
                      <p className="text-xs text-ink-muted">
                        {(course?.categories ?? []).map((c) => c.name).join(', ') || 'None'} · Changing categories needs the categories.manage permission.
                      </p>
                    ) : categories.isPending ? (
                      <Skeleton className="h-20 w-full" />
                    ) : categories.isError ? (
                      <ErrorState error={categories.error} onRetry={() => categories.refetch()} compact />
                    ) : (categories.data ?? []).length === 0 ? (
                      <p className="text-xs text-ink-muted">No categories yet. Create one on the Categories page.</p>
                    ) : (
                      <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                        {(categories.data ?? []).map((c) => {
                          const on = values.categoryIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleId('categoryIds', c.id)}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                                on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-field-border bg-field text-ink-muted hover:border-field-border-hover hover:text-ink'
                              )}
                            >
                              {on ? <Check className="size-3" aria-hidden /> : null}
                              {c.name}
                              {c.status === 'inactive' ? <span className="text-[10px] text-ink-subtle">(inactive)</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {err('categoryIds') ? <p className="mt-2 text-xs text-danger">{err('categoryIds')}</p> : null}
                  </Panel>

                  <Panel title="Instructors" description={`${values.instructorIds.length} selected · at least one is required to publish`}>
                    {!canPickInstructors ? (
                      <p className="text-xs text-ink-muted">
                        {(course?.instructors ?? []).map((i) => displayName(i)).join(', ') || 'None'} · Assigning instructors needs the courses.instructors.manage permission.
                      </p>
                    ) : roster.isPending ? (
                      <Skeleton className="h-32 w-full" />
                    ) : roster.isError ? (
                      <ErrorState error={roster.error} onRetry={() => roster.refetch()} compact />
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-field-border bg-field">
                        <div className="relative border-b border-line">
                          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" aria-hidden />
                          <input
                            type="search"
                            value={staffSearch}
                            onChange={(e) => setStaffSearch(e.target.value)}
                            placeholder="Search staff by name or email"
                            aria-label="Search instructors"
                            className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
                          />
                        </div>
                        <ul className="max-h-56 overflow-y-auto p-1.5">
                          {staffOptions.length === 0 ? <li className="px-2 py-4 text-center text-xs text-ink-subtle">No staff found</li> : null}
                          {staffOptions.map((o) => {
                            const on = values.instructorIds.includes(o.id);
                            return (
                              <li key={o.id}>
                                <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition', on ? 'bg-primary/10' : 'hover:bg-surface-2')}>
                                  <input type="checkbox" checked={on} onChange={() => toggleId('instructorIds', o.id)} className="size-4 accent-primary" />
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary" aria-hidden>
                                    {o.name
                                      .split(' ')
                                      .map((w) => w[0])
                                      .join('')
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-ink">{o.name}</span>
                                    <span className="block truncate text-[11px] text-ink-subtle">{o.email}</span>
                                  </span>
                                  {o.role && o.role !== 'Instructor' ? <Badge tone="brand">{o.role}</Badge> : null}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {err('instructorIds') ? <p className="mt-2 text-xs text-danger">{err('instructorIds')}</p> : null}
                  </Panel>
                </div>
              </div>
            ) : null}

            {tab === 'content' ? (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel title="Learning objectives" description="What learners will be able to do after the course.">
                  <ListEditor
                    label="Objective"
                    rows={values.learningObjectives}
                    onChange={(rows) => patch({ learningObjectives: rows }, ['learningObjectives'])}
                    createRow={() => ({ title: '', description: '' })}
                    max={50}
                    addLabel="Add objective"
                    emptyText="No objectives yet."
                    error={err('learningObjectives')}
                    renderRow={(row, i, update) => (
                      <div className="space-y-2">
                        <Input value={row.title} onChange={(e) => update({ ...row, title: e.target.value })} placeholder="Objective" aria-label={`Objective ${i + 1} title`} aria-invalid={Boolean(err(`learningObjectives.${i}.title`))} />
                        <Input value={row.description} onChange={(e) => update({ ...row, description: e.target.value })} placeholder="Description (optional)" aria-label={`Objective ${i + 1} description`} />
                        {err(`learningObjectives.${i}.title`) || err(`learningObjectives.${i}.description`) ? (
                          <p className="text-xs text-danger">{err(`learningObjectives.${i}.title`) ?? err(`learningObjectives.${i}.description`)}</p>
                        ) : null}
                      </div>
                    )}
                  />
                </Panel>
                <Panel title="FAQs" description="Answers shown on the course page.">
                  <ListEditor
                    label="FAQ"
                    rows={values.faqs}
                    onChange={(rows) => patch({ faqs: rows }, ['faqs'])}
                    createRow={() => ({ question: '', answer: '' })}
                    max={50}
                    addLabel="Add FAQ"
                    emptyText="No FAQs yet."
                    error={err('faqs')}
                    renderRow={(row, i, update) => (
                      <div className="space-y-2">
                        <Input value={row.question} onChange={(e) => update({ ...row, question: e.target.value })} placeholder="Question" aria-label={`FAQ ${i + 1} question`} aria-invalid={Boolean(err(`faqs.${i}.question`))} />
                        <Textarea rows={2} value={row.answer} onChange={(e) => update({ ...row, answer: e.target.value })} placeholder="Answer" aria-label={`FAQ ${i + 1} answer`} aria-invalid={Boolean(err(`faqs.${i}.answer`))} />
                        {err(`faqs.${i}.question`) || err(`faqs.${i}.answer`) ? <p className="text-xs text-danger">{err(`faqs.${i}.question`) ?? err(`faqs.${i}.answer`)}</p> : null}
                      </div>
                    )}
                  />
                </Panel>
                <Panel title="Requirements" description="What learners should know beforehand.">
                  <StringListEditor idPrefix="course-req" label="Requirement" values={values.requirements} onChange={(rows) => patch({ requirements: rows }, ['requirements'])} placeholder="Basic chemistry knowledge" max={50} maxLength={300} errors={errors} errorPath="requirements" addLabel="Add requirement" emptyText="No requirements." />
                </Panel>
                <Panel title="Target audience" description="Who the course is designed for.">
                  <StringListEditor idPrefix="course-aud" label="Audience" values={values.targetAudience} onChange={(rows) => patch({ targetAudience: rows }, ['targetAudience'])} placeholder="QA executives" max={50} maxLength={300} errors={errors} errorPath="targetAudience" addLabel="Add audience" emptyText="No audience entries." />
                </Panel>
                <Panel title="Tags" description="Used by search · max 50 characters each." className="xl:col-span-2">
                  <StringListEditor idPrefix="course-tag" label="Tag" values={values.tags} onChange={(rows) => patch({ tags: rows }, ['tags'])} placeholder="gmp" max={50} maxLength={50} errors={errors} errorPath="tags" addLabel="Add tag" emptyText="No tags." />
                </Panel>
              </div>
            ) : null}

            {tab === 'media' ? (
              <div className="space-y-5">
                <Panel
                  title="Thumbnail"
                  description="Shown on course cards and the course page. Required to publish · 16:9 works best."
                  action={
                    <div className="flex flex-wrap gap-2">
                      {canBrowseMedia ? (
                        <Button size="sm" variant="secondary" onClick={() => setPicker({ target: 'thumbnail', tab: 'library' })}>
                          <Images className="size-4" aria-hidden />
                          Choose from gallery
                        </Button>
                      ) : null}
                      {canUploadMedia ? (
                        <Button size="sm" onClick={() => setPicker({ target: 'thumbnail', tab: 'upload' })}>
                          <CloudUpload className="size-4" aria-hidden />
                          Upload to Cloudinary
                        </Button>
                      ) : null}
                    </div>
                  }
                >
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start">
                    <div className={cn('relative aspect-video overflow-hidden rounded-xl border', hasThumb ? 'border-line' : 'border-2 border-dashed border-field-border bg-surface-2/40')}>
                      {hasThumb ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL */}
                          <img src={values.thumbnail.secureUrl} alt="Course thumbnail" className="size-full object-cover" />
                          <button
                            type="button"
                            onClick={() => patch({ thumbnail: { secureUrl: '', publicId: '' } }, ['thumbnail'])}
                            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur hover:bg-black/75"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            Remove
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPicker({ target: 'thumbnail', tab: canBrowseMedia ? 'library' : 'upload' })}
                          disabled={!canBrowseMedia && !canUploadMedia}
                          className="flex size-full flex-col items-center justify-center gap-2 text-center"
                        >
                          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ImageIcon className="size-5" aria-hidden />
                          </span>
                          <span className="text-sm font-semibold text-ink">No thumbnail yet</span>
                          <span className="text-xs text-ink-muted">Pick from the gallery or upload a new image</span>
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {hasThumb ? (
                        <dl className="space-y-1 rounded-xl border border-line bg-surface-2/40 p-3 text-xs">
                          <dt className="text-ink-subtle">Cloudinary public ID</dt>
                          <dd className="break-all font-medium text-ink">{values.thumbnail.publicId}</dd>
                        </dl>
                      ) : null}
                      {err('thumbnail.secureUrl') || err('thumbnail.publicId') ? <p className="text-xs text-danger">{err('thumbnail.secureUrl') ?? err('thumbnail.publicId')}</p> : null}
                      <button type="button" onClick={() => setManualMedia((v) => !v)} aria-expanded={manualMedia} className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink">
                        <ChevronDown className={cn('size-3.5 transition', manualMedia && 'rotate-180')} aria-hidden />
                        Enter a Cloudinary reference manually
                      </button>
                      {manualMedia ? (
                        <div className="space-y-3">
                          <Field id="course-thumb-url" label="Secure URL" error={err('thumbnail.secureUrl')}>
                            <Input id="course-thumb-url" value={values.thumbnail.secureUrl} onChange={(e) => patch({ thumbnail: { ...values.thumbnail, secureUrl: e.target.value } }, ['thumbnail'])} placeholder="https://res.cloudinary.com/…" aria-invalid={Boolean(err('thumbnail.secureUrl'))} aria-describedby="course-thumb-url-msg" />
                          </Field>
                          <Field id="course-thumb-id" label="Public ID" error={err('thumbnail.publicId')}>
                            <Input id="course-thumb-id" value={values.thumbnail.publicId} onChange={(e) => patch({ thumbnail: { ...values.thumbnail, publicId: e.target.value } }, ['thumbnail'])} placeholder="skillbee/course_thumbnail/…" aria-invalid={Boolean(err('thumbnail.publicId'))} aria-describedby="course-thumb-id-msg" />
                          </Field>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Panel>

                <Panel
                  title="Gallery"
                  description={`${values.gallery.length}/20 images · shown on the course page.`}
                  action={
                    <div className="flex flex-wrap gap-2">
                      {canBrowseMedia ? (
                        <Button size="sm" variant="secondary" onClick={() => setPicker({ target: 'gallery', tab: 'library' })} disabled={values.gallery.length >= 20}>
                          <Images className="size-4" aria-hidden />
                          Add from gallery
                        </Button>
                      ) : null}
                      {canUploadMedia ? (
                        <Button size="sm" variant="secondary" onClick={() => setPicker({ target: 'gallery', tab: 'upload' })} disabled={values.gallery.length >= 20}>
                          <CloudUpload className="size-4" aria-hidden />
                          Upload
                        </Button>
                      ) : null}
                    </div>
                  }
                >
                  {values.gallery.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-field-border px-3 py-8 text-center text-xs text-ink-subtle">No gallery images yet.</p>
                  ) : (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                      {values.gallery.map((g, i) => (
                        <li key={`${g.publicId}-${i}`} className="group relative overflow-hidden rounded-xl border border-line bg-surface-2">
                          {/^https?:\/\//.test(g.secureUrl) ? (
                            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL
                            <img src={g.secureUrl} alt={`Gallery image ${i + 1}`} className="aspect-video w-full object-cover" loading="lazy" />
                          ) : (
                            <span className="flex aspect-video items-center justify-center text-xs text-danger">Invalid URL</span>
                          )}
                          <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                            <span className="text-[11px] font-semibold text-ink-subtle">#{i + 1}</span>
                            <span className="flex">
                              <button type="button" onClick={() => patch({ gallery: move(values.gallery, i, i - 1) })} disabled={i === 0} className="rounded p-1 text-ink-subtle hover:bg-surface hover:text-ink disabled:opacity-30" aria-label={`Move image ${i + 1} left`}>
                                ‹
                              </button>
                              <button type="button" onClick={() => patch({ gallery: move(values.gallery, i, i + 1) })} disabled={i === values.gallery.length - 1} className="rounded p-1 text-ink-subtle hover:bg-surface hover:text-ink disabled:opacity-30" aria-label={`Move image ${i + 1} right`}>
                                ›
                              </button>
                              <button type="button" onClick={() => patch({ gallery: values.gallery.filter((_, j) => j !== i) }, ['gallery'])} className="rounded p-1 text-ink-subtle hover:bg-danger/10 hover:text-danger" aria-label={`Remove image ${i + 1}`}>
                                <Trash2 className="size-3.5" />
                              </button>
                            </span>
                          </div>
                          {err(`gallery.${i}.secureUrl`) || err(`gallery.${i}.publicId`) ? <p className="px-1.5 pb-1 text-[11px] text-danger">{err(`gallery.${i}.secureUrl`) ?? err(`gallery.${i}.publicId`)}</p> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {err('gallery') ? <p className="mt-2 text-xs text-danger">{err('gallery')}</p> : null}
                </Panel>
              </div>
            ) : null}

            {tab === 'pricing' ? (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel title="Price" description="Amounts are in major units (e.g. rupees).">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Pricing type">
                      {(['free', 'paid'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          role="radio"
                          aria-checked={p.type === type}
                          onClick={() => patchNested('pricing', { type }, ['pricing.regularPrice', 'pricing.salePrice', 'pricing.saleEndAt'])}
                          className={cn(
                            'rounded-xl border-2 px-4 py-3 text-left transition',
                            p.type === type ? 'border-primary bg-primary/5' : 'border-field-border bg-field hover:border-field-border-hover'
                          )}
                        >
                          <span className={cn('block text-sm font-semibold', p.type === type ? 'text-primary' : 'text-ink')}>{type === 'free' ? 'Free' : 'Paid'}</span>
                          <span className="mt-0.5 block text-xs text-ink-muted">{type === 'free' ? 'Anyone can enroll at no cost' : 'Learners pay at checkout'}</span>
                        </button>
                      ))}
                    </div>
                    {p.type === 'paid' ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <Field id="price-regular" label="Regular price" required error={err('pricing.regularPrice')}>
                            <Input id="price-regular" type="number" min={0} step="0.01" value={p.regularPrice} onChange={(e) => patchNested('pricing', { regularPrice: e.target.value }, ['pricing.regularPrice', 'pricing.salePrice'])} placeholder="4999" aria-invalid={Boolean(err('pricing.regularPrice'))} aria-describedby="price-regular-msg" />
                          </Field>
                          <Field id="price-currency" label="Currency">
                            <Select id="price-currency" value={p.currency} onChange={(e) => patchNested('pricing', { currency: e.target.value as CourseFormValues['pricing']['currency'] })}>
                              {CURRENCIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        </div>
                        <div className="rounded-xl border border-line bg-surface-2/40 p-4">
                          <p className="mb-3 text-sm font-semibold text-ink">Sale</p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field id="price-sale" label="Sale price" error={err('pricing.salePrice')} hint="Optional · must be below the regular price">
                              <Input id="price-sale" type="number" min={0} step="0.01" value={p.salePrice} onChange={(e) => patchNested('pricing', { salePrice: e.target.value }, ['pricing.salePrice'])} placeholder="3999" aria-invalid={Boolean(err('pricing.salePrice'))} aria-describedby="price-sale-msg" />
                            </Field>
                            <Field
                              id="price-sale-end"
                              label="Sale ends"
                              error={err('pricing.saleEndAt')}
                              hint={saleEnded ? 'This date has passed, so the regular price applies.' : 'Leave empty to keep the sale price active with no end date.'}
                            >
                              <Input id="price-sale-end" type="datetime-local" value={p.saleEndAt} onChange={(e) => patchNested('pricing', { saleEndAt: e.target.value }, ['pricing.saleEndAt'])} disabled={!p.salePrice.trim()} aria-invalid={Boolean(err('pricing.saleEndAt'))} aria-describedby="price-sale-end-msg" />
                            </Field>
                          </div>
                          {p.saleStartAt ? (
                            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-warning">
                              This sale is scheduled to start on {formatDate(new Date(p.saleStartAt).toISOString())}.
                              <button type="button" onClick={() => patchNested('pricing', { saleStartAt: '' })} className="font-semibold underline underline-offset-2">
                                Start it immediately
                              </button>
                            </p>
                          ) : null}
                          {sale !== null && regular > 0 ? (
                            <div className="mt-4 flex flex-wrap items-baseline gap-2 rounded-lg bg-surface px-3 py-2.5">
                              <span className="text-xs text-ink-muted">Learners pay</span>
                              <span className="text-lg font-semibold text-ink">{formatMoney(saleEnded ? regular : sale, p.currency)}</span>
                              {!saleEnded && discount > 0 ? (
                                <>
                                  <span className="text-xs text-ink-subtle line-through">{formatMoney(regular, p.currency)}</span>
                                  <Badge tone="success">{discount}% off</Badge>
                                </>
                              ) : null}
                              <span className="w-full text-[11px] text-ink-subtle sm:ml-auto sm:w-auto">
                                {p.saleEndAt ? (saleEnded ? 'Sale ended' : `Until ${formatDate(new Date(p.saleEndAt).toISOString())}`) : 'No end date'}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="rounded-xl bg-surface-2/60 px-3 py-3 text-xs text-ink-muted">Free courses are saved with a zero price.</p>
                    )}
                  </div>
                </Panel>
                <Panel title="Purchase & tax" description="Checkout availability and tax handling.">
                  <div className="space-y-3">
                    <Toggle id="price-purchasable" label="Purchasable" description="Allow checkout for this course." checked={p.isPurchasable} onChange={(v) => patchNested('pricing', { isPurchasable: v })} />
                    <Toggle id="price-auto-enroll" label="Automatic enrollment" description="Enroll the learner as soon as payment succeeds." checked={p.automaticEnrollmentEnabled} onChange={(v) => patchNested('pricing', { automaticEnrollmentEnabled: v })} />
                    <Toggle id="price-window" label="Purchase window" description="Limit when the course can be bought." checked={p.purchaseWindowEnabled} onChange={(v) => patchNested('pricing', { purchaseWindowEnabled: v })} />
                    {p.purchaseWindowEnabled ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field id="price-window-start" label="Available from">
                          <Input id="price-window-start" type="datetime-local" value={p.purchaseStartAt} onChange={(e) => patchNested('pricing', { purchaseStartAt: e.target.value })} />
                        </Field>
                        <Field id="price-window-end" label="Available until">
                          <Input id="price-window-end" type="datetime-local" value={p.purchaseEndAt} onChange={(e) => patchNested('pricing', { purchaseEndAt: e.target.value })} />
                        </Field>
                      </div>
                    ) : null}
                    <Toggle id="price-tax" label="Tax" description="Apply tax at checkout." checked={p.taxEnabled} onChange={(v) => patchNested('pricing', { taxEnabled: v })} />
                    {p.taxEnabled ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field id="price-tax-percent" label="Tax %" error={err('pricing.taxConfiguration.taxPercent')}>
                          <Input id="price-tax-percent" type="number" min={0} max={100} step="0.01" value={p.taxPercent} onChange={(e) => patchNested('pricing', { taxPercent: e.target.value }, ['pricing.taxConfiguration.taxPercent'])} aria-invalid={Boolean(err('pricing.taxConfiguration.taxPercent'))} aria-describedby="price-tax-percent-msg" />
                        </Field>
                        <Field id="price-tax-class" label="Tax class" error={err('pricing.taxConfiguration.taxClass')}>
                          <Input id="price-tax-class" value={p.taxClass} onChange={(e) => patchNested('pricing', { taxClass: e.target.value }, ['pricing.taxConfiguration.taxClass'])} placeholder="GST" aria-describedby="price-tax-class-msg" />
                        </Field>
                        <div className="sm:col-span-2">
                          <Toggle id="price-tax-inclusive" label="Prices include tax" checked={p.taxInclusive} onChange={(v) => patchNested('pricing', { taxInclusive: v })} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Panel>
              </div>
            ) : null}

            {tab === 'settings' ? (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel title="Visibility & enrollment">
                  <div className="space-y-3">
                    <Toggle id="course-featured" label="Featured" description="Highlight the course in featured listings." checked={values.isFeatured} onChange={(v) => patch({ isFeatured: v })} />
                    <Field id="course-sort" label="Sort order" error={err('sortOrder')} hint="Lower numbers appear first when sorted by order.">
                      <Input id="course-sort" type="number" step={1} value={values.sortOrder} onChange={(e) => patch({ sortOrder: e.target.value }, ['sortOrder'])} aria-invalid={Boolean(err('sortOrder'))} aria-describedby="course-sort-msg" />
                    </Field>
                    <Toggle id="course-limit" label="Limit enrollments" description="Close enrollment once the seat limit is reached." checked={values.enrollment.limitEnabled} onChange={(v) => patchNested('enrollment', { limitEnabled: v })} />
                    {values.enrollment.limitEnabled ? (
                      <Field id="course-max" label="Maximum students" error={err('enrollment.maximumStudents')} hint={course?.enrollment?.currentStudents !== undefined ? `${course.enrollment.currentStudents} currently enrolled` : undefined}>
                        <Input id="course-max" type="number" min={0} step={1} value={values.enrollment.maximumStudents} onChange={(e) => patchNested('enrollment', { maximumStudents: e.target.value }, ['enrollment.maximumStudents'])} aria-invalid={Boolean(err('enrollment.maximumStudents'))} aria-describedby="course-max-msg" />
                      </Field>
                    ) : null}
                  </div>
                </Panel>
                <Panel title="Certificate & access">
                  <div className="space-y-3">
                    <Toggle id="course-cert" label="Issue certificate" description="Award a certificate when learners finish." checked={values.certificate.enabled} onChange={(v) => patchNested('certificate', { enabled: v })} />
                    {values.certificate.enabled ? (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field id="course-cert-min" label="Completion %" error={err('certificate.minimumCompletionPercentage')}>
                            <Input id="course-cert-min" type="number" min={0} max={100} value={values.certificate.minimumCompletionPercentage} onChange={(e) => patchNested('certificate', { minimumCompletionPercentage: e.target.value }, ['certificate.minimumCompletionPercentage'])} aria-invalid={Boolean(err('certificate.minimumCompletionPercentage'))} aria-describedby="course-cert-min-msg" />
                          </Field>
                          <Field id="course-cert-template" label="Template ID" error={err('certificate.templateId')} hint="Optional">
                            <Input id="course-cert-template" value={values.certificate.templateId} onChange={(e) => patchNested('certificate', { templateId: e.target.value }, ['certificate.templateId'])} aria-invalid={Boolean(err('certificate.templateId'))} aria-describedby="course-cert-template-msg" />
                          </Field>
                        </div>
                        <Toggle id="course-cert-auto" label="Auto-issue on completion" checked={values.certificate.autoIssue} onChange={(v) => patchNested('certificate', { autoIssue: v })} />
                      </>
                    ) : null}
                    <Toggle id="course-expiry" label="Expire access" description="Learner access ends after a fixed period." checked={values.expiry.enabled} onChange={(v) => patchNested('expiry', { enabled: v })} />
                    {values.expiry.enabled ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field id="course-expiry-value" label="Duration" error={err('expiry.durationValue')}>
                          <Input id="course-expiry-value" type="number" min={0} value={values.expiry.durationValue} onChange={(e) => patchNested('expiry', { durationValue: e.target.value }, ['expiry.durationValue'])} aria-invalid={Boolean(err('expiry.durationValue'))} aria-describedby="course-expiry-value-msg" />
                        </Field>
                        <Field id="course-expiry-unit" label="Unit">
                          <Select id="course-expiry-unit" value={values.expiry.durationUnit} onChange={(e) => patchNested('expiry', { durationUnit: e.target.value as CourseFormValues['expiry']['durationUnit'] })}>
                            {DURATION_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {titleCase(u)}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    ) : null}
                  </div>
                </Panel>
              </div>
            ) : null}

            {tab === 'seo' ? (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
                <Panel title="Search engine listing" description="How the course appears in search results." className="xl:col-span-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field id="seo-title" label="Meta title" error={err('seo.metaTitle')} hint={`${values.seo.metaTitle.length}/120`}>
                      <Input id="seo-title" value={values.seo.metaTitle} onChange={(e) => patchNested('seo', { metaTitle: e.target.value }, ['seo.metaTitle'])} aria-invalid={Boolean(err('seo.metaTitle'))} aria-describedby="seo-title-msg" />
                    </Field>
                    <Field id="seo-keyword" label="Focus keyword" error={err('seo.focusKeyword')}>
                      <Input id="seo-keyword" value={values.seo.focusKeyword} onChange={(e) => patchNested('seo', { focusKeyword: e.target.value }, ['seo.focusKeyword'])} aria-describedby="seo-keyword-msg" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field id="seo-description" label="Meta description" error={err('seo.metaDescription')} hint={`${values.seo.metaDescription.length}/300`}>
                        <Textarea id="seo-description" rows={3} value={values.seo.metaDescription} onChange={(e) => patchNested('seo', { metaDescription: e.target.value }, ['seo.metaDescription'])} aria-invalid={Boolean(err('seo.metaDescription'))} aria-describedby="seo-description-msg" />
                      </Field>
                    </div>
                    <Field id="seo-canonical" label="Canonical URL" error={err('seo.canonicalUrl')} hint="Leave empty to use the default course URL.">
                      <Input id="seo-canonical" value={values.seo.canonicalUrl} onChange={(e) => patchNested('seo', { canonicalUrl: e.target.value }, ['seo.canonicalUrl'])} aria-invalid={Boolean(err('seo.canonicalUrl'))} aria-describedby="seo-canonical-msg" />
                    </Field>
                    <Field id="seo-og-image" label="Social image URL">
                      <Input id="seo-og-image" value={values.seo.ogImage} onChange={(e) => patchNested('seo', { ogImage: e.target.value })} />
                    </Field>
                    <Field id="seo-og-title" label="Social title" error={err('seo.ogTitle')}>
                      <Input id="seo-og-title" value={values.seo.ogTitle} onChange={(e) => patchNested('seo', { ogTitle: e.target.value }, ['seo.ogTitle'])} aria-describedby="seo-og-title-msg" />
                    </Field>
                    <Field id="seo-og-description" label="Social description" error={err('seo.ogDescription')}>
                      <Input id="seo-og-description" value={values.seo.ogDescription} onChange={(e) => patchNested('seo', { ogDescription: e.target.value }, ['seo.ogDescription'])} aria-describedby="seo-og-description-msg" />
                    </Field>
                    <div className="md:col-span-2">
                      <Toggle id="seo-noindex" label="Hide from search engines" description="Adds noindex to the public course page." checked={values.seo.noIndex} onChange={(v) => patchNested('seo', { noIndex: v })} />
                    </div>
                  </div>
                </Panel>
                <Panel title="Preview" description="Approximate search result." className="xl:col-span-2 xl:self-start">
                  <div className="rounded-xl border border-line bg-field p-4">
                    <p className="truncate text-xs text-success">skillbee.co.in › courses › {values.slug || slugify(values.title) || 'course'}</p>
                    <p className="mt-1 line-clamp-2 text-base font-medium text-info">{values.seo.metaTitle || values.title || 'Course title'}</p>
                    <p className="mt-1 line-clamp-3 text-xs text-ink-muted">{values.seo.metaDescription || values.shortDescription || 'Add a meta description to control this snippet.'}</p>
                  </div>
                </Panel>
              </div>
            ) : null}
          </form>
        </div>
      </Dialog>

      {picker ? (
        <MediaPickerDialog
          title={picker.target === 'thumbnail' ? 'Course thumbnail' : 'Add gallery images'}
          category={picker.target === 'thumbnail' ? 'course_thumbnail' : 'course_gallery'}
          courseId={course?.id}
          multiple={picker.target === 'gallery'}
          max={20 - values.gallery.length}
          initialTab={picker.tab}
          onClose={() => setPicker(null)}
          onSelect={applyPicked}
        />
      ) : null}
    </>
  );
}
