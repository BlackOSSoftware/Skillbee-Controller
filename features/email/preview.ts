import type { TemplateVariable } from '@/types/email';

/**
 * Development-only sample values for live template preview.
 * Mirrors the backend renderTemplate() escaping so the preview matches
 * what recipients would see. Never used for real sends.
 */
export const SAMPLE_VARIABLES: Record<TemplateVariable, string> = {
  studentName: 'Asha Verma',
  email: 'asha.verma@example.com',
  courseName: 'Advanced React & TypeScript',
  orderId: 'SKB-ORD-1042',
  amount: '4,999',
  currency: 'INR',
  certificateNumber: 'SKB-CERT-2026-0187',
  resetLink: 'https://skillbee.com/reset-password?token=sample',
  message: 'This is a sample message body used for preview purposes only.',
  title: 'Sample notification title',
  score: '18/20',
  assignmentTitle: 'React Hooks Deep Dive',
  quizTitle: 'GAMP 5 Fundamentals',
  ticketNumber: 'TKT-2026-0042',
  enquiryNumber: 'ENQ-2026-0117',
  previousStatus: 'Open',
  newStatus: 'In Progress',
  applicationNumber: 'APP-2026-0098',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Substitute {{variables}} with sample values, HTML-escaping them exactly
 * like the backend renderTemplate(). Unknown placeholders render as empty.
 */
export function renderPreviewHtml(template: string): string {
  return template.replace(PLACEHOLDER_RE, (_m, key: string) => {
    const sample = SAMPLE_VARIABLES[key as TemplateVariable];
    return sample != null ? escapeHtml(sample) : '';
  });
}

/** Subject line preview — placeholders replaced, no HTML escaping needed. */
export function renderPreviewSubject(subject: string): string {
  return subject.replace(PLACEHOLDER_RE, (_m, key: string) => SAMPLE_VARIABLES[key as TemplateVariable] ?? '');
}

/** Plain-text preview with sample values. */
export function renderPreviewText(text: string): string {
  return text.replace(PLACEHOLDER_RE, (_m, key: string) => SAMPLE_VARIABLES[key as TemplateVariable] ?? '');
}
