'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { BankQuestion, BankQuestionInput } from '@/types/quizzes';
import { useBankCategories, useCreateBankQuestion, useUpdateBankQuestion } from '../hooks';
import { EMPTY_ANSWER_KEY, initialQuestionValues, QuestionFormFields, toQuestionPayload, validateQuestion, type QuestionErrors, type QuestionValues } from './question-form';

/** The backend files uncategorised items under "general". */
const DEFAULT_CATEGORY = 'general';

interface BankQuestionDialogProps {
  question?: BankQuestion;
  onClose: () => void;
  /** Replaces the default close after a successful save. */
  onSaved?: (question: BankQuestion) => void;
}

export function BankQuestionDialog({ question, onClose, onSaved }: BankQuestionDialogProps) {
  const toast = useToast();
  const create = useCreateBankQuestion();
  const update = useUpdateBankQuestion();
  const categories = useBankCategories(true);
  const listId = useId();
  const inFlight = useRef(false);
  const [v, setValues] = useState<QuestionValues>(() => initialQuestionValues(question ? { ...question, marks: question.defaultMarks } : undefined));
  const [category, setCategory] = useState(question?.category ?? DEFAULT_CATEGORY);
  const [errors, setErrors] = useState<QuestionErrors>({});
  const pending = create.isPending || update.isPending;

  function set<K extends keyof QuestionValues>(key: K, value: QuestionValues[K]) {
    setValues((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const found: QuestionErrors = Object.fromEntries(Object.entries(validateQuestion(v)).filter(([, m]) => m));
    const cat = category.trim();
    // An empty category on PATCH is ignored by the backend, so one is always required here.
    if (!cat) found.category = 'Enter a category.';
    else if (cat.length > 100) found.category = '100 characters or less.';
    setErrors(found);
    if (Object.keys(found).length) return;

    inFlight.current = true;
    const { marks, ...content } = toQuestionPayload(v);
    const body: BankQuestionInput = { ...content, defaultMarks: marks, category: cat };
    const handlers = {
      onSuccess: (saved: BankQuestion) => {
        toast.success(question ? 'Bank question updated' : 'Added to the question bank', saved.questionText.slice(0, 80));
        if (onSaved) onSaved(saved);
        else onClose();
      },
      onError: (error: unknown) => toast.error('Could not save question', normalizeApiError(error).message),
      onSettled: () => {
        inFlight.current = false;
      },
    };
    if (question) {
      const input = question.questionType === v.questionType ? body : { ...EMPTY_ANSWER_KEY, ...body };
      update.mutate({ id: question.id, input }, handlers);
    } else create.mutate(body, handlers);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={pending}
      size="lg"
      title={question ? 'Edit bank question' : 'New bank question'}
      description={
        question
          ? 'Edits apply to future imports. Quizzes that already imported this question, and their attempts, keep their own copy.'
          : 'Reusable across quizzes. Importing copies it into a quiz, so later edits here never change existing quizzes.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="bank-question-form" loading={pending}>
            {question ? 'Save changes' : 'Add to bank'}
          </Button>
        </>
      }
    >
      <form id="bank-question-form" onSubmit={submit} noValidate className="space-y-5">
        <QuestionFormFields
          idPrefix="bq"
          values={v}
          errors={errors}
          onChange={set}
          marksLabel="Default marks"
          aside={
            <Field id="bq-category" label="Category" required error={errors.category} hint={categories.isError ? 'Existing categories could not be loaded' : 'Pick one or type a new one'}>
              <Input
                id="bq-category"
                list={listId}
                value={category}
                maxLength={100}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setErrors((er) => ({ ...er, category: '' }));
                }}
                aria-invalid={Boolean(errors.category)}
                aria-describedby="bq-category-msg"
                autoComplete="off"
              />
              <datalist id={listId}>
                {(categories.data ?? []).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          }
        />
      </form>
    </Dialog>
  );
}
