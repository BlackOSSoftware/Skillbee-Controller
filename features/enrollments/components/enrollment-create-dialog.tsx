'use client';

import { Check, Search } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { titleCase } from '@/lib/format';
import { hasPermissions } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import type { CreateEnrollmentInput, EnrollmentType } from '@/types/enrollments';
import { Toggle } from '@/features/courses/components/form-controls';
import { useCourseOptions, useCreateEnrollment, useStudentOptions } from '../hooks';
import { typeLabel } from '../display';

/** Types an admin grants by hand; `purchase` comes from checkout and `migration` from imports. */
const MANUAL_TYPES: EnrollmentType[] = ['admin_granted', 'manual', 'free'];

interface Picked {
  id: string;
  label: string;
  sub: string;
}

function Picker({
  id,
  label,
  placeholder,
  search,
  onSearch,
  picked,
  onPick,
  loading,
  error,
  onRetry,
  options,
  disabledReason,
  fieldError,
}: {
  id: string;
  label: string;
  placeholder: string;
  search: string;
  onSearch: (v: string) => void;
  picked: Picked | null;
  onPick: (p: Picked | null) => void;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  options: Array<Picked & { badge?: ReactNode }>;
  disabledReason?: string;
  fieldError?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink">
        {label}
        <span className="ml-0.5 text-danger">*</span>
      </p>
      {disabledReason ? (
        <p className="rounded-md border border-line bg-surface-2 px-3 py-2.5 text-xs text-ink-muted">{disabledReason}</p>
      ) : picked ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{picked.label}</span>
            <span className="block truncate text-xs text-ink-muted">{picked.sub}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => onPick(null)}>
            Change
          </Button>
        </div>
      ) : (
        <div className={cn('overflow-hidden rounded-md border bg-field', fieldError ? 'border-danger' : 'border-field-border')}>
          <div className="relative border-b border-line">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <input
              id={id}
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={placeholder}
              className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto p-1" role="listbox" aria-label={label}>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="px-2 py-2">
                  <Skeleton className="h-4 w-2/3" />
                </li>
              ))
            ) : error ? (
              <li className="p-2">
                <ErrorState error={error} onRetry={onRetry} compact />
              </li>
            ) : options.length === 0 ? (
              <li className="px-2 py-4 text-center text-xs text-ink-subtle">No matches</li>
            ) : (
              options.map((o) => (
                <li key={o.id}>
                  <button type="button" role="option" aria-selected={false} onClick={() => onPick(o)} className="flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{o.label}</span>
                      <span className="block truncate text-[11px] text-ink-subtle">{o.sub}</span>
                    </span>
                    {o.badge}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      {fieldError ? <p className="mt-1 text-xs text-danger">{fieldError}</p> : null}
    </div>
  );
}

export function EnrollmentCreateDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const create = useCreateEnrollment();
  const inFlight = useRef(false);
  const canReadUsers = hasPermissions(user, ['users:read']);
  const canReadCourses = hasPermissions(user, ['courses.read']);

  const [studentSearch, setStudentSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [student, setStudent] = useState<Picked | null>(null);
  const [course, setCourse] = useState<(Picked & { status: string }) | null>(null);
  const [type, setType] = useState<EnrollmentType>('admin_granted');
  const [status, setStatus] = useState<'active' | 'pending'>('active');
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const [allowUnpublished, setAllowUnpublished] = useState(false);
  const [errors, setErrors] = useState<{ student?: string; course?: string; expiresAt?: string; reason?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const debouncedStudent = useDebouncedValue(studentSearch.trim(), 350);
  const debouncedCourse = useDebouncedValue(courseSearch.trim(), 350);
  const students = useStudentOptions(debouncedStudent, canReadUsers && !student);
  const courses = useCourseOptions(debouncedCourse, canReadCourses && !course);

  const studentOptions = (students.data?.users ?? []).map((u) => ({
    id: u.id,
    label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
    sub: u.email,
    badge: u.status !== 'active' ? <Badge tone="warning">{titleCase(u.status)}</Badge> : undefined,
  }));
  const courseOptions = (courses.data?.data ?? []).map((c) => ({
    id: c.id,
    label: c.title,
    sub: `/${c.slug}`,
    status: c.status,
    badge: <Badge tone={c.status === 'published' ? 'success' : c.status === 'draft' ? 'warning' : 'neutral'}>{titleCase(c.status)}</Badge>,
  }));
  const needsUnpublished = Boolean(course && course.status === 'draft');

  function submit() {
    if (inFlight.current || create.isPending) return;
    setFormError(null);
    const found: typeof errors = {};
    if (!student) found.student = 'Select a learner.';
    if (!course) found.course = 'Select a course.';
    if (course?.status === 'archived') found.course = 'Archived courses cannot take new enrollments.';
    if (expiresAt && new Date(expiresAt).getTime() <= new Date().getTime()) found.expiresAt = 'Expiry must be in the future.';
    if (reason.length > 2000) found.reason = 'Reason must be 2000 characters or less.';
    setErrors(found);
    if (Object.keys(found).length || !student || !course) return;

    const body: CreateEnrollmentInput = {
      studentId: student.id,
      courseId: course.id,
      enrollmentType: type,
      status,
      enrollmentExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      ...(needsUnpublished && allowUnpublished ? { allowUnpublished: true } : {}),
    };
    inFlight.current = true;
    create.mutate(body, {
      onSuccess: () => {
        toast.success('Enrollment created', `${student.label} → ${course.label}`);
        onClose();
      },
      onError: (e) => {
        const { message, code } = normalizeApiError(e);
        if (code === 'DUPLICATE_ACTIVE_ENROLLMENT') setErrors({ student: 'This learner already has an active enrollment in this course.' });
        else if (code === 'COURSE_NOT_PUBLISHED') setErrors({ course: 'This course is not published. Turn on “Allow unpublished course” to enroll anyway.' });
        else if (code === 'STUDENT_SUSPENDED') setErrors({ student: message });
        else if (code === 'ENROLLMENT_LIMIT' || code === 'COURSE_ARCHIVED') setErrors({ course: message });
        setFormError(message);
        toast.error('Could not create enrollment', message);
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
      size="lg"
      title="New enrollment"
      description="Grant a learner access to a course. Progress is calculated by the backend."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            <Check className="size-4" aria-hidden />
            Create enrollment
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {formError ? (
          <p className="rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="grid gap-5 md:grid-cols-2">
          <Picker
            id="enroll-student"
            label="Learner"
            placeholder="Search students by name or email"
            search={studentSearch}
            onSearch={setStudentSearch}
            picked={student}
            onPick={(p) => {
              setStudent(p);
              setErrors((e) => ({ ...e, student: undefined }));
            }}
            loading={students.isPending}
            error={students.error}
            onRetry={() => students.refetch()}
            options={studentOptions}
            disabledReason={canReadUsers ? undefined : 'Selecting a learner needs the users:read permission.'}
            fieldError={errors.student}
          />
          <Picker
            id="enroll-course"
            label="Course"
            placeholder="Search courses by title"
            search={courseSearch}
            onSearch={setCourseSearch}
            picked={course}
            onPick={(p) => {
              const full = courseOptions.find((o) => o.id === p?.id);
              setCourse(full ? { id: full.id, label: full.label, sub: full.sub, status: full.status } : null);
              setAllowUnpublished(false);
              setErrors((e) => ({ ...e, course: undefined }));
            }}
            loading={courses.isPending}
            error={courses.error}
            onRetry={() => courses.refetch()}
            options={courseOptions}
            disabledReason={canReadCourses ? undefined : 'Selecting a course needs the courses.read permission.'}
            fieldError={errors.course}
          />
        </div>

        {needsUnpublished ? (
          <Toggle
            id="enroll-allow-unpublished"
            label="Allow unpublished course"
            description="This course is a draft. Enable to enroll the learner before it is published."
            checked={allowUnpublished}
            onChange={setAllowUnpublished}
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="enroll-type" label="Enrollment type">
            <Select id="enroll-type" value={type} onChange={(e) => setType(e.target.value as EnrollmentType)}>
              {MANUAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="enroll-status" label="Initial status">
            <Select id="enroll-status" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'pending')}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
            </Select>
          </Field>
          <Field id="enroll-expires" label="Access expires" error={errors.expiresAt} hint="Optional · defaults to the course expiry rule">
            <Input id="enroll-expires" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} aria-invalid={Boolean(errors.expiresAt)} aria-describedby="enroll-expires-msg" />
          </Field>
        </div>
        <Field id="enroll-reason" label="Reason" error={errors.reason} hint={`Optional · recorded in the enrollment history (${reason.length}/2000)`}>
          <Textarea id="enroll-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Corporate batch access" aria-invalid={Boolean(errors.reason)} aria-describedby="enroll-reason-msg" />
        </Field>
      </div>
    </Dialog>
  );
}
