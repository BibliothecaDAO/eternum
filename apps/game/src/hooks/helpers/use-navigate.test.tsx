import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { StructureType } from "@bibliothecadao/types";
import { configManager, Position, type GameClient } from "@bibliothecadao/eternum";
import { NativeFactStore, type GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  disposeGameSyncSession,
  installActiveGameClient,
  startRealmVisit,
  useRealmVisit,
} from "@/sync/active-game-client";
import { useGoToStructure } from "./use-navigate";

it("leaves the visit stream and banner when navigating to an owned structure", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, "", "/g/0xa1/1/map");
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(0);
  const store = new NativeFactStore();
  vi.spyOn(store, "get").mockReturnValue({ owner: 0x111n } as never);
  const setup = { store } as GameClientSetup;
  const visit = vi.fn();
  useAccountStore.setState({ account: { address: "0x111" } as never });
  installActiveGameClient({ setup, connect: vi.fn(), dispose: vi.fn(), visit } as unknown as GameClient);
  startRealmVisit({ player: "0x222", structureId: 8, opensOn: "realm" });
  useUIStore.setState({ structureEntityId: 8, isSpectating: true });
  const Probe = () => {
    const go = useGoToStructure(setup);
    const current = useRealmVisit();
    return (
      <button onClick={() => void go(7, Position.fromContract({ x: 4, y: 5 }), true)}>
        {current ? "Visiting" : "Home"}
      </button>
    );
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<Probe />));
  await act(async () => host.querySelector("button")!.click());
  expect(visit).toHaveBeenLastCalledWith(null);
  expect(host.textContent).toBe("Home");
  expect(useUIStore.getState().isSpectating).toBe(false);
  act(() => root.unmount());
  disposeGameSyncSession();
  vi.restoreAllMocks();
});

it("starts a realm visit when opening another player's realm in Frontier and leaves it when returning home", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, "", "/g/0xa1/1/map");
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(0);
  const { store } = frontierDay();
  const home = store.require("Structure", { game_id: 1, entity_id: 7 });
  store.applyFacts([
    {
      model: "Structure",
      key: "0x8",
      value: { ...home, entity_id: 8, owner: "0x222", metadata: { ...home.metadata, realm_id: 2 } },
    },
    {
      model: "Structure",
      key: "0x9",
      value: { ...home, entity_id: 9, owner: "0x0", metadata: { ...home.metadata, realm_id: 3 } },
    },
  ] as never);
  const setup = { store } as GameClientSetup;
  const visit = vi.fn();
  useAccountStore.setState({ account: { address: "0x111" } as never });
  installActiveGameClient({ setup, connect: vi.fn(), dispose: vi.fn(), visit } as unknown as GameClient);
  useUIStore.setState({ structureEntityId: 7, isSpectating: false });
  const Probe = () => {
    const go = useGoToStructure(setup);
    const current = useRealmVisit();
    return (
      <>
        <button data-rival onClick={() => void go(8, Position.fromContract({ x: 8, y: 9 }), false)}>
          Rival
        </button>
        <button data-bandit onClick={() => void go(9, Position.fromContract({ x: 2, y: 2 }), false)}>
          Bandit
        </button>
        <button data-home onClick={() => void go(7, Position.fromContract({ x: 4, y: 5 }), false)}>
          Home
        </button>
        <span data-state>{current ? `${current.player}:${current.structureId}` : "Home"}</span>
      </>
    );
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<Probe />));

  await act(async () => host.querySelector<HTMLButtonElement>("[data-bandit]")!.click());
  expect(visit).not.toHaveBeenCalled();

  await act(async () => host.querySelector<HTMLButtonElement>("[data-rival]")!.click());
  expect(visit).toHaveBeenCalledTimes(1);
  expect(visit).toHaveBeenLastCalledWith("0x222");
  expect(host.querySelector("[data-state]")!.textContent).toBe("0x222:8");

  await act(async () => host.querySelector<HTMLButtonElement>("[data-rival]")!.click());
  expect(visit).toHaveBeenCalledTimes(1);

  await act(async () => host.querySelector<HTMLButtonElement>("[data-home]")!.click());
  expect(visit).toHaveBeenLastCalledWith(null);
  expect(host.querySelector("[data-state]")!.textContent).toBe("Home");
  expect(useUIStore.getState().isSpectating).toBe(false);

  act(() => root.unmount());
  disposeGameSyncSession();
  vi.restoreAllMocks();
});

it("does not start a realm visit in a non-expedition game when opening another player's realm", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, "", "/g/0xa1/1/map");
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(0);
  const store = new NativeFactStore();
  vi.spyOn(store, "get").mockImplementation((model) =>
    model === "Structure"
      ? ({ entity_id: 8n, owner: 0x222n, base: { category: StructureType.Realm } } as never)
      : undefined,
  );
  const setup = { store } as GameClientSetup;
  const visit = vi.fn();
  useAccountStore.setState({ account: { address: "0x111" } as never });
  installActiveGameClient({ setup, connect: vi.fn(), dispose: vi.fn(), visit } as unknown as GameClient);
  const Probe = () => {
    const go = useGoToStructure(setup);
    return <button onClick={() => void go(8, Position.fromContract({ x: 8, y: 9 }), false)}>Rival</button>;
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<Probe />));
  await act(async () => host.querySelector("button")!.click());
  expect(visit).not.toHaveBeenCalled();
  act(() => root.unmount());
  disposeGameSyncSession();
  vi.restoreAllMocks();
});
