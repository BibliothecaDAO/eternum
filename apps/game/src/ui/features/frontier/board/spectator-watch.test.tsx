import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { startVisit, leader, board } = vi.hoisted(() => {
  const leader = { address: "0xa1", structure_id: "7" };
  return { startVisit: vi.fn(), leader, board: { data: [leader] as unknown[] } };
});
vi.mock("./season-board", () => ({ useSeasonBoard: () => board }));
vi.mock("@/sync/active-game-client", () => ({ startRealmVisit: startVisit, useRealmVisit: () => null }));

import { resetEntryDestination, whenEntryDestinationSettled } from "@/game-entry/entry-destination";
import { accountAddress, useAccountStore } from "@/hooks/store/use-account-store";
import { overrideSpectateIntent } from "@/utils/spectator-session";
import { useSpectatorWatchesTheLeader } from "./spectator-watch";

const Hud = () => {
  useSpectatorWatchesTheLeader();
  return null;
};

const mount = () => {
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Hud />));
  return () => act(() => root.unmount());
};

describe("a spectator", () => {
  it("watches the season's leader, while a signed-in player is never moved", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useAccountStore.setState({ account: { address: "0x111" } as never });
    mount()();
    expect(startVisit).not.toHaveBeenCalled();

    useAccountStore.setState({ account: null });
    mount()();
    expect(startVisit).toHaveBeenCalledWith({ player: "0xa1", structureId: 7, opensOn: "map" });
  });

  it("leaves the map nothing to open on when the season has no leader to watch", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    resetEntryDestination();
    useAccountStore.setState({ account: null });
    board.data = [];
    startVisit.mockClear();

    mount()();

    expect(startVisit).not.toHaveBeenCalled();
    await expect(whenEntryDestinationSettled()).resolves.toBeNull();
    board.data = [leader];
  });

  describe("entered to spectate while an account is still held", () => {
    const enterToSpectate = () => {
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      resetEntryDestination();
      useAccountStore.setState({ account: { address: "0x111" } as never });
      overrideSpectateIntent(true);
      startVisit.mockClear();
      expect(accountAddress()).toBeNull();
    };

    it("watches the season's leader", () => {
      enterToSpectate();
      try {
        mount()();
        expect(startVisit).toHaveBeenCalledWith({ player: "0xa1", structureId: 7, opensOn: "map" });
      } finally {
        overrideSpectateIntent(false);
      }
    });

    it("leaves the map nothing to open on when the season has no leader", async () => {
      enterToSpectate();
      board.data = [];
      try {
        mount()();
        expect(startVisit).not.toHaveBeenCalled();
        await expect(whenEntryDestinationSettled()).resolves.toBeNull();
      } finally {
        overrideSpectateIntent(false);
        board.data = [leader];
      }
    });
  });

  it("opens the watched realm only when the address names no place", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useAccountStore.setState({ account: null });
    startVisit.mockClear();
    const entered = window.location.href;
    try {
      window.history.replaceState(null, "", "/g/0x4445/1/map?col=-1968759586&row=-2000471286&spectate=true");
      mount()();
      expect(startVisit).toHaveBeenCalledWith({ player: "0xa1", structureId: 7, opensOn: null });

      window.history.replaceState(null, "", "/g/0x4445/1/map?spectate=true");
      mount()();
      expect(startVisit).toHaveBeenLastCalledWith({ player: "0xa1", structureId: 7, opensOn: "map" });
    } finally {
      window.history.replaceState(null, "", entered);
    }
  });
});
