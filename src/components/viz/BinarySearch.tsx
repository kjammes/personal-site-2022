import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Btn, Group, NumberField, Scroller, VizFrame } from './VizFrame';
import { scaled, useSpeed } from './speed';

type Step = { lo: number; hi: number; mid: number; cmp: 'lt' | 'gt' | 'eq' } | { lo: number; hi: number; mid: -1; cmp: 'miss' };

/** Deterministic so the server-rendered array matches the hydrated one. */
function sortedValues(size: number, seed: number): number[] {
  let x = seed;
  const rand = () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
  const out: number[] = [];
  let v = 2 + Math.floor(rand() * 5);
  for (let i = 0; i < size; i++) {
    out.push(v);
    v += 1 + Math.floor(rand() * 7);
  }
  return out;
}

function plan(values: number[], target: number): Step[] {
  const steps: Step[] = [];
  let lo = 0;
  let hi = values.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] === target) {
      steps.push({ lo, hi, mid, cmp: 'eq' });
      return steps;
    }
    if (values[mid] < target) {
      steps.push({ lo, hi, mid, cmp: 'lt' });
      lo = mid + 1;
    } else {
      steps.push({ lo, hi, mid, cmp: 'gt' });
      hi = mid - 1;
    }
  }
  steps.push({ lo, hi, mid: -1, cmp: 'miss' });
  return steps;
}

function describe(step: Step | undefined, values: number[], target: number): string {
  if (!step) return `Pick a target and press Search. ${values.length} sorted values, at most ${Math.ceil(Math.log2(values.length + 1))} comparisons.`;
  if (step.cmp === 'miss') return `lo passed hi, so ${target} is not in the array.`;
  const v = values[step.mid];
  if (step.cmp === 'eq') return `values[${step.mid}] is ${v}. Found ${target}.`;
  if (step.cmp === 'lt') return `values[${step.mid}] is ${v}, smaller than ${target}. Discard the left half.`;
  return `values[${step.mid}] is ${v}, larger than ${target}. Discard the right half.`;
}

type Props = {
  size?: number;
  seed?: number;
  initialTarget?: number;
  /** Studio mode: hide chrome and loop through these targets automatically. */
  script?: number[];
};

const CELL = 46;
const GAP = 6;
/** Room above the cells for the text labels that mark the middle and found cells. */
const TOP = 22;

/** Vertical (narrow screen) layout: one row per value inside a fixed-height window. */
const ROW = 44;
const ROW_CELL = 38;
const VIEW_H = 360;
/** Below this zoom the values get too small to read, so the camera follows mid instead of fitting the range. */
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.15;
/** Height of the edge fade. Rows are kept clear of it, so the first and last rows are never cut off. */
const FADE = 12;
const PAD = FADE + 6;
const AVAIL_H = VIEW_H - 2 * PAD;

type Camera = { scale: number; y: number };

/**
 * Frame the rows that might still hold the target. As the range halves, the camera zooms in,
 * so the reader sees the whole array at the start and a close-up of the answer at the end.
 */
function camera(n: number, step: Step | undefined, overview: boolean): Camera {
  const content = n * ROW;
  const fitAll = Math.min(1, AVAIL_H / content);
  if (overview || !step) return { scale: fitAll, y: (VIEW_H - content * fitAll) / 2 };

  const clampRow = (r: number) => Math.min(n - 1, Math.max(0, r));
  let a: number;
  let b: number;
  let focus: number;
  if (step.cmp === 'miss') {
    // lo has passed hi: frame the gap where the target would have been.
    a = clampRow(Math.min(step.lo, step.hi));
    b = clampRow(Math.max(step.lo, step.hi));
    focus = (a + b) / 2;
  } else if (step.cmp === 'eq') {
    a = b = focus = step.mid;
  } else {
    a = step.lo;
    b = step.hi;
    focus = (a + b) / 2;
  }

  const span = (b - a + 1) * ROW;
  const raw = AVAIL_H / span;
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, raw));
  if (raw < MIN_ZOOM && step.cmp !== 'miss') focus = step.mid;

  const h = content * scale;
  if (h <= AVAIL_H) return { scale, y: (VIEW_H - h) / 2 };
  const y = VIEW_H / 2 - (focus + 0.5) * ROW * scale;
  // Never pull the first or last row into the fade.
  return { scale, y: Math.min(PAD, Math.max(VIEW_H - PAD - h, y)) };
}

export default function BinarySearch({ size = 15, seed = 7, initialTarget, script }: Props) {
  const speed = useSpeed();
  const [values, setValues] = useState(() => sortedValues(size, seed));
  const [target, setTarget] = useState(initialTarget ?? values[Math.floor(size * 0.7)]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [overview, setOverview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const step = cursor >= 0 ? steps[cursor] : undefined;
  const done = cursor >= 0 && cursor === steps.length - 1;
  const comparisons = step ? (step.cmp === 'miss' ? cursor : cursor + 1) : 0;

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    setPlaying(false);
    setSteps([]);
    setCursor(-1);
  }, []);

  const start = useCallback(
    (t: number, autoplay: boolean) => {
      clearTimeout(timer.current);
      // A new search always follows the camera, so the zoom-in is never hidden by a leftover overview.
      setOverview(false);
      setSteps(plan(values, t));
      setCursor(0);
      setPlaying(autoplay);
    },
    [values],
  );

  const stepOnce = () => {
    if (cursor < 0) start(target, false);
    else if (!done) setCursor((c) => c + 1);
  };

  // Autoplay advances one comparison per tick, scaled by the shared speed.
  useEffect(() => {
    if (!playing || cursor < 0) return;
    if (done) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setCursor((c) => c + 1), scaled(1000, speed));
    return () => clearTimeout(timer.current);
  }, [playing, cursor, done, speed]);

  // Studio script: search each target in turn, pause, repeat.
  const scriptIndex = useRef(0);
  useEffect(() => {
    if (!script?.length) return;
    if (cursor === -1 || done) {
      const wait = cursor === -1 ? 600 : 1800;
      const t = setTimeout(() => {
        const next = script[scriptIndex.current % script.length];
        scriptIndex.current += 1;
        setTarget(next);
        start(next, true);
      }, scaled(wait, speed));
      return () => clearTimeout(t);
    }
  }, [script, cursor, done, speed, start]);

  const width = values.length * (CELL + GAP) - GAP;
  const height = TOP + CELL + 44;
  const transition = `${Math.round(scaled(260, speed))}ms`;
  const cameraTransition = `${Math.round(scaled(650, speed))}ms`;
  const cam = camera(values.length, step, overview);

  const cellState = useMemo(
    () => (i: number) => {
      if (!step) return 'idle';
      if (step.cmp === 'eq' && i === step.mid) return 'found';
      if (i === step.mid) return 'mid';
      if (step.cmp === 'miss' || i < step.lo || i > step.hi) return 'out';
      return 'in';
    },
    [step],
  );

  const controls = (
    <>
      <Group label="Search for a value" color="blue">
        <NumberField label="target value" value={target} min={0} max={999} onChange={(v) => { setTarget(v); reset(); }} />
        <Btn onClick={() => start(target, true)}>Search</Btn>
      </Group>
      <Group label="Step through" color="purple">
        <Btn onClick={stepOnce} disabled={done || playing}>
          Step
        </Btn>
      </Group>
      <Group label="New sorted array" color="green">
        <Btn
          onClick={() => {
            reset();
            setValues(sortedValues(size, Math.floor(Math.random() * 1e9)));
          }}
        >
          Shuffle
        </Btn>
      </Group>
      <Group label={' '}>
        <Btn onClick={reset}>Reset</Btn>
      </Group>
    </>
  );

  return (
    <VizFrame label="Interactive binary search over a sorted array" controls={controls} bare={!!script} minHeight={170}>
      <div className="bs-root" style={{ '--t': transition, '--cam': cameraTransition } as CSSProperties}>
        {/* Wide layout. A container query swaps it for the vertical layout on narrow screens. */}
        <div className="bs-h">
        <Scroller label="Sorted array">
        <svg
          viewBox={`-4 -4 ${width + 8} ${height + 8}`}
          width="100%"
          className="viz-drawing"
          style={{
            display: 'block',
            // Below this width the numbers get too small to read, so the drawing scrolls instead.
            minWidth: script ? undefined : 600,
            maxWidth: script ? 'none' : width + 8,
            margin: '0 auto',
            overflow: 'visible',
          }}
          role="img"
          aria-label={`Sorted array: ${values.join(', ')}`}
        >
          {values.map((v, i) => {
            const s = cellState(i);
            const x = i * (CELL + GAP);
            return (
              <g key={i} className={`bs-cell bs-${s}`} transform={`translate(${x} ${TOP})`}>
                {/* State is shown by colour, line style and a text label, so it never depends on colour alone. */}
                {s === 'mid' && (
                  <text className="bs-tag" x={CELL / 2} y={-8} textAnchor="middle">
                    mid
                  </text>
                )}
                {s === 'found' && (
                  <text className="bs-tag" x={CELL / 2} y={-8} textAnchor="middle">
                    ✓ found
                  </text>
                )}
                <rect width={CELL} height={CELL} rx={5} />
                <text x={CELL / 2} y={CELL / 2 + 5} textAnchor="middle">
                  {v}
                </text>
                <text className="bs-index" x={CELL / 2} y={CELL + 16} textAnchor="middle">
                  {i}
                </text>
              </g>
            );
          })}
          {step && step.cmp !== 'miss' && (
            <>
              <Marker x={step.lo * (CELL + GAP) + CELL / 2} label="lo" color="var(--accent)" y={TOP + CELL + 36} />
              <Marker x={step.hi * (CELL + GAP) + CELL / 2} label="hi" color="var(--accent)" y={TOP + CELL + 36} />
            </>
          )}
        </svg>
        </Scroller>
        </div>

        {/* Narrow layout: rows stacked top to bottom, with a camera that follows the search. */}
        <div className="bs-v">
          <div className="bs-viewport" style={{ height: VIEW_H }}>
            <div
              className="bs-world"
              role="img"
              aria-label={`Sorted array: ${values.join(', ')}`}
              style={{ height: values.length * ROW, transform: `translate(0, ${cam.y}px) scale(${cam.scale})` }}
            >
              {values.map((v, i) => {
                const s = cellState(i);
                return (
                  <div key={i} className={`bs-row bs-${s}`} style={{ top: i * ROW, height: ROW_CELL }} aria-hidden="true">
                    <span className="bs-row-index">{i}</span>
                    <span className="bs-row-cell">{v}</span>
                    <span className="bs-row-tag">{s === 'mid' ? '◀ mid' : s === 'found' ? '✓ found' : ''}</span>
                  </div>
                );
              })}
              {step && step.cmp !== 'miss' && (
                <>
                  {/* lo sits at the top of its row and hi at the bottom, so they never overlap when lo equals hi. */}
                  <span className="bs-vmarker" style={{ transform: `translateY(${step.lo * ROW + 3}px)` }} aria-hidden="true">
                    lo ▸
                  </span>
                  <span className="bs-vmarker" style={{ transform: `translateY(${step.hi * ROW + ROW_CELL - 17}px)` }} aria-hidden="true">
                    hi ▸
                  </span>
                </>
              )}
            </div>
          </div>
          <button
              type="button"
              className="bs-zoom"
              aria-pressed={overview}
              onClick={() => setOverview((o) => !o)}
            >
            {overview ? 'Follow search' : 'Show whole array'}
          </button>
        </div>

        <p className="viz-status" aria-live="polite">
          {describe(step, values, target)}
          {step && (
            <span className="muted">
              {' '}
              comparisons: {comparisons}
            </span>
          )}
        </p>
      </div>
      <style>{`
        .bs-cell rect { fill: var(--bg-raised); stroke: var(--border-strong); stroke-width: 1; transition: fill var(--t), stroke var(--t), opacity var(--t); }
        .bs-cell text { fill: var(--text); font: 600 14px var(--font); transition: fill var(--t), opacity var(--t); }
        .bs-cell .bs-index { fill: var(--muted); font-size: 11px; font-weight: 400; }
        .bs-cell .bs-tag { font-size: 11px; font-weight: 700; }
        .bs-in rect { stroke: var(--accent); }
        .bs-out rect { opacity: 0.45; stroke-dasharray: 3 3; }
        .bs-out text:not(.bs-index) { opacity: 0.6; }
        .bs-mid rect { fill: color-mix(in oklab, var(--purple) 26%, var(--bg-raised)); stroke: var(--purple); stroke-width: 3; }
        .bs-mid text:not(.bs-index) { fill: var(--purple); }
        .bs-found rect { fill: color-mix(in oklab, var(--green) 26%, var(--bg-raised)); stroke: var(--green); stroke-width: 4; }
        .bs-found text:not(.bs-index) { fill: var(--green); }
        .bs-marker { transition: transform var(--t); }

        .bs-root { width: 100%; container-type: inline-size; }
        .bs-v { display: none; }
        @container (max-width: 599px) {
          .bs-h { display: none; }
          .bs-v { display: block; }
        }
        .bs-viewport {
          position: relative; overflow: hidden; border-radius: 4px;
          background: color-mix(in oklab, var(--bg-raised) 40%, transparent);
          /* Fade the edges so it is clear the column continues past the window. */
          mask-image: linear-gradient(transparent, #000 ${FADE}px, #000 calc(100% - ${FADE}px), transparent);
        }
        .bs-world {
          position: relative; width: 100%; transform-origin: top center;
          transition: transform var(--cam) cubic-bezier(.4, 0, .2, 1);
        }
        .bs-row {
          position: absolute; left: 0; right: 0; display: grid; align-items: center;
          grid-template-columns: 2.6rem 2rem minmax(0, 1fr) 4.6rem; gap: 0.5rem;
        }
        .bs-row-index { grid-column: 2; text-align: right; color: var(--muted); font: 400 12px var(--font); }
        .bs-row-cell {
          height: 100%; display: grid; place-items: center; border-radius: 5px;
          background: var(--bg-raised); border: 1px solid var(--border-strong); color: var(--text);
          font: 600 18px var(--font);
          transition: background var(--t), border-color var(--t), opacity var(--t), color var(--t);
        }
        .bs-row-tag { font: 700 12px var(--font); white-space: nowrap; }
        .bs-in .bs-row-cell { border-color: var(--accent); }
        .bs-out .bs-row-cell { opacity: 0.45; border-style: dashed; }
        .bs-mid .bs-row-cell { background: color-mix(in oklab, var(--purple) 26%, var(--bg-raised)); border: 3px solid var(--purple); color: var(--purple); }
        .bs-mid .bs-row-tag { color: var(--purple); }
        .bs-found .bs-row-cell { background: color-mix(in oklab, var(--green) 26%, var(--bg-raised)); border: 4px solid var(--green); color: var(--green); }
        .bs-found .bs-row-tag { color: var(--green); }
        .bs-vmarker {
          position: absolute; top: 0; left: 0; width: 2.6rem; text-align: right;
          color: var(--accent); font: 700 12px var(--font);
          transition: transform var(--t);
        }
        .bs-zoom {
          display: block; margin: 0.5rem auto 0; padding: 0.35rem 0.8rem; min-height: 2.75rem;
          border: 1px solid var(--border-strong); border-radius: 4px;
          background: var(--bg-panel); color: var(--text); font: 600 var(--fs-xs) var(--font); cursor: pointer;
        }
        .bs-zoom[aria-pressed='true'] { border-color: var(--accent); color: var(--accent); }
      `}</style>
    </VizFrame>
  );
}

function Marker({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <g className="bs-marker" transform={`translate(${x} ${y})`}>
      <text textAnchor="middle" fill={color} style={{ font: '700 11px var(--font)' }} dx={label === 'lo' ? -9 : 9}>
        {label}
      </text>
    </g>
  );
}
