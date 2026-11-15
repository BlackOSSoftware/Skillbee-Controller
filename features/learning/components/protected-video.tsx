'use client';

import { ExternalLink, Hourglass, Lock, PlayCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { refreshSession } from '@/lib/api-client';
import { normalizeApiError } from '@/lib/api-error';
import { playbackService } from '@/services/learning.service';
import type { LearningLesson, PlaybackAuthorization } from '@/types/learning';
import { usePlaybackAuthorization, useRenewPlaybackToken } from '../hooks';
import { SecureVideoPlayer } from './secure-video-player';

/** `expiresIn` follows jsonwebtoken notation ("10m", "900s", "1h" or plain seconds). */
function durationMs(value: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i.exec(value.trim());
  if (!m) return 5 * 60_000;
  const n = Number(m[1]);
  const unit = (m[2] ?? 's').toLowerCase();
  return n * ({ ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 1000);
}

type Session = { kind: 'stream'; src: string; expiresAt: number } | { kind: 'external'; url: string };

/** Renew a little before expiry so a Range request never carries a dead token. */
const RENEW_MARGIN_MS = 15_000;

export function ProtectedVideo({ lesson }: { lesson: LearningLesson }) {
  const authorize = usePlaybackAuthorization();
  const renew = useRenewPlaybackToken();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const recovering = useRef(false);
  const lastRecovery = useRef(0);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<{ title: string; message: string; code?: number | null } | null>(null);
  const video = lesson.content?.video;
  const processing = video?.processingStatus && video.processingStatus !== 'ready' && video.source !== 'external';

  function apply(auth: PlaybackAuthorization) {
    if (auth.type === 'external') setSession({ kind: 'external', url: auth.externalUrl });
    else setSession({ kind: 'stream', src: playbackService.streamUrl(lesson.id, auth.playbackToken), expiresAt: Date.now() + durationMs(auth.expiresIn) });
  }

  function fail(err: unknown) {
    const { status, code, message } = normalizeApiError(err);
    if (code === 'VIDEO_NOT_READY') setError({ title: 'Video is still processing', message: 'Check back in a few minutes.', code: status });
    else if (status === 429) setError({ title: 'Too many requests right now', message: 'The server is limiting requests from this network. Wait a minute, then try again.', code: status });
    else if (status === 403) setError({ title: 'Playback not allowed', message, code: status });
    else setError({ title: 'Could not start playback', message, code: status });
  }

  function start() {
    setError(null);
    authorize.mutate(lesson.id, { onSuccess: apply, onError: fail });
  }

  /** Refresh the session cookie used by the stream, then renew the playback token and resume. */
  async function reauthorize() {
    if (recovering.current) return;
    recovering.current = true;
    setResumeAt(videoRef.current?.currentTime ?? null);
    try {
      await refreshSession();
      const auth = await renew.mutateAsync(lesson.id);
      apply(auth);
    } catch (err) {
      fail(err);
    } finally {
      recovering.current = false;
    }
  }

  if (!video) return <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-subtle">No video has been added to this lesson yet.</p>;

  if (session?.kind === 'external') {
    return (
      <a href={session.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/50 px-4 py-4 text-sm font-medium text-primary hover:border-primary/40">
        <span className="flex items-center gap-2">
          <PlayCircle className="size-5" aria-hidden />
          Watch on {video.provider === 'youtube' ? 'YouTube' : video.provider === 'vimeo' ? 'Vimeo' : 'the video host'}
        </span>
        <ExternalLink className="size-4" aria-hidden />
      </a>
    );
  }

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-lg border border-line bg-black">
        {session?.kind === 'stream' ? (
          <SecureVideoPlayer
            src={session.src}
            videoRef={videoRef}
            startAt={resumeAt}
            onResumed={() => setResumeAt(null)}
            onIntent={() => {
              if (Date.now() > session.expiresAt - RENEW_MARGIN_MS) void reauthorize();
            }}
            onPlaying={() => {
              lastRecovery.current = 0;
            }}
            onMediaError={() => {
              // Media errors hide the HTTP status; an expired token or session cookie is the usual cause.
              // One automatic recovery per failure; a second failure right after shows the error state.
              if (recovering.current) return;
              if (Date.now() - lastRecovery.current < 20_000) {
                const code = videoRef.current?.error?.code;
                setSession(null);
                setError(
                  code === 4
                    ? { title: 'This video format is not supported', message: 'Your browser cannot decode this file. Ask the course team to upload it as MP4 (H.264).' }
                    : { title: 'Video could not be played', message: 'The stream was refused or interrupted. Try again, or sign in again if it keeps happening.' }
                );
                return;
              }
              lastRecovery.current = Date.now();
              void reauthorize();
            }}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
            {error ? (
              <>
                {error.code === 403 ? <Lock className="size-8 text-white/80" aria-hidden /> : <Hourglass className="size-8 text-white/80" aria-hidden />}
                <p className="text-sm font-semibold">{error.title}</p>
                <p className="max-w-sm text-xs text-white/70">{error.message}</p>
                {error.code !== 403 ? (
                  <Button size="sm" variant="secondary" onClick={start} loading={authorize.isPending}>
                    <RefreshCw className="size-3.5" aria-hidden />
                    Try again
                  </Button>
                ) : null}
              </>
            ) : processing ? (
              <>
                <Hourglass className="size-8 text-white/80" aria-hidden />
                <p className="text-sm font-semibold">Video is still processing</p>
                <Button size="sm" variant="secondary" onClick={start} loading={authorize.isPending}>
                  Check again
                </Button>
              </>
            ) : (
              <button type="button" onClick={start} disabled={authorize.isPending} className="group flex flex-col items-center gap-2 focus-visible:outline-none" aria-label="Play video">
                <span className="flex size-16 items-center justify-center rounded-full bg-white/15 transition group-hover:bg-white/25 group-focus-visible:ring-2 group-focus-visible:ring-white">
                  <PlayCircle className="size-9" aria-hidden />
                </span>
                <span className="text-xs text-white/80">{authorize.isPending ? 'Authorizing…' : 'Play'}</span>
              </button>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-subtle">
        <ShieldCheck className="size-3.5" aria-hidden />
        Secure playback with a short-lived token that renews automatically.
        {renew.isPending ? ' Renewing…' : ''}
      </p>
    </div>
  );
}
