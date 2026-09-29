import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { configManager, Position, type GameClient } from "@bibliothecadao/eternum";
import { NativeFactStore, type GameClientSetup } from "@bibliothecadao/eternum/game-client";
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
  startRealmVisit({ player: "0x222", structureId: 8 });
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
