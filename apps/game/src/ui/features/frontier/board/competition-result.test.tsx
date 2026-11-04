import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { HeraldFrontierLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { CompetitionResult } from "./competition-result";
import { SeasonList } from "./season-list";
import { seasonPodium } from "./season-pool";
import { setViewportWidth } from "@/shell/frame/test-viewport";
vi.mock("@/ui/design-system/kit/player-name", () => ({
  PlayerName: ({ account }: { account: string }) => <span>{account}</span>,
}));
const board: HeraldFrontierLeaderboard = {
  game_id: "1",
  mode: "frontier",
  entries: [
    {
      address: "0xa",
      structure_id: "1",
      rank: 1,
      campaign: null,
      sites_cleared: { total: 2, camps: 2, rifts: 0, ruins: 0, beasts: 0 },
      chests_earned: 1,
      rewards: { lords: "10", essence: "0", labor: "0" },
      deepest_depth: 1,
      level: 1,
      order: 1,
    },
  ],
  prize: { pool: "90000", count: null, top_n: 3, awards: [] },
  competition: { status: "live", cutoff: 100, confirmed_at: 99 },
};
it.each([390, 1440])(
  "transitions an open board through confirmation to final without a prize race at %i px",
  (width) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    setViewportWidth(width);
    const host = document.createElement("div");
    const root = createRoot(host);
    const draw = (data: HeraldFrontierLeaderboard, now: number) =>
      act(() =>
        root.render(
          <SeasonList
            rank={null}
            chest={{ lords: 50 }}
            rows={[]}
            state="ready"
            onRetry={vi.fn()}
            onOpen={vi.fn()}
            onClose={vi.fn()}
            competition={<CompetitionResult board={data} endAt={200} confirmedAt={now} />}
          />,
        ),
      );
    try {
      draw(board, 99);
      expect(host.textContent).toContain("Prize competition ends");
      draw(board, 100);
      expect(host.textContent).toContain("Final results are being confirmed");
      expect(host.textContent).not.toContain("0xa");
      const final: HeraldFrontierLeaderboard = {
        ...board,
        competition: { status: "final", cutoff: 100, confirmed_at: 101, confirmed_block: 20, block_hash: "0x20" },
      };
      draw(final, 101);
      expect(host.textContent).toContain("Final results");
      expect(host.textContent).toContain("0xa");
      expect(host.textContent).toContain("90,000");
      expect(host.querySelector('[aria-label="Season prizes"]')).toBeNull();
      expect(host.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("LORDS 50");
      expect(seasonPodium({ ...final, prize: { ...final.prize!, count: 1, awards: [] } })).toEqual([
        { place: 1, lords: 90000, holder: { address: "0xa" } },
      ]);
      expect(seasonPodium({ ...final, entries: [] })).toEqual([]);
    } finally {
      act(() => root.unmount());
    }
  },
);
