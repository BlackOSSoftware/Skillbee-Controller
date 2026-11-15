'use client';

import { CheckCircle2, Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { BrandMark } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { contactEnquiriesService } from '@/services/contact-enquiries.service';
import type { EnquiryCategory, SubmitEnquiryInput } from '@/types/contact';
import { ENQUIRY_CATEGORY_LABEL } from '../display';

const SUBJECT_MAX = 200;
const MESSAGE_MAX = 10000;

export function PublicContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<EnquiryCategory>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const nameTrim = name.trim();
  const emailTrim = email.trim();
  const subjectTrim = subject.trim();
  const messageTrim = message.trim();

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
  const errors = {
    name: touched && nameTrim.length < 2 ? 'Please enter your name.' : undefined,
    email: touched && !emailOk ? 'Enter a valid email address.' : undefined,
    subject: touched && subjectTrim.length < 3 ? 'Subject must be at least 3 characters.' : undefined,
    message:
      touched && messageTrim.length < 10
        ? 'Please write at least 10 characters so we can help you.'
        : messageTrim.length > MESSAGE_MAX
          ? `Messages are limited to ${MESSAGE_MAX.toLocaleString()} characters.`
          : undefined,
  };
  const valid = nameTrim.length >= 2 && emailOk && subjectTrim.length >= 3 && messageTrim.length >= 10 && messageTrim.length <= MESSAGE_MAX;

  async function submit() {
    setTouched(true);
    setError(null);
    if (!valid || submitting) return;
    setSubmitting(true);
    const input: SubmitEnquiryInput = {
      name: nameTrim,
      email: emailTrim,
      phone: phone.trim() || undefined,
      subject: subjectTrim,
      message: messageTrim,
      category,
    };
    try {
      const enquiry = await contactEnquiriesService.submit(input);
      setReference(enquiry.referenceNumber);
    } catch (e) {
      setError(normalizeApiError(e).message || 'Could not send your enquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
        <Card className="w-full max-w-lg p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-ink">Enquiry received</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Thank you for reaching out. We have received your enquiry and our team will get back to you soon.
          </p>
          <p className="mt-4 rounded-lg border border-line bg-surface-2/60 px-4 py-3 font-mono text-sm text-ink">
            Reference: <span className="font-semibold">{reference}</span>
          </p>
          <p className="mt-3 text-xs text-ink-subtle">Please keep this reference number for follow-ups.</p>
          <Button variant="secondary" className="mt-6" onClick={() => window.location.reload()}>
            Send another enquiry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-4 sm:px-6">
          <BrandMark size={32} priority />
          <span className="text-sm font-semibold text-ink">SkillBee</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-ink">Contact us</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Questions about courses, pricing or partnerships? Send us a message and we will reply by email.
          </p>
        </div>

        <Card className="p-5 sm:p-7">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
            noValidate
          >
            {error ? (
              <div className="rounded-lg border border-danger/30 bg-danger/[0.06] px-3.5 py-2.5 text-sm text-danger" role="alert">
                {error}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cf-name" label="Full name" required error={errors.name}>
                <Input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} placeholder="Your name" autoComplete="name" aria-invalid={Boolean(errors.name)} />
              </Field>
              <Field id="cf-email" label="Email" required error={errors.email}>
                <Input id="cf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} placeholder="you@example.com" autoComplete="email" aria-invalid={Boolean(errors.email)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cf-phone" label="Phone (optional)">
                <Input id="cf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" autoComplete="tel" />
              </Field>
              <Field id="cf-category" label="Category">
                <Select id="cf-category" value={category} onChange={(e) => setCategory(e.target.value as EnquiryCategory)}>
                  {Object.entries(ENQUIRY_CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field id="cf-subject" label="Subject" required error={errors.subject}>
              <Input id="cf-subject" value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={() => setTouched(true)} placeholder="What is this about?" maxLength={SUBJECT_MAX} aria-invalid={Boolean(errors.subject)} />
            </Field>
            <Field id="cf-message" label="Message" required error={errors.message} hint={`${messageTrim.length.toLocaleString()} / ${MESSAGE_MAX.toLocaleString()}`}>
              <Textarea id="cf-message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} onBlur={() => setTouched(true)} placeholder="Tell us how we can help…" aria-invalid={Boolean(errors.message)} />
            </Field>
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
                <Mail className="size-3.5" aria-hidden />
                We reply by email — usually within one business day.
              </p>
              <Button type="submit" loading={submitting} disabled={!valid}>
                <Send className="size-4" aria-hidden />
                Send enquiry
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
