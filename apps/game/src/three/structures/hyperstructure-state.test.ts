import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { configManager } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { hash } from "starknet";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deepSitesScenario } from "@/lab/game/deep-sites-scenario";
import { chainOf } from "@/lab/game/lab-chain";
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

describe("a Season 1 hyperstructure, built by its Aspect's height", () => {
  it("stands each Aspect's tower by the stages its height has built: a fifth of the tower a stage", () => {
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
    const chain = chainOf(deepSitesScenario());
    // Might 4,100 (stage 2), Harmony 2,500 (1), Chaos 6,000 (3), Guile 8,200 (4): entities 0x1ad01 to 0x1ad04.
    expect([1, 2, 3, 4].map((aspect) => readHyperstructureConstruction(chain, 0x1ad00 + aspect))).toEqual([
      { entityId: 0x1ad01, progress: 40, completed: false },
      { entityId: 0x1ad02, progress: 20, completed: false },
      { entityId: 0x1ad03, progress: 60, completed: false },
      { entityId: 0x1ad04, progress: 80, completed: false },
    ]);
    // A hyperstructure no Aspect builds keeps the resources given to it: the depth proof's, none given.
    expect(readHyperstructureConstruction(chain, 903)).toEqual({ entityId: 903, progress: 0, completed: false });
    vi.restoreAllMocks();
  });
});
