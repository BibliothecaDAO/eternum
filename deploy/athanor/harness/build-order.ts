import { buildArmyPathIndexes, createGameActions, getBlockTimestamp, type GameClient } from "@bibliothecadao/eternum";
import {
  buildRealmProductionPlan,
  buildRealmResourceSnapshot,
  generateBuildablePositions,
  planHasExecutableCalls,
  readBlitzRealmSuggestions,
  type BlitzSuggestionDraft,
} from "@bibliothecadao/eternum/automation";
import { BUILDINGS_CENTER, getNeighborHexes, TroopTier, type ID } from "@bibliothecadao/types";
import type { Account } from "starknet";
import { EXPLORER_TROOP_COUNT, type HarnessGame } from "./harness-game";

export interface BuildOrderAction {
  kind: string;
  run(): Promise<unknown>;
}

export interface BuildOrderWorkload {
  build(signer: Account, realmId: ID): BuildOrderAction | undefined;
  automate(signer: Account, realmId: ID): BuildOrderAction | undefined;
  explorers(realmId: ID): ID[];
}

/** The same build recommendations and Smart production planner used by the player's Attention panel. */
export function createBuildOrderWorkload(client: GameClient, game: HarnessGame): BuildOrderWorkload {
  return {
    build: (signer, realmId) => nextBuildOrderAction(client, game, signer, realmId),
    automate: (signer, realmId) => nextProductionAction(client, signer, realmId),
    explorers: (realmId) => client.views.explorers(realmId).map((army) => army.entityId),
  };
}

function nextBuildOrderAction(client: GameClient, game: HarnessGame, signer: Account, realmId: ID) {
  const tiles = client.views.buildingTiles(realmId);
  const suggestion = readBlitzRealmSuggestions({
    store: client.setup.store,
    realmId,
    realmName: `Realm ${realmId}`,
    isBlitzActive: true,
    tiles,
  })[0];
  if (!suggestion) return undefined;
  const actions = createGameActions(client, { signer });
  if (suggestion.action === "upgrade") {
    return { kind: "upgrade", run: () => client.setup.systemCalls.upgrade_realm({ signer, realm_entity_id: realmId }) };
  }
  if (suggestion.buildingTypeHint !== undefined) {
    const buildingType = suggestion.buildingTypeHint;
    const hex = generateBuildablePositions(Math.max(1, tiles.getRealmLevel(realmId) + 1)).find(
      (spot) => (spot.col !== BUILDINGS_CENTER[0] || spot.row !== BUILDINGS_CENTER[1]) && !tiles.isHexOccupied(spot),
    );
    if (!hex) return undefined;
    return {
      kind: suggestion.action,
      run: () => actions.placeBuilding({ structureId: realmId, buildingType, hex, useSimpleCost: false }),
    };
  }
  return armyBuildOrderAction(client, game, signer, suggestion);
}

function armyBuildOrderAction(
  client: GameClient,
  game: HarnessGame,
  signer: Account,
  suggestion: BlitzSuggestionDraft,
) {
  const realmId = suggestion.realmId;
  const troopType = game.startingTroopType(realmId);
  if (troopType === undefined) return undefined;
  const actions = createGameActions(client, { signer });
  const troops = { structureId: realmId, troopType, troopTier: TroopTier.T1, troopCount: EXPLORER_TROOP_COUNT };
  if (suggestion.action === "garrison") {
    return { kind: "garrison", run: () => actions.addTroopsToGuard({ ...troops, slot: 0 }) };
  }
  if (suggestion.action !== "deploy-explorer") throw new Error(`Unsupported build order: ${suggestion.action}`);
  const coord = game.structureCoord(realmId);
  if (!coord) throw new Error(`Unsynchronized realm ${realmId}`);
  const center = game.mapCenter();
  const indexes = buildArmyPathIndexes(client);
  const spawn = getNeighborHexes(coord.x - center.x, coord.y - center.y).find(
    ({ col, row }) =>
      !indexes.armyHexes.get(col)?.has(row) &&
      !indexes.structureHexes.get(col)?.has(row) &&
      !indexes.chestHexes.get(col)?.has(row),
  );
  if (!spawn) return undefined;
  return {
    kind: "deploy-explorer",
    run: () => actions.createExplorerArmy({ ...troops, spawnDirection: spawn.direction }),
  };
}

function nextProductionAction(client: GameClient, signer: Account, realmId: ID): BuildOrderAction | undefined {
  const now = Date.now();
  const plan = buildRealmProductionPlan({
    realmConfig: {
      realmId: String(realmId),
      entityType: "realm",
      presetId: "smart",
      autoBalance: true,
      customPercentages: {},
      createdAt: now,
      updatedAt: now,
    },
    snapshot: buildRealmResourceSnapshot({
      store: client.setup.store,
      realmId,
      currentTick: getBlockTimestamp().currentDefaultTick,
    }),
  });
  if (!planHasExecutableCalls(plan)) return undefined;
  if (plan.callset.laborToResource.length) throw new Error("Blitz automation must never burn labor");
  return {
    kind: "automate-production",
    run: () =>
      client.setup.systemCalls.execute_realm_production_plan({
        signer,
        realm_entity_id: realmId,
        skipQueue: true,
        resource_to_resource: plan.callset.resourceToResource.map(({ resourceId, cycles }) => ({
          resource_id: resourceId,
          cycles,
        })),
        labor_to_resource: [],
      }),
  };
}
