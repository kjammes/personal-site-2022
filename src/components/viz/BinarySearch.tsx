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

export default function BinarySearch({ size = 15, seed = 7, initialTarget, script }: Props) {
  const speed = useSpeed();
  const [values, setValues] = useState(() => sortedValues(size, seed));
  const [target, setTarget] = useState(initialTarget ?? values[Math.floor(size * 0.7)]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
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
      <div style={{ width: '100%', '--t': transition } as CSSProperties}>
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
