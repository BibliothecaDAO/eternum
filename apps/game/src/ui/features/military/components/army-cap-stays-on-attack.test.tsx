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
import { renderToStaticMarkup } from "react-dom/server";
import { ArmyTypeToggle } from "./unified-army-creation-modal/army-type-toggle";
import { useArmyCreation } from "./unified-army-creation-modal/use-army-creation";

afterEach(() => setBlockTimestampSource(null));

const Probe = () => {
  const army = useArmyCreation({ structureId: 7, isExplorer: true });
  return <p>{army.armyType ? "Attack" : "Defense"}</p>;
};

describe("the Military window once the field army cap is full", () => {
  it("stays on Attack, where the army just raised is, instead of moving to Defense", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    // No field army slot left to fill (the realm's cap reached) and one defense slot free.
    store.applyFacts([
      {
        model: "Structure",
        key: "0x7",
        value: { ...row, base: { ...row.base, troop_max_explorer_count: 0, troop_max_guard_count: 1 } },
      },
    ] as never);
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
      expect(host.textContent).toBe("Attack");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("says the cap plainly, as a note and not an error, with what lifts it", () => {
    const html = renderToStaticMarkup(
      <ArmyTypeToggle
        armyType
        canCreateAttackArmy={false}
        canCreateDefenseArmy
        canInteractWithDefense
        currentExplorersCount={1}
        maxExplorers={1}
        currentGuardsCount={0}
        maxGuards={1}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain(
      "All 1 field army slots are in use. Level up the realm or disband an army to raise another.",
    );
    expect(html).toContain('role="status"');
    expect(html).not.toContain("text-danger");
  });
});
