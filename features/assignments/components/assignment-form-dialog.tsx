'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { hasPermissions } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import { SUBMISSION_TYPES, type Assignment, type CreateAssignmentInput, type SubmissionType, type UpdateAssignmentInput } from '@/types/assignments';
import { Toggle } from '@/features/courses/components/form-controls';
import { useCourseOptions } from '@/features/enrollments/hooks';
import { useCreateAssignment, useUpdateAssignment } from '../hooks';
import { submissionTypeLabel } from '../display';

const MB = 1024 * 1024;

interface Values {
  title: string;
  instructions: string;
  courseId: string;
  dueDate: string;
  maximumMarks: string;
  submissionType: SubmissionType;
  allowedFileTypes: string;
  maxFileSizeMb: string;
  allowLateSubmission: boolean;
  allowResubmission: boolean;
  maxSubmissions: string;
}

type Errors = Partial<Record<keyof Values, string>>;

/** `datetime-local` works in local time; the API stores ISO instants. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialValues(a?: Assignment): Values {
  return {
    title: a?.title ?? '',
    instructions: a?.instructions ?? '',
    courseId: a?.courseId ?? '',
    dueDate: toLocalInput(a?.dueDate ?? null),
    maximumMarks: a ? String(a.maximumMarks) : '100',
    submissionType: a?.submissionType ?? 'file_and_text',
    allowedFileTypes: (a?.allowedFileTypes ?? ['.pdf', '.doc', '.docx', '.txt', '.zip']).join(', '),
    maxFileSizeMb: String(Math.round(((a?.maximumFileSizeBytes ?? 10 * MB) / MB) * 100) / 100),
    allowLateSubmission: a?.allowLateSubmission ?? false,
    allowResubmission: a?.allowResubmission ?? false,
    maxSubmissions: String(a?.maxSubmissions ?? 3),
  };
}

function parseTypes(raw: string): string[] {
  return [...new Set(raw.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean).map((t) => (t.startsWith('.') ? t : `.${t}`)))];
}

/** Mirrors `createAssignmentSchema` plus the service's file-type rules. */
function validate(v: Values, mode: 'create' | 'edit'): Errors {
  const e: Errors = {};
  if (v.title.trim().length < 3 || v.title.trim().length > 200) e.title = 'Title must be 3–200 characters.';
  if (!v.instructions.trim()) e.instructions = 'Instructions are required.';
  else if (v.instructions.length > 20000) e.instructions = 'Instructions must be 20,000 characters or less.';
  if (mode === 'create' && !v.courseId) e.courseId = 'Choose a course.';
  const marks = Number(v.maximumMarks);
  if (v.maximumMarks.trim() === '' || !Number.isFinite(marks) || marks < 0) e.maximumMarks = 'Enter 0 or more.';
  if (v.dueDate && Number.isNaN(new Date(v.dueDate).getTime())) e.dueDate = 'Enter a valid date.';
  if (v.submissionType !== 'text') {
    const types = parseTypes(v.allowedFileTypes);
    if (!types.length) e.allowedFileTypes = 'Add at least one file type.';
    else if (types.length > 20) e.allowedFileTypes = 'Up to 20 file types.';
    else if (types.some((t) => t.length > 20)) e.allowedFileTypes = 'Each file type must be 20 characters or less.';
    const mb = Number(v.maxFileSizeMb);
    if (!Number.isFinite(mb) || mb <= 0 || mb > 100) e.maxFileSizeMb = 'Between 0.01 and 100 MB.';
  }
  if (v.allowResubmission) {
    const n = Number(v.maxSubmissions);
    if (!Number.isInteger(n) || n < 1 || n > 20) e.maxSubmissions = 'Whole number from 1 to 20.';
  }
  return e;
}

function toInput(v: Values): CreateAssignmentInput {
  const fileBased = v.submissionType !== 'text';
  return {
    title: v.title.trim(),
    instructions: v.instructions.trim(),
    courseId: v.courseId,
    dueDate: v.dueDate ? new Date(v.dueDate).toISOString() : null,
    maximumMarks: Number(v.maximumMarks),
    submissionType: v.submissionType,
    ...(fileBased ? { allowedFileTypes: parseTypes(v.allowedFileTypes), maximumFileSizeBytes: Math.round(Number(v.maxFileSizeMb) * MB) } : {}),
    allowLateSubmission: v.allowLateSubmission,
    allowResubmission: v.allowResubmission,
    maxSubmissions: v.allowResubmission ? Number(v.maxSubmissions) : 1,
  };
}

/** Only changed fields go to PATCH so concurrent edits to other fields are not overwritten. */
function diff(a: Assignment, next: CreateAssignmentInput): UpdateAssignmentInput {
  const out: UpdateAssignmentInput = {};
  if (next.title !== a.title) out.title = next.title;
  if (next.instructions !== a.instructions) out.instructions = next.instructions;
  if ((next.dueDate ?? null) !== (a.dueDate ? new Date(a.dueDate).toISOString() : null)) out.dueDate = next.dueDate ?? null;
  if (next.maximumMarks !== a.maximumMarks) out.maximumMarks = next.maximumMarks;
  if (next.submissionType !== a.submissionType) out.submissionType = next.submissionType;
  if (next.allowedFileTypes && next.allowedFileTypes.join(',') !== a.allowedFileTypes.join(',')) out.allowedFileTypes = next.allowedFileTypes;
  if (next.maximumFileSizeBytes !== undefined && next.maximumFileSizeBytes !== a.maximumFileSizeBytes) out.maximumFileSizeBytes = next.maximumFileSizeBytes;
  if (next.allowLateSubmission !== a.allowLateSubmission) out.allowLateSubmission = next.allowLateSubmission;
  if (next.allowResubmission !== a.allowResubmission) out.allowResubmission = next.allowResubmission;
  if (next.maxSubmissions !== a.maxSubmissions) out.maxSubmissions = next.maxSubmissions;
  return out;
}

interface AssignmentFormDialogProps {
  mode: 'create' | 'edit';
  assignment?: Assignment;
  onClose: () => void;
  onSaved: (assignment: Assignment) => void;
}

export function AssignmentFormDialog({ mode, assignment, onClose, onSaved }: AssignmentFormDialogProps) {
  const { user } = useAuth();
  const toast = useToast();
  const create = useCreateAssignment();
  const update = useUpdateAssignment();
  const inFlight = useRef(false);
  const [values, setValues] = useState<Values>(() => initialValues(assignment));
  const [errors, setErrors] = useState<Errors>({});
  const courses = useCourseOptions('', mode === 'create' && hasPermissions(user, ['courses.read']), 100);
  const pending = create.isPending || update.isPending;

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validate(values, mode);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`af-${first}`)?.focus();
      return;
    }
    const input = toInput(values);
    const onError = (error: unknown) => {
      const { message, fieldErrors } = normalizeApiError(error);
      const mapped: Errors = {};
      for (const issue of fieldErrors) {
        const key = issue.path.split('.')[0] as keyof Values;
        if (key in values) mapped[key] = issue.message;
      }
      setErrors(mapped);
      toast.error(mode === 'create' ? 'Could not create assignment' : 'Could not save changes', message);
    };
    inFlight.current = true;
    const settle = () => {
      inFlight.current = false;
    };
    if (mode === 'create') {
      create.mutate(input, {
        onSuccess: (a) => {
          toast.success('Assignment created', 'Saved as a draft. Publish it when it is ready for learners.');
          onSaved(a);
        },
        onError,
        onSettled: settle,
      });
    } else if (assignment) {
      const changes = diff(assignment, input);
      if (!Object.keys(changes).length) {
        settle();
        toast.notify({ tone: 'info', title: 'No changes to save' });
        onClose();
        return;
      }
      update.mutate(
        { id: assignment.id, input: changes },
        {
          onSuccess: (a) => {
            toast.success('Assignment updated', a.title);
            onSaved(a);
          },
          onError,
          onSettled: settle,
        }
      );
    }
  }

  const fileBased = values.submissionType !== 'text';

  return (
    <Dialog
      open
      onClose={onClose}
      busy={pending}
      size="lg"
      title={mode === 'create' ? 'New assignment' : 'Edit assignment'}
      description={mode === 'create' ? 'New assignments are saved as drafts.' : assignment?.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="assignment-form" loading={pending}>
            {mode === 'create' ? 'Create assignment' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="assignment-form" onSubmit={submit} noValidate className="space-y-6">
        <section className="space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Basics</h3>
          <Field id="af-title" label="Title" required error={errors.title} hint={`${values.title.trim().length}/200`}>
            <Input id="af-title" value={values.title} onChange={(e) => set('title', e.target.value)} maxLength={220} placeholder="e.g. CAPA case study" aria-invalid={Boolean(errors.title)} aria-describedby="af-title-msg" />
          </Field>
          {mode === 'create' ? (
            <Field id="af-courseId" label="Course" required error={errors.courseId} hint={courses.isError ? 'Could not load courses.' : undefined}>
              <Select id="af-courseId" value={values.courseId} onChange={(e) => set('courseId', e.target.value)} disabled={courses.isPending} aria-invalid={Boolean(errors.courseId)} aria-describedby="af-courseId-msg">
                <option value="">{courses.isPending ? 'Loading courses…' : 'Choose a course'}</option>
                {(courses.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field id="af-instructions" label="Instructions" required error={errors.instructions} hint={`${values.instructions.length.toLocaleString('en-IN')}/20,000 · shown to learners`}>
            <Textarea id="af-instructions" rows={6} value={values.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="What learners should do, how it is assessed, and what to submit" aria-invalid={Boolean(errors.instructions)} aria-describedby="af-instructions-msg" />
          </Field>
        </section>

        <section className="space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Marks & deadline</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="af-maximumMarks" label="Maximum marks" required error={errors.maximumMarks}>
              <Input id="af-maximumMarks" type="number" min={0} step="any" value={values.maximumMarks} onChange={(e) => set('maximumMarks', e.target.value)} aria-invalid={Boolean(errors.maximumMarks)} aria-describedby="af-maximumMarks-msg" />
            </Field>
            <Field id="af-dueDate" label="Due date" error={errors.dueDate} hint="Leave empty for no deadline">
              <Input id="af-dueDate" type="datetime-local" value={values.dueDate} onChange={(e) => set('dueDate', e.target.value)} aria-invalid={Boolean(errors.dueDate)} aria-describedby="af-dueDate-msg" />
            </Field>
          </div>
          <Toggle id="af-late" label="Accept late submissions" description="Learners can still submit after the due date; late work is flagged." checked={values.allowLateSubmission} onChange={(v) => set('allowLateSubmission', v)} />
        </section>

        <section className="space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Submission</h3>
          <Field id="af-submissionType" label="Submission type" required>
            <Select id="af-submissionType" value={values.submissionType} onChange={(e) => set('submissionType', e.target.value as SubmissionType)}>
              {SUBMISSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {submissionTypeLabel(t)}
                </option>
              ))}
            </Select>
          </Field>
          {fileBased ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
              <Field id="af-allowedFileTypes" label="Allowed file types" required error={errors.allowedFileTypes} hint="Comma separated, e.g. .pdf, .docx">
                <Input id="af-allowedFileTypes" value={values.allowedFileTypes} onChange={(e) => set('allowedFileTypes', e.target.value)} aria-invalid={Boolean(errors.allowedFileTypes)} aria-describedby="af-allowedFileTypes-msg" />
              </Field>
              <Field id="af-maxFileSizeMb" label="Max file size (MB)" required error={errors.maxFileSizeMb}>
                <Input id="af-maxFileSizeMb" type="number" min={0.01} max={100} step="any" value={values.maxFileSizeMb} onChange={(e) => set('maxFileSizeMb', e.target.value)} aria-invalid={Boolean(errors.maxFileSizeMb)} aria-describedby="af-maxFileSizeMb-msg" />
              </Field>
            </div>
          ) : null}
          <Toggle id="af-resubmit" label="Allow resubmission" description="Learners can submit again, and reviewers can return work for correction." checked={values.allowResubmission} onChange={(v) => set('allowResubmission', v)} />
          {values.allowResubmission ? (
            <Field id="af-maxSubmissions" label="Maximum submissions" required error={errors.maxSubmissions} hint="Including the first submission (1–20)">
              <Input id="af-maxSubmissions" type="number" min={1} max={20} step={1} value={values.maxSubmissions} onChange={(e) => set('maxSubmissions', e.target.value)} className="w-32" aria-invalid={Boolean(errors.maxSubmissions)} aria-describedby="af-maxSubmissions-msg" />
            </Field>
          ) : null}
        </section>
      </form>
    </Dialog>
  );
}
