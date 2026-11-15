'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import { useCreateCampaign, useSubscriberStats } from '../hooks';

const SUBJECT_MAX = 200;
const HTML_MAX = 100000;
const TEXT_MAX = 50000;

interface FormState {
  subject: string;
  htmlBody: string;
  textBody: string;
}

const EMPTY: FormState = { subject: '', htmlBody: '', textBody: '' };

/** Campaign creation — POST queues emails to every subscribed (verified) contact. */
export function CampaignCreateDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const create = useCreateCampaign();
  const stats = useSubscriberStats();
  const [v, setV] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [confirming, setConfirming] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const recipients = stats.subscribed.value;
  const pending = create.isPending;

  const dirty = useMemo(
    () => v.subject.trim() !== '' || v.htmlBody.trim() !== '' || v.textBody.trim() !== '',
    [v]
  );

  function set<K extends keyof FormState>(key: K, value: string) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!v.subject.trim()) next.subject = 'Subject is required.';
    else if (v.subject.trim().length > SUBJECT_MAX) next.subject = `Subject must be ${SUBJECT_MAX} characters or less.`;
    if (!v.htmlBody.trim()) next.htmlBody = 'HTML body is required.';
    else if (v.htmlBody.length > HTML_MAX) next.htmlBody = `HTML body must be ${HTML_MAX.toLocaleString()} characters or less.`;
    if (!v.textBody.trim()) next.textBody = 'Plain-text body is required.';
    else if (v.textBody.length > TEXT_MAX) next.textBody = `Text body must be ${TEXT_MAX.toLocaleString()} characters or less.`;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || pending) return;
    setConfirming(true);
  }

  function confirmSend() {
    if (pending) return;
    create.mutate(
      { subject: v.subject.trim(), htmlBody: v.htmlBody, textBody: v.textBody },
      {
        onSuccess: (campaign) => {
          toast.success('Campaign queued', `"${campaign.subject}" is being sent to verified subscribers.`);
          setV(EMPTY);
          setConfirming(false);
          onClose();
          onDone?.();
        },
        onError: (err) => {
          setConfirming(false);
          toast.error('Could not queue campaign', normalizeApiError(err).message);
        },
      }
    );
  }

  function handleClose() {
    if (pending) return;
    if (dirty && !window.confirm('Discard this campaign draft?')) return;
    setV(EMPTY);
    setErrors({});
    setConfirming(false);
    onClose();
  }

  return (
    <>
      <Dialog
        open={open && !confirming}
        onClose={handleClose}
        title="New campaign"
        description="Queued emails go to every verified (subscribed) contact. Unverified and unsubscribed contacts are skipped."
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-ink-muted">
              {recipients != null ? `${recipients.toLocaleString('en-IN')} verified recipients` : 'Loading recipient count…'}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleClose} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={pending || !dirty}>
                {pending ? 'Queueing…' : 'Review & send'}
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="camp-subject" label="Subject" error={errors.subject} hint={`${v.subject.length.toLocaleString('en-IN')}/${SUBJECT_MAX}`}>
            <Input id="camp-subject" value={v.subject} onChange={(e) => set('subject', e.target.value)} maxLength={SUBJECT_MAX} required />
          </Field>
          <Field
            id="camp-html"
            label="HTML body"
            error={errors.htmlBody}
            hint={`${v.htmlBody.length.toLocaleString('en-IN')}/${HTML_MAX.toLocaleString('en-IN')} · raw HTML, sanitized server-side`}
          >
            <Textarea id="camp-html" rows={10} value={v.htmlBody} onChange={(e) => set('htmlBody', e.target.value)} className="font-mono text-[13px]" required />
          </Field>
          <div>
            <button type="button" onClick={() => setShowPreview((s) => !s)} className="text-xs font-medium text-primary hover:underline">
              {showPreview ? 'Hide HTML preview' : 'Preview HTML'}
            </button>
            {showPreview && v.htmlBody.trim() ? (
              <iframe
                title="Campaign HTML preview"
                sandbox=""
                srcDoc={v.htmlBody}
                className="mt-2 h-64 w-full rounded-lg border border-line bg-white"
              />
            ) : null}
          </div>
          <Field
            id="camp-text"
            label="Plain-text body"
            error={errors.textBody}
            hint={`${v.textBody.length.toLocaleString('en-IN')}/${TEXT_MAX.toLocaleString('en-IN')} · fallback for text-only clients`}
          >
            <Textarea id="camp-text" rows={5} value={v.textBody} onChange={(e) => set('textBody', e.target.value)} required />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={confirming}
        onClose={() => !pending && setConfirming(false)}
        title="Send this campaign?"
        description="This queues real emails through the configured mail transport."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={confirmSend}
              disabled={pending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {pending ? 'Queueing…' : `Send to ${recipients != null ? recipients.toLocaleString('en-IN') : '…'} subscribers`}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
            <p className="text-xs text-ink-subtle">Subject</p>
            <p className="mt-0.5 text-sm font-medium text-ink">{v.subject}</p>
          </div>
          <p className="text-sm text-ink-muted">
            Delivery is asynchronous — the campaign moves through queued → sending → sent (or failed). Delivery counts are
            tracked per campaign, not per recipient in real time.
          </p>
        </div>
      </Dialog>
    </>
  );
}
