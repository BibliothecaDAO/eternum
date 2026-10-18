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

  // A level 1 realm has one slot of each: the note counts it as one ("All 1 field army slots" before).
  it.each([
    { slots: 1, note: "Your 1 field army slot is in use. Level up the realm or disband an army to raise another." },
    { slots: 3, note: "Your 3 field army slots are in use. Level up the realm or disband an army to raise another." },
  ])("says a cap of $slots plainly, as a note and not an error, with what lifts it", ({ slots, note }) => {
    const html = renderToStaticMarkup(
      <ArmyTypeToggle
        armyType
        canCreateAttackArmy={false}
        canCreateDefenseArmy
        canInteractWithDefense
        currentExplorersCount={slots}
        maxExplorers={slots}
        currentGuardsCount={0}
        maxGuards={1}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain(note);
    expect(html).toContain('role="status"');
    expect(html).not.toContain("text-danger");
  });

  it.each([
    { slots: 1, note: "Your 1 defense slot holds troops. Pick a slot to reinforce it." },
    { slots: 2, note: "Your 2 defense slots hold troops. Pick a slot to reinforce it." },
  ])("counts $slots full defense slots in the same rule", ({ slots, note }) => {
    const html = renderToStaticMarkup(
      <ArmyTypeToggle
        armyType={false}
        canCreateAttackArmy
        canCreateDefenseArmy={false}
        canInteractWithDefense
        currentExplorersCount={0}
        maxExplorers={1}
        currentGuardsCount={slots}
        maxGuards={slots}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain(note);
  });
});
