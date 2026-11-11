/**
 * Lets a button in the article load a specific case into a tree widget: rebuild the starting tree,
 * run some setup operations silently, then play or step through one operation.
 *
 * Islands are separate React roots but import this same module, so they share the store (as speed.ts
 * does). A widget with `client:visible` may not have hydrated yet when the button is pressed, so the
 * request waits here until the widget mounts and picks it up.
 */
import type { TreeScriptOp } from './TreeViz';

export type CaseMode = 'play' | 'step';

export type CaseRequest = {
  /** Matches the widget's `caseId`. */
  widget: string;
  /** Applied quietly to a fresh tree before the shown operation. Insert and delete only. */
  setup: TreeScriptOp[];
  op: TreeScriptOp;
  mode: CaseMode;
  /** Short name of the case, shown in the widget. */
  label: string;
  /** Element to send the reader back to when they are done. */
  returnTo?: string;
};

type Listener = (r: CaseRequest) => void;
const listeners = new Map<string, Listener>();
const pending = new Map<string, CaseRequest>();

export function requestCase(r: CaseRequest) {
  const l = listeners.get(r.widget);
  if (l) l(r);
  else pending.set(r.widget, r);
}

/** The widget calls this on mount. A request made before it hydrated is delivered right away. */
export function listenForCases(widget: string, l: Listener) {
  listeners.set(widget, l);
  const waiting = pending.get(widget);
  if (waiting) {
    pending.delete(widget);
    l(waiting);
  }
  return () => {
    if (listeners.get(widget) === l) listeners.delete(widget);
  };
}

/**
 * Parse the article's short syntax: operations separated by semicolons, such as
 * "insert 44; delete 82", "search 38" or "range 20 60".
 */
export function parseOps(src: string): TreeScriptOp[] {
  return src
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [op, a, b] = s.split(/\s+/);
      const x = Number(a);
      if (op === 'range') return { op, from: x, to: Number(b) };
      if (op === 'search' || op === 'insert' || op === 'delete') return { op, v: x };
      throw new Error(`Unknown tree operation: "${s}"`);
    });
}

/** Element id of the widget's frame, used to scroll to it. */
export const widgetDomId = (widget: string) => `viz-${widget}`;
