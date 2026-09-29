import { describe, expect, it, vi } from "vitest";

import { DiffLatencyMonitor } from "./diff-latency";

const monitorFixture = () => {
  let now = 0;
  const log = { info: vi.fn(), warn: vi.fn() };
  const monitor = new DiffLatencyMonitor(() => now, log);
  const lines = (spy: typeof log.info) => spy.mock.calls.map(([line]) => JSON.parse(line as string));
  return {
    advance: (ms: number) => {
      now += ms;
    },
    digests: () => lines(log.info),
    monitor,
    warnings: () => lines(log.warn),
  };
};

describe("DiffLatencyMonitor", () => {
  it("warns for a diff slower than 200 ms and stays silent at the threshold", () => {
    const { monitor, warnings } = monitorFixture();

    monitor.record("preconfirmed", 200);
    monitor.record("confirmed", 201);

    expect(warnings()).toEqual([{ durationMs: 201, event: "herald_diff_slow", kind: "confirmed" }]);
  });

  it("digests every kind when a record arrives a window after the window opened", () => {
    const { advance, digests, monitor } = monitorFixture();
    for (let sample = 1; sample <= 98; sample += 1) monitor.record("preconfirmed", sample);
    advance(59_999);
    monitor.record("preconfirmed", 99);
    expect(digests()).toEqual([]);

    advance(1);
    monitor.record("preconfirmed", 100);
    expect(digests()).toEqual([
      {
        count: 100,
        event: "herald_diff_latency_digest",
        kind: "preconfirmed",
        maxMs: 100,
        p50Ms: 50,
        p95Ms: 95,
        windowMs: 60_000,
      },
      { count: 0, event: "herald_diff_latency_digest", kind: "confirmed", windowMs: 60_000 },
    ]);

    advance(59_999);
    monitor.record("preconfirmed", 7);
    expect(digests()).toHaveLength(2);
    advance(1);
    monitor.record("preconfirmed", 9);
    expect(digests().at(-2)).toMatchObject({ count: 2, maxMs: 9, p50Ms: 7, p95Ms: 9, windowMs: 60_000 });
  });

  it("shows a kind with no samples in an active window as a zero count, and stays silent when idle", () => {
    const { advance, digests, monitor } = monitorFixture();
    const digestedKinds = () => digests().map(({ count, kind }) => [kind, count]);

    monitor.record("confirmed", 2);
    advance(60_000);
    monitor.record("confirmed", 4);
    expect(digestedKinds()).toEqual([
      ["preconfirmed", 0],
      ["confirmed", 2],
    ]);

    advance(600_000);
    expect(digests()).toHaveLength(2);
  });

  it("bounds the samples kept for percentiles while counting every diff", () => {
    const { advance, digests, monitor } = monitorFixture();
    for (let index = 0; index < 2_048; index += 1) monitor.record("confirmed", 1);
    for (let index = 0; index < 1_000; index += 1) monitor.record("confirmed", 1_000);

    advance(60_000);
    monitor.record("confirmed", 1_000);

    expect(digests()).toEqual([
      { count: 0, event: "herald_diff_latency_digest", kind: "preconfirmed", windowMs: 60_000 },
      {
        count: 3_049,
        event: "herald_diff_latency_digest",
        kind: "confirmed",
        maxMs: 1,
        p50Ms: 1,
        p95Ms: 1,
        windowMs: 60_000,
      },
    ]);
  });
});
