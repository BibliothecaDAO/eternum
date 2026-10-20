// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => [] }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 3,
  useCurrentArmiesTick: () => 3,
  useCurrentBlockTimestamp: () => 350,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useArmyCreation } from "./unified-army-creation-modal/use-army-creation";

afterEach(() => setBlockTimestampSource(null));

const Probe = () => <p>{useArmyCreation({ structureId: 7, isExplorer: true }).troopSourceLine}</p>;

/** The Military window's empty-state line for the fixture realm's Knights T1, once its 420 run out. */
const sourceLineAfterKnightsRunOut = (store: ReturnType<typeof frontierDay>["store"]) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <Probe />
        </GameProvider>,
      ),
    );
    const whileHeld = host.textContent;
    act(() =>
      store.applyFacts([
        {
          model: "ResourceBalance",
          key: "0x8",
          value: { game_id: 1, entity_id: 7, resource_type: 26, balance: "0" },
        },
      ] as never),
    );
    return { whileHeld, onceGone: host.textContent };
  } finally {
    act(() => root.unmount());
    host.remove();
  }
};

describe("where troops come from, once a realm has none", () => {
  it("names the arena barracks' resource recipe, per troop", () => {
    const { store } = frontierDay();
    // Arena games have no BoardRules, so no board deployment charge.
    store.applyFacts([{ model: "BoardRules", key: "0xa", value: null }] as never);
    // Blitz Knight T1: ten trained from 2 wheat and 0.8 copper; no labor-paid path.
    store.applyFacts([
      {
        model: "ProductionRecipe",
        key: "0xb",
        value: {
          game_id: 1,
          resource_type: 26,
          simple_output: "0",
          simple_inputs: [],
          complex_output: "10000000000",
          complex_inputs: [
            { resource_type: 35, amount: "2000000000" },
            { resource_type: 4, amount: "800000000" },
          ],
        },
      },
    ] as never);
    expect(sourceLineAfterKnightsRunOut(store)).toEqual({
      whileHeld: "",
      onceGone:
        "Knight T1 are trained by a Knight T1 barracks on the realm board, from 0.2 wheat and 0.08 copper each.",
    });
  });

  it("names the labor-paid recipe where a game has no resource recipe", () => {
    // The fixture's Knight T1: one trained from 2 wheat, by the labor-paid (simple) path only.
    const { store } = frontierDay();
    expect(sourceLineAfterKnightsRunOut(store).onceGone).toBe(
      "Knight T1 are trained by a Knight T1 barracks on the realm board, from 2 wheat each.",
    );
  });
});
