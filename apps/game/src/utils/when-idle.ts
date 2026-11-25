export const whenIdle = (task: () => void): void => {
  const idleCallback = (
    globalThis as typeof globalThis & {
      requestIdleCallback?: (fn: () => void) => number;
    }
  ).requestIdleCallback;

  if (typeof idleCallback === "function") {
    idleCallback(task);
    return;
  }

  globalThis.setTimeout(task, 0);
};
