import { useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { SPEEDS, setSpeed, useSpeed } from './speed';
import './viz.css';

export type VizColor = 'blue' | 'green' | 'purple' | 'pink' | 'amber' | 'neutral';

type FrameProps = {
  /** Accessible name for the figure. */
  label: string;
  controls?: ReactNode;
  children: ReactNode;
  caption?: ReactNode;
  minHeight?: number;
  /** Studio mode: no chrome, transparent background, for screen recording. */
  bare?: boolean;
  /** Show the full screen button. On by default; turn off for small helpers such as the speed control. */
  fullscreen?: boolean;
};

/** How long the mouse must be still in full screen before the toolbar and cursor hide. */
const IDLE_MS = 2500;

export function VizFrame({ label, controls, children, caption, minHeight = 220, bare = false, fullscreen = true }: FrameProps) {
  const ref = useRef<HTMLElement>(null);
  const fs = useFullscreen(ref);
  const [hideControls, setHideControls] = useState(false);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // In full screen, hide the toolbar and cursor while the mouse is still, like a video player.
  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
  }, []);
  useEffect(() => {
    if (fs.active) wake();
    else {
      clearTimeout(idleTimer.current);
      setIdle(false);
      setHideControls(false);
    }
    return () => clearTimeout(idleTimer.current);
  }, [fs.active, wake]);

  // Keyboard shortcuts while full screen: H toggles the controls. Escape exits (the browser handles it natively).
  useEffect(() => {
    if (!fs.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'h' || e.key === 'H') setHideControls((h) => !h);
      wake();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fs.active, wake]);

  const showButton = fullscreen && !bare;
  const classes = ['viz-frame', bare && 'viz-bare', fs.active && 'viz-fs', fs.fallback && 'viz-fs-fallback', idle && 'viz-idle']
    .filter(Boolean)
    .join(' ');

  return (
    <figure ref={ref} className={classes} aria-label={label} onPointerMove={fs.active ? wake : undefined}>
      {showButton && (
        <div className="viz-toolbar">
          {fs.active && (
            <>
              <SpeedPicker />
              {controls && (
                <Btn aria-pressed={hideControls} onClick={() => setHideControls((h) => !h)} title="Hide controls (H)">
                  Hide controls
                </Btn>
              )}
            </>
          )}
          <Btn
            className="viz-fs-btn"
            onClick={fs.toggle}
            aria-label={fs.active ? 'Exit full screen' : 'Full screen'}
            title={fs.active ? 'Exit full screen (Esc)' : 'Full screen'}
          >
            <FullscreenIcon exit={fs.active} />
          </Btn>
        </div>
      )}
      {controls && !bare && !(fs.active && hideControls) && <div className="viz-controls">{controls}</div>}
      <div className="viz-stage" style={{ minHeight: fs.active ? undefined : minHeight }}>
        {children}
      </div>
      {caption && !bare && !fs.active && <figcaption className="viz-caption">{caption}</figcaption>}
    </figure>
  );
}

/**
 * Full screen via the Fullscreen API. Where the API is missing (iPhone Safari only allows it for video),
 * the frame is pinned over the page with CSS instead.
 */
function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const onChange = () => setNative(document.fullscreenElement === ref.current && ref.current !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [ref]);

  // The CSS fallback has no browser Escape handling and must stop the page scrolling underneath.
  useEffect(() => {
    if (!fallback) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFallback(false);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [fallback]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (native) {
      void document.exitFullscreen();
      return;
    }
    if (fallback) {
      setFallback(false);
      return;
    }
    if (document.fullscreenEnabled && el.requestFullscreen) {
      el.requestFullscreen().catch(() => setFallback(true));
    } else {
      setFallback(true);
    }
  }, [ref, native, fallback]);

  return { active: native || fallback, fallback, toggle };
}

function SpeedPicker() {
  const speed = useSpeed();
  return (
    <div className="viz-fs-speed" role="group" aria-label="Animation speed">
      {SPEEDS.map((s) => (
        <Btn key={s} aria-pressed={s === speed} onClick={() => setSpeed(s)}>
          {s * 100}%
        </Btn>
      ))}
    </div>
  );
}

function FullscreenIcon({ exit }: { exit: boolean }) {
  // Four corner brackets pointing out (enter) or in (exit).
  const d = exit
    ? 'M6 2v4H2 M10 2v4h4 M6 14v-4H2 M10 14v-4h4'
    : 'M2 6V2h4 M14 6V2h-4 M2 10v4h4 M14 10v4h-4';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d={d} />
    </svg>
  );
}

export function Group({ label, color = 'neutral', children }: { label: string; color?: VizColor; children: ReactNode }) {
  const id = useId();
  const named = label.trim().length > 0;
  return (
    <div
      className="viz-group"
      role={named ? 'group' : undefined}
      aria-labelledby={named ? id : undefined}
      style={{ '--c': `var(--viz-${color})` } as CSSProperties}
    >
      <span className="viz-group-label" id={id} aria-hidden={named ? undefined : true}>
        {label}
      </span>
      <div className="viz-group-row">{children}</div>
    </div>
  );
}

/**
 * Horizontal scroller for drawings that are too wide for small screens.
 * It only joins the tab order when it actually overflows, so keyboard users can scroll it with the arrow keys.
 */
export function Scroller({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    check();
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="viz-scroll"
      tabIndex={overflows ? 0 : undefined}
      role={overflows ? 'region' : undefined}
      aria-label={overflows ? `${label}, scrolls sideways` : undefined}
    >
      {children}
    </div>
  );
}

export function Btn({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`viz-btn ${className}`} {...props} />;
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <>
      <Btn aria-label={`Decrease ${label}`} onClick={() => onChange(clamp(value - 1))}>
        -
      </Btn>
      <input
        className="viz-input"
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
      />
      <Btn aria-label={`Increase ${label}`} onClick={() => onChange(clamp(value + 1))}>
        +
      </Btn>
    </>
  );
}
