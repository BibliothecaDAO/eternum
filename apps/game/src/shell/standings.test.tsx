import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { board } = vi.hoisted(() => ({ board: { current: null as unknown } }));
vi.mock("./herald", () => ({ useLeaderboard: () => ({ isSuccess: true, isPending: false, data: board.current }) }));
vi.mock("./profiles", () => ({ useProfiles: () => () => null }));

import { Standings } from "./standings";

const season = (address: string, rank: number) => ({
  address,
  structure_id: String(rank),
  rank,
  sites_cleared: { total: 10 - rank, camps: 0, rifts: 0, fallen_realms: 0 },
  chests_earned: 2,
  rewards: { lords: "400", essence: "0", labor: "0" },
  deepest_depth: 1,
  order: 4,
});

describe("a game's standings", () => {
  it("shows a Frontier game's season board, never its points", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    board.current = { game_id: "3", mode: "frontier", entries: [season("0xa1", 1), season("0xa2", 2)] };
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() => root.render(<Standings game={{ chainId: "0x1", gameId: 3 }} highlight="0xa2" limit={1} />));
    expect(host.querySelector('[aria-label="9 sites cleared"]')).not.toBeNull();
    expect(host.querySelector('img[alt="Ethereal 1"]')).not.toBeNull();
    // The top row, then the highlighted player's own row below the limit.
    expect(host.querySelectorAll("li")).toHaveLength(2);
    expect(host.textContent).not.toContain("VP");
    act(() => root.unmount());
  });
});
