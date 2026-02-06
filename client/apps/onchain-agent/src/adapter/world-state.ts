import type { WorldState } from "@mariozechner/pi-onchain-agent";
import type { EternumClient } from "@bibliothecadao/client";

/**
 * An entity in the Eternum world, representing a structure, army, or realm
 * in a unified format suitable for the autonomous agent framework.
 */
export interface EternumEntity {
  type: "structure" | "army" | "realm";
  entityId: number;
  owner: string;
  position: { x: number; y: number };
  name?: string;
  // Structure-specific
  structureType?: string;
  level?: number;
  // Army-specific
  strength?: number;
  stamina?: number;
  isInBattle?: boolean;
}

/**
 * Extended world state for Eternum, combining the generic WorldState
 * with game-specific player, market, and leaderboard data.
 */
export interface EternumWorldState extends WorldState<EternumEntity> {
  player: {
    address: string;
    name: string;
    structures: number;
    armies: number;
    points: number;
    rank: number;
  };
  market: {
    recentSwapCount: number;
    openOrderCount: number;
  };
  leaderboard: {
    topPlayers: { name: string; points: number; rank: number }[];
    totalPlayers: number;
  };
}

/**
 * Build a snapshot of the Eternum world state by querying all relevant
 * view methods on the client in parallel.
 *
 * @param client - An initialized EternumClient instance
 * @param accountAddress - The player's on-chain address
 * @returns A fully populated EternumWorldState
 */
export async function buildWorldState(
  client: EternumClient,
  accountAddress: string,
): Promise<EternumWorldState> {
  const [playerView, mapAreaView, marketView, leaderboardView] = await Promise.all([
    client.view.player(accountAddress),
    client.view.mapArea({ x: 0, y: 0, radius: 100 }),
    client.view.market(),
    client.view.leaderboard({ limit: 10 }),
  ]);

  const structures = Array.isArray((mapAreaView as any)?.structures) ? (mapAreaView as any).structures : [];
  const armies = Array.isArray((mapAreaView as any)?.armies) ? (mapAreaView as any).armies : [];
  const playerStructures = Array.isArray((playerView as any)?.structures) ? (playerView as any).structures : [];
  const playerArmies = Array.isArray((playerView as any)?.armies) ? (playerView as any).armies : [];
  const recentSwaps = Array.isArray((marketView as any)?.recentSwaps) ? (marketView as any).recentSwaps : [];
  const openOrders = Array.isArray((marketView as any)?.openOrders) ? (marketView as any).openOrders : [];
  const leaderboardEntries = Array.isArray((leaderboardView as any)?.entries)
    ? (leaderboardView as any).entries
    : [];

  // Build entities from map area structures
  const structureEntities: EternumEntity[] = structures.map((s: any) => ({
    type: "structure" as const,
    entityId: s.entityId,
    owner: s.owner,
    position: { x: s.position.x, y: s.position.y },
    name: s.name || undefined,
    structureType: s.structureType,
    level: s.level,
  }));

  // Build entities from map area armies
  const armyEntities: EternumEntity[] = armies.map((a: any) => ({
    type: "army" as const,
    entityId: a.entityId,
    owner: a.owner,
    position: { x: a.position.x, y: a.position.y },
    strength: a.strength,
    stamina: a.stamina,
    isInBattle: a.isInBattle,
  }));

  const entities: EternumEntity[] = [...structureEntities, ...armyEntities];

  // Populate resources from the player's totalResources
  const resources = new Map<string, number>();
  if (Array.isArray((playerView as any)?.totalResources)) {
    for (const r of (playerView as any).totalResources) {
      resources.set(r.name, r.totalBalance);
    }
  }

  return {
    tick: Math.floor(Date.now() / 1000),
    timestamp: Date.now(),
    entities,
    resources,
    player: {
      address: (playerView as any)?.address ?? accountAddress,
      name: (playerView as any)?.name ?? "",
      structures: playerStructures.length,
      armies: playerArmies.length,
      points: Number((playerView as any)?.points ?? 0),
      rank: Number((playerView as any)?.rank ?? 0),
    },
    market: {
      recentSwapCount: recentSwaps.length,
      openOrderCount: openOrders.length,
    },
    leaderboard: {
      topPlayers: leaderboardEntries.map((e: any) => ({
        name: e.name,
        points: e.points,
        rank: e.rank,
      })),
      totalPlayers: Number((leaderboardView as any)?.totalPlayers ?? 0),
    },
  };
}
