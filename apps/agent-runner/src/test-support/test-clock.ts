import type { Clock } from "../wake";

interface TestClock extends Clock {
  /** Moves time forward, firing due timers in order and letting the promises they trigger settle. */
  advance(ms: number): Promise<void>;
}

interface PendingTimer {
  at: number;
  callback: () => void;
}

export const createTestClock = (): TestClock => {
  let now = 0;
  let nextHandle = 1;
  const timers = new Map<number, PendingTimer>();
  return {
    now: () => now,
    setTimeout: (callback, ms) => {
      const handle = nextHandle++;
      timers.set(handle, { at: now + ms, callback });
      return handle;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
    advance: async (ms) => {
      const target = now + ms;
      for (let due = nextDue(timers, target); due; due = nextDue(timers, target)) {
        timers.delete(due.handle);
        now = due.timer.at;
        due.timer.callback();
        await flush();
      }
      now = target;
      await flush();
    },
  };
};

const nextDue = (timers: Map<number, PendingTimer>, until: number) =>
  [...timers.entries()]
    .filter(([, timer]) => timer.at <= until)
    .sort(([, left], [, right]) => left.at - right.at)
    .map(([handle, timer]) => ({ handle, timer }))[0];

/** Lets the loop's promise chains (wake → observe → prompt → stream) run to their next wait. */
export const flush = async (): Promise<void> => {
  for (let round = 0; round < 8; round++) await new Promise((resolve) => setImmediate(resolve));
};
