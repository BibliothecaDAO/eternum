import { describe, expect, it } from "vitest";
import { learnedResearchNodes, researchedBuildingTier, researchedDepths } from "./realm-research";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

const node = (id: number, effect: NativeRows["ResearchNode"]["effect"]): NativeRows["ResearchNode"] => ({
  game_id: 7,
  node: id,
  prerequisites: 0,
  essence_cost: 1n,
  effect,
});
const store = (learned: number | undefined, nodes: NativeRows["ResearchNode"][]) =>
  ({
    get: () => (learned === undefined ? undefined : { game_id: 7, structure_id: 9, learned }),
    require: (_model: string, keys: { node: number }) => {
      const value = nodes.find((row) => row.node === keys.node);
      if (!value) throw new Error(`Missing ResearchNode ${keys.node}`);
      return value;
    },
  }) as Pick<NativeFactStore, "get" | "require">;

describe("realm research derives unlocked effects from the public bitset", () => {
  it("keeps unknown knowledge unknown and uses the intrinsic tier I only for known knowledge", () => {
    expect(researchedBuildingTier(store(undefined, []), 7, 9, 28)).toBeUndefined();
    expect(researchedDepths(store(undefined, []), 7, 9)).toBeUndefined();
    expect(researchedBuildingTier(store(0, []), 7, 9, 28)).toBe(1);
    expect(researchedDepths(store(0, []), 7, 9)).toEqual([]);
  });
  it("separates building rows and sorts unlocked depths without reading a retired lane", () => {
    const facts = store((1 << 1) | (1 << 2) | (1 << 10) | (1 << 11), [
      node(1, { BuildingTier: { 0: 37, 1: 3 } }),
      node(2, { BuildingTier: { 0: 28, 1: 2 } }),
      node(10, { Depth: 1 }),
      node(11, { Depth: 2 }),
    ]);
    expect(researchedBuildingTier(facts, 7, 9, 37)).toBe(3);
    expect(researchedBuildingTier(facts, 7, 9, 28)).toBe(2);
    expect(researchedBuildingTier(facts, 7, 9, 1)).toBe(1);
    expect(researchedDepths(facts, 7, 9)).toEqual([1, 2]);
  });
  it("refuses a learned bit whose preset node is missing", () => {
    expect(() => learnedResearchNodes(store(1, []), 7, 9)).toThrow("Missing ResearchNode 0");
  });
});
