import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { startVisit, leader } = vi.hoisted(() => ({
  startVisit: vi.fn(),
  leader: { address: "0xa1", structure_id: "7" },
}));
vi.mock("./season-board", () => ({ useSeasonBoard: () => ({ data: [leader] }) }));
vi.mock("@/sync/active-game-client", () => ({ startRealmVisit: startVisit, useRealmVisit: () => null }));

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
});
