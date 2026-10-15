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
import { useAccountStore } from "@/hooks/store/use-account-store";
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
    expect(startVisit).toHaveBeenCalledWith({ player: "0xa1", structureId: 7 });
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
});
