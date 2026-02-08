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
  // Structure detail (from realm view)
  guardSlots?: { troopType: string; count: number; tier: number }[];
  guardStrength?: number;
  buildings?: { category: string; position: { x: number; y: number } }[];
  resourceBalances?: { resourceId: number; name: string; balance: number }[];
  // Army-specific
  explorerId?: number;
  strength?: number;
  stamina?: number;
  isInBattle?: boolean;
  // Explorer detail (from explorer view)
  troops?: { totalTroops: number; slots: { troopType: string; count: number; tier: number }[]; strength: number };
  carriedResources?: { resourceId: number; name: string; amount: number }[];
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
  recentEvents?: { eventId: number; eventType: string; timestamp: number; data: Record<string, unknown> }[];
  hyperstructures?: { entityId: number; position: { x: number; y: number }; owner: string | null; progress: number; isComplete: boolean }[];
  banks?: { entityId: number; position: { x: number; y: number } }[];
}

/**
 * Build a snapshot of the Eternum world state by querying all relevant
 * view methods on the client in parallel.
 *
 * Uses `client.view.player()` for the player's own structures/armies (queried by owner),
 * then queries `mapArea` centered on the player's first structure to see nearby entities.
 *
 * @param client - An initialized EternumClient instance
 * @param accountAddress - The player's on-chain address
 * @returns A fully populated EternumWorldState
 */
export async function buildWorldState(
  client: EternumClient,
  accountAddress: string,
): Promise<EternumWorldState> {
  // First fetch player data to know our structure positions
  const [playerView, marketView, leaderboardView] = await Promise.all([
    client.view.player(accountAddress),
    client.view.market(),
    client.view.leaderboard({ limit: 10 }),
  ]);

  const playerStructures = Array.isArray((playerView as any)?.structures) ? (playerView as any).structures : [];
  const playerArmies = Array.isArray((playerView as any)?.armies) ? (playerView as any).armies : [];
  const recentSwaps = Array.isArray((marketView as any)?.recentSwaps) ? (marketView as any).recentSwaps : [];
  const openOrders = Array.isArray((marketView as any)?.openOrders) ? (marketView as any).openOrders : [];
  const leaderboardEntries = Array.isArray((leaderboardView as any)?.entries)
    ? (leaderboardView as any).entries
    : [];

  // Build entities from the player's own structures and armies
  const structureEntities: EternumEntity[] = playerStructures.map((s: any) => ({
    type: "structure" as const,
    entityId: Number(s.entityId ?? s.entity_id ?? 0),
    owner: String(s.owner ?? accountAddress),
    position: {
      x: Number(s.position?.x ?? s.coord_x ?? s.x ?? 0),
      y: Number(s.position?.y ?? s.coord_y ?? s.y ?? 0),
    },
    name: s.name || undefined,
    structureType: String(s.structureType ?? s.category ?? s.structure_type ?? "unknown"),
    level: Number(s.level ?? 1),
  }));

  const armyEntities: EternumEntity[] = playerArmies.map((a: any) => ({
    type: "army" as const,
    entityId: Number(a.entityId ?? a.entity_id ?? 0),
    explorerId: Number(a.explorerId ?? a.explorer_id ?? a.entityId ?? a.entity_id ?? 0),
    owner: String(a.owner ?? accountAddress),
    position: {
      x: Number(a.position?.x ?? a.coord_x ?? a.x ?? 0),
      y: Number(a.position?.y ?? a.coord_y ?? a.y ?? 0),
    },
    strength: Number(a.strength ?? a.guardStrength ?? 0),
    stamina: Number(a.stamina ?? 0),
    isInBattle: Boolean(a.isInBattle ?? a.is_in_battle ?? false),
  }));

  // If we have structures, also query the map area around the first one to see neighbors
  let nearbyEntities: EternumEntity[] = [];
  if (structureEntities.length > 0) {
    const center = structureEntities[0].position;
    try {
      const mapAreaView = await client.view.mapArea({ x: center.x, y: center.y, radius: 50 });
      const mapStructures = Array.isArray((mapAreaView as any)?.structures) ? (mapAreaView as any).structures : [];
      const mapArmies = Array.isArray((mapAreaView as any)?.armies) ? (mapAreaView as any).armies : [];

      // Add non-owned structures from the map (avoid duplicates of our own)
      const ownedEntityIds = new Set(structureEntities.map((e) => e.entityId));
      for (const s of mapStructures) {
        const eid = Number(s.entityId ?? s.entity_id ?? 0);
        if (!ownedEntityIds.has(eid)) {
          nearbyEntities.push({
            type: "structure",
            entityId: eid,
            owner: String(s.owner ?? "0x0"),
            position: {
              x: Number(s.position?.x ?? s.coord_x ?? s.x ?? 0),
              y: Number(s.position?.y ?? s.coord_y ?? s.y ?? 0),
            },
            name: s.name || undefined,
            structureType: String(s.structureType ?? s.category ?? "unknown"),
            level: Number(s.level ?? 1),
          });
        }
      }

      const ownedArmyIds = new Set(armyEntities.map((e) => e.entityId));
      for (const a of mapArmies) {
        const eid = Number(a.entityId ?? a.entity_id ?? 0);
        if (!ownedArmyIds.has(eid)) {
          nearbyEntities.push({
            type: "army",
            entityId: eid,
            owner: String(a.owner ?? "0x0"),
            position: {
              x: Number(a.position?.x ?? a.coord_x ?? a.x ?? 0),
              y: Number(a.position?.y ?? a.coord_y ?? a.y ?? 0),
            },
            strength: Number(a.strength ?? 0),
            stamina: Number(a.stamina ?? 0),
            isInBattle: Boolean(a.isInBattle ?? a.is_in_battle ?? false),
          });
        }
      }
    } catch {
      // Map area query failed; we still have our own entities
    }
  }

  // Enrich player structures with realm detail (guards, buildings, resources)
  for (const entity of structureEntities) {
    try {
      const realmDetail = await client.view.realm(entity.entityId);
      if (realmDetail) {
        const rd = realmDetail as any;
        if (rd.guard?.slots) {
          entity.guardSlots = rd.guard.slots;
          entity.guardStrength = Number(rd.guard.strength ?? 0);
        }
        if (Array.isArray(rd.buildings)) {
          entity.buildings = rd.buildings.map((b: any) => ({
            category: String(b.category ?? b.name ?? "unknown"),
            position: { x: Number(b.position?.x ?? 0), y: Number(b.position?.y ?? 0) },
          }));
        }
        if (Array.isArray(rd.resources)) {
          entity.resourceBalances = rd.resources.map((r: any) => ({
            resourceId: Number(r.resourceId ?? 0),
            name: String(r.name ?? ""),
            balance: Number(r.balance ?? 0),
          }));
        }
      }
    } catch (e) {
      process.stderr.write(`[world-state] realm(${entity.entityId}) failed: ${e}\n`);
    }
  }

  // Enrich player armies with explorer detail (troops, carried resources, stamina)
  for (const entity of armyEntities) {
    try {
      const explorerDetail = await client.view.explorer(entity.explorerId ?? entity.entityId);
      if (explorerDetail) {
        const ed = explorerDetail as any;
        if (ed.explorerId != null) {
          entity.explorerId = Number(ed.explorerId);
        }
        if (ed.troops) {
          entity.troops = {
            totalTroops: Number(ed.troops.totalTroops ?? 0),
            slots: Array.isArray(ed.troops.slots) ? ed.troops.slots : [],
            strength: Number(ed.troops.strength ?? 0),
          };
        }
        if (Array.isArray(ed.carriedResources)) {
          entity.carriedResources = ed.carriedResources.map((r: any) => ({
            resourceId: Number(r.resourceId ?? 0),
            name: String(r.name ?? ""),
            amount: Number(r.amount ?? r.balance ?? 0),
          }));
        }
        if (ed.stamina != null) {
          entity.stamina = Number(ed.stamina);
        }
        if (ed.isInBattle != null) {
          entity.isInBattle = Boolean(ed.isInBattle);
        }
      }
    } catch (e) {
      process.stderr.write(`[world-state] explorer(${entity.explorerId ?? entity.entityId}) failed: ${e}\n`);
    }
  }

  const entities: EternumEntity[] = [...structureEntities, ...armyEntities, ...nearbyEntities];

  // Populate resources from the player's totalResources
  const resources = new Map<string, number>();
  if (Array.isArray((playerView as any)?.totalResources)) {
    for (const r of (playerView as any).totalResources) {
      resources.set(r.name, r.totalBalance);
    }
  }

  // Fetch recent events (limit 10)
  let recentEvents: EternumWorldState["recentEvents"];
  try {
    const eventsView = await client.view.events({ owner: accountAddress, limit: 10 });
    if (eventsView?.events) {
      recentEvents = eventsView.events.map((e: any) => ({
        eventId: Number(e.eventId ?? 0),
        eventType: String(e.eventType ?? "unknown"),
        timestamp: Number(e.timestamp ?? 0),
        data: e.data ?? {},
      }));
    }
  } catch (e) {
    process.stderr.write(`[world-state] events() failed: ${e}\n`);
  }

  // Fetch hyperstructure data from map structures (type = "hyperstructure")
  let hyperstructures: EternumWorldState["hyperstructures"];
  try {
    // Look for hyperstructure-type entities in the nearby structures
    const hsStructures = nearbyEntities.filter(
      (e) => e.type === "structure" && e.structureType === "hyperstructure",
    );
    if (hsStructures.length > 0) {
      hyperstructures = [];
      for (const hs of hsStructures) {
        try {
          const hsView = await client.view.hyperstructure(hs.entityId);
          if (hsView) {
            const hd = hsView as any;
            hyperstructures.push({
              entityId: Number(hd.entityId ?? hs.entityId),
              position: { x: Number(hd.position?.x ?? hs.position.x), y: Number(hd.position?.y ?? hs.position.y) },
              owner: hd.owner ? String(hd.owner) : null,
              progress: Number(hd.progress ?? 0),
              isComplete: Boolean(hd.isComplete ?? false),
            });
          }
        } catch (e) {
          process.stderr.write(`[world-state] hyperstructure(${hs.entityId}) failed: ${e}\n`);
        }
      }
    }
  } catch (e) {
    process.stderr.write(`[world-state] hyperstructure scan failed: ${e}\n`);
  }

  // Collect bank entities from nearby structures
  let banks: EternumWorldState["banks"];
  const bankStructures = nearbyEntities.filter(
    (e) => e.type === "structure" && e.structureType === "bank",
  );
  if (bankStructures.length > 0) {
    banks = bankStructures.map((b) => ({
      entityId: b.entityId,
      position: { x: b.position.x, y: b.position.y },
    }));
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
    recentEvents,
    hyperstructures,
    banks,
  };
}
