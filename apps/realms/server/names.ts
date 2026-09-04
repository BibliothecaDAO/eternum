import { count, sql } from "drizzle-orm";

import { db } from "@realms-world/db/client";
import { starknet_mmr_updates, user } from "@realms-world/db";
import { normalizeStarknetAddress } from "@realms-world/identity";

/**
 * Name uniqueness is case-insensitive; the functional unique index on
 * lower(name) is the race-proof guarantee and this pre-check only shapes the
 * error. Format rules live in name-rules.ts.
 */
export const isNameTaken = async (name: string, excludeUserId?: string): Promise<boolean> => {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.name}) = lower(${name})`)
    .limit(2);
  return rows.some((row) => row.id !== excludeUserId);
};

/** A user's name is "chosen" once it differs from the address it defaulted to. */
const hasChosenName = (row: { id: string; name: string }): boolean => row.name.toLowerCase() !== row.id.toLowerCase();

export const namesByOwners = async (owners: string[]): Promise<Record<string, string>> => {
  if (owners.length === 0) return {};
  const normalized = owners.map((owner) => normalizeStarknetAddress(owner));
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(sql`${user.id} in ${normalized}`);
  return Object.fromEntries(rows.filter(hasChosenName).map((row) => [row.id, row.name]));
};

interface LeaderboardPlayerRow {
  address: string;
  name: string | null;
  portrait: string | null;
  games: number;
}

/**
 * The ladder's population: every player the MMR event history has seen, with
 * their game count, joined to identity names in memory (both sides store the
 * normalized address, so the join is exact).
 */
export const leaderboardPopulation = async (limit = 500): Promise<LeaderboardPlayerRow[]> => {
  const played = await db
    .select({ player: starknet_mmr_updates.player, games: count() })
    .from(starknet_mmr_updates)
    .groupBy(starknet_mmr_updates.player)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  if (played.length === 0) return [];

  const identities = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(sql`${user.id} in ${played.map((row) => row.player)}`);
  const byAddress = new Map(identities.map((row) => [row.id, row]));

  return played.map((row) => {
    const identity = byAddress.get(row.player);
    return {
      address: row.player,
      name: identity && hasChosenName(identity) ? identity.name : null,
      portrait: identity?.image ?? null,
      games: row.games,
    };
  });
};
