import { expect, test } from "bun:test";
import { phaseStatistics, steadyChainSchedule } from "./blitz-flow";

test("chained offers preserve nonce order, building alternation and the 20.3-action rate", () => {
  const schedule = steadyChainSchedule(120, 3);
  expect(schedule).toHaveLength(2436);
  for (let index = 0; index < schedule.length; index += 3) {
    const chain = schedule.slice(index, index + 3);
    expect(chain.map((slot) => slot.chainPosition)).toEqual([1, 2, 3]);
    expect(new Set(chain.map((slot) => slot.actorIndex)).size).toBe(1);
    expect(new Set(chain.map((slot) => slot.offeredOffsetNs)).size).toBe(1);
  }
  const firstActor = schedule.filter((slot) => slot.actorIndex === 0);
  expect(firstActor.map((slot) => slot.payloadIndex)).toEqual(Array.from({ length: 27 }, (_, index) => index));
  expect(firstActor.slice(0, 6).map((slot) => slot.payloadIndex % 2)).toEqual([0, 1, 0, 1, 0, 1]);
});

test("single-action scheduling retains the original actor and offer cadence", () => {
  const schedule = steadyChainSchedule(120, 1);
  expect(schedule).toHaveLength(2436);
  for (const index of [0, 95, 96, 2435]) {
    expect(schedule[index]).toEqual({
      actorIndex: index % 96,
      payloadIndex: Math.floor(index / 96),
      chainPosition: 1,
      offeredOffsetNs: BigInt(Math.round((index * 1e9) / 20.3)),
    });
  }
  expect(() => steadyChainSchedule(120, 2)).toThrow("Chain length must be 1 or 3");
});

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
