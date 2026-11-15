'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { QuestionInput, QuizQuestion } from '@/types/quizzes';
import { Toggle } from '@/features/courses/components/form-controls';
import { useAddQuestion, useUpdateQuestion } from '../hooks';
import { initialQuestionValues, QuestionFormFields, toQuestionPayload, validateQuestion, type QuestionErrors, type QuestionValues } from './question-form';

interface QuestionEditorDialogProps {
  quizId: string;
  question?: QuizQuestion;
  onClose: () => void;
}

export function QuestionEditorDialog({ quizId, question, onClose }: QuestionEditorDialogProps) {
  const toast = useToast();
  const add = useAddQuestion(quizId);
  const update = useUpdateQuestion(quizId);
  const inFlight = useRef(false);
  const [v, setValues] = useState<QuestionValues>(() => initialQuestionValues(question));
  const [isRequired, setRequired] = useState(question?.isRequired ?? true);
  const [errors, setErrors] = useState<QuestionErrors>({});
  const pending = add.isPending || update.isPending;

  function set<K extends keyof QuestionValues>(key: K, value: QuestionValues[K]) {
    setValues((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const found = Object.fromEntries(Object.entries(validateQuestion(v)).filter(([, m]) => m));
    setErrors(found);
    if (Object.keys(found).length) return;
    inFlight.current = true;
    const input: QuestionInput = { ...toQuestionPayload(v), isRequired };
    const handlers = {
      onSuccess: () => {
        toast.success(question ? 'Question updated' : 'Question added', input.questionText.slice(0, 80));
        onClose();
      },
      onError: (error: unknown) => toast.error('Could not save question', normalizeApiError(error).message),
      onSettled: () => {
        inFlight.current = false;
      },
    };
    if (question) update.mutate({ id: question.id, input }, handlers);
    else add.mutate(input, handlers);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={pending}
      size="lg"
      title={question ? 'Edit question' : 'Add question'}
      description={question ? 'Changes apply to new attempts; past attempts keep their snapshot.' : 'Questions are added to the end of the quiz.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="question-form" loading={pending}>
            {question ? 'Save question' : 'Add question'}
          </Button>
        </>
      }
    >
      <form id="question-form" onSubmit={submit} noValidate className="space-y-5">
        <QuestionFormFields
          idPrefix="qe"
          values={v}
          errors={errors}
          onChange={set}
          aside={
            <div className="sm:pt-6">
              <Toggle id="qe-required" label="Required" checked={isRequired} onChange={setRequired} />
            </div>
          }
        />
      </form>
    </Dialog>
  );
}
