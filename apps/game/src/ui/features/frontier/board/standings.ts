import { normalizeLeaderboardAddress } from "@/services/leaderboard/landing-leaderboard-service";
import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

type Entry = HeraldFrontierLeaderboardEntry;

const PRECISION = BigInt(RESOURCE_PRECISION);

/** The viewer's own row, matched by canonical address; none for a spectator or a player without a settled realm. */
const findOwnEntry = (entries: readonly Entry[], viewer: string | null): Entry | undefined => {
  const own = normalizeLeaderboardAddress(viewer);
  return own ? entries.find((entry) => normalizeLeaderboardAddress(entry.address) === own) : undefined;
};

/** The board's first rows in Herald's order, with the viewer's own row after them when it ranks below. */
export const boardRows = (
  entries: readonly Entry[],
  viewer: string | null,
  length: number,
): { entry: Entry; own: boolean }[] => {
  const own = findOwnEntry(entries, viewer);
  const top = entries.slice(0, length);
  const rows = top.map((entry) => ({ entry, own: entry === own }));
  return own && !top.includes(own) ? [...rows, { entry: own, own: true }] : rows;
};

/** The viewer's season rank: undefined while the board loads, null for a viewer without a realm on it. */
export const ownRank = (entries: readonly Entry[] | undefined, viewer: string | null): number | null | undefined =>
  entries && (findOwnEntry(entries, viewer)?.rank ?? null);

/** Essence or labor earned, whole, from Herald's decimal string in resource base units. */
export const wholeResource = (baseUnits: string): number => Number(BigInt(baseUnits) / PRECISION);

/** LORDS won, from Herald's decimal string already in whole LORDS. */
export const wholeLords = (lords: string): number => Number(BigInt(lords));
