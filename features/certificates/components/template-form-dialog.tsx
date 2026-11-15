'use client';

import { Info } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import {
  FIELD_TOGGLES,
  TEMPLATE_IMAGE_FIELDS,
  type CertificateTemplate,
  type ConfigRecord,
  type CreateTemplateInput,
  type FieldToggle,
  type MediaRef,
  type MediaRefInput,
  type TemplateImageField,
  type UpdateTemplateInput,
} from '@/types/certificates';
import { Toggle } from '@/features/courses/components/form-controls';
import { FIELD_TOGGLE_LABEL, layoutOf, toggleOn } from '../display';
import { useCreateTemplate, useUpdateTemplate } from '../hooks';
import { CertificatePreview, SAMPLE_VALUES } from './certificate-preview';
import { isImageSet, TemplateImageField as ImageField } from './template-image-field';

type Images = Record<TemplateImageField, MediaRef | null>;

const IMAGE_COPY: Record<TemplateImageField, { label: string; hint: string; aspect: 'wide' | 'square' | 'signature' }> = {
  backgroundImage: { label: 'Background', hint: 'Stretched to the full page · landscape image recommended', aspect: 'wide' },
  organizationLogo: { label: 'Organization logo', hint: 'Printed centred at the top · PNG with transparency works best', aspect: 'square' },
  signatureImage: { label: 'Signature', hint: 'Printed above the signatory name · transparent PNG', aspect: 'signature' },
};

const refKey = (ref: MediaRef | null | undefined) => (isImageSet(ref) ? (ref?.mediaAssetId ?? ref?.storageKey ?? ref?.url ?? '') : '');

/** New uploads reference their asset; a removed image is cleared with an all-null reference. */
function toRefInput(ref: MediaRef | null): MediaRefInput {
  return ref?.mediaAssetId ? { mediaAssetId: ref.mediaAssetId, originalFileName: ref.originalFileName ?? null } : { mediaAssetId: null, url: null, storageKey: null, originalFileName: null };
}

interface Values {
  name: string;
  templateCode: string;
  description: string;
  certificateTitle: string;
  certificateDescription: string;
  organizationName: string;
  authorizedSignatoryName: string;
  authorizedSignatoryDesignation: string;
  fields: Record<FieldToggle, boolean>;
  orientation: 'landscape' | 'portrait';
  pageWidth: string;
  pageHeight: string;
  margin: string;
  status: 'draft' | 'active';
  isDefault: boolean;
  images: Images;
}

type Errors = Partial<Record<keyof Values, string>>;

const PAGE_DEFAULTS = { landscape: { w: 842, h: 595 }, portrait: { w: 595, h: 842 } } as const;

function initial(t?: CertificateTemplate): Values {
  const layout = layoutOf(t?.layoutConfiguration);
  return {
    name: t?.name ?? '',
    templateCode: t?.templateCode ?? '',
    description: t?.description ?? '',
    certificateTitle: t?.certificateTitle ?? 'Certificate of Completion',
    certificateDescription: t?.certificateDescription ?? 'This certifies that the learner has successfully completed the course.',
    organizationName: t?.organizationName ?? 'SkillBee',
    authorizedSignatoryName: t?.authorizedSignatoryName ?? '',
    authorizedSignatoryDesignation: t?.authorizedSignatoryDesignation ?? '',
    fields: Object.fromEntries(FIELD_TOGGLES.map((k) => [k, toggleOn(t?.fieldConfiguration, k)])) as Record<FieldToggle, boolean>,
    orientation: layout.orientation,
    pageWidth: String(layout.pageWidth),
    pageHeight: String(layout.pageHeight),
    margin: String(layout.margin),
    status: 'draft',
    isDefault: false,
    images: Object.fromEntries(TEMPLATE_IMAGE_FIELDS.map((k) => [k, isImageSet(t?.[k]) ? (t?.[k] ?? null) : null])) as Images,
  };
}

function validate(v: Values): Errors {
  const e: Errors = {};
  const len = (s: string, max: number) => s.trim().length > max;
  if (v.name.trim().length < 2) e.name = 'Enter at least 2 characters.';
  else if (len(v.name, 200)) e.name = '200 characters or less.';
  if (v.templateCode.trim() && (v.templateCode.trim().length < 2 || len(v.templateCode, 80))) e.templateCode = 'Between 2 and 80 characters.';
  if (len(v.description, 2000)) e.description = '2,000 characters or less.';
  if (len(v.certificateTitle, 200)) e.certificateTitle = '200 characters or less.';
  if (len(v.certificateDescription, 2000)) e.certificateDescription = '2,000 characters or less.';
  if (len(v.organizationName, 200)) e.organizationName = '200 characters or less.';
  if (len(v.authorizedSignatoryName, 200)) e.authorizedSignatoryName = '200 characters or less.';
  if (len(v.authorizedSignatoryDesignation, 200)) e.authorizedSignatoryDesignation = '200 characters or less.';
  const inRange = (s: string, min: number, max: number) => Number.isFinite(Number(s)) && Number(s) >= min && Number(s) <= max;
  if (!inRange(v.pageWidth, 200, 2400)) e.pageWidth = '200–2400 pt.';
  if (!inRange(v.pageHeight, 200, 2400)) e.pageHeight = '200–2400 pt.';
  if (!inRange(v.margin, 10, 200)) e.margin = '10–200 pt.';
  return e;
}

/** Existing JSON keys the console does not manage are kept as they are. */
function buildConfigs(v: Values, t?: CertificateTemplate): { fieldConfiguration: ConfigRecord; layoutConfiguration: ConfigRecord } {
  return {
    fieldConfiguration: { ...(t?.fieldConfiguration ?? {}), ...v.fields },
    layoutConfiguration: { ...(t?.layoutConfiguration ?? {}), orientation: v.orientation, pageWidth: Number(v.pageWidth), pageHeight: Number(v.pageHeight), margin: Number(v.margin) },
  };
}

interface TemplateFormDialogProps {
  template?: CertificateTemplate;
  onClose: () => void;
  onSaved?: (template: CertificateTemplate) => void;
}

export function TemplateFormDialog({ template, onClose, onSaved }: TemplateFormDialogProps) {
  const toast = useToast();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const inFlight = useRef(false);
  const [base] = useState(() => initial(template));
  const [v, setValues] = useState<Values>(base);
  const [errors, setErrors] = useState<Errors>({});
  const [uploading, setUploading] = useState(0);
  const pending = create.isPending || update.isPending;
  const configs = buildConfigs(v, template);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function changeOrientation(next: 'landscape' | 'portrait') {
    const d = PAGE_DEFAULTS[next];
    setValues((s) => ({ ...s, orientation: next, pageWidth: String(d.w), pageHeight: String(d.h) }));
  }

  /** PATCH needs at least one field, so edits send only what changed. */
  function diff(): UpdateTemplateInput {
    const out: UpdateTemplateInput = {};
    const text = ['name', 'description', 'certificateTitle', 'certificateDescription', 'organizationName', 'authorizedSignatoryName', 'authorizedSignatoryDesignation'] as const;
    for (const key of text) if (v[key].trim() !== base[key].trim()) out[key] = v[key].trim();
    if (v.templateCode.trim() && v.templateCode.trim() !== base.templateCode) out.templateCode = v.templateCode.trim();
    if (FIELD_TOGGLES.some((k) => v.fields[k] !== base.fields[k])) out.fieldConfiguration = configs.fieldConfiguration;
    if (v.orientation !== base.orientation || v.pageWidth !== base.pageWidth || v.pageHeight !== base.pageHeight || v.margin !== base.margin) out.layoutConfiguration = configs.layoutConfiguration;
    for (const key of TEMPLATE_IMAGE_FIELDS) if (refKey(v.images[key]) !== refKey(base.images[key])) out[key] = toRefInput(v.images[key]);
    return out;
  }

  const changes = template ? diff() : null;
  const dirty = !template || Object.keys(changes ?? {}).length > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length || uploading) return;
    inFlight.current = true;
    const handlers = {
      onSuccess: (saved: CertificateTemplate) => {
        toast.success(template ? 'Template updated' : 'Template created', template ? 'Certificates already issued keep their original design.' : saved.name);
        if (onSaved) onSaved(saved);
        else onClose();
      },
      onError: (error: unknown) => {
        const { code, message } = normalizeApiError(error);
        if (code === 'TEMPLATE_CODE_EXISTS') setErrors((e) => ({ ...e, templateCode: 'This code is already used by another template.' }));
        toast.error('Could not save template', message);
      },
      onSettled: () => {
        inFlight.current = false;
      },
    };
    if (template) {
      if (!changes || !Object.keys(changes).length) {
        inFlight.current = false;
        return;
      }
      update.mutate({ id: template.id, input: changes }, handlers);
    } else {
      const input: CreateTemplateInput = {
        name: v.name.trim(),
        ...(v.templateCode.trim() ? { templateCode: v.templateCode.trim() } : {}),
        description: v.description.trim(),
        certificateTitle: v.certificateTitle.trim(),
        certificateDescription: v.certificateDescription.trim(),
        organizationName: v.organizationName.trim(),
        authorizedSignatoryName: v.authorizedSignatoryName.trim(),
        authorizedSignatoryDesignation: v.authorizedSignatoryDesignation.trim(),
        ...configs,
        ...Object.fromEntries(TEMPLATE_IMAGE_FIELDS.filter((k) => v.images[k]?.mediaAssetId).map((k) => [k, toRefInput(v.images[k])])),
        status: v.status,
        ...(v.isDefault ? { isDefault: true } : {}),
      };
      create.mutate(input, handlers);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={pending}
      size="full"
      title={template ? `Edit “${template.name}”` : 'New certificate template'}
      description={template ? 'Changes apply to certificates issued from now on.' : 'Design the certificate learners receive when they complete a course.'}
      footer={
        <>
          {template && !dirty ? <p className="mr-auto self-center text-xs text-ink-subtle">No changes yet.</p> : null}
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="template-form" loading={pending} disabled={!dirty || uploading > 0}>
            {template ? 'Save changes' : 'Create template'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <form id="template-form" onSubmit={submit} noValidate className="min-w-0 space-y-6">
          {template ? (
            <p className="flex gap-2 rounded-lg border border-info/25 bg-info/[0.06] px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
              Every issued certificate stores a snapshot of its template. Editing this template never changes certificates that were already issued, including when their PDF is regenerated.
            </p>
          ) : null}

          <section className="space-y-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Template</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="tf-name" label="Name" required error={errors.name}>
                <Input id="tf-name" value={v.name} onChange={(e) => set('name', e.target.value)} maxLength={200} aria-invalid={Boolean(errors.name)} aria-describedby="tf-name-msg" />
              </Field>
              <Field id="tf-code" label="Template code" error={errors.templateCode} hint={template ? 'Changing it does not affect issued certificates' : 'Optional · generated from the name'}>
                <Input id="tf-code" value={v.templateCode} onChange={(e) => set('templateCode', e.target.value)} maxLength={80} placeholder="e.g. completion-classic" aria-invalid={Boolean(errors.templateCode)} aria-describedby="tf-code-msg" />
              </Field>
            </div>
            <Field id="tf-description" label="Internal description" error={errors.description} hint="Visible to admins only">
              <Textarea id="tf-description" rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} aria-describedby="tf-description-msg" />
            </Field>
            {!template ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="tf-status" label="Initial status">
                  <Select id="tf-status" value={v.status} onChange={(e) => set('status', e.target.value as Values['status'])}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                  </Select>
                </Field>
                <div className="sm:pt-6">
                  <Toggle id="tf-default" label="Make default template" description="Replaces the current default and activates this template" checked={v.isDefault} onChange={(c) => set('isDefault', c)} />
                </div>
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Certificate text</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="tf-title" label="Certificate title" error={errors.certificateTitle}>
                <Input id="tf-title" value={v.certificateTitle} onChange={(e) => set('certificateTitle', e.target.value)} maxLength={200} aria-describedby="tf-title-msg" />
              </Field>
              <Field id="tf-org" label="Organization name" error={errors.organizationName}>
                <Input id="tf-org" value={v.organizationName} onChange={(e) => set('organizationName', e.target.value)} maxLength={200} aria-describedby="tf-org-msg" />
              </Field>
            </div>
            <Field id="tf-body" label="Certificate statement" error={errors.certificateDescription} hint="Printed under the title (the PDF shows up to 280 characters)">
              <Textarea id="tf-body" rows={3} value={v.certificateDescription} onChange={(e) => set('certificateDescription', e.target.value)} aria-describedby="tf-body-msg" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="tf-signatory" label="Authorized signatory" error={errors.authorizedSignatoryName} hint="Shown only when a name is set">
                <Input id="tf-signatory" value={v.authorizedSignatoryName} onChange={(e) => set('authorizedSignatoryName', e.target.value)} maxLength={200} aria-describedby="tf-signatory-msg" />
              </Field>
              <Field id="tf-designation" label="Signatory designation" error={errors.authorizedSignatoryDesignation}>
                <Input id="tf-designation" value={v.authorizedSignatoryDesignation} onChange={(e) => set('authorizedSignatoryDesignation', e.target.value)} maxLength={200} aria-describedby="tf-designation-msg" />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Printed fields</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELD_TOGGLES.map((k) => (
                <div key={k} className="rounded-lg border border-line px-3 py-2">
                  <Toggle id={`tf-${k}`} label={FIELD_TOGGLE_LABEL[k]} checked={v.fields[k]} onChange={(c) => set('fields', { ...v.fields, [k]: c })} />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Page</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field id="tf-orientation" label="Orientation">
                <Select id="tf-orientation" value={v.orientation} onChange={(e) => changeOrientation(e.target.value as Values['orientation'])}>
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </Select>
              </Field>
              <Field id="tf-width" label="Width (pt)" error={errors.pageWidth}>
                <Input id="tf-width" type="number" min={200} max={2400} value={v.pageWidth} onChange={(e) => set('pageWidth', e.target.value)} aria-describedby="tf-width-msg" />
              </Field>
              <Field id="tf-height" label="Height (pt)" error={errors.pageHeight}>
                <Input id="tf-height" type="number" min={200} max={2400} value={v.pageHeight} onChange={(e) => set('pageHeight', e.target.value)} aria-describedby="tf-height-msg" />
              </Field>
              <Field id="tf-margin" label="Margin (pt)" error={errors.margin}>
                <Input id="tf-margin" type="number" min={10} max={200} value={v.margin} onChange={(e) => set('margin', e.target.value)} aria-describedby="tf-margin-msg" />
              </Field>
            </div>
            <p className="text-[11px] text-ink-subtle">A4 is 842 × 595 pt in landscape. Switching orientation resets the page size.</p>
          </section>

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Images</h3>
            {TEMPLATE_IMAGE_FIELDS.map((key) => (
              <ImageField
                key={key}
                id={`tf-${key}`}
                label={IMAGE_COPY[key].label}
                hint={IMAGE_COPY[key].hint}
                aspect={IMAGE_COPY[key].aspect}
                value={v.images[key]}
                onChange={(ref) => setValues((s) => ({ ...s, images: { ...s.images, [key]: ref } }))}
                onBusyChange={(busy) => setUploading((n) => Math.max(0, n + (busy ? 1 : -1)))}
              />
            ))}
            <p className="text-[11px] text-ink-subtle">JPG, PNG, WebP or AVIF up to 10 MB. Images are stored in the media library and embedded when each certificate PDF is generated.</p>
          </section>
        </form>

        <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-xl border border-line bg-surface-2/60 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">Live preview</h3>
              <span className="text-[11px] text-ink-subtle">Sample learner details</span>
            </div>
            <CertificatePreview
              content={{
                organizationName: v.organizationName,
                certificateTitle: v.certificateTitle,
                certificateDescription: v.certificateDescription,
                authorizedSignatoryName: v.authorizedSignatoryName,
                authorizedSignatoryDesignation: v.authorizedSignatoryDesignation,
                ...configs,
                ...v.images,
              }}
              values={SAMPLE_VALUES}
              className={v.orientation === 'portrait' ? 'mx-auto max-w-sm' : undefined}
            />
            <p className="mt-3 text-[11px] leading-relaxed text-ink-subtle">Mirrors the server’s PDF layout. The real verification QR code is added when the PDF is generated.</p>
          </div>
        </aside>
      </div>
    </Dialog>
  );
}
