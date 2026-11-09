import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
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
};

export function VizFrame({ label, controls, children, caption, minHeight = 220, bare = false }: FrameProps) {
  return (
    <figure className={`viz-frame${bare ? ' viz-bare' : ''}`} aria-label={label}>
      {controls && !bare && <div className="viz-controls">{controls}</div>}
      <div className="viz-stage" style={{ minHeight }}>
        {children}
      </div>
      {caption && !bare && <figcaption className="viz-caption">{caption}</figcaption>}
    </figure>
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
