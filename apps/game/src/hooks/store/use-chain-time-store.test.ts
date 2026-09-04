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
});
