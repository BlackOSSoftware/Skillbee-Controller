'use client';

import { Gauge, Loader2, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, ShieldCheck, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/cn';

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const HIDE_AFTER_MS = 2500;

function clock(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

interface SecureVideoPlayerProps {
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Position to restore once the (re-authorized) source has loaded. */
  startAt: number | null;
  onResumed: () => void;
  /** Fired on play and seek, so the caller can renew the playback token before it expires. */
  onIntent: () => void;
  onPlaying: () => void;
  onMediaError: () => void;
}

/**
 * Custom controls over a bare <video>: no native download menu, picture-in-picture,
 * remote playback or context menu.
 */
export function SecureVideoPlayer({ src, videoRef, startAt, onResumed, onIntent, onPlaying, onMediaError }: SecureVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [active, setActive] = useState(true);
  const [rateMenu, setRateMenu] = useState(false);
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!rateMenu) return;
    const close = (e: globalThis.PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-rate-menu]')) setRateMenu(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [rateMenu]);

  function poke() {
    setActive(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setActive(false), HIDE_AFTER_MS);
  }

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) void v.play().catch(() => setPlaying(false));
    else v.pause();
    poke();
  }

  function seekTo(time: number) {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Math.min(Math.max(time, 0), duration);
    setCurrent(v.currentTime);
    poke();
  }

  function changeVolume(next: number) {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.min(Math.max(next, 0), 1);
    v.muted = v.volume === 0;
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted || v.volume === 0) {
      v.muted = false;
      if (v.volume === 0) v.volume = 0.6;
    } else v.muted = true;
  }

  function changeRate(next: number) {
    const v = videoRef.current;
    if (v) v.playbackRate = next;
    setRateMenu(false);
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (typeof el.requestFullscreen === 'function') void el.requestFullscreen().catch(() => undefined);
    else (videoRef.current as IosVideo | null)?.webkitEnterFullscreen?.();
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const onSlider = e.target instanceof HTMLInputElement;
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'k') {
      if (onSlider && key === ' ') return;
      e.preventDefault();
      toggle();
    } else if (!onSlider && key === 'arrowleft') {
      e.preventDefault();
      seekTo(current - 5);
    } else if (!onSlider && key === 'arrowright') {
      e.preventDefault();
      seekTo(current + 5);
    } else if (!onSlider && key === 'arrowup') {
      e.preventDefault();
      changeVolume(volume + 0.1);
    } else if (!onSlider && key === 'arrowdown') {
      e.preventDefault();
      changeVolume(volume - 0.1);
    } else if (key === 'm') toggleMute();
    else if (key === 'f') toggleFullscreen();
  }

  function onSeekHover(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHover({ x: ratio * 100, time: ratio * duration });
  }

  const played = duration ? (current / duration) * 100 : 0;
  const loaded = duration ? (buffered / duration) * 100 : 0;
  const shown = active || !playing || rateMenu;
  const level = muted ? 0 : volume;
  const VolumeIcon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerMove={poke}
      onPointerLeave={() => playing && setActive(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={cn('group/player relative size-full select-none bg-black focus-visible:outline-none', !shown && 'cursor-none')}
      aria-label="Video player"
      role="region"
    >
      <video
        ref={videoRef}
        key={src}
        src={src}
        crossOrigin="use-credentials"
        autoPlay
        playsInline
        preload="metadata"
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload noremoteplayback noplaybackrate"
        draggable={false}
        className="size-full"
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          v.volume = volume;
          v.muted = muted;
          v.playbackRate = rate;
          setDuration(Number.isFinite(v.duration) ? v.duration : 0);
          if (startAt !== null) {
            v.currentTime = startAt;
            onResumed();
          }
        }}
        onDurationChange={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          setBuffered(b.length ? b.end(b.length - 1) : 0);
        }}
        onPlay={() => {
          setPlaying(true);
          onIntent();
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onSeeking={onIntent}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onPlaying={() => {
          setWaiting(false);
          onPlaying();
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
        onError={onMediaError}
      />

      {waiting ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-10 animate-spin text-white/85" aria-label="Loading video" />
        </div>
      ) : !playing ? (
        <button
          type="button"
          onClick={toggle}
          className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Play"
        >
          <Play className="ml-1 size-7 fill-current" aria-hidden />
        </button>
      ) : null}

      <div
        className={cn(
          'pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm transition-opacity duration-300',
          shown ? 'opacity-100' : 'opacity-0'
        )}
      >
        <ShieldCheck className="size-3.5" aria-hidden />
        Protected stream
      </div>

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-10 text-white transition-opacity duration-300 sm:px-4',
          shown ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <div className="group/seek relative py-2" onPointerMove={onSeekHover} onPointerLeave={() => setHover(null)}>
          {hover && duration ? (
            <span
              className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] tabular-nums"
              style={{ left: `${hover.x}%` }}
            >
              {clock(hover.time)}
            </span>
          ) : null}
          <div className="relative h-1 rounded-full bg-white/20 transition-[height] group-hover/seek:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${loaded}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${played}%` }} />
            <div
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white shadow transition-transform group-hover/seek:scale-100"
              style={{ left: `${played}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="any"
            value={current}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Seek"
            aria-valuetext={`${clock(current)} of ${clock(duration)}`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ControlButton label={playing ? 'Pause' : 'Play'} onClick={toggle}>
            {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="size-5 fill-current" aria-hidden />}
          </ControlButton>
          <ControlButton label="Back 10 seconds" onClick={() => seekTo(current - 10)}>
            <RotateCcw className="size-[18px]" aria-hidden />
          </ControlButton>
          <ControlButton label="Forward 10 seconds" onClick={() => seekTo(current + 10)}>
            <RotateCw className="size-[18px]" aria-hidden />
          </ControlButton>

          <div className="group/vol flex items-center">
            <ControlButton label={level === 0 ? 'Unmute' : 'Mute'} onClick={toggleMute}>
              <VolumeIcon className="size-5" aria-hidden />
            </ControlButton>
            <div className="relative hidden h-8 w-0 items-center overflow-hidden transition-[width] duration-200 group-hover/vol:w-20 group-focus-within/vol:w-20 sm:flex">
              <div className="relative mx-1 h-1 w-full rounded-full bg-white/25">
                <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${level * 100}%` }} />
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={level}
                onChange={(e) => changeVolume(Number(e.target.value))}
                aria-label="Volume"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
          </div>

          <span className="ml-1 text-xs tabular-nums text-white/85">
            {clock(current)} <span className="text-white/50">/ {clock(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <div className="relative" data-rate-menu>
              <ControlButton label="Playback speed" onClick={() => setRateMenu((o) => !o)} expanded={rateMenu}>
                <Gauge className="size-[18px]" aria-hidden />
                <span className="text-xs tabular-nums">{rate}×</span>
              </ControlButton>
              {rateMenu ? (
                <ul role="menu" aria-label="Playback speed" className="absolute bottom-full right-0 mb-2 w-28 overflow-hidden rounded-lg border border-white/10 bg-neutral-900/95 py-1 text-sm shadow-xl backdrop-blur">
                  {RATES.map((r) => (
                    <li key={r}>
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={r === rate}
                        onClick={() => changeRate(r)}
                        className={cn('flex w-full items-center justify-between px-3 py-1.5 text-left tabular-nums hover:bg-white/10', r === rate ? 'text-white' : 'text-white/70')}
                      >
                        {r === 1 ? 'Normal' : `${r}×`}
                        {r === rate ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <ControlButton label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
              {fullscreen ? <Minimize className="size-[18px]" aria-hidden /> : <Maximize className="size-[18px]" aria-hidden />}
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, expanded, children }: { label: string; onClick: () => void; expanded?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      className="flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 text-white/90 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      {children}
    </button>
  );
}
