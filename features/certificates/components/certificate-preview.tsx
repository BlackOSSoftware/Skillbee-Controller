import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import type { ConfigRecord, MediaRef } from '@/types/certificates';
import { layoutOf, toggleOn } from '../display';

export interface PreviewContent {
  organizationName?: string;
  certificateTitle?: string;
  certificateDescription?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryDesignation?: string;
  fieldConfiguration?: ConfigRecord | null;
  layoutConfiguration?: ConfigRecord | null;
  backgroundImage?: MediaRef | null;
  organizationLogo?: MediaRef | null;
  signatureImage?: MediaRef | null;
}

export interface PreviewValues {
  studentName: string;
  courseName: string;
  certificateNumber: string;
  completionDate: string;
  issueDate: string;
  verificationUrl: string;
}

/** Deterministic pseudo-QR pattern; the real code is generated into the PDF by the server. */
function QrMark() {
  const cells = Array.from({ length: 81 }, (_, i) => ((i * 7 + (i % 9) * 3) % 5 < 2 ? 1 : 0));
  return (
    <div className="grid size-full grid-cols-9 gap-[6%] rounded-[3%] bg-white p-[6%] ring-1 ring-black/10" aria-hidden>
      {cells.map((on, i) => (
        <span key={i} className={on ? 'bg-neutral-800' : 'bg-transparent'} />
      ))}
    </div>
  );
}

/**
 * Mirrors the server PDF layout (`certificatePdf.service`): same text, images, order, sizes,
 * alignment and field toggles, scaled to the page size. Images are drawn from their media-library
 * URLs; images that exist only in server storage cannot be previewed.
 */
export function CertificatePreview({ content, values, className }: { content: PreviewContent; values: PreviewValues; className?: string }) {
  const layout = layoutOf(content.layoutConfiguration);
  const fields = content.fieldConfiguration;
  const { pageWidth: W, pageHeight: H, margin: M } = layout;
  /** Points → percentage of the page width, as container-query units. */
  const pt = (size: number): CSSProperties => ({ fontSize: `${(size / W) * 100}cqw` });
  const x = (v: number) => `${(v / W) * 100}%`;
  const y = (v: number) => `${(v / H) * 100}%`;
  const metaY = H - M - 140;
  const showSignatory = toggleOn(fields, 'showSignatory') && Boolean(content.authorizedSignatoryName);
  const logoUrl = content.organizationLogo?.url;
  const LOGO_H = 44;

  return (
    <div className={cn('@container w-full', className)}>
      <div
        className="relative w-full overflow-hidden rounded-md bg-white text-center shadow-[0_1px_2px_rgb(0_0_0/0.06),0_12px_32px_-16px_rgb(0_0_0/0.35)] ring-1 ring-black/[0.06]"
        style={{ aspectRatio: `${W} / ${H}`, fontFamily: 'Helvetica, Arial, sans-serif' }}
        role="img"
        aria-label={`Certificate layout preview, ${layout.orientation}`}
      >
        {/* eslint-disable @next/next/no-img-element -- media-library CDN images drawn at PDF coordinates */}
        {content.backgroundImage?.url ? <img src={content.backgroundImage.url} alt="" className="absolute inset-0 size-full object-fill" aria-hidden /> : null}
        {logoUrl ? (
          <img src={logoUrl} alt="" className="absolute object-contain" style={{ left: x(W / 2 - 60), top: y(M), width: x(120), height: y(LOGO_H) }} aria-hidden />
        ) : null}
        <div className="absolute flex flex-col items-center" style={{ left: x(M), right: x(M), top: y(logoUrl ? M + LOGO_H + 8 : M) }}>
          <p className="w-full truncate leading-tight text-[#555555]" style={pt(10)}>
            {content.organizationName || 'SkillBee'}
          </p>
          <p className="mt-[3.2%] w-full leading-tight text-[#111111]" style={pt(28)}>
            {content.certificateTitle || 'Certificate of Completion'}
          </p>
          <p className="mt-[1.6%] line-clamp-3 w-full leading-snug text-[#333333]" style={pt(12)}>
            {content.certificateDescription || 'This certifies that the learner has successfully completed the course.'}
          </p>
          {toggleOn(fields, 'showStudentName') ? (
            <>
              <p className="mt-[2.4%] text-[#666666]" style={pt(11)}>
                Awarded to
              </p>
              <p className="mt-[0.6%] w-full truncate leading-tight text-black" style={pt(22)}>
                {values.studentName}
              </p>
            </>
          ) : null}
          {toggleOn(fields, 'showCourseName') ? (
            <>
              <p className="mt-[1.6%] text-[#666666]" style={pt(11)}>
                for successfully completing
              </p>
              <p className="mt-[0.6%] w-full truncate leading-tight text-[#111111]" style={pt(16)}>
                {values.courseName}
              </p>
            </>
          ) : null}
        </div>

        <div className="absolute text-left leading-[1.45] text-[#333333]" style={{ left: x(M), top: y(metaY), width: x(W - M * 2 - 160), ...pt(10) }}>
          {toggleOn(fields, 'showCertificateNumber') ? <p>Certificate No: {values.certificateNumber}</p> : null}
          {toggleOn(fields, 'showCompletionDate') ? <p>Completion: {values.completionDate}</p> : null}
          {toggleOn(fields, 'showIssueDate') ? <p>Issued: {values.issueDate}</p> : null}
          {toggleOn(fields, 'showVerificationUrl') ? (
            <p className="break-all text-[#555555]" style={pt(8)}>
              Verify: {values.verificationUrl}
            </p>
          ) : null}
        </div>

        {showSignatory && content.signatureImage?.url ? (
          <img
            src={content.signatureImage.url}
            alt=""
            className="absolute object-contain object-left-bottom"
            style={{ left: x(W - M - 220), top: y(metaY - 40), width: x(120), height: y(40) }}
            aria-hidden
          />
        ) : null}
        {/* eslint-enable @next/next/no-img-element */}
        {showSignatory ? (
          <div className="absolute text-left" style={{ left: x(W - M - 220), top: y(metaY + 10), width: x(200) }}>
            <p className="truncate text-[#111111]" style={pt(11)}>
              {content.authorizedSignatoryName}
            </p>
            {content.authorizedSignatoryDesignation ? (
              <p className="truncate text-[#555555]" style={pt(9)}>
                {content.authorizedSignatoryDesignation}
              </p>
            ) : null}
          </div>
        ) : null}

        {toggleOn(fields, 'showQrCode') ? (
          <div className="absolute" style={{ left: x(W - M - 90), top: y(H - M - 100), width: x(90), height: y(90) }}>
            <QrMark />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Clearly-labelled placeholder values for template previews. */
export const SAMPLE_VALUES: PreviewValues = {
  studentName: 'Learner Name',
  courseName: 'Course Title',
  certificateNumber: 'CERT-NUMBER',
  completionDate: 'YYYY-MM-DD',
  issueDate: 'YYYY-MM-DD',
  verificationUrl: 'https://…/certificates/verify/…',
};
