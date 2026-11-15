'use client';

import { Lock, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import type { Coupon, CouponApplicability, CouponDiscountType, CreateCouponInput, UpdateCouponInput } from '@/types/coupons';
import { SectionTitle, Toggle } from '@/features/courses/components/form-controls';
import { useCourseCatalog } from '@/features/shared/lookups';
import { discountLabel, formatMajor } from '../display';
import { useCreateCoupon, useUpdateCoupon } from '../hooks';

const CURRENCIES = ['INR', 'USD'] as const;

interface FormState {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  currency: string;
  maximumDiscountAmount: string;
  minimumOrderAmount: string;
  usageLimit: string;
  perUserLimit: string;
  startDate: string;
  expiryDate: string;
  applicability: CouponApplicability;
  applicableCourses: string[];
  isActive: boolean;
}

/** ISO → value for `<input type="datetime-local">` in the viewer's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const num = (v: string) => (v.trim() === '' ? null : Number(v));

function initialState(c?: Coupon): FormState {
  return {
    code: c?.code ?? '',
    description: c?.description ?? '',
    discountType: c?.discountType ?? 'percentage',
    discountValue: c ? String(c.discountValue) : '',
    currency: c?.currency ?? 'INR',
    maximumDiscountAmount: c?.maximumDiscountAmount != null ? String(c.maximumDiscountAmount) : '',
    minimumOrderAmount: c && c.minimumOrderAmount ? String(c.minimumOrderAmount) : '',
    usageLimit: c?.usageLimit != null ? String(c.usageLimit) : '',
    perUserLimit: String(c?.perUserLimit ?? 1),
    startDate: toLocalInput(c?.startDate ?? null),
    expiryDate: toLocalInput(c?.expiryDate ?? null),
    applicability: c?.applicability ?? 'all_courses',
    applicableCourses: c?.applicableCourses ?? [],
    isActive: c?.isActive ?? true,
  };
}

const MONEY = /^\d+(\.\d{1,2})?$/;
const INT = /^\d+$/;

function validate(s: FormState, coupon?: Coupon): Record<string, string> {
  const e: Record<string, string> = {};
  const code = s.code.trim();
  if (!code) e.code = 'Enter a coupon code.';
  else if (code.length < 3 || code.length > 40) e.code = 'Use 3 to 40 characters.';
  else if (/\s/.test(code)) e.code = 'Spaces are not allowed.';
  if (s.description.trim().length > 500) e.description = '500 characters or less.';

  const value = s.discountValue.trim();
  if (!value) e.discountValue = 'Enter the discount.';
  else if (!MONEY.test(value) || Number(value) <= 0) e.discountValue = 'Enter a number above zero with up to two decimals.';
  else if (s.discountType === 'percentage' && Number(value) > 100) e.discountValue = 'A percentage cannot exceed 100.';

  if (s.discountType === 'percentage' && s.maximumDiscountAmount.trim() && (!MONEY.test(s.maximumDiscountAmount.trim()) || Number(s.maximumDiscountAmount) <= 0))
    e.maximumDiscountAmount = 'Enter an amount above zero, or leave empty for no cap.';
  if (s.minimumOrderAmount.trim() && !MONEY.test(s.minimumOrderAmount.trim())) e.minimumOrderAmount = 'Enter an amount with up to two decimals.';

  if (s.usageLimit.trim()) {
    if (!INT.test(s.usageLimit.trim()) || Number(s.usageLimit) < 1) e.usageLimit = 'Enter a whole number of at least 1, or leave empty for unlimited.';
    else if (coupon && Number(s.usageLimit) < coupon.usedCount) e.usageLimit = `Already redeemed ${coupon.usedCount} times; the limit cannot be lower.`;
  }
  if (!INT.test(s.perUserLimit.trim()) || Number(s.perUserLimit) < 1) e.perUserLimit = 'Enter a whole number of at least 1.';

  if (s.startDate && s.expiryDate && new Date(s.expiryDate) <= new Date(s.startDate)) e.expiryDate = 'Expiry must be after the start.';
  else if (!coupon && s.expiryDate && new Date(s.expiryDate).getTime() <= Date.now()) e.expiryDate = 'Choose a future date and time.';

  if (s.applicability === 'selected_courses' && !s.applicableCourses.length) e.applicableCourses = 'Pick at least one course.';
  return e;
}

function toCreateInput(s: FormState): CreateCouponInput {
  const percentage = s.discountType === 'percentage';
  return {
    code: s.code.trim().toUpperCase(),
    ...(s.description.trim() ? { description: s.description.trim() } : {}),
    discountType: s.discountType,
    discountValue: Number(s.discountValue),
    currency: s.currency,
    minimumOrderAmount: num(s.minimumOrderAmount) ?? 0,
    maximumDiscountAmount: percentage ? num(s.maximumDiscountAmount) : null,
    usageLimit: num(s.usageLimit),
    perUserLimit: Number(s.perUserLimit),
    startDate: fromLocalInput(s.startDate),
    expiryDate: fromLocalInput(s.expiryDate),
    applicability: s.applicability,
    applicableCourses: s.applicability === 'selected_courses' ? s.applicableCourses : [],
    isActive: s.isActive,
  };
}

const sameMinute = (a: string | null, b: string | null) => toLocalInput(a) === toLocalInput(b);
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Only fields that differ from the stored coupon; locked fields are never sent. */
function toUpdateInput(s: FormState, c: Coupon, locks: { code: boolean; discount: boolean }): UpdateCouponInput {
  const next = toCreateInput(s);
  const out: UpdateCouponInput = {};
  if (!locks.code && next.code !== c.code) out.code = next.code;
  if ((next.description ?? '') !== c.description) out.description = next.description ?? '';
  if (!locks.discount) {
    if (next.discountType !== c.discountType) out.discountType = next.discountType;
    if (next.discountValue !== c.discountValue) out.discountValue = next.discountValue;
    if (next.currency !== c.currency) out.currency = next.currency;
  }
  if (next.maximumDiscountAmount !== c.maximumDiscountAmount) out.maximumDiscountAmount = next.maximumDiscountAmount;
  if (next.minimumOrderAmount !== c.minimumOrderAmount) out.minimumOrderAmount = next.minimumOrderAmount;
  if (next.usageLimit !== c.usageLimit) out.usageLimit = next.usageLimit;
  if (next.perUserLimit !== c.perUserLimit) out.perUserLimit = next.perUserLimit;
  if (!sameMinute(next.startDate ?? null, c.startDate)) out.startDate = next.startDate;
  if (!sameMinute(next.expiryDate ?? null, c.expiryDate)) out.expiryDate = next.expiryDate;
  if (next.applicability !== c.applicability) out.applicability = next.applicability;
  if (!sameSet(next.applicableCourses ?? [], c.applicableCourses)) out.applicableCourses = next.applicableCourses;
  if (next.isActive !== c.isActive) out.isActive = next.isActive;
  return out;
}

function CoursePicker({ value, onChange, error }: { value: string[]; onChange: (ids: string[]) => void; error?: string }) {
  const { query, courses } = useCourseCatalog();
  const [search, setSearch] = useState('');
  const titleOf = useMemo(() => new Map(courses.map((c) => [c.id, c.title])), [courses]);
  const shown = courses.filter((c) => c.title.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div>
      {value.length ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary">
              <span className="truncate">{titleOf.get(id) ?? `Course ${id.slice(-6)}`}</span>
              <button type="button" onClick={() => toggle(id)} className="rounded p-0.5 hover:bg-primary/15" aria-label={`Remove ${titleOf.get(id) ?? 'course'}`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className={cn('rounded-lg border', error ? 'border-danger' : 'border-field-border')}>
        <div className="relative border-b border-line">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses"
            aria-label="Search courses"
            className="h-9 w-full rounded-t-lg bg-transparent pl-8 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
        <ul className="max-h-48 overflow-y-auto py-1" aria-label="Courses">
          {query.isPending ? (
            <li className="px-3 py-2 text-xs text-ink-subtle">Loading courses…</li>
          ) : query.isError ? (
            <li className="px-3 py-2 text-xs text-danger">{normalizeApiError(query.error).message}</li>
          ) : !shown.length ? (
            <li className="px-3 py-2 text-xs text-ink-subtle">No courses match.</li>
          ) : (
            shown.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-surface-2">
                  <input type="checkbox" checked={value.includes(c.id)} onChange={() => toggle(c.id)} className="size-4 rounded border-field-border accent-primary" />
                  <span className="min-w-0 flex-1 truncate text-ink">{c.title}</span>
                  <span className="shrink-0 text-[11px] text-ink-subtle">
                    {c.pricing.type === 'free' ? 'Free' : formatMajor(c.pricing.salePrice ?? c.pricing.regularPrice ?? 0, c.pricing.currency ?? 'INR')}
                  </span>
                </label>
              </li>
            ))
          )}
        </ul>
      </div>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

export function CouponFormDialog({ coupon, onClose, onSaved }: { coupon?: Coupon; onClose: () => void; onSaved?: (c: Coupon) => void }) {
  const toast = useToast();
  const create = useCreateCoupon();
  const update = useUpdateCoupon();
  const [s, setS] = useState<FormState>(() => initialState(coupon));
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setS((prev) => ({ ...prev, [key]: value }));
    setServerErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const editing = Boolean(coupon);
  const locks = { code: Boolean(coupon && (coupon.usedCount > 0 || coupon.reservedCount > 0)), discount: Boolean(coupon && coupon.usedCount > 0) };
  const errors = { ...validate(s, coupon), ...Object.fromEntries(Object.entries(serverErrors).filter(([, v]) => v)) };
  const shownErrors = touched ? errors : {};
  const changes = coupon ? toUpdateInput(s, coupon, locks) : null;
  const unchanged = Boolean(changes && Object.keys(changes).length === 0);
  const pending = create.isPending || update.isPending;

  function fail(e: unknown) {
    const err = normalizeApiError(e);
    const fieldErrors = Object.fromEntries(err.fieldErrors.map((f) => [f.path.split('.')[0], f.message]));
    if (err.code === 'COUPON_DUPLICATE' || err.code === 'COUPON_IMMUTABLE_CODE') fieldErrors.code = err.message;
    if (err.code === 'INVALID_COURSES') fieldErrors.applicableCourses = err.message;
    setServerErrors(fieldErrors);
    toast.error(editing ? 'Could not save coupon' : 'Could not create coupon', err.message);
  }

  function submit() {
    setTouched(true);
    if (Object.keys(validate(s, coupon)).length) return;
    if (coupon) {
      if (!changes || unchanged) return;
      update.mutate(
        { id: coupon.id, input: changes },
        {
          onSuccess: (c) => {
            toast.success('Coupon updated', `${c.code} · ${discountLabel(c)}`);
            onSaved?.(c);
            onClose();
          },
          onError: fail,
        }
      );
      return;
    }
    create.mutate(toCreateInput(s), {
      onSuccess: (c) => {
        toast.success('Coupon created', `${c.code} · ${discountLabel(c)}`);
        onSaved?.(c);
        onClose();
      },
      onError: fail,
    });
  }

  const percentage = s.discountType === 'percentage';
  const err = (k: keyof FormState) => shownErrors[k] || undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      busy={pending}
      size="lg"
      title={editing ? `Edit ${coupon?.code}` : 'New coupon'}
      description={editing ? 'Changes apply to future checkouts. Past orders keep the discount they were given.' : 'Create a discount code learners can apply at checkout.'}
      footer={
        <>
          {editing && unchanged ? <span className="mr-auto text-xs text-ink-subtle">No changes yet</span> : null}
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending} disabled={editing && unchanged}>
            {editing ? 'Save changes' : 'Create coupon'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {locks.discount || locks.code ? (
          <p className="flex gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            <span>
              {locks.discount
                ? `This coupon has been redeemed ${coupon?.usedCount} time${coupon?.usedCount === 1 ? '' : 's'}, so its code, discount type, value and currency are locked to keep past invoices accurate. Limits, dates, courses and status can still change.`
                : 'An unpaid order is holding this coupon, so its code is locked. The discount can still change until it is redeemed.'}
            </span>
          </p>
        ) : null}

        <section>
          <SectionTitle title="Code" description="Learners type this at checkout. It is saved in capitals." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cp-code" label="Coupon code" required error={err('code')} hint={locks.code ? 'Locked after use' : '3–40 characters, no spaces'}>
              <Input
                id="cp-code"
                value={s.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                disabled={locks.code}
                maxLength={40}
                placeholder="WELCOME20"
                className="font-mono uppercase tracking-wide"
                aria-invalid={Boolean(err('code'))}
                aria-describedby="cp-code-msg"
                autoFocus={!editing}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field id="cp-desc" label="Description" hint="Optional · shown to admins only" error={err('description')}>
                <Textarea id="cp-desc" rows={2} value={s.description} onChange={(e) => set('description', e.target.value)} maxLength={520} aria-describedby="cp-desc-msg" />
              </Field>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle title="Discount" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="cp-type" label="Type" required hint={locks.discount ? 'Locked after use' : undefined}>
              <Select id="cp-type" value={s.discountType} onChange={(e) => set('discountType', e.target.value as CouponDiscountType)} disabled={locks.discount} aria-describedby="cp-type-msg">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </Select>
            </Field>
            <Field id="cp-value" label={percentage ? 'Percent off' : 'Amount off'} required error={err('discountValue')} hint={locks.discount ? 'Locked after use' : percentage ? '1 to 100' : undefined}>
              <div className="relative">
                <Input
                  id="cp-value"
                  inputMode="decimal"
                  value={s.discountValue}
                  onChange={(e) => set('discountValue', e.target.value)}
                  disabled={locks.discount}
                  placeholder={percentage ? '20' : '500'}
                  className="pr-10"
                  aria-invalid={Boolean(err('discountValue'))}
                  aria-describedby="cp-value-msg"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-subtle">{percentage ? '%' : s.currency}</span>
              </div>
            </Field>
            <Field id="cp-currency" label="Currency" hint={locks.discount ? 'Locked after use' : 'Currency of the amounts below'}>
              <Select id="cp-currency" value={s.currency} onChange={(e) => set('currency', e.target.value)} disabled={locks.discount} aria-describedby="cp-currency-msg">
                {(CURRENCIES as readonly string[]).includes(s.currency) ? null : <option value={s.currency}>{s.currency}</option>}
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            {percentage ? (
              <Field id="cp-cap" label="Maximum discount" hint="Optional · leave empty for no cap" error={err('maximumDiscountAmount')}>
                <Input id="cp-cap" inputMode="decimal" value={s.maximumDiscountAmount} onChange={(e) => set('maximumDiscountAmount', e.target.value)} placeholder="No cap" aria-invalid={Boolean(err('maximumDiscountAmount'))} aria-describedby="cp-cap-msg" />
              </Field>
            ) : null}
            <Field id="cp-min" label="Minimum order" hint="Optional · cart subtotal before discount" error={err('minimumOrderAmount')}>
              <Input id="cp-min" inputMode="decimal" value={s.minimumOrderAmount} onChange={(e) => set('minimumOrderAmount', e.target.value)} placeholder="0" aria-invalid={Boolean(err('minimumOrderAmount'))} aria-describedby="cp-min-msg" />
            </Field>
          </div>
        </section>

        <section>
          <SectionTitle title="Applies to" />
          <div className="mb-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Applies to">
            {(
              [
                ['all_courses', 'All courses', 'Any course in the cart'],
                ['selected_courses', 'Selected courses', 'Only the courses you pick'],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition',
                  s.applicability === value ? 'border-primary/40 bg-primary/5' : 'border-line hover:border-field-border-hover'
                )}
              >
                <input type="radio" name="cp-applicability" value={value} checked={s.applicability === value} onChange={() => set('applicability', value)} className="mt-0.5 accent-primary" />
                <span>
                  <span className="block text-sm font-medium text-ink">{label}</span>
                  <span className="block text-xs text-ink-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {s.applicability === 'selected_courses' ? <CoursePicker value={s.applicableCourses} onChange={(ids) => set('applicableCourses', ids)} error={err('applicableCourses')} /> : null}
        </section>

        <section>
          <SectionTitle title="Limits and validity" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="cp-limit" label="Total redemptions" hint={coupon ? `Optional · ${coupon.usedCount} redeemed so far` : 'Optional · leave empty for unlimited'} error={err('usageLimit')}>
              <Input id="cp-limit" inputMode="numeric" value={s.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} placeholder="Unlimited" aria-invalid={Boolean(err('usageLimit'))} aria-describedby="cp-limit-msg" />
            </Field>
            <Field id="cp-per-user" label="Uses per learner" required error={err('perUserLimit')}>
              <Input id="cp-per-user" inputMode="numeric" value={s.perUserLimit} onChange={(e) => set('perUserLimit', e.target.value)} aria-invalid={Boolean(err('perUserLimit'))} aria-describedby="cp-per-user-msg" />
            </Field>
            <Field id="cp-start" label="Starts" hint="Optional · usable immediately when empty" error={err('startDate')}>
              <Input id="cp-start" type="datetime-local" value={s.startDate} onChange={(e) => set('startDate', e.target.value)} aria-describedby="cp-start-msg" />
            </Field>
            <Field id="cp-end" label="Expires" hint="Optional · never expires when empty" error={err('expiryDate')}>
              <Input id="cp-end" type="datetime-local" value={s.expiryDate} min={s.startDate || undefined} onChange={(e) => set('expiryDate', e.target.value)} aria-invalid={Boolean(err('expiryDate'))} aria-describedby="cp-end-msg" />
            </Field>
          </div>
        </section>

        <Toggle id="cp-active" label="Active" description={s.isActive ? 'Learners can apply this coupon within its dates and limits.' : 'Paused: the coupon cannot be applied until it is turned back on.'} checked={s.isActive} onChange={(v) => set('isActive', v)} />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
