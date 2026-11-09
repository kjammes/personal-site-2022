import { useSyncExternalStore } from 'react';

/**
 * One animation speed shared by every widget on the page.
 * Islands are separate React roots but import this same module, so they share the store.
 */
export const SPEEDS = [0.5, 0.75, 1, 1.5, 2] as const;
const KEY = 'viz-speed';

function read(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return (SPEEDS as readonly number[]).includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

let speed = typeof window === 'undefined' ? 1 : read();
const listeners = new Set<() => void>();

export function setSpeed(v: number) {
  speed = v;
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    /* storage unavailable: keep the in-memory value */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSpeed(): number {
  return useSyncExternalStore(
    subscribe,
    () => speed,
    () => 1,
  );
}

/** Scale a base duration in ms by the current speed; reduced-motion users get near-instant steps. */
export function scaled(ms: number, s: number): number {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return reduced ? Math.min(ms, 120) / s : ms / s;
}
