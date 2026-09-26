import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/unit-command-audio", () => ({ playUnitCommandSound: () => {} }));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { MapSiteCard } from "./map-site-card";
import { campBeside, SITE_TILE } from "./site-fixture";

afterEach(() => useUIStore.getState().updateEntityActionSelectedEntityId(null));

describe("a Well's tile card", () => {
  it("shows the stamina it gives, and uses it with the selected army beside it", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store } = campBeside();
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: "0x75",
        value: { game_id: 1, alt: false, col: 41, row: 12, entity_id: 201, category: 15, is_structure: false },
      },
    ] as never);
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const interact = vi.fn(() => Promise.resolve());
    const tile = { hexCoords: SITE_TILE, occupierType: 41 } as unknown as TileSpatialRenderable;
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { interact_site: interact } } as unknown as GameClientSetup}
          account={{ address: "0x111", account: { address: "0x111" } } as never}
        >
          <MapSiteCard selected={{ kind: "Well", tile }} onClose={() => {}} />
        </GameProvider>,
      ),
    );
    const use = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Use")!;
    expect(host.querySelector('[aria-label="Stamina +60"]')).not.toBeNull();
    expect(use().disabled).toBe(true);

    act(() => useUIStore.getState().updateEntityActionSelectedEntityId(201));
    expect(use().disabled).toBe(false);
    await act(async () => use().click());
    expect(interact).toHaveBeenCalledWith(
      expect.objectContaining({ explorer_id: 201, coord: { alt: false, x: SITE_TILE.col, y: SITE_TILE.row } }),
    );
    act(() => root.unmount());
  });
});
