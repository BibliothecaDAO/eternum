import { afterAll } from "vitest";

// The vm pool runs each file in a fresh vm context, but on a worker that runs many files, and Node's performance
// timeline and process belong to the worker. A file starts on an empty timeline, as a fresh page does, and must leave
// process as it found it (file-boundary.test.ts).
performance.clearMarks();
performance.clearMeasures();
performance.clearResourceTimings();

const processAtStart = processState();
afterAll(() => {
  const left = processChanges(processAtStart, processState());
  if (left.length > 0) {
    throw new Error(
      `This file left the test worker's process changed, and the next file on the worker would inherit it: ` +
        `${left.join(", ")}. Restore it before the file ends (vi.unstubAllEnvs, process.off).`,
    );
  }
});

function processState() {
  return {
    env: { ...process.env },
    listeners: new Map(process.eventNames().map((name) => [String(name), process.listenerCount(name)])),
  };
}

function processChanges(before: ReturnType<typeof processState>, after: ReturnType<typeof processState>) {
  const envKeys = new Set([...Object.keys(before.env), ...Object.keys(after.env)]);
  const events = new Set([...before.listeners.keys(), ...after.listeners.keys()]);
  return [
    ...[...envKeys].filter((key) => before.env[key] !== after.env[key]).map((key) => `process.env.${key}`),
    ...[...events]
      .filter((name) => (before.listeners.get(name) ?? 0) !== (after.listeners.get(name) ?? 0))
      .map((name) => `a "${name}" listener on process`),
  ];
}
