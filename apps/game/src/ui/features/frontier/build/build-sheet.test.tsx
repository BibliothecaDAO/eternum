import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: () => Promise.resolve(null) }) },
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { disposeGameSyncSession, installActiveGameClient } from "@/sync/active-game-client";
import { type GameClient, markedPlot, setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { BuildingType } from "@bibliothecadao/types";
import { realmBoard } from "./build-fixture";
import { BuildSheet } from "./build-sheet";

afterEach(() => {
  disposeGameSyncSession();
  setBlockTimestampSource(null);
  useUIStore.getState().setPreviewBuilding(null);
});

describe("the build sheet", () => {
  it("stands the chosen building on the plot as a ghost, builds it there and takes the ghost away", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, realm } = realmBoard();
    const plot = markedPlot(1, 1);
    const placeBuilding = vi.fn(() => Promise.resolve());
    installActiveGameClient({
      connect() {},
      disconnect() {},
      dispose() {},
      actions: { placeBuilding },
    } as unknown as GameClient);
    const onClose = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <BuildSheet realm={realm} plot={plot} onClose={onClose} />
        </GameProvider>,
      ),
    );
    const card = (name: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
    expect(card("Farm").getAttribute("aria-pressed")).toBe("true");
    expect(useUIStore.getState().previewBuilding).toEqual({ type: BuildingType.ResourceWheat, plot });
    // The ring's marked plot doubles every card, and a farm's wheat after is good news.
    expect(card("Farm").querySelector('[aria-label="Doubled on this plot"]')).not.toBeNull();
    expect(card("Farm").querySelector('[aria-label^="Wheat an hour after"]')?.getAttribute("data-tone")).toBe("gain");
    expect(card("Hut").querySelector('[aria-label^="Wheat an hour after"]')).toBeNull();

    act(() => card("Barracks").click());
    expect(useUIStore.getState().previewBuilding).toEqual({ type: BuildingType.ResourceKnightT1, plot });
    act(() => card("Farm").click());

    const build = [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Build"))!;
    await act(async () => build.click());
    expect(placeBuilding).toHaveBeenCalledWith(
      expect.objectContaining({ structureId: 7, buildingType: BuildingType.ResourceWheat, hex: plot }),
    );
    expect(onClose).toHaveBeenCalledOnce();
    act(() => root.unmount());
    expect(useUIStore.getState().previewBuilding).toBeNull();
    host.remove();
  });
});
