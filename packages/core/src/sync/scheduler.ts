export interface GameSyncScheduler {
  schedule(task: () => void): () => void;
}

export const createMicrotaskGameSyncScheduler = (): GameSyncScheduler => ({
  schedule(task) {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) task();
    });
    return () => {
      cancelled = true;
    };
  },
});

interface ManualGameSyncScheduler extends GameSyncScheduler {
  flushNext(): boolean;
  pendingCount(): number;
}

export const createManualGameSyncScheduler = (): ManualGameSyncScheduler => {
  const tasks: Array<{ cancelled: boolean; run: () => void }> = [];

  return {
    schedule(task) {
      const scheduled = { cancelled: false, run: task };
      tasks.push(scheduled);
      return () => {
        scheduled.cancelled = true;
      };
    },
    flushNext() {
      const scheduled = tasks.shift();
      if (!scheduled) return false;
      if (!scheduled.cancelled) scheduled.run();
      return true;
    },
    pendingCount() {
      return tasks.filter(({ cancelled }) => !cancelled).length;
    },
  };
};
