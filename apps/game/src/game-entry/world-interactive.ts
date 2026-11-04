import { useSyncExternalStore } from "react";

/**
 * Whether the player's first view is up and answering (the doorway gone, game-entry:world-interactive). What the first
 * view does not need waits for it, music, ambience, weather and models off the first screen, so a slow link spends
 * itself on the first frame (measured: those took 15 of the 50 s a 1.6 Mbit/s link spent between data and play). The
 * lab, which has no opening, marks it as it starts. It stays set for the life of the page.
 */
let interactive = false;
let waiting: Array<() => void> = [];
const listeners = new Set<() => void>();

export const markWorldInteractive = (): void => {
  if (interactive) return;
  interactive = true;
  const run = waiting;
  waiting = [];
  run.forEach((task) => task());
  listeners.forEach((listener) => listener());
};

export const isWorldInteractive = (): boolean => interactive;

/** Runs `task` now when the world is interactive, else once it is. */
export const afterWorldInteractive = (task: () => void): void => {
  if (interactive) task();
  else waiting.push(task);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useWorldInteractive = (): boolean => useSyncExternalStore(subscribe, isWorldInteractive);
