'use client';

import { Clock, Download, FileText, History, Paperclip, RotateCcw, Star } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { Assignment, Submission } from '@/types/assignments';
import { Toggle } from '@/features/courses/components/form-controls';
import { Initials } from '@/features/enrollments/display';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { assignmentPolicy, useDownloadAttachment, useGradeSubmission, useReturnSubmission, useSubmissionDetail, useSubmissionHistory } from '../hooks';
import { formatBytes, formatDateTime, GRADABLE, SubmissionStatusBadge, submissionStatusLabel } from '../display';

interface SubmissionReviewDrawerProps {
  assignment: Assignment;
  submission: Submission;
  learner?: { name: string; email: string };
  onClose: () => void;
  onUpdated: (submission: Submission) => void;
  /** Owned by the parent so the panel stays open when the drawer remounts after a save. */
  showHistory: boolean;
  onShowHistoryChange: (open: boolean) => void;
}

function Section({ title, icon, children, action }: { title: string; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SubmissionReviewDrawer({ assignment, submission: row, learner, onClose, onUpdated, showHistory, onShowHistoryChange: setShowHistory }: SubmissionReviewDrawerProps) {
  const { user } = useAuth();
  const toast = useToast();
  const canGrade = assignmentPolicy.canGrade(user);
  const detail = useSubmissionDetail(row, assignmentPolicy.canReadSubmissions(user));
  const s = detail.data ?? row;
  const historyQuery = useSubmissionHistory(s.id, showHistory);
  const grade = useGradeSubmission();
  const returnSub = useReturnSubmission();
  const download = useDownloadAttachment();
  const inFlight = useRef(false);

  const [marks, setMarks] = useState(s.marksAwarded !== null && s.marksAwarded !== undefined ? String(s.marksAwarded) : '');
  const [feedback, setFeedback] = useState(s.feedback ?? '');
  const [returnWithGrade, setReturnWithGrade] = useState(false);
  const [errors, setErrors] = useState<{ marks?: string; feedback?: string }>({});
  const [confirmRegrade, setConfirmRegrade] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnFeedback, setReturnFeedback] = useState(s.feedback ?? '');
  const [downloading, setDownloading] = useState<string | null>(null);

  const gradable = GRADABLE.includes(s.submissionStatus);
  const alreadyGraded = s.marksAwarded !== null && s.marksAwarded !== undefined;
  const history = historyQuery.data?.evaluationHistory ?? [];
  const versions = historyQuery.data?.versionHistory ?? [];
  const pending = grade.isPending || returnSub.isPending;

  function validate(): boolean {
    const found: typeof errors = {};
    const value = Number(marks);
    if (marks.trim() === '' || !Number.isFinite(value)) found.marks = 'Enter the marks awarded.';
    else if (value < 0) found.marks = 'Marks cannot be negative.';
    else if (value > assignment.maximumMarks) found.marks = `Marks cannot exceed ${assignment.maximumMarks}.`;
    if (feedback.length > 10000) found.feedback = 'Feedback must be 10,000 characters or less.';
    setErrors(found);
    return !Object.keys(found).length;
  }

  function requestGrade() {
    if (!validate()) return;
    if (alreadyGraded) setConfirmRegrade(true);
    else submitGrade();
  }

  function submitGrade() {
    if (inFlight.current) return;
    inFlight.current = true;
    grade.mutate(
      { id: s.id, input: { marksAwarded: Number(marks), ...(feedback.trim() ? { feedback: feedback.trim() } : {}), status: returnWithGrade ? 'returned' : 'evaluated' } },
      {
        onSuccess: (updated) => {
          toast.success(returnWithGrade ? 'Graded and returned' : 'Submission graded', `${updated.marksAwarded} / ${assignment.maximumMarks} · ${learner?.name ?? 'Learner'}`);
          setConfirmRegrade(false);
          onUpdated(updated);
        },
        onError: (error) => {
          const { message, code } = normalizeApiError(error);
          if (code === 'MARKS_EXCEED' || code === 'INVALID_MARKS') setErrors({ marks: message });
          setConfirmRegrade(false);
          toast.error('Could not save grade', message);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  function submitReturn() {
    if (inFlight.current) return;
    if (returnFeedback.length > 10000) return;
    inFlight.current = true;
    returnSub.mutate(
      { id: s.id, feedback: returnFeedback.trim() || undefined },
      {
        onSuccess: (updated) => {
          toast.success('Returned for correction', `${learner?.name ?? 'Learner'} can resubmit.`);
          setReturnOpen(false);
          onUpdated(updated);
        },
        onError: (error) => toast.error('Could not return submission', normalizeApiError(error).message),
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  function downloadFile(attachment: Submission['attachments'][number]) {
    setDownloading(attachment.id);
    download.mutate(
      { submissionId: s.id, attachment },
      {
        onError: (error) => toast.error('Download failed', normalizeApiError(error).message),
        onSettled: () => setDownloading(null),
      }
    );
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        busy={pending}
        placement="right"
        title="Review submission"
        description={assignment.title}
        footer={
          canGrade && gradable ? (
            <>
              <Button
                variant="secondary"
                className="mr-auto"
                onClick={() => setReturnOpen(true)}
                disabled={!assignment.allowResubmission || pending}
                title={assignment.allowResubmission ? undefined : 'Resubmission is turned off for this assignment'}
              >
                <RotateCcw className="size-4" aria-hidden />
                Return for correction
              </Button>
              <Button onClick={requestGrade} loading={grade.isPending}>
                <Star className="size-4" aria-hidden />
                {alreadyGraded ? 'Update grade' : 'Save grade'}
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Initials firstName={learner?.name.split(' ')[0]} lastName={learner?.name.split(' ').slice(1).join(' ')} email={learner?.email} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-ink">{learner?.name ?? 'Learner'}</p>
              <p className="truncate text-sm text-ink-muted">{learner?.email ?? `Student ${s.studentId.slice(-6)}`}</p>
            </div>
            <SubmissionStatusBadge status={s.submissionStatus} />
          </div>

          <dl className="grid grid-cols-3 gap-3 rounded-lg border border-line p-3 text-sm">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">Submitted</dt>
              <dd className="mt-0.5 text-ink">{formatDateTime(s.submittedAt)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">Attempt</dt>
              <dd className="mt-0.5 text-ink">
                {s.version} of {assignment.maxSubmissions}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">Timing</dt>
              <dd className="mt-0.5">{s.isLate ? <span className="text-danger">Late</span> : <span className="text-success">On time</span>}</dd>
            </div>
          </dl>

          <Section title="Answer" icon={<FileText className="size-3.5" aria-hidden />}>
            {s.textContent ? (
              <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2/50 p-3 text-sm leading-relaxed text-ink">{s.textContent}</div>
            ) : (
              <p className="text-sm text-ink-subtle">No written answer.</p>
            )}
          </Section>

          <Section title={`Files (${s.attachments.length})`} icon={<Paperclip className="size-3.5" aria-hidden />}>
            {s.attachments.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                {s.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-[10px] font-semibold uppercase text-ink-muted">
                      {(a.extension ?? a.originalFileName.split('.').pop() ?? 'file').replace('.', '').slice(0, 4)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{a.originalFileName}</span>
                      <span className="block text-[11px] text-ink-subtle">{formatBytes(a.sizeBytes)}</span>
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => downloadFile(a)} loading={downloading === a.id} disabled={Boolean(downloading) && downloading !== a.id}>
                      {downloading === a.id ? null : <Download className="size-3.5" aria-hidden />}
                      Download
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-subtle">No files attached.</p>
            )}
          </Section>

          {alreadyGraded ? (
            <Section title="Current evaluation" icon={<Star className="size-3.5" aria-hidden />}>
              <div className="rounded-lg border border-line p-3">
                <p className="text-sm text-ink">
                  <span className="text-xl font-semibold tabular-nums">{s.marksAwarded}</span>
                  <span className="text-ink-muted"> / {assignment.maximumMarks}</span>
                  <span className="ml-2 text-xs text-ink-subtle">{formatDateTime(s.evaluatedAt)}</span>
                </p>
                {s.feedback ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">{s.feedback}</p> : null}
              </div>
            </Section>
          ) : null}

          {canGrade && gradable ? (
            <Section title={alreadyGraded ? 'Update grade' : 'Grade'} icon={<Star className="size-3.5" aria-hidden />}>
              <div className="space-y-3 rounded-lg border border-line bg-surface-2/40 p-3">
                <Field id="grade-marks" label={`Marks (0–${assignment.maximumMarks})`} required error={errors.marks}>
                  <div className="flex items-center gap-2">
                    <Input
                      id="grade-marks"
                      type="number"
                      min={0}
                      max={assignment.maximumMarks}
                      step="any"
                      value={marks}
                      onChange={(e) => {
                        setMarks(e.target.value);
                        setErrors((x) => ({ ...x, marks: undefined }));
                      }}
                      className="w-32"
                      aria-invalid={Boolean(errors.marks)}
                      aria-describedby="grade-marks-msg"
                    />
                    <span className="text-sm text-ink-muted">/ {assignment.maximumMarks}</span>
                  </div>
                </Field>
                <Field id="grade-feedback" label="Feedback" error={errors.feedback} hint={`Visible to the learner · ${feedback.length}/10000`}>
                  <Textarea id="grade-feedback" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, and what to improve" aria-invalid={Boolean(errors.feedback)} aria-describedby="grade-feedback-msg" />
                </Field>
                <Toggle id="grade-return" label="Return to learner with this grade" description="Marks the submission as returned instead of final." checked={returnWithGrade} onChange={setReturnWithGrade} />
                {!assignment.allowResubmission ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                    <Clock className="size-3" aria-hidden />
                    Return for correction is unavailable because resubmission is turned off for this assignment.
                  </p>
                ) : null}
              </div>
            </Section>
          ) : !canGrade ? (
            <p className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-xs text-ink-muted">Grading needs the assignments.grade permission.</p>
          ) : null}

          <Section
            title="History"
            icon={<History className="size-3.5" aria-hidden />}
            action={
              <Button size="sm" variant="ghost" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>
                {showHistory ? 'Hide' : 'Show history'}
              </Button>
            }
          >
            {!showHistory ? (
              <p className="text-xs text-ink-subtle">Earlier grades, returns and resubmitted versions.</p>
            ) : historyQuery.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : historyQuery.isError ? (
              <ErrorState error={historyQuery.error} onRetry={() => historyQuery.refetch()} compact />
            ) : !history.length && !versions.length ? (
              <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-xs text-ink-subtle">No earlier evaluations or versions yet.</p>
            ) : (
              <div className="space-y-4">
                {history.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-ink-muted">Evaluations ({history.length})</p>
                    <ol className="space-y-2">
                      {[...history].reverse().map((h, i) => (
                        <li key={h._id ?? i} className="rounded-lg border border-line px-3 py-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-ink">
                              {h.marksAwarded ?? '—'} / {assignment.maximumMarks}
                            </span>
                            <Badge>{submissionStatusLabel(h.status)}</Badge>
                            <span className="text-ink-subtle">{formatDateTime(h.evaluatedAt)}</span>
                          </div>
                          {h.feedback ? <p className="mt-1 text-ink-muted">{h.feedback}</p> : null}
                          {h.note ? <p className="mt-1 text-[11px] text-ink-subtle">{h.note}</p> : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {versions.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-ink-muted">Earlier versions ({versions.length})</p>
                    <ol className="space-y-2">
                      {[...versions].reverse().map((v, i) => (
                        <li key={v.id ?? i} className="rounded-lg border border-line px-3 py-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-ink">Version {v.version}</span>
                            <Badge>{submissionStatusLabel(v.submissionStatus)}</Badge>
                            <span className="text-ink-subtle">{formatDateTime(v.submittedAt)}</span>
                            {v.isLate ? <span className="text-danger">Late</span> : null}
                            {v.marksAwarded !== null && v.marksAwarded !== undefined ? (
                              <span className="text-ink-muted">
                                {v.marksAwarded} / {assignment.maximumMarks}
                              </span>
                            ) : null}
                          </div>
                          {v.textContent ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-ink-muted">{v.textContent}</p> : null}
                          {v.attachments.length ? (
                            <p className="mt-1 text-[11px] text-ink-subtle">
                              {v.attachments.map((f) => f.originalFileName).join(', ')}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            )}
          </Section>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmRegrade}
        title="Replace the existing grade?"
        confirmLabel="Update grade"
        tone="primary"
        loading={grade.isPending}
        onCancel={() => setConfirmRegrade(false)}
        onConfirm={submitGrade}
        description={
          <p>
            The current grade ({s.marksAwarded} / {assignment.maximumMarks}) is kept in the evaluation history and replaced with {marks} / {assignment.maximumMarks}.
          </p>
        }
      />

      {returnOpen ? (
        <Dialog
          open
          onClose={() => setReturnOpen(false)}
          busy={returnSub.isPending}
          size="sm"
          title="Return for correction?"
          description={`${learner?.name ?? 'The learner'} will be able to resubmit this assignment.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setReturnOpen(false)} disabled={returnSub.isPending}>
                Cancel
              </Button>
              <Button onClick={submitReturn} loading={returnSub.isPending}>
                <RotateCcw className="size-4" aria-hidden />
                Return submission
              </Button>
            </>
          }
        >
          <Field id="return-feedback" label="Feedback for the learner" hint={`Optional · ${returnFeedback.length}/10000`} error={returnFeedback.length > 10000 ? 'Feedback must be 10,000 characters or less.' : undefined}>
            <Textarea id="return-feedback" rows={4} value={returnFeedback} onChange={(e) => setReturnFeedback(e.target.value)} placeholder="Explain what needs to be corrected" aria-describedby="return-feedback-msg" />
          </Field>
        </Dialog>
      ) : null}
    </>
  );
}
