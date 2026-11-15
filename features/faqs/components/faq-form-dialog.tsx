'use client';

import { useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { CreateFaqInput, Faq, FaqStatus } from '@/types/faqs';
import { FAQ_STATUS_LABEL } from '../display';
import { useCreateFaq, useSetFaqStatus, useUpdateFaq } from '../hooks';

const QUESTION_MAX = 500;
const ANSWER_MAX = 20000;
const CATEGORY_MAX = 120;

interface FormState {
  question: string;
  answer: string;
  category: string;
  displayOrder: string;
  isFeatured: boolean;
}

function toForm(faq?: Faq | null): FormState {
  return {
    question: faq?.question ?? '',
    answer: faq?.answer ?? '',
    category: faq?.category && faq.category !== 'general' ? faq.category : '',
    displayOrder: faq ? String(faq.displayOrder) : '',
    isFeatured: faq?.isFeatured ?? false,
  };
}

/** Create (always draft) or edit an FAQ. Answer accepts sanitized HTML. */
export function FaqFormDialog({
  open,
  faq,
  onClose,
  onDone,
}: {
  open: boolean;
  faq: Faq | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const create = useCreateFaq();
  const update = useUpdateFaq();
  const [v, setV] = useState<FormState>(() => toForm(faq));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const pending = create.isPending || update.isPending;
  const isEdit = Boolean(faq);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (v.question.trim().length < 3) next.question = 'Question must be at least 3 characters.';
    else if (v.question.trim().length > QUESTION_MAX) next.question = `Question must be ${QUESTION_MAX} characters or less.`;
    if (!v.answer.trim()) next.answer = 'Answer is required.';
    else if (v.answer.length > ANSWER_MAX) next.answer = `Answer must be ${ANSWER_MAX.toLocaleString()} characters or less.`;
    if (v.category.trim().length > CATEGORY_MAX) next.category = `Category must be ${CATEGORY_MAX} characters or less.`;
    const order = v.displayOrder.trim();
    if (order && (!Number.isInteger(Number(order)) || Number(order) < 0)) next.displayOrder = 'Display order must be a non-negative whole number.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || pending) return;
    const input: CreateFaqInput = {
      question: v.question.trim(),
      answer: v.answer,
      category: v.category.trim() || undefined,
      displayOrder: v.displayOrder.trim() ? Number(v.displayOrder) : undefined,
      isFeatured: v.isFeatured,
    };
    const onOk = (saved: Faq) => {
      toast.success(isEdit ? 'FAQ updated' : 'FAQ created', isEdit ? undefined : 'New FAQs start as drafts — publish when ready.');
      onClose();
      onDone?.();
      return saved;
    };
    if (isEdit && faq) {
      update.mutate(
        { id: faq.id, input },
        {
          onSuccess: () => onOk(faq),
          onError: (err) => toast.error('Could not save FAQ', normalizeApiError(err).message),
        }
      );
    } else {
      create.mutate(input, {
        onSuccess: () => onOk({} as Faq),
        onError: (err) => toast.error('Could not create FAQ', normalizeApiError(err).message),
      });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !pending && onClose()}
      title={isEdit ? 'Edit FAQ' : 'New FAQ'}
      description={isEdit ? `Currently ${FAQ_STATUS_LABEL[faq!.status]}` : 'Created as a draft — publish it when ready.'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" form="faq-form" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create draft'}
          </button>
        </div>
      }
    >
      <form id="faq-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field id="faq-question" label="Question" error={errors.question} hint={`${v.question.trim().length.toLocaleString('en-IN')}/${QUESTION_MAX}`}>
          <Input id="faq-question" value={v.question} onChange={(e) => set('question', e.target.value)} maxLength={QUESTION_MAX} required />
        </Field>
        <Field
          id="faq-answer"
          label="Answer"
          error={errors.answer}
          hint={`${v.answer.length.toLocaleString('en-IN')}/${ANSWER_MAX.toLocaleString('en-IN')} · HTML allowed, sanitized server-side`}
        >
          <Textarea id="faq-answer" rows={8} value={v.answer} onChange={(e) => set('answer', e.target.value)} className="font-mono text-[13px]" required />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="faq-category" label="Category" error={errors.category} hint="Optional — e.g. billing, courses, account">
            <Input id="faq-category" value={v.category} onChange={(e) => set('category', e.target.value)} maxLength={CATEGORY_MAX} placeholder="general" />
          </Field>
          <Field id="faq-order" label="Display order" error={errors.displayOrder} hint="Lower numbers appear first">
            <Input id="faq-order" type="number" min={0} step={1} value={v.displayOrder} onChange={(e) => set('displayOrder', e.target.value)} placeholder="0" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={v.isFeatured}
            onChange={(e) => set('isFeatured', e.target.checked)}
            className="size-4 rounded border-line text-primary focus:ring-primary"
          />
          Feature this FAQ
        </label>
      </form>
    </Dialog>
  );
}

/** Publish / unpublish with confirmation. */
export function FaqStatusDialog({
  faq,
  target,
  onClose,
  onDone,
}: {
  faq: Pick<Faq, 'id' | 'question' | 'status'>;
  target: FaqStatus;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const update = useSetFaqStatus();
  const publishing = target === 'published';

  function confirm() {
    if (update.isPending) return;
    update.mutate(
      { id: faq.id, status: target },
      {
        onSuccess: () => {
          toast.success(publishing ? 'FAQ published' : 'FAQ unpublished', publishing ? 'Now visible on the public site.' : 'Hidden from the public site.');
          onClose();
          onDone?.();
        },
        onError: (e) => toast.error('Could not update status', normalizeApiError(e).message),
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={publishing ? 'Publish this FAQ?' : 'Unpublish this FAQ?'}
      description={faq.question}
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
            {update.isPending ? 'Saving…' : publishing ? 'Publish' : 'Unpublish'}
          </button>
        </div>
      }
    >
      <p className="text-sm text-ink-muted">
        {publishing
          ? 'Published FAQs appear on the public FAQ page and in FAQPage structured data.'
          : 'Unpublished FAQs are hidden from all public endpoints but kept for editing.'}
      </p>
    </Dialog>
  );
}
