// @vitest-environment jsdom
import { ResourcesIds } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 100 }));
vi.mock("@/ui/features/settlement/construction/realm-build-actions", () => ({
  buildRealmBuilding: vi.fn(),
  resolveRealmHasAvailableBuildingTile: () => true,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { MergedResourcePanel } from "./merged-resource-panel";

const producing = (resourceId: ResourcesIds, timeRemainingSeconds: number | null) => ({
  resourceId,
  totalBuildings: 12,
  activeBuildings: 12,
  isProducing: true,
  timeRemainingSeconds,
  productionPerSecond: 1,
  outputRemaining: null,
});

it("reads each ring's full production in the structure details: a long time left, never running out, none known", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const items = [
    producing(ResourcesIds.Wheat, Number.POSITIVE_INFINITY),
    producing(ResourcesIds.Wood, 1000 * 86_400),
    producing(ResourcesIds.Coal, null),
  ];
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider
        value={{ store: frontierDay().store } as unknown as GameClientSetup}
        account={{ address: "0x111" } as never}
      >
        <MergedResourcePanel
          structureEntityId={7}
          canBuild={false}
          productionSummary={{ items, totalProductionBuildings: 36, activeProductionBuildings: 36 }}
        />
      </GameProvider>,
    ),
  );
  const ring = (name: string) => host.querySelector(`.ui-ring[data-tip="${name}"]`);
  expect(ring("Wheat")?.getAttribute("aria-label")).toBe("Wheat · production never runs out");
  expect(ring("Wood")?.getAttribute("aria-label")).toBe("Wood · 1000d of production left");
  expect(ring("Coal")?.getAttribute("aria-label")).toBe("Coal · producing");
  expect(ring("Wheat")?.querySelector('[data-at="timer"]')).toBeNull();
  expect(ring("Wood")?.querySelector('[data-at="timer"]')?.textContent).toBe("2y");
  expect(ring("Coal")?.querySelector('[data-at="timer"]')).toBeNull();
  act(() => root.unmount());
  host.remove();
});
