import { watch, type FSWatcher } from "node:fs";
import { mkdir, readdir, readFile, rename } from "node:fs/promises";
import path from "node:path";

/** Where owner directions come from. M3 backs this with the gateway; until then a directory or a script. */
export interface DirectionSource {
  /** Resolves with the next direction; null once the source is closed. */
  next(): Promise<string | null>;
  close(): void;
}

const DIRECTION_EXTENSION = ".md";
const DONE_DIRECTORY = "done";

/**
 * Every `*.md` dropped into the directory is one direction, taken in name order and moved to `done/` once read, so a
 * restarted runner never replays it.
 */
export const createFileDirectionSource = (directory: string): DirectionSource => {
  let watcher: FSWatcher | null = null;
  let closed = false;
  let onChange: (() => void) | null = null;

  const ensureWatching = async (): Promise<void> => {
    if (watcher) return;
    await mkdir(path.join(directory, DONE_DIRECTORY), { recursive: true });
    watcher = watch(directory, { persistent: false }, () => onChange?.());
  };

  return {
    next: async () => {
      await ensureWatching();
      while (!closed) {
        // Arm before scanning so a file written during the scan still wakes the wait.
        const changed = new Promise<void>((resolve) => {
          onChange = resolve;
        });
        const direction = await takeOldestDirection(directory);
        if (direction !== null) {
          onChange = null;
          return direction;
        }
        await changed;
      }
      return null;
    },
    close: () => {
      closed = true;
      watcher?.close();
      onChange?.();
    },
  };
};

/** Hands out the scripted directions in order, then waits until closed. */
export const createScriptedDirectionSource = (directions: readonly string[]): DirectionSource => {
  const queue = [...directions];
  let closed = false;
  let release: (() => void) | null = null;
  return {
    next: async () => {
      const direction = queue.shift();
      if (direction !== undefined) return direction;
      if (!closed) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return null;
    },
    close: () => {
      closed = true;
      release?.();
    },
  };
};

const takeOldestDirection = async (directory: string): Promise<string | null> => {
  const names = (await readdir(directory)).filter((name) => name.endsWith(DIRECTION_EXTENSION)).sort();
  for (const name of names) {
    const file = path.join(directory, name);
    const text = (await readFile(file, "utf8")).trim();
    await rename(file, path.join(directory, DONE_DIRECTORY, `${Date.now()}-${name}`));
    if (text) return text;
  }
  return null;
};
