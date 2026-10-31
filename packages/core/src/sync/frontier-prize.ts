import type { HeraldFrontierLeaderboardEntry } from "./herald-http-types";

/**
 * Who holds Frontier's prize places on a season board, best first: only a player who cleared at least one site is paid
 * (the owner, 30 October 2026), so the board's first `places` entries with a site cleared. The relay posts these at the
 * season's end and the ledger splits the prize over how many there are; the Season page names the same ones.
 */
export const frontierPrizeHolders = <Entry extends Pick<HeraldFrontierLeaderboardEntry, "sites_cleared">>(
  entries: readonly Entry[],
  places: number,
): Entry[] => entries.filter((entry) => entry.sites_cleared.total > 0).slice(0, places);
