import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { realmBoard } from "../build/build-fixture";
import { readResearchPlan } from "./research-reader";
import { ResearchSheet } from "./research-sheet";

const PRECISION = BigInt(RESOURCE_PRECISION);

/** The build board's realm with Farm III behind Farm II on its research table, and 200 Essence to spend. */
const researchBoard = (learned: number) => {
  const board = realmBoard();
  board.store.applyFacts([
    { model: "RealmKnowledge", key: "0x77", value: { game_id: 1, structure_id: 7, learned } },
    {
      model: "ResearchNode",
      key: "0x7a",
      value: {
        game_id: 1,
        node: 1,
        prerequisites: 1,
        essence_cost: String(12_000n * PRECISION),
        effect: { BuildingTier: { 0: BuildingType.ResourceWheat, 1: 3 } },
      },
    },
    {
      model: "BuildingTierRule",
      key: "0x7b",
      value: {
        game_id: 1,
        category: BuildingType.ResourceWheat,
        tier: 3,
        labor_upgrade_cost: String(400n * PRECISION),
        output_multiplier_bps: 40_000,
        capacity_multiplier_bps: 10_000,
        population_multiplier_bps: 10_000,
      },
    },
    {
      model: "ResourceBalance",
      key: "0x7c",
      value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Essence, balance: String(200n * PRECISION) },
    },
  ] as never);
  return board;
};

afterEach(() => setBlockTimestampSource(null));

describe("research from the realm's facts", () => {
  it("reads each node's state from what the realm has learned, with its price and a farm's gain", () => {
    const { store, realm } = researchBoard(0);
    const plan = readResearchPlan(store, realm, 3)!;
    expect(plan.essence).toBe(200);
    expect(plan.nodes.map(({ node, state }) => [node, state])).toEqual([
      [0, "open"],
      [1, "locked"],
    ]);
    const farmII = plan.nodes[0];
    expect(farmII.price).toBe(150);
    expect(farmII.gain?.next).toBeCloseTo(farmII.gain!.now * 2, 6);
    store.applyFacts([
      { model: "RealmKnowledge", key: "0x77", value: { game_id: 1, structure_id: 7, learned: 1 } },
    ] as never);
    expect(readResearchPlan(store, realm, 3)!.nodes.map(({ state }) => state)).toEqual(["learned", "open"]);
  });

  it("is unknown until the realm's knowledge is", () => {
    const { store, realm } = researchBoard(0);
    store.applyFacts([{ model: "RealmKnowledge", key: "0x77", value: null }] as never);
    expect(readResearchPlan(store, realm, 3)).toBeUndefined();
  });

  it("buys an open node the realm can pay for, and never a locked one", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, realm } = researchBoard(0);
    const research = vi.fn(() => Promise.resolve());
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(<ResearchSheet plan={readResearchPlan(store, realm, 3)!} research={research} onClose={() => {}} />),
    );
    const node = (label: string) => host.querySelector<HTMLButtonElement>(`[aria-label^="${label}"]`)!;
    const buy = () => host.querySelector<HTMLButtonElement>('button[aria-label="Research"]')!;
    expect(node("Farm, open").getAttribute("aria-pressed")).toBe("true");
    await act(async () => buy().click());
    expect(research).toHaveBeenCalledWith(expect.objectContaining({ node: 0 }));
    act(() => node("Farm, locked").click());
    expect(buy().disabled).toBe(true);
    act(() => root.unmount());
  });
});
