import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore, type GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { GameProvider } from "@/hooks/context/game-context";
import { useChestOpening } from "@/hooks/store/use-chest-opening-store";
import { ChestOpenings } from "./chest-openings";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const hex = { col: 10, row: 20 };
function Receipt() {
  return <p>{useChestOpening(hex)?.title ?? "No opening"}</p>;
}

it("retains a world's paid receipt, then removes it and its listener when that world is left", async () => {
  const host = document.createElement("div"),
    root = createRoot(host);
  const first = new NativeFactStore(),
    second = new NativeFactStore();
  const mount = async (store: NativeFactStore) => {
    await act(async () =>
      root.render(
        <GameProvider value={{ store } as GameClientSetup} account={{ address: "0x111" } as never}>
          <ChestOpenings />
          <Receipt />
        </GameProvider>,
      ),
    );
  };
  const emit = async (store: NativeFactStore, game_id: number, amount: number) => {
    await act(async () =>
      store.applyEvent({
        model: "StoryEvent",
        key: "0xce",
        value: {
          game_id,
          timestamp: 361,
          story: {
            RewardChestOpened: { explorer_id: 7, structure_id: 5, coord: { alt: false, x: 10, y: 20 }, amount },
          },
        },
      }),
    );
  };
  try {
    configManager.setActiveGame(1, 5);
    await mount(first);
    await emit(first, 1, 17);
    expect(host.textContent).toBe("Chest opened: 17 LORDS to its realm");
    configManager.setActiveGame(2, 5);
    await mount(second);
    expect(host.textContent).toBe("No opening");
    await emit(first, 2, 50);
    expect(host.textContent).toBe("No opening");
    await emit(second, 2, 0);
    expect(host.textContent).toBe("Chest expired: no LORDS paid");
  } finally {
    await act(async () => root.unmount());
  }
});
