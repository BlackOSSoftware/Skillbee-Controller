'use client';

import {
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  TriangleAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const MEDIA_ERROR_TEXT: Record<number, string> = {
  1: 'Playback was aborted.',
  2: 'Network error while loading the video. Check your connection and retry.',
  3: 'The video could not be decoded. The file may be corrupted or in an unsupported format.',
  4: 'The browser does not support this video source. The file may be incomplete or not a valid MP4.',
};

export interface SecureVideoPlayerProps {
  src: string;
  title: string;
  onRetry: () => void;
  className?: string;
}

/**
 * Shared custom video player — one consistent design everywhere.
 * Play/pause, seek, volume, fullscreen; NO native controls, NO download button.
 * Handles loadstart/loadedmetadata/loadeddata/canplay/playing/waiting/stalled/error.
 */
export function SecureVideoPlayer({ src, title, onRetry, className }: SecureVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const log = useCallback((event: string, detail?: Record<string, unknown>) => {
    // Debug aid only — never log the src (it contains the signed token).
    console.debug(`[media-player] ${event}`, detail ?? '');
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const pokeControls = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) setShowControls(false);
    }, 2600);
  }, []);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const seek = useCallback((value: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = value;
    setCurrentTime(value);
  }, []);

  const handleError = useCallback(() => {
    const v = videoRef.current;
    const err = v?.error;
    const code = err?.code ?? 0;
    const message = err?.message || 'Unknown playback error';
    const diagnostic = `code=${code} networkState=${v?.networkState ?? 'n/a'} readyState=${v?.readyState ?? 'n/a'}`;
    log('error', { code, message, networkState: v?.networkState, readyState: v?.readyState });
    setLoading(false);
    setBuffering(false);
    setErrorInfo(`${MEDIA_ERROR_TEXT[code] ?? message} (${diagnostic})`);
  }, [log]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showSpinner = loading || buffering;

  return (
    <div
      ref={containerRef}
      className={cn('group relative h-full w-full bg-black', className)}
      onMouseMove={pokeControls}
      onMouseLeave={() => { const v = videoRef.current; if (v && !v.paused) setShowControls(false); }}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        className="h-full w-full cursor-pointer object-contain"
        onClick={togglePlay}
        onLoadStart={() => { log('loadstart'); setLoading(true); setErrorInfo(null); }}
        onLoadedMetadata={(e) => { log('loadedmetadata', { duration: e.currentTarget.duration }); setDuration(e.currentTarget.duration); }}
        onLoadedData={() => { log('loadeddata'); setLoading(false); }}
        onCanPlay={() => { log('canplay'); setLoading(false); }}
        onPlaying={() => { log('playing'); setPlaying(true); setLoading(false); setBuffering(false); }}
        onWaiting={() => { log('waiting'); setBuffering(true); }}
        onStalled={() => { log('stalled'); setBuffering(true); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
        onError={handleError}
      />

      {showSpinner && !errorInfo ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="size-10 animate-spin text-white/80" aria-hidden />
        </div>
      ) : null}

      {errorInfo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
          <TriangleAlert className="size-8 text-amber-400" aria-hidden />
          <p className="max-w-md text-sm text-white/85">{errorInfo}</p>
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden />
            Retry playback
          </Button>
        </div>
      ) : null}

      {!playing && !errorInfo ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/40"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-primary/90 text-white shadow-xl transition hover:scale-105">
            <Play className="ml-1 size-7 fill-current" aria-hidden />
          </span>
        </button>
      ) : null}

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-200',
          showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-primary [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          style={{ background: `linear-gradient(to right, var(--color-primary, #7c3aed) ${progress}%, rgba(255,255,255,0.25) ${progress}%)` }}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex size-8 items-center justify-center rounded-full text-white transition hover:bg-white/15"
          >
            {playing ? <Pause className="size-4 fill-current" aria-hidden /> : <Play className="size-4 fill-current" aria-hidden />}
          </button>
          <span className="text-xs tabular-nums text-white/85">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="flex size-8 items-center justify-center rounded-full text-white transition hover:bg-white/15"
            >
              {muted || volume === 0 ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                v.volume = Number(e.target.value);
                v.muted = v.volume === 0;
              }}
              aria-label="Volume"
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-primary sm:w-20 [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="flex size-8 items-center justify-center rounded-full text-white transition hover:bg-white/15"
            >
              {fullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}
