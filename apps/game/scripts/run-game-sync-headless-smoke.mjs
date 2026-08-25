#!/usr/bin/env node

import {
  GameSyncRuntime,
  WorldSpatialProjection,
  buildGameSyncModelKeysClause,
  createTimerGameSyncScheduler,
  getGameSyncModelsForChannel,
} from "@bibliothecadao/eternum/game-sync";
import { tileOptToTile } from "@bibliothecadao/eternum";
import { TileOccupier, defineContractComponents } from "@bibliothecadao/types";
import { createWorld, getComponentEntities, getComponentValue, removeComponent } from "@dojoengine/recs";
import { createClient } from "@dojoengine/sdk";
import { setEntities } from "@dojoengine/state";

const PAGE_SIZE = 500;
const EVENT_IDENTITY_LIMIT = 512;

const usage = `Usage:
  pnpm --dir apps/game smoke:game-sync-headless -- \\
    --torii-url <url> --world-address <felt> --game-id <number> --col <number> --row <number>

Options:
  --namespace <s2|s1_eternum>       Default: s2
  --watch-ms <milliseconds>         Observe live update rate after hydration (default: 0)
  --expect-occupier-id <number>     Fail unless the decoded tile has this occupier

Environment fallbacks: TORII_URL, WORLD_ADDRESS, GAME_ID, HEX_COL, HEX_ROW,
GAME_NAMESPACE, WATCH_MS, EXPECT_OCCUPIER_ID.`;

const parseArguments = (args) => {
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") return { help: true };
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    values.set(argument.slice(2), value);
    index += 1;
  }

  const resolveValue = (argument, environmentName) => values.get(argument) ?? process.env[environmentName];
  const requiredNumber = (argument, environmentName) => {
    const raw = resolveValue(argument, environmentName);
    const value = Number(raw);
    if (!raw || !Number.isFinite(value)) throw new Error(`Missing or invalid --${argument}`);
    return value;
  };

  const toriiUrl = resolveValue("torii-url", "TORII_URL");
  const worldAddress = resolveValue("world-address", "WORLD_ADDRESS");
  if (!toriiUrl) throw new Error("Missing --torii-url");
  if (!worldAddress) throw new Error("Missing --world-address");

  const namespace = resolveValue("namespace", "GAME_NAMESPACE") ?? "s2";
  if (namespace !== "s2" && namespace !== "s1_eternum") throw new Error(`Unsupported namespace: ${namespace}`);

  const expectedOccupier = resolveValue("expect-occupier-id", "EXPECT_OCCUPIER_ID");
  return {
    toriiUrl,
    worldAddress,
    namespace,
    gameId: requiredNumber("game-id", "GAME_ID"),
    col: requiredNumber("col", "HEX_COL"),
    row: requiredNumber("row", "HEX_ROW"),
    watchMs: Number(resolveValue("watch-ms", "WATCH_MS") ?? 0),
    expectedOccupierId: expectedOccupier === undefined ? undefined : Number(expectedOccupier),
  };
};

const qualify = (namespace, model) => `${namespace}-${model}`;

const buildChannelClause = (channel, config) =>
  buildGameSyncModelKeysClause(
    getGameSyncModelsForChannel(channel, { includeS2Only: config.namespace === "s2" }).map((model) => ({
      model: qualify(config.namespace, model.name),
      scopedKey: config.namespace === "s2" && model.s2Scope === "game" ? `0x${config.gameId.toString(16)}` : undefined,
    })),
  );

const createComponentLookup = (components) =>
  new Map(components.map((component) => [`${component.metadata?.namespace}-${component.metadata?.name}`, component]));

const createRecsStore = (world, components) => {
  const componentLookup = createComponentLookup(components);
  const removeModels = (entityId, models) => {
    models.forEach((model) => {
      const component = componentLookup.get(model);
      if (component) removeComponent(component, entityId);
    });
  };

  return {
    async applyEntityOperations(operations) {
      for (const operation of operations) {
        if (operation.type === "upsert") await setEntities(operation.entities, components, false);
        else if (operation.type === "delete-entity") world.deleteEntity(operation.entityId);
        else removeModels(operation.entityId, operation.models);
      }
    },
    async applyEvent(event) {
      await setEntities([event], components, false);
      removeModels(event.hashed_keys, Object.keys(event.models));
    },
    listModelEntityIds(model) {
      const component = componentLookup.get(model);
      return component ? getComponentEntities(component) : [];
    },
  };
};

const createTransport = (client, entityClause, eventClause, entityModels) => ({
  async subscribe(handlers) {
    const [entitySubscription, eventSubscription] = await Promise.all([
      client.onEntityUpdated(entityClause, handlers.onEntity),
      client.onEventMessageUpdated(eventClause, handlers.onEvent),
    ]);
    return {
      cancel() {
        entitySubscription.cancel();
        eventSubscription.cancel();
      },
    };
  },
  async fetchSnapshotPage(cursor) {
    const page = await client.getEntities({
      pagination: { limit: PAGE_SIZE, cursor, direction: "Forward", order_by: [] },
      clause: entityClause,
      no_hashed_keys: false,
      models: entityModels,
      historical: false,
    });
    return { items: page.items, nextCursor: page.next_cursor };
  },
});

const findHexOccupancy = (tileOptComponent, col, row) => {
  for (const entityId of getComponentEntities(tileOptComponent)) {
    const tileOpt = getComponentValue(tileOptComponent, entityId);
    if (!tileOpt || Number(tileOpt.col) !== col || Number(tileOpt.row) !== row) continue;
    const tile = tileOptToTile(tileOpt);
    return {
      tileEntityId: entityId,
      col: tile.col,
      row: tile.row,
      occupierId: tile.occupier_id,
      occupierType: tile.occupier_type,
    };
  }
  throw new Error(`No TileOpt row found at (${col}, ${row})`);
};

const verifyChestProjection = (projection, occupancy) => {
  const projectedChestSnapshot = projection.getChests();
  const projectedChests = projection.getChestsAtHex({ col: occupancy.col, row: occupancy.row });
  const expectedChestId = occupancy.occupierType === TileOccupier.Chest ? occupancy.occupierId : undefined;
  const matchesOccupancy = projectedChests.some(({ entityId }) => entityId === expectedChestId);

  if (expectedChestId !== undefined && !matchesOccupancy) {
    throw new Error(`Projection is missing chest ${expectedChestId} at (${occupancy.col}, ${occupancy.row})`);
  }
  if (expectedChestId === undefined && projectedChests.length > 0) {
    throw new Error(`Projection contains a chest on non-chest tile (${occupancy.col}, ${occupancy.row})`);
  }

  return {
    chestCount: projectedChestSnapshot.length,
    chestsAtCoordinate: projectedChests,
    sampleChest: projectedChestSnapshot[0] ?? null,
  };
};

const verifyArmyProjection = (projection, explorerTroopsComponent) => {
  const expectedArmies = Array.from(getComponentEntities(explorerTroopsComponent)).flatMap((entityId) => {
    const explorerTroops = getComponentValue(explorerTroopsComponent, entityId);
    if (!explorerTroops || explorerTroops.coord.alt || explorerTroops.troops.count <= 0n) return [];
    return [
      {
        entityId: explorerTroops.explorer_id,
        col: Number(explorerTroops.coord.x),
        row: Number(explorerTroops.coord.y),
      },
    ];
  });
  const projectedArmies = projection.getArmies();

  if (projectedArmies.length !== expectedArmies.length) {
    throw new Error(`Projection contains ${projectedArmies.length} armies; expected ${expectedArmies.length}`);
  }
  for (const expected of expectedArmies) {
    const projected = projection.getArmy(expected.entityId);
    if (projected?.hexCoords.col !== expected.col || projected.hexCoords.row !== expected.row) {
      throw new Error(`Projection has stale coordinates for army ${expected.entityId}`);
    }
  }

  return {
    armyCount: projectedArmies.length,
    sampleArmy: projectedArmies[0] ?? null,
  };
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const run = async (config) => {
  const world = createWorld();
  const contractComponents = defineContractComponents(world, config.namespace);
  const components = Object.values(contractComponents);
  const entityDefinitions = getGameSyncModelsForChannel("gamewide-entity", {
    includeS2Only: config.namespace === "s2",
  });
  const entityModels = entityDefinitions.map(({ name }) => qualify(config.namespace, name));
  const entityClause = buildChannelClause("gamewide-entity", config);
  const eventClause = buildChannelClause("global-event", config);
  const toriiProvider = await createClient({ toriiUrl: config.toriiUrl, worldAddress: config.worldAddress });
  const runtime = new GameSyncRuntime();

  try {
    await runtime.startSession({
      transport: createTransport(toriiProvider, entityClause, eventClause, entityModels),
      store: createRecsStore(world, components),
      snapshotModels: entityModels,
      scheduler: createTimerGameSyncScheduler(),
      eventIdentityLimit: EVENT_IDENTITY_LIMIT,
    });
    const projection = new WorldSpatialProjection({
      tileOptComponent: contractComponents.TileOpt,
      explorerTroopsComponent: contractComponents.ExplorerTroops,
    });
    runtime.installWorldSpatialProjection(projection);
    if (config.watchMs > 0) await delay(config.watchMs);

    const occupancy = findHexOccupancy(contractComponents.TileOpt, config.col, config.row);
    if (config.expectedOccupierId !== undefined && occupancy.occupierId !== config.expectedOccupierId) {
      throw new Error(`Expected occupier ${config.expectedOccupierId}, received ${occupancy.occupierId}`);
    }
    const spatialProjection = {
      ...verifyChestProjection(projection, occupancy),
      ...verifyArmyProjection(projection, contractComponents.ExplorerTroops),
    };
    console.log(
      JSON.stringify(
        { status: runtime.getStatus(), occupancy, spatialProjection, metrics: runtime.getMetrics() },
        null,
        2,
      ),
    );
  } finally {
    runtime.dispose();
  }
};

try {
  const config = parseArguments(process.argv.slice(2));
  if (config.help) console.log(usage);
  else await run(config);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(usage);
  process.exitCode = 1;
}
