import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Btn, Group, NumberField, Scroller, VizFrame } from './VizFrame';
import { scaled, useSpeed } from './speed';
import {
  contains,
  height,
  isLeaf,
  keyCount,
  leaves,
  planInsert,
  planRange,
  planSearch,
  seededTree,
  suggestInsert,
  type Step,
  type Tree,
  type TreeNode,
  type Variant,
} from './tree-core';

type Op = 'search' | 'insert' | 'range';

export type TreeScriptOp = { op: 'search'; v: number } | { op: 'insert'; v: number } | { op: 'range'; from: number; to: number };

export type TreeVizProps = {
  /** Keys in the starting tree. */
  count?: number;
  seed?: number;
  /** Most keys a node may hold before it splits. */
  maxKeys?: number;
  /** Studio mode: hide chrome and loop through these operations, starting from a fresh tree each loop. */
  script?: TreeScriptOp[];
};

/** Node sizes the reader can pick. Bigger nodes mean a wider, shorter tree. */
const SIZES = [3, 4, 5];
/** Past this the drawing gets too wide to read, so Insert is disabled. */
const MAX_KEYS_TOTAL = 42;

const KW = 36;
const NH = 34;
const LEVEL = 86;
const TOP = 6;

type Box = { x: number; y: number; w: number };

function layout(root: TreeNode, leafGap: number) {
  const pos = new Map<number, Box>();
  let cursor = 0;
  const place = (n: TreeNode, depth: number): number => {
    const w = Math.max(1, n.keys.length) * KW;
    let cx: number;
    if (isLeaf(n)) {
      cx = cursor + w / 2;
      cursor += w + leafGap;
    } else {
      const centers = n.children.map((c) => place(c, depth + 1));
      cx = (centers[0] + centers[centers.length - 1]) / 2;
    }
    pos.set(n.id, { x: cx - w / 2, y: TOP + depth * LEVEL, w });
    return cx;
  };
  place(root, 0);
  return { pos, width: cursor - leafGap, height: TOP + (height(root) - 1) * LEVEL + NH };
}

/*
 * Narrow screens: the tree sits in a fixed window and a camera frames the part that matters for the
 * current step, so keys stay readable instead of shrinking the whole tree to fit a phone.
 */
const VIEW_H = 300;
/** Below this zoom 14px keys drop under about 11px, so the camera centres on the active node instead of fitting. */
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1.3;
/** The drawing's viewBox starts at -8, so world coordinates are layout coordinates plus this. */
const PAD = 8;
/** Room kept clear at the top for the level badge and at the bottom for the "too full" tag. */
const BADGE_H = 30;
const TAG_H = 22;

type Rect = { x: number; y: number; w: number; h: number };
type Camera = { scale: number; x: number; y: number };

const union = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};

/**
 * What the camera should frame: the node being read and the node it came from (its parent on the way
 * down, or the previous leaf during a scan), plus both halves of a split. The anchor is the one node
 * that must stay in view when all of that is too wide to fit.
 */
function focusFor(step: Step | undefined, pos: Map<number, Box>): { focus: Rect; anchor: Rect } | null {
  if (!step) return null;
  const box = (id: number): Rect | undefined => {
    const p = pos.get(id);
    return p && { x: p.x + PAD, y: p.y + PAD, w: p.w, h: NH };
  };
  const ids = new Set<number>(step.split ?? []);
  if (step.active !== undefined) {
    ids.add(step.active);
    const v = step.visited;
    if (v[v.length - 1] === step.active && v.length > 1) ids.add(v[v.length - 2]);
  } else {
    // Final summary of a range scan: frame the leaves that matched.
    for (const k of Object.keys(step.marks)) ids.add(Number(k.split(':')[0]));
  }
  const rects = [...ids].map(box).filter((r): r is Rect => !!r);
  if (!rects.length) return null;
  const anchor = (step.active !== undefined && box(step.active)) || rects[0];
  return { focus: union(rects), anchor };
}

function cameraFor(target: { focus: Rect; anchor: Rect } | null, world: { w: number; h: number }, vw: number): Camera {
  const fit = Math.min(MAX_ZOOM, vw / world.w, VIEW_H / world.h);
  const place = (scale: number, cx: number, cy: number): Camera => {
    const clamp = (v: number, size: number, view: number) => {
      const s = size * scale;
      if (s <= view) return (view - s) / 2;
      return Math.min(0, Math.max(view - s, v));
    };
    return { scale, x: clamp(vw / 2 - cx * scale, world.w, vw), y: clamp(VIEW_H / 2 - cy * scale, world.h, VIEW_H) };
  };
  if (!target) return place(fit, world.w / 2, world.h / 2);

  const { focus, anchor } = target;
  const room = { w: vw - 24, h: VIEW_H - BADGE_H - TAG_H };
  const raw = Math.min(room.w / focus.w, room.h / focus.h);
  const scale = Math.max(fit, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, raw)));
  // Too wide to fit at a readable size: keep the active node centred and let the rest run off the edges.
  const f = focus.w * scale > room.w ? anchor : focus;
  // Nudge down a little so the badge never covers the top row.
  return place(scale, f.x + f.w / 2, f.y + f.h / 2 + (TAG_H - BADGE_H) / 2 / scale);
}

function describeTree(root: TreeNode, name: string): string {
  const levels: string[] = [];
  let row = [root];
  while (row.length) {
    levels.push(row.map((n) => `[${n.keys.join(', ')}]`).join(' '));
    row = row.flatMap((n) => n.children);
  }
  return `${name} with ${levels.length} ${levels.length === 1 ? 'level' : 'levels'}. ${levels.map((l, i) => `Level ${i + 1}: ${l}.`).join(' ')}`;
}

/** A key that sits in a leaf, so the default search goes all the way down. */
function defaultTarget(t: Tree): number {
  const ls = leaves(t.root);
  const leaf = ls[Math.floor(ls.length * 0.6)];
  return leaf.keys[leaf.keys.length - 1];
}

function defaultRange(t: Tree): [number, number] {
  const ls = leaves(t.root);
  const a = ls[Math.min(1, ls.length - 1)];
  const b = ls[Math.min(3, ls.length - 1)];
  return [a.keys[a.keys.length - 1], b.keys[0]];
}

export default function TreeViz({ variant, count = 14, seed = 11, maxKeys: initialMax = 3, script }: TreeVizProps & { variant: Variant }) {
  const speed = useSpeed();
  const name = variant === 'b' ? 'B-tree' : 'B+ tree';
  const [maxKeys, setMaxKeys] = useState(initialMax);
  const [tree, setTree] = useState(() => seededTree(count, seed, initialMax, variant));
  const [target, setTarget] = useState(() => defaultTarget(tree));
  const [insertV, setInsertV] = useState(() => suggestInsert(tree, initialMax, variant));
  const [range, setRange] = useState<[number, number]>(() => defaultRange(tree));
  const [steps, setSteps] = useState<Step[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  /** Which operation the current plan belongs to, so each group's Step button only advances its own. */
  const [kind, setKind] = useState<Op | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const treeRef = useRef(tree);
  treeRef.current = tree;
  const [overview, setOverview] = useState(false);
  // Width of the narrow-layout window. The server renders with a typical phone width.
  const [vw, setVw] = useState(340);
  const viewportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      // Hidden in the wide layout, where it measures 0. Keep the last real width.
      if (el.clientWidth > 0) setVw(el.clientWidth);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const step = cursor >= 0 ? steps[cursor] : undefined;
  const done = cursor >= 0 && cursor === steps.length - 1;
  const shown = step?.tree ?? tree;
  const full = keyCount(tree, variant) >= MAX_KEYS_TOTAL;
  const cannotInsert = full || contains(tree, insertV, variant);

  const run = useCallback((plan: Step[], autoplay: boolean, op: Op) => {
    clearTimeout(timer.current);
    // A new operation always follows the camera, so the zoom-in is never hidden by a leftover overview.
    setOverview(false);
    setKind(op);
    setSteps(plan);
    setCursor(0);
    setPlaying(autoplay);
  }, []);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    setPlaying(false);
    setKind(null);
    setSteps([]);
    setCursor(-1);
  }, []);

  const rebuild = useCallback(
    (k: number) => {
      clear();
      const t = seededTree(count, seed, k, variant);
      setTree(t);
      setInsertV(suggestInsert(t, k, variant));
      return t;
    },
    [clear, count, seed, variant],
  );

  const doInsert = useCallback(
    (v: number, base: Tree, k: number, autoplay = true) => {
      const r = planInsert(base, v, k, variant);
      // Commit right away. The plan replays how the tree got there.
      setTree(r.tree);
      run(r.steps, autoplay, 'insert');
    },
    [run, variant],
  );

  // Suggest the next value only once an insert has finished, so the field keeps showing the value being inserted.
  useEffect(() => {
    if (kind === 'insert' && done) setInsertV(suggestInsert(tree, maxKeys, variant));
  }, [kind, done, tree, maxKeys, variant]);

  const inProgress = (op: Op) => kind === op && cursor >= 0 && !done;

  /** Advance this operation by one step, or start it paused if it is not the one in progress. */
  const stepOp = (op: Op) => {
    clearTimeout(timer.current);
    if (inProgress(op)) {
      setPlaying(false);
      setCursor((c) => c + 1);
    } else if (op === 'search') run(planSearch(tree, target, variant), false, 'search');
    else if (op === 'insert') doInsert(insertV, tree, maxKeys, false);
    else run(planRange(tree, range[0], range[1]), false, 'range');
  };

  useEffect(() => {
    if (!playing || cursor < 0) return;
    if (done) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setCursor((c) => c + 1), scaled(steps[cursor]?.long ? 1700 : 850, speed));
    return () => clearTimeout(timer.current);
  }, [playing, cursor, done, speed, steps]);

  // Studio script: run each operation in turn, and start from a fresh tree at the top of each loop.
  const scriptIndex = useRef(0);
  useEffect(() => {
    if (!script?.length) return;
    if (cursor !== -1 && !done) return;
    const wait = cursor === -1 ? 600 : 2200;
    const t = setTimeout(() => {
      const i = scriptIndex.current % script.length;
      scriptIndex.current += 1;
      const base = i === 0 ? rebuild(maxKeys) : treeRef.current;
      const op = script[i];
      if (op.op === 'search') {
        setTarget(op.v);
        run(planSearch(base, op.v, variant), true, 'search');
      } else if (op.op === 'insert') {
        doInsert(op.v, base, maxKeys);
      } else if (variant === 'bplus') {
        setRange([op.from, op.to]);
        run(planRange(base, op.from, op.to), true, 'range');
      }
    }, scaled(wait, speed));
    return () => clearTimeout(t);
  }, [script, cursor, done, speed, run, rebuild, doInsert, maxKeys, variant]);

  const leafGap = variant === 'bplus' ? 30 : 18;
  const { pos, width, height: h } = useMemo(() => layout(shown.root, leafGap), [shown, leafGap]);
  const chain = useMemo(() => leaves(shown.root), [shown]);

  // Moves taken in order: parent to child, or leaf to next leaf during a scan.
  const travelled = useMemo(() => {
    const s = new Set<string>();
    const v = step?.visited ?? [];
    for (let i = 1; i < v.length; i++) s.add(`${v[i - 1]}-${v[i]}`);
    return s;
  }, [step]);
  const visited = useMemo(() => new Set(step?.visited ?? []), [step]);
  const split = new Set(step?.split ?? []);

  const nodeState = (id: number) => {
    if (step?.overflow === id) return 'overflow';
    if (step?.active === id) return 'active';
    if (split.has(id)) return 'split';
    if (visited.has(id)) return 'visited';
    return 'idle';
  };

  const edges: { key: string; d: string; on: boolean }[] = [];
  const walk = (n: TreeNode) => {
    const p = pos.get(n.id)!;
    n.children.forEach((c, i) => {
      const q = pos.get(c.id)!;
      const x1 = p.x + Math.min(Math.max(i * KW, 3), p.w - 3);
      const d = `M${x1} ${p.y + NH} L${q.x + q.w / 2} ${q.y}`;
      // The geometry is part of the key, so a moved edge remounts and fades in after the nodes settle.
      edges.push({ key: `${n.id}-${c.id}-${d}`, d, on: travelled.has(`${n.id}-${c.id}`) });
      walk(c);
    });
  };
  walk(shown.root);

  const links =
    variant === 'bplus'
      ? chain.slice(1).map((b, i) => {
          const a = chain[i];
          const pa = pos.get(a.id)!;
          const pb = pos.get(b.id)!;
          const y = pa.y + NH / 2;
          return { key: `${a.id}-${b.id}-${pa.x + pa.w}-${pb.x}`, x1: pa.x + pa.w + 3, x2: pb.x - 3, y, on: travelled.has(`${a.id}-${b.id}`) };
        })
      : [];

  const t = `${Math.round(scaled(260, speed))}ms`;
  const move = `${Math.round(scaled(420, speed))}ms`;

  const controls = (
    <>
      <Group label="Search for a value" color="blue">
        <NumberField label="value to search for" value={target} min={1} max={99} onChange={(v) => { setTarget(v); clear(); }} />
        <Btn onClick={() => run(planSearch(tree, target, variant), true, 'search')}>Search</Btn>
        <Btn onClick={() => stepOp('search')} aria-label="Step through the search" title="One step at a time">
          Step
        </Btn>
      </Group>
      <Group label="Insert a value" color="green">
        <NumberField label="value to insert" value={insertV} min={1} max={99} onChange={setInsertV} />
        <Btn onClick={() => doInsert(insertV, tree, maxKeys)} disabled={cannotInsert} title={full ? 'The tree is full for this demo. Press Reset.' : undefined}>
          Insert
        </Btn>
        <Btn
          onClick={() => stepOp('insert')}
          disabled={!inProgress('insert') && cannotInsert}
          aria-label="Step through the insert"
          title="One step at a time"
        >
          Step
        </Btn>
      </Group>
      {variant === 'bplus' && (
        <Group label="Range scan" color="amber">
          <NumberField label="range start" value={range[0]} min={1} max={99} onChange={(v) => { setRange([v, range[1]]); clear(); }} />
          <NumberField label="range end" value={range[1]} min={1} max={99} onChange={(v) => { setRange([range[0], v]); clear(); }} />
          <Btn onClick={() => run(planRange(tree, range[0], range[1]), true, 'range')}>Scan</Btn>
          <Btn onClick={() => stepOp('range')} aria-label="Step through the range scan" title="One step at a time">
            Step
          </Btn>
        </Group>
      )}
      <Group label="Max keys per node">
        {SIZES.map((k) => (
          <Btn
            key={k}
            aria-pressed={k === maxKeys}
            onClick={() => {
              setMaxKeys(k);
              const fresh = rebuild(k);
              setTarget(defaultTarget(fresh));
              setRange(defaultRange(fresh));
            }}
          >
            {k}
          </Btn>
        ))}
      </Group>
      <Group label={' '}>
        <Btn onClick={() => rebuild(maxKeys)}>Reset</Btn>
      </Group>
    </>
  );

  const levels = height(shown.root);
  const status = step ? step.text : `${keyCount(tree, variant)} keys in ${levels} ${levels === 1 ? 'level' : 'levels'}, up to ${maxKeys} keys per node. Search, insert${variant === 'bplus' ? ', scan a range' : ''} or step through.`;

  const world = { w: width + 2 * PAD, h: h + 2 * PAD };
  const cam = cameraFor(overview ? null : focusFor(step, pos), world, vw);
  const activeBox = step?.active !== undefined ? pos.get(step.active) : undefined;
  const depth = activeBox ? Math.round((activeBox.y - TOP) / LEVEL) : -1;
  const badge =
    depth < 0
      ? `Whole tree, ${levels} ${levels === 1 ? 'level' : 'levels'}`
      : `Level ${depth + 1} of ${levels}${levels === 1 ? '' : depth === 0 ? ', root' : depth === levels - 1 ? ', leaves' : ''}`;
  // The part of the world the window shows, for the mini map.
  const seen = { x: -cam.x / cam.scale, y: -cam.y / cam.scale, w: vw / cam.scale, h: VIEW_H / cam.scale };
  const mapScale = Math.min(96 / world.w, 56 / world.h);

  const body = (
    <>
            {edges.map((e) => (
              <path key={e.key} d={e.d} className={`tv-edge${e.on ? ' tv-on' : ''}`} />
            ))}
            {links.map((l) => (
              <g key={l.key} className={`tv-link${l.on ? ' tv-on' : ''}`}>
                <path d={`M${l.x1} ${l.y} L${l.x2 - 5} ${l.y}`} />
                <path d={`M${l.x2} ${l.y} l-7 -4 v8 z`} className="tv-head" />
              </g>
            ))}
            {[...pos.entries()].map(([id, p]) => {
              const n = findIn(shown.root, id)!;
              const s = nodeState(id);
              return (
                <g key={id} className={`tv-node tv-${s}`} style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
                  <rect className="tv-box" width={p.w} height={NH} rx={4} />
                  {n.keys.map((k, i) => {
                    const mark = step?.marks[`${id}:${i}`];
                    return (
                      <g key={i} className={mark ? `tv-key tv-${mark}` : 'tv-key'}>
                        {mark && <rect className="tv-mark" x={i * KW + 2} y={2} width={KW - 4} height={NH - 4} rx={3} />}
                        {i > 0 && <line className="tv-sep" x1={i * KW} x2={i * KW} y1={0} y2={NH} />}
                        <text x={i * KW + KW / 2} y={NH / 2 + 5} textAnchor="middle">
                          {k}
                        </text>
                      </g>
                    );
                  })}
                  {s === 'overflow' && (
                    <text className="tv-tag tv-tag-over" x={p.w / 2} y={NH + 15} textAnchor="middle">
                      too full
                    </text>
                  )}
                </g>
              );
            })}
    </>
  );

  return (
    <VizFrame label={`Interactive ${name}`} controls={controls} bare={!!script} minHeight={240}>
      <div className="tv-root" style={{ '--t': t, '--move': move, '--cam': `${Math.round(scaled(650, speed))}ms` } as CSSProperties}>
        {/* Wide layout. A container query swaps it for the camera layout on narrow screens. */}
        <div className={script ? undefined : 'tv-wide'}>
          <Scroller label={name}>
            <svg
              viewBox={`-${PAD} -${PAD} ${world.w} ${world.h}`}
              width="100%"
              className="viz-drawing"
              style={{
                display: 'block',
                // Below this width the keys get too small to read, so the drawing scrolls instead.
                minWidth: script ? undefined : Math.min(world.w, Math.max(520, Math.round(width * 0.8))),
                maxWidth: script ? 'none' : world.w,
                margin: '0 auto',
              }}
              role="img"
              aria-label={describeTree(shown.root, name)}
            >
              {body}
            </svg>
          </Scroller>
        </div>

        {/* Narrow layout: a fixed window with a camera that zooms to the level being worked on. */}
        {!script && (
          <div className="tv-narrow">
            <div className="tv-viewport" ref={viewportRef} style={{ height: VIEW_H }}>
              <div className="tv-world" style={{ width: world.w, height: world.h, transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})` }}>
                <svg viewBox={`-${PAD} -${PAD} ${world.w} ${world.h}`} width={world.w} height={world.h} role="img" aria-label={describeTree(shown.root, name)}>
                  {body}
                </svg>
              </div>
              <span className="tv-badge" aria-hidden="true">
                {overview ? `Whole tree, ${levels} ${levels === 1 ? 'level' : 'levels'}` : badge}
              </span>
            </div>
            {step && (
            <div className="tv-under">
              {!overview && (
                <svg
                  className="tv-map"
                  width={world.w * mapScale + 8}
                  height={world.h * mapScale + 8}
                  viewBox={`-4 -4 ${world.w * mapScale + 8} ${world.h * mapScale + 8}`}
                  aria-hidden="true"
                >
                  {[...pos.entries()].map(([id, p]) => (
                    <rect
                      key={id}
                      className={step?.active === id ? 'tv-map-on' : visited.has(id) ? 'tv-map-seen' : undefined}
                      x={(p.x + PAD) * mapScale}
                      y={(p.y + PAD) * mapScale}
                      width={Math.max(2, p.w * mapScale)}
                      height={Math.max(2, NH * mapScale)}
                    />
                  ))}
                  <rect
                    className="tv-map-view"
                    x={Math.max(0, seen.x) * mapScale}
                    y={Math.max(0, seen.y) * mapScale}
                    width={Math.min(world.w, seen.w) * mapScale}
                    height={Math.min(world.h, seen.h) * mapScale}
                  />
                </svg>
              )}
              <button type="button" className="tv-zoom" aria-pressed={overview} onClick={() => setOverview((o) => !o)}>
                {overview ? 'Follow the steps' : 'Show whole tree'}
              </button>
            </div>
            )}
          </div>
        )}

        <p className="viz-status" aria-live="polite">
          {status}
          {step && (
            <span className="muted">
              {' '}
              disk reads: {step.reads}, comparisons: {step.comparisons}
            </span>
          )}
        </p>
      </div>
      <style>{`
        .tv-root { width: 100%; container-type: inline-size; }
        .tv-narrow { display: none; }
        @container (max-width: 599px) {
          .tv-wide { display: none; }
          .tv-narrow { display: block; }
        }
        .tv-viewport {
          position: relative; overflow: hidden; border-radius: 4px;
          background: color-mix(in oklab, var(--bg-raised) 40%, transparent);
        }
        .tv-world { position: absolute; top: 0; left: 0; transform-origin: 0 0; transition: transform var(--cam) cubic-bezier(.4, 0, .2, 1); }
        .tv-world svg { display: block; overflow: visible; }
        .tv-badge {
          position: absolute; top: 6px; left: 6px; padding: 2px 8px; border-radius: 3px;
          background: var(--bg-panel); border: 1px solid var(--border-strong); color: var(--purple);
          font: 700 var(--fs-xs) var(--font);
        }
        .tv-under { display: flex; justify-content: center; align-items: center; gap: 0.75rem; margin-top: 0.5rem; }
        .tv-map { flex: none; border-radius: 3px; background: var(--bg-panel); border: 1px solid var(--border-strong); }
        .tv-map rect { fill: var(--border-strong); }
        .tv-map .tv-map-seen { fill: var(--accent); }
        .tv-map .tv-map-on { fill: var(--purple); }
        .tv-map .tv-map-view { fill: none; stroke: var(--text); stroke-width: 1; transition: all var(--cam); }
        .tv-zoom {
          display: block; margin: 0; padding: 0.35rem 0.8rem; min-height: 2.75rem;
          border: 1px solid var(--border-strong); border-radius: 4px;
          background: var(--bg-panel); color: var(--text); font: 600 var(--fs-xs) var(--font); cursor: pointer;
        }
        .tv-zoom[aria-pressed='true'] { border-color: var(--accent); color: var(--accent); }
        .tv-node { transition: transform var(--move) cubic-bezier(.4, 0, .2, 1); animation: tv-in var(--move) ease-out; }
        .tv-box { fill: var(--bg-raised); stroke: var(--border-strong); stroke-width: 1; transition: stroke var(--t), fill var(--t); }
        .tv-sep { stroke: var(--border-strong); stroke-width: 1; }
        .tv-key text { fill: var(--text); font: 600 14px var(--font); transition: fill var(--t); }
        .tv-mark { transition: fill var(--t); }
        .tv-visited .tv-box { stroke: var(--accent); stroke-width: 2; }
        .tv-active .tv-box { stroke: var(--purple); stroke-width: 3; fill: color-mix(in oklab, var(--purple) 10%, var(--bg-raised)); }
        .tv-split .tv-box { stroke: var(--pink); stroke-width: 2; stroke-dasharray: 5 3; }
        .tv-overflow .tv-box { stroke: var(--pink); stroke-width: 3; fill: color-mix(in oklab, var(--pink) 14%, var(--bg-raised)); }
        .tv-tag { font: 700 11px var(--font); }
        .tv-tag-over { fill: var(--pink); }
        .tv-cmp .tv-mark { fill: color-mix(in oklab, var(--purple) 34%, var(--bg-raised)); }
        .tv-cmp text { fill: var(--purple); }
        .tv-found .tv-mark, .tv-new .tv-mark { fill: color-mix(in oklab, var(--green) 34%, var(--bg-raised)); }
        .tv-found text, .tv-new text { fill: var(--green); }
        .tv-up .tv-mark { fill: color-mix(in oklab, var(--pink) 34%, var(--bg-raised)); }
        .tv-up text { fill: var(--pink); }
        .tv-scan .tv-mark { fill: color-mix(in oklab, var(--amber) 34%, var(--bg-raised)); }
        .tv-scan text { fill: var(--amber); }
        .tv-edge { fill: none; stroke: var(--border-strong); stroke-width: 1.5; animation: tv-in var(--t) ease-out var(--move) backwards; transition: stroke var(--t); }
        .tv-edge.tv-on { stroke: var(--accent); stroke-width: 3; }
        .tv-link path { fill: none; stroke: var(--muted); stroke-width: 1.5; transition: stroke var(--t); }
        .tv-link .tv-head { fill: var(--muted); stroke: none; }
        .tv-link { animation: tv-in var(--t) ease-out var(--move) backwards; }
        .tv-link.tv-on path { stroke: var(--amber); stroke-width: 3; }
        .tv-link.tv-on .tv-head { fill: var(--amber); }
        @keyframes tv-in { from { opacity: 0; } }
      `}</style>
    </VizFrame>
  );
}

function findIn(n: TreeNode, id: number): TreeNode | undefined {
  if (n.id === id) return n;
  for (const c of n.children) {
    const f = findIn(c, id);
    if (f) return f;
  }
  return undefined;
}
