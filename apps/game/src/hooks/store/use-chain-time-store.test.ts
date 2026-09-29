import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChainTimeStore } from "./use-chain-time-store";

describe("useChainTimeStore", () => {
  let perfNowMs = 0;
  let perfSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    perfNowMs = 0;
    perfSpy = vi.spyOn(performance, "now").mockImplementation(() => perfNowMs);

    useChainTimeStore.setState({
      lastHeartbeat: null,
      executionFloorMs: null,
      anchorTimestampMs: null,
      anchorPerfMs: null,
      nowMs: 0,
    });
  });

  afterEach(() => {
    perfSpy.mockRestore();
  });

  it("keeps logical time monotonic when a heartbeat is newer than last heartbeat but behind extrapolated now", () => {
    useChainTimeStore.setState({
      lastHeartbeat: { timestamp: 1_770_672_600_000 },
      anchorTimestampMs: 1_770_672_600_000,
      anchorPerfMs: 0,
      nowMs: 1_770_672_600_000,
    });

    // Extrapolated now is 1.5s after the last heartbeat.
    perfNowMs = 1_500;

    useChainTimeStore.getState().setHeartbeat({
      timestamp: 1_770_672_601_000,
    });

    // Expected: clamp to extrapolated now to avoid visible rewinds.
    expect(useChainTimeStore.getState().anchorTimestampMs).toBe(1_770_672_601_500);
    expect(useChainTimeStore.getState().nowMs).toBe(1_770_672_601_500);
  });

  it("ignores stale heartbeats that are older than the last accepted heartbeat", () => {
    useChainTimeStore.setState({
      lastHeartbeat: { timestamp: 50_000 },
      anchorTimestampMs: 55_000,
      anchorPerfMs: 100,
      nowMs: 55_000,
    });

    perfNowMs = 1_000;

    useChainTimeStore.getState().setHeartbeat({
      timestamp: 49_999,
    });

    const state = useChainTimeStore.getState();
    expect(state.lastHeartbeat?.timestamp).toBe(50_000);
    expect(state.anchorTimestampMs).toBe(55_000);
    expect(state.nowMs).toBe(55_000);
  });

  it("moves the clock on a pre-confirmed head but raises the execution floor only on confirmed time", () => {
    const store = useChainTimeStore.getState();
    store.anchor({ timestamp: 1_000_000, source: "herald-head" });
    store.setHeartbeat({ timestamp: 1_004_000, source: "herald-clock", preconfirmed: true });
    expect(useChainTimeStore.getState().nowMs).toBe(1_004_000);
    expect(useChainTimeStore.getState().executionFloorMs).toBe(1_000_000);

    // A confirmed head behind the pre-confirmed clock is stale for the clock, yet it is the new floor.
    store.setHeartbeat({ timestamp: 1_002_000, source: "herald-head" });
    expect(useChainTimeStore.getState().nowMs).toBe(1_004_000);
    expect(useChainTimeStore.getState().executionFloorMs).toBe(1_002_000);

    store.setHeartbeat({ timestamp: 1_003_000, source: "row-evidence" });
    expect(useChainTimeStore.getState().executionFloorMs).toBe(1_003_000);
  });
});
