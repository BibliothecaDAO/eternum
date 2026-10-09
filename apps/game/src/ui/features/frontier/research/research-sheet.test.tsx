import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setBlockTimestampSource, setBuildingCount } from "@bibliothecadao/eternum";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { realmBoard } from "../build/build-fixture";
import { readResearchPlan } from "./research-reader";
import { ResearchSheet } from "./research-sheet";

const PRECISION = BigInt(RESOURCE_PRECISION);

/** The build board's realm with one farm standing, its Farm row priced, and 2,000 Essence to spend. */
const researchBoard = (learned: bigint) => {
  const board = realmBoard();
  const [packed_counts_1, packed_counts_2, packed_counts_3] = setBuildingCount(
    BuildingType.ResourceWheat,
    [0n, 0n, 0n],
    1,
  );
  const price = (tier: number, essence: bigint) => ({
    model: "ResearchPrice",
    key: `0x7${tier}a`,
    value: { game_id: 1, row: 0, tier, essence: String(essence * PRECISION), labor: String(essence * PRECISION) },
  });
  board.store.applyFacts([
    { model: "RealmKnowledge", key: "0x77", value: { game_id: 1, structure_id: 7, learned } },
    price(1, 1_000n),
    price(2, 4_000n),
    {
      model: "StructureBuildings",
      key: "0x72",
      value: {
        game_id: 1,
        entity_id: 7,
        packed_counts_1: String(packed_counts_1),
        packed_counts_2: String(packed_counts_2),
        packed_counts_3: String(packed_counts_3),
        population: { current: 1, max: 6 },
      },
    },
    {
      model: "ResourceBalance",
      key: "0x7c",
      value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Essence, balance: String(2_000n * PRECISION) },
    },
  ] as never);
  return board;
};

afterEach(() => setBlockTimestampSource(null));

describe("research from the realm's facts", () => {
  it("reads each tier's state from the row's tier, with its price and a farm's gain", () => {
    const { store, realm } = researchBoard(0n);
    const plan = readResearchPlan(store, realm, 3)!;
    expect(plan.essence).toBe(2_000);
    expect(plan.nodes.map(({ row, state }) => [row, state])).toEqual([
      [0, "open"],
      [0, "locked"],
    ]);
    const uncommon = plan.nodes[0];
    expect(uncommon.price).toBe(1_000);
    expect(uncommon.gain?.next).toBeCloseTo(uncommon.gain!.now * 1.25, 6);
    store.applyFacts([
      { model: "RealmKnowledge", key: "0x77", value: { game_id: 1, structure_id: 7, learned: 1n } },
    ] as never);
    expect(readResearchPlan(store, realm, 3)!.nodes.map(({ state }) => state)).toEqual(["learned", "open"]);
  });

  it("is unknown until the realm's knowledge is", () => {
    const { store, realm } = researchBoard(0n);
    store.applyFacts([{ model: "RealmKnowledge", key: "0x77", value: null }] as never);
    expect(readResearchPlan(store, realm, 3)).toBeUndefined();
  });

  it("buys an open node the realm can pay for, and never a locked one", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, realm } = researchBoard(0n);
    const research = vi.fn(() => Promise.resolve());
    useUIStore.getState().setSelectedBuildingHex({ structureId: 7, innerCol: 10, innerRow: 10 });
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(<ResearchSheet plan={readResearchPlan(store, realm, 3)!} research={research} onClose={() => {}} />),
    );
    // The workspace takes the screen: the plot the player had tapped is let go.
    expect(useUIStore.getState().selectedBuildingHex).toBeNull();
    const node = (label: string) => host.querySelector<HTMLButtonElement>(`[aria-label^="${label}"]`)!;
    const buy = () => host.querySelector<HTMLButtonElement>('button[aria-label="Research"]')!;
    expect(node("Farm, open").getAttribute("aria-pressed")).toBe("true");
    await act(async () => buy().click());
    expect(research).toHaveBeenCalledWith(expect.objectContaining({ row: 0 }));
    act(() => node("Farm, locked").click());
    expect(buy().disabled).toBe(true);
    act(() => root.unmount());
  });
});
