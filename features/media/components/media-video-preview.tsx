'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';
import { mediaService } from '@/services/media.service';
import type { MediaAsset } from '@/types/media';
import { SecureVideoPlayer } from './secure-video-player';

interface MediaVideoPreviewProps {
  asset: MediaAsset;
}

/**
 * Resolves a playable URL for ANY video asset and renders the shared player.
 * - Lesson videos (source 'lesson_video'): lesson playback token flow.
 * - MediaAsset videos (local): /learning/media/:id/playback view-token flow.
 * - Cloudinary videos: secureUrl directly.
 * No download option anywhere; tokens are never rendered in the UI.
 */
export function MediaVideoPreview({ asset }: MediaVideoPreviewProps) {
  const isLesson = asset.source === 'lesson_video' && Boolean(asset.playback?.lessonId);
  const lessonId = asset.playback?.lessonId ?? null;
  const [nonce, setNonce] = useState(0);

  const playback = useQuery({
    queryKey: ['media', 'video-preview', asset.id, isLesson ? lessonId : 'asset'],
    queryFn: async () => {
      if (isLesson && lessonId) return { kind: 'lesson' as const, data: await mediaService.getLessonPlayback(lessonId) };
      return { kind: 'media' as const, data: await mediaService.getMediaPlayback(asset.id) };
    },
    staleTime: 60_000,
    retry: 1,
    enabled: asset.mediaType === 'video' && (isLesson || asset.storageProvider === 'local'),
  });

  const src = useMemo(() => {
    if (asset.mediaType !== 'video') return null;
    // Cloudinary (or any provider with a direct secure URL) plays directly.
    if (!isLesson && asset.storageProvider !== 'local' && asset.secureUrl) return asset.secureUrl;
    const result = playback.data;
    if (!result) return null;
    if (result.kind === 'lesson') {
      const d = result.data;
      if (d.type === 'external') return d.externalUrl;
      const base = env.apiBaseUrl.replace(/\/$/, '');
      return `${base}/learning/lessons/${lessonId}/video/stream?token=${encodeURIComponent(d.playbackToken)}`;
    }
    const d = result.data;
    if (d.type !== 'video') return null;
    const base = env.apiBaseUrl.replace(/\/$/, '');
    return `${base}/learning/media/${asset.id}/stream?token=${encodeURIComponent(d.viewToken)}`;
  }, [asset, isLesson, lessonId, playback.data]);

  const retry = useCallback(() => {
    void playback.refetch();
    setNonce((n) => n + 1);
  }, [playback]);

  if (asset.mediaType !== 'video') return null;

  // Direct URL (Cloudinary) — no token needed.
  if (!isLesson && asset.storageProvider !== 'local' && asset.secureUrl) {
    return (
      <div className="aspect-video w-full bg-black">
        <SecureVideoPlayer key={asset.secureUrl} src={asset.secureUrl} title={asset.originalFileName} onRetry={retry} />
      </div>
    );
  }

  if (playback.isPending) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-black text-sm text-white/70">
        <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden />
        Preparing secure playback…
      </div>
    );
  }

  if (playback.isError || !src) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black px-6 text-center">
        <TriangleAlert className="size-6 text-amber-400" aria-hidden />
        <p className="text-sm text-white/70">Playback is not available for this video. It may still be processing or access may be restricted.</p>
        <Button size="sm" variant="secondary" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full bg-black">
      <SecureVideoPlayer key={`${src}:${nonce}`} src={src} title={asset.originalFileName} onRetry={retry} />
    </div>
  );
}
