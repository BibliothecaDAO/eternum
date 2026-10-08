import { expect, test } from "bun:test";
import { phaseStatistics } from "./blitz-flow";

test("steady latency starts at each actual send and keeps scheduler delay and failures distinct", () => {
  const stats = phaseStatistics([
    {
      hash: "0x1",
      actor: "a",
      game: 1,
      offeredNs: "0",
      sentNs: "500000000",
      receiptNs: "600000000",
      executionStatus: "SUCCEEDED",
    },
    {
      hash: "0x2",
      actor: "b",
      game: 2,
      offeredNs: "0",
      sentNs: "0",
      receiptNs: "700000000",
      executionStatus: "SUCCEEDED",
    },
    { hash: "0x3", actor: "c", game: 3, offeredNs: "0", sentNs: "0", submitError: "refused" },
    { hash: "0x4", actor: "d", game: 4, offeredNs: "0", sentNs: "0" },
    {
      hash: "0x5",
      actor: "e",
      game: 4,
      offeredNs: "0",
      sentNs: "0",
      receiptNs: "800000000",
      executionStatus: "REVERTED",
    },
  ]);
  expect(stats).toEqual({
    offered: 5,
    completed: 3,
    succeeded: 2,
    p50Ms: 700,
    p95Ms: 800,
    worstMs: 800,
    timeouts: 1,
    refusals: 1,
    reverted: 1,
    schedulerDelayP95Ms: 500,
  });
});
