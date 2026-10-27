// @vitest-environment jsdom
import { BuildingType, ResourcesIds, type RealmInfo } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const NOW = 100;
const RATE = 1_000_000n;
/** A realm's productions as the chain holds them: wood with 7h 14m of output left, wheat that never runs out. */
const PRODUCTION = new Map([
  [ResourcesIds.Wood, { seconds: 7 * 3600 + 14 * 60 }],
  [ResourcesIds.Wheat, { seconds: 60 }],
]);

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => NOW }));
// The realm's production bonus row, read as present and empty: no relic is active.
vi.mock("@/hooks/helpers/use-native-facts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useNativeRowOrAbsent: () => ({}),
}));
vi.mock("@/hooks/helpers/use-buildings", () => ({
  useBuildings: () =>
    [
      [BuildingType.ResourceWood, ResourcesIds.Wood],
      [BuildingType.ResourceWheat, ResourcesIds.Wheat],
      [BuildingType.ResourceCoal, ResourcesIds.Coal],
    ].map(([category, resource]) => ({ category, produced: { resource } })),
}));
vi.mock("@/hooks/helpers/use-resources", () => ({
  useResourceManager: () => ({
    current: (resourceId: ResourcesIds) => {
      const production = PRODUCTION.get(resourceId);
      if (!production) return undefined;
      return {
        balance: 0n,
        production: {
          building_count: 1,
          production_rate: RATE,
          output_amount_left: RATE * BigInt(production.seconds),
          last_settled_at: NOW,
        },
      };
    },
  }),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { ProductionSidebar } from "./production-sidebar";

it("reads each ring's full production: the time left, never running out, and none known", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, row } = frontierDay();
  const realm = {
    entityId: 7,
    structure: row,
  } as unknown as RealmInfo;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <ProductionSidebar
          realms={[realm]}
          selectedRealmEntityId={7}
          onSelectRealm={() => undefined}
          onSelectResource={() => undefined}
        />
      </GameProvider>,
    ),
  );
  const rings = [...host.querySelectorAll("button.ui-ring")];
  expect(rings.map((ring) => ring.getAttribute("aria-label"))).toEqual([
    "Wheat · production never runs out",
    "Coal · not producing",
    "Wood · 7h 14m of production left",
  ]);
  expect(rings.map((ring) => ring.querySelector('[data-at="timer"]')?.textContent ?? null)).toEqual([null, null, "7h"]);
  expect(rings.map((ring) => ring.getAttribute("data-tip"))).toEqual(["Wheat", "Coal", "Wood"]);
  act(() => root.unmount());
  host.remove();
});
