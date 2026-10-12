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
import { ArmyDeploymentPicker } from "./army-deployment-picker";

afterEach(() => setBlockTimestampSource(null));

describe("the shared deployment picker", () => {
  it("opens on the troop the structure holds, in a game that raises no crossbowmen", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // A realm holding only knights, on a board whose recipes raise only knights.
    const { store } = frontierDay();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <ArmyDeploymentPicker structureId={7} isExplorer />
        </GameProvider>,
      ),
    );
    expect(host.querySelector('[aria-pressed="true"]')?.getAttribute("aria-label")).toMatch(/^Knight T1: /);
    act(() => root.unmount());
    host.remove();
  });
});
