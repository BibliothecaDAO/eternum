import { expect, it, vi } from "vitest";
const { leaderboard } = vi.hoisted(() => ({ leaderboard: vi.fn() }));
vi.mock("@/runtime/world/herald-http", () => ({ fetchHeraldGameLeaderboard: leaderboard }));
import { fetchLeaderboardActivityBreakdowns } from "./player-activity-breakdown-service";
import type { WorldDeployment } from "@/runtime/world/world-directory";
it("reads Herald's prepared aggregate with one scoped request", async () => {
  const world = { id: "blitz" } as WorldDeployment;
  const entries = [{ address: "0x1", totalPoints: 5, rank: 1 }];
  leaderboard.mockResolvedValue({ game_id: "28", entries });
  expect(await fetchLeaderboardActivityBreakdowns(world, 28)).toBe(entries);
  expect(leaderboard).toHaveBeenCalledOnce();
  expect(leaderboard).toHaveBeenCalledWith(world, 28);
});
