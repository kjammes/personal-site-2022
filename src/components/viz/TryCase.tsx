import type { CSSProperties } from 'react';
import { parseOps, requestCase, widgetDomId, type CaseMode } from './cases';
import type { TreeScriptOp } from './TreeViz';
import './viz.css';

type Props = {
  /** The `caseId` of the widget to load the case into. */
  widget: string;
  /** The operation to show, such as "delete 64" or "range 20 60". */
  run: string;
  /** Operations applied quietly to a fresh tree first, separated by semicolons. */
  setup?: string;
  /** Short name of the case, shown in the widget while it runs. */
  label: string;
};

const COLOR: Record<TreeScriptOp['op'], string> = { search: 'blue', insert: 'green', delete: 'pink', range: 'amber' };

const describe = (o: TreeScriptOp) => (o.op === 'range' ? `scan ${o.from} to ${o.to}` : `${o.op} ${o.v}`);

const list = (xs: (number | string)[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** "after deleting 82, 34 and 80", or a count when the list is too long to read. */
function describeSetup(ops: TreeScriptOp[]): string {
  if (!ops.length) return 'on the starting tree';
  const kinds = new Set(ops.map((o) => o.op));
  if (kinds.size === 1 && ops[0].op !== 'range') {
    const verb = ops[0].op === 'insert' ? 'inserting' : ops[0].op === 'delete' ? 'deleting' : 'searching for';
    if (ops.length > 4) return `after ${verb} ${ops.length} other keys`;
    return `after ${verb} ${list(ops.map((o) => (o as { v: number }).v))}`;
  }
  return `after ${ops.length} other operations`;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A pair of buttons in the article that load one case into a tree widget, to watch or to step through. */
export default function TryCase({ widget, run, setup = '', label }: Props) {
  const op = parseOps(run)[0];
  const before = parseOps(setup);
  // Derived from the props, not useId: every island is its own React root, so useId values repeat.
  const id = `try-${widget}-${slug(label)}`;
  const what = `${describe(op)} ${describeSetup(before)}`;

  const go = (mode: CaseMode) => {
    requestCase({ widget, setup: before, op, mode, label, returnTo: id });
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(widgetDomId(widget))?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <span id={id} className="try-case" style={{ '--c': `var(--${COLOR[op.op]})` } as CSSProperties}>
      <button type="button" className="viz-btn try-btn" onClick={() => go('play')} aria-label={`Watch it in the widget: ${label}, ${what}`}>
        <span aria-hidden="true">▶</span> Watch
      </button>
      <button type="button" className="viz-btn try-btn" onClick={() => go('step')} aria-label={`Step through it in the widget: ${label}, ${what}`}>
        Step through
      </button>
      <span className="try-what" aria-hidden="true">
        {what}
      </span>
    </span>
  );
}
