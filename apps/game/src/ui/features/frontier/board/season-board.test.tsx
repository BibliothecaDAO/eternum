import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fetchBoard, startVisit } = vi.hoisted(() => ({ fetchBoard: vi.fn(), startVisit: vi.fn() }));
vi.mock("@bibliothecadao/eternum/game-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/game-client")>()),
  fetchHeraldLeaderboard: fetchBoard,
  requireShard: () => ({ url: "https://herald.test" }),
}));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@/hooks/use-player-profile", () => ({ usePlayerDisplayName: (address: string) => `Player ${address}` }));
vi.mock("@/sync/active-game-client", () => ({ startRealmVisit: startVisit }));

import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { configManager } from "@bibliothecadao/eternum";
import { SeasonBoardChip } from "./season-board";

const PLAYER = "0xa38";
const entry = (index: number) => ({
  address: `0x${(0xa00 + index).toString(16)}`,
  structure_id: String(500 + index),
  rank: index + 1,
  sites_cleared: { total: 60 - index, camps: 60 - index, rifts: 0, fallen_realms: 0 },
  chests_earned: 1,
  rewards: { lords: "100", essence: "0", labor: "0" },
  deepest_depth: 0,
  order: (index % 16) + 1,
});

afterEach(() => {
  usePopoverStore.getState().close();
  vi.restoreAllMocks();
});

describe("the season board", () => {
  it("ranks the player on the chip, lists the top fifty with their own row, and visits another realm", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(configManager, "getActiveGameId").mockReturnValue(3);
    useAccountStore.setState({ account: { address: PLAYER } as never });
    let answer!: (board: unknown) => void;
    fetchBoard.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const host = document.createElement("div");
    const root = createRoot(host);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <SeasonBoardChip />
        </QueryClientProvider>,
      ),
    );
    const rank = () => host.querySelector('[aria-label^="Season rank"]')?.getAttribute("aria-label");
    expect(rank()).toBe("Season rank —");

    act(() =>
      answer({ game_id: "3", mode: "frontier", entries: Array.from({ length: 60 }, (_, index) => entry(index)) }),
    );
    // The query settles on its notifier's next ticks; each retry lets React apply them.
    await vi.waitFor(async () => {
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(rank()).toBe("Season rank #57");
    });

    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Season board"]')!.click());
    const rows = host.querySelectorAll('section[aria-label="Season board"] li');
    expect(rows).toHaveLength(51);
    expect(rows[50].textContent).toContain(`Player ${PLAYER}`);
    // The podium wears medals, every row its realm's Order, and the player's own row the gold selected border.
    expect(rows[0].querySelector("svg text")?.textContent).toBe("1");
    expect(rows[3].querySelector("svg text")).toBeNull();
    expect(rows[0].querySelector("img")?.getAttribute("alt")).toBe("Order of Giants");
    expect(rows[50].className).toContain("border-[#f6ac1d]");
    expect(rows[1].className).not.toContain("border-[#f6ac1d]");

    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Visit Player 0xa00\'s realm"]')!.click());
    expect(startVisit).toHaveBeenCalledWith({ player: "0xa00", structureId: 500 });
    expect(host.querySelector('section[aria-label="Season board"]')).toBeNull();
    act(() => root.unmount());
  });
});
