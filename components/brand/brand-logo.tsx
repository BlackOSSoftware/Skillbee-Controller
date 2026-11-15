import Image from 'next/image';
import { cn } from '@/lib/cn';

const WORDMARK_RATIO = 640 / 231;

export function BrandMark({ size = 36, className, priority }: { size?: number; className?: string; priority?: boolean }) {
  return <Image src="/brand/skillbee-mark.webp" alt="" width={size} height={size} priority={priority} className={cn('shrink-0 select-none', className)} draggable={false} />;
}

/** Full SkillBee wordmark; the dark variant swaps the dark tagline ink for a light one. */
export function BrandWordmark({ height = 48, className, priority }: { height?: number; className?: string; priority?: boolean }) {
  const width = Math.round(height * WORDMARK_RATIO);
  return (
    <span className={cn('inline-block shrink-0 select-none', className)} style={{ width, height }}>
      <Image src="/brand/skillbee-logo.webp" alt="SkillBee" width={width} height={height} priority={priority} className="dark:hidden" draggable={false} />
      <Image src="/brand/skillbee-logo-dark.webp" alt="SkillBee" width={width} height={height} priority={priority} className="hidden dark:block" draggable={false} />
    </span>
  );
}
