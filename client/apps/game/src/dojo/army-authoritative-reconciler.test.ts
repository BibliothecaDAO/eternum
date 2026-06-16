import { describe, expect, it, vi } from "vitest";

const { setEntitiesMock } = vi.hoisted(() => ({
  setEntitiesMock: vi.fn(async () => undefined),
}));

vi.mock("@dojoengine/state", () => ({
  setEntities: setEntitiesMock,
}));

import { ID } from "@bibliothecadao/types";
import { Type, createWorld, defineComponent, getComponentValue, setComponent } from "@dojoengine/recs";
import { ToriiClient } from "@dojoengine/torii-client";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import {
  classifyAuthoritativeSweep,
  isSuspiciousAuthoritativeDeadSet,
  sweepArmiesAgainstTorii,
} from "./army-authoritative-reconciler";

const EXPLORER_TROOPS_MODEL = "s1_eternum-ExplorerTroops";

function makeExplorerTroopsWorld() {
  const world = createWorld();
  const explorerTroops = defineComponent(world, { explorer_id: Type.Number });
  return { world, explorerTroops };
}

function trackArmy(explorerTroops: ReturnType<typeof makeExplorerTroopsWorld>["explorerTroops"], id: number) {
  setComponent(explorerTroops, getEntityIdFromKeys([BigInt(id)]), { explorer_id: id });
}

function makeToriiClient(presentIds: number[]): ToriiClient {
  return {
    getEntities: vi.fn(async () => ({
      items: presentIds.map((id) => ({
        hashed_keys: getEntityIdFromKeys([BigInt(id)]),
        models: { [EXPLORER_TROOPS_MODEL]: { explorer_id: { type: "primitive", value: id } } },
      })),
      next_cursor: undefined,
    })),
  } as unknown as ToriiClient;
}

function makeFailingToriiClient(): ToriiClient {
  return {
    getEntities: vi.fn(async () => {
      throw new Error("torii unavailable");
    }),
  } as unknown as ToriiClient;
}

describe("classifyAuthoritativeSweep", () => {
  it("records a first absence as missing without confirming death", () => {
    const result = classifyAuthoritativeSweep({
      candidateIds: [1, 2] as ID[],
      presentIds: new Set([1] as ID[]),
      previousMissing: new Set(),
    });

    expect(result.confirmedDead).toEqual([]);
    expect([...result.nextMissing]).toEqual([2]);
  });

  it("confirms death only on the second consecutive absence", () => {
    const result = classifyAuthoritativeSweep({
      candidateIds: [1, 2] as ID[],
      presentIds: new Set([1] as ID[]),
      previousMissing: new Set([2] as ID[]),
    });

    expect(result.confirmedDead).toEqual([2]);
    expect(result.nextMissing.size).toBe(0);
  });

  it("drops a reappeared id from the missing set", () => {
    const result = classifyAuthoritativeSweep({
      candidateIds: [2] as ID[],
      presentIds: new Set([2] as ID[]),
      previousMissing: new Set([2] as ID[]),
    });

    expect(result.confirmedDead).toEqual([]);
    expect(result.nextMissing.size).toBe(0);
  });
});

describe("isSuspiciousAuthoritativeDeadSet", () => {
  it("trusts small dead counts even at a high ratio", () => {
    expect(isSuspiciousAuthoritativeDeadSet(3, 4)).toBe(false);
  });

  it("distrusts a mass-death result", () => {
    expect(isSuspiciousAuthoritativeDeadSet(12, 20)).toBe(true);
  });

  it("trusts large dead counts that are a minority of candidates", () => {
    expect(isSuspiciousAuthoritativeDeadSet(12, 100)).toBe(false);
  });
});

describe("sweepArmiesAgainstTorii", () => {
  it("skips entirely with no valid candidates", async () => {
    const { explorerTroops } = makeExplorerTroopsWorld();
    const result = await sweepArmiesAgainstTorii({
      toriiClient: makeToriiClient([]),
      components: [explorerTroops] as never,
      explorerTroopsComponent: explorerTroops as never,
      candidateIds: [-5, 0] as ID[],
      previousMissing: new Set(),
    });

    expect(result.outcome).toBe("skipped_empty");
  });

  it("keeps two-strike state and RECS untouched when the query fails", async () => {
    const { explorerTroops } = makeExplorerTroopsWorld();
    trackArmy(explorerTroops, 42);
    const previousMissing = new Set([42] as ID[]);

    const result = await sweepArmiesAgainstTorii({
      toriiClient: makeFailingToriiClient(),
      components: [explorerTroops] as never,
      explorerTroopsComponent: explorerTroops as never,
      candidateIds: [42] as ID[],
      previousMissing,
    });

    expect(result.outcome).toBe("failed");
    expect(result.confirmedDead).toEqual([]);
    expect(result.nextMissing).toBe(previousMissing);
    expect(getComponentValue(explorerTroops, getEntityIdFromKeys([42n]))).toBeDefined();
  });

  it("marks a missing army on strike one and removes its component on strike two", async () => {
    const { explorerTroops } = makeExplorerTroopsWorld();
    trackArmy(explorerTroops, 42);
    const toriiClient = makeToriiClient([]);

    const first = await sweepArmiesAgainstTorii({
      toriiClient,
      components: [explorerTroops] as never,
      explorerTroopsComponent: explorerTroops as never,
      candidateIds: [42] as ID[],
      previousMissing: new Set(),
    });

    expect(first.outcome).toBe("completed");
    expect(first.confirmedDead).toEqual([]);
    expect([...first.nextMissing]).toEqual([42]);
    expect(getComponentValue(explorerTroops, getEntityIdFromKeys([42n]))).toBeDefined();

    const second = await sweepArmiesAgainstTorii({
      toriiClient,
      components: [explorerTroops] as never,
      explorerTroopsComponent: explorerTroops as never,
      candidateIds: [42] as ID[],
      previousMissing: first.nextMissing,
    });

    expect(second.outcome).toBe("completed");
    expect(second.confirmedDead).toEqual([42]);
    expect(getComponentValue(explorerTroops, getEntityIdFromKeys([42n]))).toBeUndefined();
  });

  it("re-applies present armies and keeps them out of the missing set", async () => {
    setEntitiesMock.mockClear();
    const { explorerTroops } = makeExplorerTroopsWorld();
    trackArmy(explorerTroops, 7);

    const result = await sweepArmiesAgainstTorii({
      toriiClient: makeToriiClient([7]),
      components: [explorerTroops] as never,
      explorerTroopsComponent: explorerTroops as never,
      candidateIds: [7] as ID[],
      previousMissing: new Set([7] as ID[]),
    });

    expect(result.outcome).toBe("completed");
    expect(result.confirmedDead).toEqual([]);
    expect(result.nextMissing.size).toBe(0);
    expect(result.reappliedCount).toBe(1);
    expect(setEntitiesMock).toHaveBeenCalledTimes(1);
    expect(getComponentValue(explorerTroops, getEntityIdFromKeys([7n]))).toBeDefined();
  });

  it("aborts without touching RECS when the dead set looks like a Torii failure", async () => {
    const { explorerTroops } = makeExplorerTroopsWorld();
    const candidateIds = Array.from({ length: 12 }, (_, i) => (i + 1) as ID);
    candidateIds.forEach((id) => trackArmy(explorerTroops, id));

    const result = await sweepArmiesAgainstTorii({
      toriiClient: makeToriiClient([]),
      components: [explorerTroops] as never,
      explorerTroopsComponent: explorerTroops as never,
      candidateIds,
      previousMissing: new Set(candidateIds),
    });

    expect(result.outcome).toBe("aborted_suspicious");
    expect(result.confirmedDead).toEqual([]);
    candidateIds.forEach((id) => {
      expect(getComponentValue(explorerTroops, getEntityIdFromKeys([BigInt(id)]))).toBeDefined();
    });
  });

  it("reports timing for a completed sweep", async () => {
    const { explorerTroops } = makeExplorerTroopsWorld();
    trackArmy(explorerTroops, 7);

    const result = await sweepArmiesAgainstTorii({
      toriiClient: makeToriiClient([7]),
      components: [explorerTroops] as never,
      explorerTroopsComponent: explorerTroops as never,
      candidateIds: [7] as ID[],
      previousMissing: new Set(),
    });

    expect(result.timing.pageCount).toBeGreaterThanOrEqual(1);
    expect(typeof result.timing.totalMs).toBe("number");
    expect(typeof result.timing.maxQueryMs).toBe("number");
    expect(typeof result.timing.maxApplyMs).toBe("number");
  });

  it("treats a query past the per-op timeout as a failure with state unchanged", async () => {
    const { explorerTroops } = makeExplorerTroopsWorld();
    trackArmy(explorerTroops, 99);
    const previousMissing = new Set([99] as ID[]);
    const hangingClient = {
      getEntities: vi.fn(() => new Promise(() => {})),
    } as unknown as ToriiClient;

    const result = await sweepArmiesAgainstTorii({
      toriiClient: hangingClient,
      components: [explorerTroops] as never,
      explorerTroopsComponent: explorerTroops as never,
      candidateIds: [99] as ID[],
      previousMissing,
      queryTimeoutMs: 5,
    });

    expect(result.outcome).toBe("failed");
    expect(result.nextMissing).toBe(previousMissing);
    expect(getComponentValue(explorerTroops, getEntityIdFromKeys([99n]))).toBeDefined();
  });
});
