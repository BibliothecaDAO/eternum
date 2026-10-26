import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { GameProvider } from "@/hooks/context/game-context";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { ChestTileDetails } from "./chest-tile-details";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
});

it("reads the reserved amount, changes to zero exactly at rollover, and retains Open and the accurate receipt", async () => {
  const { store } = frontierDay();
  store.applyFacts([
    {
      model: "SiteChest",
      key: "0xcce5",
      value: { game_id: 1, entity_id: 9, tier: 0, amount: "17", reservation_day: "0" },
    },
  ] as never);
  useChainTimeStore.setState({ nowMs: 350_000 });
  const host = document.createElement("div");
  const root = createRoot(host);
  unmount = async () => {
    await act(async () => root.unmount());
  };
  const open = vi.fn();
  const render = async (opening: Parameters<typeof ChestTileDetails>[0]["opening"] = null) => {
    await act(async () =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <ChestTileDetails rewardChestId={opening ? undefined : 9} opening={opening} open={{ onOpen: open }} />
        </GameProvider>,
      ),
    );
  };
  await render();
  expect(host.textContent).toContain("17 LORDS");
  expect(host.querySelector('[aria-label="Relics"]')).toBeNull();
  expect(host.querySelector("[data-lords-chest]")?.getAttribute("data-expired")).toBe("false");
  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Open")!.click());
  expect(open).toHaveBeenCalledTimes(1);
  await act(async () => useChainTimeStore.setState({ nowMs: 399_999 }));
  expect(host.textContent).toContain("17 LORDS");
  await act(async () => useChainTimeStore.setState({ nowMs: 400_000 }));
  expect(host.querySelector("[data-lords-chest]")?.getAttribute("data-expired")).toBe("true");
  expect(host.textContent).toContain("0 LORDS");
  expect(host.textContent).toContain("Expired");
  await render({
    kind: "lords",
    amount: 0,
    title: "Chest expired",
    explorerId: 70,
    hex: { x: 0, y: 0 },
    timestamp: 400,
  });
  expect(host.textContent).toContain("No LORDS paid");
  expect(host.querySelector('[aria-label="Relics"]')).toBeNull();
  await render({
    kind: "lords",
    amount: 17,
    title: "Chest opened",
    explorerId: 70,
    hex: { x: 0, y: 0 },
    timestamp: 350,
  });
  expect(host.querySelector("[data-lords-receipt]")?.textContent).toBe("17 LORDS paid to the army's realm");
  expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Open")).toBe(false);
});
