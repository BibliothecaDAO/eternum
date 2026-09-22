import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { hash } from "starknet";
import { beforeEach, describe, expect, it } from "vitest";
import { readHyperstructureConstruction } from "./hyperstructure-state";

let store: NativeFactStore;
const write = (keys: number[], models: Record<string, Record<string, unknown>>) => {
  store.applyFacts(
    Object.entries(models).map(([model, value]) => ({
      model,
      key: hash.computePoseidonHashOnElements(keys),
      value: value as Record<string, unknown>,
    })),
  );
};
const setStage = (stage: string) =>
  write([1, 17], {
    Hyperstructure: { game_id: 1, entity_id: 17, stage, seed: "123", access: "Public" },
  });
const contribute = (amount: bigint) =>
  write([1, 17, 1], {
    HyperstructureProgress: { game_id: 1, entity_id: 17, resource_type: 1, contributed: amount.toString() },
  });
beforeEach(() => {
  store = new NativeFactStore();
  configManager.setActiveGame(1, 1);
  write([1], {
    HyperstructureRules: {
      game_id: 1,
      initialize_shards: "0",
      resources: [{ resource_type: 1, minimum: 1_000_000_001, maximum: 1_000_000_001, points: "1" }],
    },
  });
});

describe("hyperstructure construction from native facts", () => {
  it("shows the foundation before initialization", () => {
    expect(readHyperstructureConstruction(store, 17)).toEqual({ entityId: 17, progress: 0, completed: false });
    setStage("Foundation");
    expect(readHyperstructureConstruction(store, 17).progress).toBe(0);
  });
  it("uses exact contributions without treating full funding as completion", () => {
    setStage("Construction");
    const total = 1_000_000_001n * BigInt(RESOURCE_PRECISION);
    contribute(total / 4n);
    expect(readHyperstructureConstruction(store, 17).progress).toBe(25);
    contribute(total);
    expect(readHyperstructureConstruction(store, 17)).toEqual({ entityId: 17, progress: 100, completed: false });
    setStage("Complete");
    expect(readHyperstructureConstruction(store, 17).completed).toBe(true);
  });
  it("restores completion without contribution rows", () => {
    setStage("Complete");
    expect(readHyperstructureConstruction(store, 17)).toEqual({ entityId: 17, progress: 100, completed: true });
  });
  it("rejects contributions on an uninitialized foundation", () => {
    setStage("Foundation");
    contribute(1n);
    expect(() => readHyperstructureConstruction(store, 17)).toThrow("contributions without resource requirements");
  });
});
