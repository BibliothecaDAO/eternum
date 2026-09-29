import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => 350, useCurrentArmiesTick: () => 3 }));
vi.mock("@/audio/unit-command-audio", () => ({ playUnitCommandSound: () => {} }));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { campBeside, SITE, SITE_TILE } from "./site-fixture";
import { TileCard } from "./tile-card";

afterEach(() => {
  setBlockTimestampSource(null);
  useUIStore.getState().updateEntityActionSelectedEntityId(null);
});

describe("the tile card", () => {
  it("attacks the site's guard with the selected army, and stays disabled with no army in reach", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, site, structure } = campBeside();
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: "0x75",
        value: { game_id: 1, alt: false, col: 41, row: 12, entity_id: 201, category: 15, is_structure: false },
      },
    ] as never);
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const attack = vi.fn(() => Promise.resolve());
    const tile = { hexCoords: SITE_TILE, biome: 11, occupierId: SITE } as unknown as TileSpatialRenderable;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { attack_explorer_vs_guard: attack } } as unknown as GameClientSetup}
          account={{ address: "0x111" } as never}
        >
          <TileCard selected={{ site, structure, tile }} onClose={() => {}} />
        </GameProvider>,
      ),
    );
    const button = () =>
      [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("Attack"))!;
    expect(host.querySelector('[aria-label="Knight T1 1,100"] .frontier-tier')?.textContent).toBe("I");
    expect(button().disabled).toBe(true);

    act(() => useUIStore.getState().updateEntityActionSelectedEntityId(201));
    expect(button().disabled).toBe(false);
    await act(async () => button().click());
    expect(attack).toHaveBeenCalledWith(expect.objectContaining({ explorer_id: 201, structure_id: SITE }));
    act(() => root.unmount());
    host.remove();
  });
});
