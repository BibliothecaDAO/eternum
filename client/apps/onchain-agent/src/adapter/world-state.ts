import type { WorldState } from "@bibliothecadao/game-agent";
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

/** Visibility radius (in hexes) around each owned entity. */
const VIEW_RADIUS = 5;

type Pos = { x: number; y: number };

/** Chebyshev distance — true if (x,y) is within `radius` hexes of `center`. */
function withinRadius(pos: Pos, center: Pos, radius: number): boolean {
  return Math.abs(pos.x - center.x) <= radius && Math.abs(pos.y - center.y) <= radius;
}

/** Returns true if `pos` is within VIEW_RADIUS of any position in `centers`. */
function nearAnyOwned(pos: Pos, centers: Pos[]): boolean {
  return centers.some((c) => withinRadius(pos, c, VIEW_RADIUS));
}

/**
 * Build a snapshot of the Eternum world state by querying all relevant
 * view methods on the client in parallel.
 *
 * The map view is the union of VIEW_RADIUS-hex areas around every entity
 * the player owns (structures + explorers). Explorers are owned by their
 * home structure, so we match on the player's structure entity IDs.
 *
 * @param client - An initialized EternumClient instance
 * @param accountAddress - The player's on-chain address
 * @returns A fully populated EternumWorldState
 */
export async function buildWorldState(client: EternumClient, accountAddress: string): Promise<EternumWorldState> {
  // 1. Fetch player data first — we need owned entity positions to scope the map view.
  const [playerView, marketView, leaderboardView] = await Promise.all([
    client.view.player(accountAddress),
    client.view.market(),
    client.view.leaderboard({ limit: 10 }),
  ]);

  const playerStructures = Array.isArray((playerView as any)?.structures) ? (playerView as any).structures : [];
  const playerArmies = Array.isArray((playerView as any)?.armies) ? (playerView as any).armies : [];

  // 2. Collect positions of every entity the player owns.
  const ownedPositions: Pos[] = [
    ...playerStructures.map((s: any) => ({ x: Number(s.position?.x ?? 0), y: Number(s.position?.y ?? 0) })),
    ...playerArmies.map((a: any) => ({ x: Number(a.position?.x ?? 0), y: Number(a.position?.y ?? 0) })),
  ];

  // 3. Compute a bounding box that covers all owned positions + VIEW_RADIUS padding,
  //    then fetch the map area once.  MapArea fetches all data and filters client-side,
  //    so we post-filter to the exact per-entity radii afterwards.
  let mapAreaView: any = { structures: [], armies: [], tiles: [], battles: [] };

  if (ownedPositions.length > 0) {
    const xs = ownedPositions.map((p) => p.x);
    const ys = ownedPositions.map((p) => p.y);
    const minX = Math.min(...xs) - VIEW_RADIUS;
    const maxX = Math.max(...xs) + VIEW_RADIUS;
    const minY = Math.min(...ys) - VIEW_RADIUS;
    const maxY = Math.max(...ys) + VIEW_RADIUS;
    const cx = Math.floor((minX + maxX) / 2);
    const cy = Math.floor((minY + maxY) / 2);
    const r = Math.max(Math.ceil((maxX - minX) / 2), Math.ceil((maxY - minY) / 2));
    mapAreaView = await client.view.mapArea({ x: cx, y: cy, radius: r });
  }

  // 4. Post-filter map entities: only keep things within VIEW_RADIUS of an owned entity.
  const allMapStructures = Array.isArray(mapAreaView?.structures) ? mapAreaView.structures : [];
  const allMapArmies = Array.isArray(mapAreaView?.armies) ? mapAreaView.armies : [];

  const nearbyStructures = allMapStructures.filter((s: any) =>
    nearAnyOwned({ x: Number(s.position?.x ?? 0), y: Number(s.position?.y ?? 0) }, ownedPositions),
  );
  const nearbyArmies = allMapArmies.filter((a: any) =>
    nearAnyOwned({ x: Number(a.position?.x ?? 0), y: Number(a.position?.y ?? 0) }, ownedPositions),
  );

  // 5. Build entities — structures from map view (includes player's own + neighbours).
  const seenIds = new Set<number>();

  const structureEntities: EternumEntity[] = nearbyStructures.map((s: any) => {
    const id = Number(s.entityId ?? 0);
    seenIds.add(id);
    return {
      type: "structure" as const,
      entityId: id,
      owner: String(s.owner ?? ""),
      position: { x: Number(s.position?.x ?? 0), y: Number(s.position?.y ?? 0) },
      name: s.name || undefined,
      structureType: String(s.structureType ?? ""),
      level: Number(s.level ?? 0),
    };
  });

  // Ensure player's own structures are always present even if mapArea missed them.
  for (const s of playerStructures) {
    const id = Number(s.entityId ?? 0);
    if (!seenIds.has(id)) {
      seenIds.add(id);
      structureEntities.push({
        type: "structure" as const,
        entityId: id,
        owner: accountAddress,
        position: { x: Number(s.position?.x ?? 0), y: Number(s.position?.y ?? 0) },
        name: String(s.name ?? ""),
        structureType: String(s.structureType ?? ""),
        level: Number(s.level ?? 0),
      });
    }
  }

  const armyEntities: EternumEntity[] = nearbyArmies.map((a: any) => ({
    type: "army" as const,
    entityId: Number(a.entityId ?? 0),
    owner: String(a.owner ?? ""),
    position: { x: Number(a.position?.x ?? 0), y: Number(a.position?.y ?? 0) },
    strength: Number(a.strength ?? 0),
    stamina: Number(a.stamina ?? 0),
    isInBattle: Boolean(a.isInBattle ?? false),
  }));

  const entities: EternumEntity[] = [...structureEntities, ...armyEntities];

  // 6. Build resource map from ViewClient's totalResources (aggregated across all structures).
  const resources = new Map<string, number>();
  if (Array.isArray((playerView as any)?.totalResources)) {
    for (const r of (playerView as any).totalResources) {
      if (r.totalBalance > 0) {
        resources.set(r.name, r.totalBalance);
      }
    }
  }

  const recentSwaps = Array.isArray((marketView as any)?.recentSwaps) ? (marketView as any).recentSwaps : [];
  const openOrders = Array.isArray((marketView as any)?.openOrders) ? (marketView as any).openOrders : [];
  const leaderboardEntries = Array.isArray((leaderboardView as any)?.entries) ? (leaderboardView as any).entries : [];

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
