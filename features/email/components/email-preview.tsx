'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { renderPreviewHtml, renderPreviewSubject, renderPreviewText } from '../preview';

export type PreviewDevice = 'desktop' | 'mobile';

interface EmailPreviewFrameProps {
  subject: string;
  htmlBody: string;
  textBody?: string;
  device?: PreviewDevice;
  /** Show the Gmail-style subject/sender mock above the email. */
  showEnvelope?: boolean;
  className?: string;
}

/** Live email preview — substitutes sample variables and renders in a sandboxed iframe. */
export function EmailPreviewFrame({ subject, htmlBody, textBody, device = 'desktop', showEnvelope = true, className }: EmailPreviewFrameProps) {
  const [tab, setTab] = useState<'html' | 'text'>('html');
  const renderedSubject = useMemo(() => renderPreviewSubject(subject) || '(no subject)', [subject]);
  const srcDoc = useMemo(() => renderPreviewHtml(htmlBody), [htmlBody]);
  const renderedText = useMemo(() => renderPreviewText(textBody ?? ''), [textBody]);

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface-2/50', className)}>
      {showEnvelope ? (
        <div className="border-b border-line bg-surface px-3 py-2.5" aria-label="Email envelope preview">
          <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
            <span className="font-semibold text-ink">SkillBee</span>
            <span>to you</span>
            <span className="ml-auto">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-ink">{renderedSubject}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-1.5">
        <div className="flex gap-1" role="tablist" aria-label="Preview format">
          {(['html', 'text'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium', tab === t ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:text-ink')}
            >
              {t === 'html' ? 'HTML' : 'Plain text'}
            </button>
          ))}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-ink-subtle">{device === 'mobile' ? '375px' : 'Fluid'} · sample data</span>
      </div>

      <div className="flex-1 overflow-auto bg-surface-2/70 p-3">
        {tab === 'html' ? (
          <div className={cn('mx-auto transition-all', device === 'mobile' ? 'w-[375px] max-w-full' : 'w-full')}>
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={srcDoc}
              className="h-[480px] w-full rounded-lg border border-line bg-white"
            />
          </div>
        ) : (
          <pre className="mx-auto max-h-[480px] w-full overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-white p-4 font-mono text-xs text-ink">
            {renderedText || '(empty text body)'}
          </pre>
        )}
      </div>
    </div>
  );
}

/** Desktop/mobile toggle used by preview dialogs. */
export function PreviewDeviceToggle({ device, onChange }: { device: PreviewDevice; onChange: (d: PreviewDevice) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-line bg-surface-2/60 p-1" role="group" aria-label="Preview device">
      {(['desktop', 'mobile'] as const).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={device === d}
          onClick={() => onChange(d)}
          className={cn('rounded-md px-3 py-1 text-xs font-medium capitalize', device === d ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
