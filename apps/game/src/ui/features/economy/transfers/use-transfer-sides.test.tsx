import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";

vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ id: "blitz", structure: { getName: () => ({ name: "Home" }) } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 1 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/use-fact-view", () => ({
  useFactView: () => [{ entityId: 11, category: StructureType.Realm, structure: {} }],
}));
vi.mock("@/ui/lib/structure-capabilities", () => ({
  canTransferMilitaryInventoryFromStructure: () => false,
  canTransferMilitaryInventoryBetweenStructures: () => false,
}));
// The realm holds wheat, whose weight rule the game gives, and Essence, whose rule it does not: in production a
// missing rule reads as unknown (undefined), never as a weight.
vi.mock("@bibliothecadao/eternum", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum")>()),
  ResourceManager: class {
    balances = () => [
      { resourceId: ResourcesIds.Wheat, amount: 100 * RESOURCE_PRECISION },
      { resourceId: ResourcesIds.Essence, amount: 300 * RESOURCE_PRECISION },
    ];
  },
  configManager: {
    getResourceWeightKg: (resource: number) => (resource === ResourcesIds.Wheat ? 0.1 : undefined),
    getCapacityConfigKg: () => 50,
  },
}));

const { useTransferSides } = await import("./use-transfer-sides");

it("never weighs a good with no weight rule as zero: it is held, kept out of what can be sent (review P3-2)", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let sides: ReturnType<typeof useTransferSides> = null;
  const Probe = () => {
    sides = useTransferSides(11, []);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  expect(sides!.goods).toEqual([{ resource: ResourcesIds.Wheat, have: 100, weightKg: 0.1 }]);
  expect(sides!.unweighed).toEqual([{ resource: ResourcesIds.Essence, have: 300 }]);
  act(() => root.unmount());
});
