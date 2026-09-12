#!/usr/bin/env node
/**
 * Headless game client smoke: boots one game through `createGameClient` (the same composition the web client's
 * bootstrap uses) in plain Node (no DOM, no `ws` package, Node 22's built-in WebSocket) and prints one JSON manifest
 * line with the snapshot/apply timings. M0 item 2 and the M1b/M1c gates in docs/plans/hired-agents-milestones.md.
 *
 * Run from the repo root (`pnpm build:packages` first so packages/*\/dist exists):
 *
 *   pnpm smoke:game-client --game-id 33
 *
 * The world is built from the committed manifest (contracts/l3/game/manifest_<chain>.json) plus the gameplay-account
 * contracts, which come from flags or the same env vars apps/game/.env carries. The lab stack's values live in that
 * .env (VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH, VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS, VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS):
 *
 *   set -a; source apps/game/.env; set +a; pnpm smoke:game-client
 *
 * Offline (the PR gate): replay the captured parity fixture through a fake Herald socket instead of connecting:
 *
 *   pnpm smoke:game-client --fixture packages/core/src/client/recs-game-sync-store.parity.json
 *
 * Either way the manifest prints, and the process exits 1 when the runtime did not reach `running` or no entity
 * reached RECS.
 *
 * Options:
 *   --fixture <path>                      Replay a captured Herald snapshot offline; the game id comes from the
 *                                         fixture's GameRegistry row, so --game-id is not accepted alongside it
 *   --rpc-url <url>                       Chain RPC (default: https://rpc.realms.party)
 *   --herald-url <url>                    Herald base URL (default: https://herald.realms.party)
 *   --chain <name>                        madara | appchain (default: madara)
 *   --game-id <number>                    Game to hydrate; omitted: the first `Live` game in the Herald directory
 *   --player-account-class-hash <felt>    or VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH
 *   --player-registry-address <felt>      or VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS
 *   --binding-authority-address <felt>    or VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS
 *   --timeout-ms <number>                 Give up on the boot after this long (default: 60000)
 *   --watch-ms <number>                   How long to wait for the first live diff after the snapshot (default: 5000)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs as parseNodeArgs } from "node:util";

import { createGameClient, createGameViews } from "@bibliothecadao/eternum";
import { buildWorldDeployment, fetchHeraldGameDirectory, worldConfigKey } from "@bibliothecadao/eternum/game-client";
import {
  createMicrotaskGameSyncScheduler,
  disposeActiveGameSyncRuntime,
  getGameSyncModelsForChannel,
} from "@bibliothecadao/eternum/game-sync";
import { getComponentValue } from "@dojoengine/recs";

// The balance config lives in the config workspace as TypeScript; tsx links it only through a dynamic import.
const { getConfigFromNetwork } = await import("../../../config/utils/utils.ts");

const DEFAULT_RPC_URL = "https://rpc.realms.party";
const DEFAULT_HERALD_URL = "https://herald.realms.party";
const DEFAULT_CHAIN = "madara";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_WATCH_MS = 5_000;
// Every deployed world is the Blitz world for now; the manifest is the one the web client bundles for the chain.
const WORLD_ID = "blitz";
const MANIFEST_BY_CHAIN = {
  madara: "manifest_madara.json",
  appchain: "manifest_appchain_blitz.json",
};
const ACCOUNT_FIELDS = [
  ["playerAccountClassHash", "player-account-class-hash", "VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH"],
  ["playerRegistryAddress", "player-registry-address", "VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS"],
  ["bindingAuthorityAddress", "binding-authority-address", "VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS"],
];

const parseArgs = (args) => {
  const { values } = parseNodeArgs({
    args,
    options: {
      fixture: { type: "string" },
      "rpc-url": { type: "string", default: DEFAULT_RPC_URL },
      "herald-url": { type: "string", default: DEFAULT_HERALD_URL },
      chain: { type: "string", default: DEFAULT_CHAIN },
      "game-id": { type: "string" },
      "player-account-class-hash": { type: "string" },
      "player-registry-address": { type: "string" },
      "binding-authority-address": { type: "string" },
      "timeout-ms": { type: "string", default: String(DEFAULT_TIMEOUT_MS) },
      "watch-ms": { type: "string", default: String(DEFAULT_WATCH_MS) },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  return {
    help: values.help,
    fixturePath: values.fixture,
    rpcUrl: values["rpc-url"],
    heraldUrl: values["herald-url"],
    chain: requireKnownChain(values.chain),
    gameId: resolveRequestedGameId(values),
    ...resolveAccountFields(values),
    timeoutMs: requirePositiveInteger("--timeout-ms", values["timeout-ms"]),
    watchMs: requireNonNegativeInteger("--watch-ms", values["watch-ms"]),
  };
};

const requireKnownChain = (chain) => {
  if (!(chain in MANIFEST_BY_CHAIN)) {
    throw new Error(`--chain must be one of ${Object.keys(MANIFEST_BY_CHAIN).join(", ")}; received ${chain}`);
  }
  return chain;
};

/** A fixture names its own game, so a --game-id next to it would be silently ignored; refuse the combination. */
const resolveRequestedGameId = (values) => {
  if (values["game-id"] === undefined) return undefined;
  if (values.fixture !== undefined) throw new Error("--game-id cannot be combined with --fixture");
  return requirePositiveInteger("--game-id", values["game-id"]);
};

const requirePositiveInteger = (flag, raw) => {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${flag} must be a positive integer; received ${raw}`);
  return value;
};

const requireNonNegativeInteger = (flag, raw) => {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${flag} must be a non-negative integer; received ${raw}`);
  return value;
};

/** Flags win over env; a missing field exits naming both spellings rather than booting a client that cannot settle. */
const resolveAccountFields = (values) =>
  Object.fromEntries(
    ACCOUNT_FIELDS.map(([field, flag, envVar]) => {
      const value = values[flag] ?? process.env[envVar];
      if (!value) throw new Error(`Missing --${flag} (or ${envVar} in the environment)`);
      return [field, value];
    }),
  );

const readCommittedManifest = (chain) =>
  JSON.parse(readFileSync(new URL(`../../../contracts/l3/game/${MANIFEST_BY_CHAIN[chain]}`, import.meta.url), "utf8"));

const buildWorld = (config, manifest) =>
  buildWorldDeployment({
    id: WORLD_ID,
    chain: config.chain,
    manifest,
    heraldBaseUrl: config.heraldUrl,
    rpcUrl: config.rpcUrl,
    browserFacing: false,
    playerAccountClassHash: config.playerAccountClassHash,
    playerRegistryAddress: config.playerRegistryAddress,
    bindingAuthorityAddress: config.bindingAuthorityAddress,
  });

/** Where the snapshot comes from: Herald's live stream for the chosen game, or a captured fixture replayed offline. */
const resolveSource = async (config, world) =>
  config.fixturePath === undefined
    ? { kind: "herald", game: await resolveLiveGame(config, world), openSocket: (url) => new WebSocket(url) }
    : resolveFixtureSource(config.fixturePath);

/** The registry row carries the preset the game runs on, so the directory is read even when the id is given. */
const resolveLiveGame = async (config, world) => {
  const directory = await fetchHeraldGameDirectory(world);
  const game =
    config.gameId === undefined
      ? directory.games.find((candidate) => candidate.status === "Live")
      : directory.games.find((candidate) => candidate.game_id === config.gameId);
  if (!game) {
    const wanted = config.gameId === undefined ? "a Live game" : `game ${config.gameId}`;
    throw new Error(`No ${wanted} in ${world.heraldBaseUrl}/${world.chain}/games`);
  }
  if (config.gameId === undefined)
    console.error(`[headless] no --game-id; using first Live game ${game.game_id} (${game.name})`);
  return game;
};

const resolveFixtureSource = (fixturePath) => {
  const fixture = JSON.parse(readFileSync(resolve(fixturePath), "utf8"));
  const game = resolveFixtureGame(fixture);
  console.error(
    `[headless] replaying fixture ${fixturePath} (game ${game.game_id}, captured from ${fixture.capturedFrom})`,
  );
  return { kind: "fixture", game, openSocket: createFixtureSocketFactory(fixture) };
};

/** The fixture's own GameRegistry row names the game it was captured from; Herald rows carry felts as hex strings. */
const resolveFixtureGame = (fixture) => {
  const registry = fixture.entities.map((entity) => entity.models.GameRegistry).find(Boolean);
  if (!registry) throw new Error(`Fixture ${fixture.capturedFrom} carries no GameRegistry row`);
  return { game_id: Number(registry.game_id), preset_id: Number(registry.preset_id) };
};

/**
 * A Herald socket that replays the fixture: hello, one snapshot chunk per model, snapshot_end, then the fixture's
 * partial rows as one confirmed diff. Messages land on the next tick, after the transport has attached its handlers.
 */
const createFixtureSocketFactory = (fixture) => () => {
  const socket = { onopen: null, onerror: null, onclose: null, onmessage: null, send() {}, close() {} };
  setTimeout(() => {
    for (const message of buildFixtureStream(fixture)) socket.onmessage?.({ data: JSON.stringify(message) });
  }, 0);
  return socket;
};

const buildFixtureStream = (fixture) => {
  const epoch = "fixture";
  const snapshotChunks = [...groupRowsByModel(fixture.entities)].map(([model, rows]) => ({
    type: "snapshot",
    epoch,
    seq: 0,
    model,
    rows,
  }));
  return [
    { type: "hello", epoch, seq: 0, confirmed_block: 0, preconfirmed_block: null },
    ...snapshotChunks,
    { type: "snapshot_end", epoch, seq: 0 },
    { type: "diff", epoch, seq: 1, block: 1, preconfirmed: false, set: toHeraldSets(fixture.partials), del: [] },
  ];
};

const groupRowsByModel = (entities) => {
  const rowsByModel = new Map();
  for (const { model, key, value } of toHeraldSets(entities)) {
    rowsByModel.set(model, [...(rowsByModel.get(model) ?? []), { key, value }]);
  }
  return rowsByModel;
};

/** Store entities ({ hashed_keys, models }) back to the per-model rows Herald streams them as. */
const toHeraldSets = (entities) =>
  entities.flatMap(({ hashed_keys, models }) =>
    Object.entries(models).map(([model, value]) => ({ model, key: hashed_keys, value })),
  );

/** The web client reads the game mode off WorldConfig once the snapshot landed; the smoke resolves config the same way. */
const resolveGameConfig = (chain) => (setup) => {
  const worldConfig = getComponentValue(setup.components.WorldConfig, worldConfigKey());
  return getConfigFromNetwork(chain, worldConfig?.blitz_mode_on ? "blitz" : "eternum");
};

/** The source's socket, watched for the handshake, the snapshot rows per model, and the first failure. */
const createObservedSocketFactory = (openSocket) => {
  const rowsByModel = new Map();
  let reported = false;
  let connectStartedAt = 0;
  let connectedAt = 0;
  let snapshotEndedAt = 0;

  const observeMessage = (data) => {
    const message = JSON.parse(String(data));
    if (message.type === "hello") connectedAt = performance.now();
    if (message.type === "snapshot" && message.rows.length > 0) {
      rowsByModel.set(message.model, (rowsByModel.get(message.model) ?? 0) + message.rows.length);
    }
    if (message.type === "snapshot_end") snapshotEndedAt = performance.now();
  };

  const socketFactory = (url) => {
    connectStartedAt = performance.now();
    const socket = openSocket(url);
    // Only a real WebSocket carries the failure detail; the fixture socket never errors.
    socket.addEventListener?.("error", (event) => {
      if (reported) return;
      reported = true;
      console.error(`[headless] websocket error on ${url}: ${event.message ?? event.error?.message ?? "unknown"}`);
    });
    // The transport assigns handlers as properties; wrapping onmessage here keeps the observation off its code path.
    return {
      close: () => socket.close(),
      send: (data) => socket.send(data),
      set onopen(handler) {
        socket.onopen = handler;
      },
      set onerror(handler) {
        socket.onerror = handler;
      },
      set onclose(handler) {
        socket.onclose = handler;
      },
      set onmessage(handler) {
        socket.onmessage =
          handler &&
          ((event) => {
            observeMessage(event.data);
            handler(event);
          });
      },
    };
  };

  return {
    socketFactory,
    summary: () => ({
      rows: [...rowsByModel.values()].reduce((total, count) => total + count, 0),
      models: rowsByModel.size,
      connectMs: Math.round(connectedAt - connectStartedAt),
      receiveMs: Math.round(snapshotEndedAt - connectedAt),
      rowsByModel: Object.fromEntries([...rowsByModel.entries()].sort(([left], [right]) => left.localeCompare(right))),
    }),
  };
};

/** First live diff after the snapshot and the confirmed head. */
const createSmokeObserver = (startedAt) => {
  let firstDiffMs;
  let confirmedBlock;
  let notifyFirstDiff;
  const firstDiffSeen = new Promise((resolve) => {
    notifyFirstDiff = resolve;
  });

  return {
    observer: {
      onLiveUpdate(kind) {
        if (kind !== "entity" || firstDiffMs !== undefined) return;
        firstDiffMs = Math.round(performance.now() - startedAt);
        notifyFirstDiff();
      },
      onHead(head) {
        if (!head.preconfirmed) confirmedBlock = head.block;
      },
      onLiveApplyFailed: (error) => console.error(`[headless] live apply failed: ${error.message}`),
    },
    confirmedBlock: () => confirmedBlock,
    async waitForFirstDiff(watchMs) {
      if (firstDiffMs === undefined) await Promise.race([firstDiffSeen, delay(watchMs)]);
      return firstDiffMs;
    },
  };
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, timeoutMs, describe) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(describe())), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
    // The boot keeps running after a timeout until the runtime is disposed; its eventual rejection is not news.
    promise.catch(() => undefined);
  }
};

// Distinct entities that reached RECS, read back through the components: `world.getEntities()` only lists ids that
// went through `registerEntity`, which component writes do not.
const countStoredEntities = (contractComponents) => {
  const entities = new Set();
  getGameSyncModelsForChannel("gamewide-entity", { includeS2Only: true }).forEach(({ name }) => {
    for (const entity of contractComponents[name]?.entities() ?? []) entities.add(entity);
  });
  return entities.size;
};

/** The views see the game from one player; the first settled owner in the snapshot stands in for the smoke. */
const sampleStructureOwner = (components) => {
  for (const entity of components.Structure.entities()) {
    const owner = getComponentValue(components.Structure, entity)?.owner;
    if (owner) return owner;
  }
  return 0n;
};

/** The same readers the React hooks map with, run once over the hydrated RECS world. */
const readViews = (client) => {
  const owner = sampleStructureOwner(client.setup.components);
  const views = createGameViews(client, owner);
  return {
    owner: `0x${owner.toString(16)}`,
    structures: views.structures(owner).length,
    realms: views.allRealms().length,
  };
};

const bytesToMb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

// Node reports maxRSS in kilobytes on every platform.
const peakRssMb = () => bytesToMb(process.resourceUsage().maxRSS * 1024);

const runSmoke = async (config) => {
  const startedAt = performance.now();
  const world = buildWorld(config, readCommittedManifest(config.chain));
  const source = await resolveSource(config, world);
  const socket = createObservedSocketFactory(source.openSocket);
  const smoke = createSmokeObserver(startedAt);

  const client = await withTimeout(
    createGameClient({
      world,
      gameId: source.game.game_id,
      presetId: source.game.preset_id,
      dojoConfig: { rpcUrl: world.rpcUrl, manifest: readCommittedManifest(config.chain) },
      setupEnvironment: { vrfProviderAddress: "0x0" },
      scheduler: createMicrotaskGameSyncScheduler(),
      socketFactory: socket.socketFactory,
      observer: smoke.observer,
      resolveGameConfig: resolveGameConfig(config.chain),
    }),
    config.timeoutMs,
    () => `Timed out after ${config.timeoutMs}ms booting game ${source.game.game_id} from ${source.kind}`,
  );

  try {
    const firstDiffMs = await smoke.waitForFirstDiff(config.watchMs);
    const metrics = client.runtime.getMetrics();
    return {
      event: "game_client_headless_smoke",
      source: source.kind,
      gameId: source.game.game_id,
      presetId: source.game.preset_id,
      status: client.runtime.getStatus(),
      snapshot: { ...socket.summary(), applyMs: Math.round(metrics.snapshotApplyDurationMs) },
      ...(firstDiffMs === undefined ? {} : { firstDiffMs }),
      confirmedBlock: smoke.confirmedBlock() ?? null,
      entities: countStoredEntities(client.setup.network.contractComponents),
      views: readViews(client),
      metrics,
      rssMb: bytesToMb(process.memoryUsage().rss),
      peakRssMb: peakRssMb(),
      totalMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    client.dispose();
  }
};

const printManifest = (manifest) => {
  console.log(JSON.stringify(manifest));
};

/** The CI gate: a client that never reached `running` or hydrated nothing failed the smoke, manifest or not. */
const assertSmokeHealthy = (manifest) => {
  if (manifest.status !== "running") throw new Error(`runtime status is ${manifest.status}; expected running`);
  if (manifest.entities === 0) throw new Error("no entity reached RECS");
};

const printUsage = () => {
  console.log(
    "Usage: pnpm smoke:game-client [--fixture <path>] " +
      "[--rpc-url <url>] [--herald-url <url>] [--chain <name>] [--game-id <number>] " +
      "[--player-account-class-hash <felt>] [--player-registry-address <felt>] [--binding-authority-address <felt>] " +
      "[--timeout-ms <n>] [--watch-ms <n>]",
  );
};

try {
  const config = parseArgs(process.argv.slice(2));
  if (config.help) {
    printUsage();
  } else {
    const manifest = await runSmoke(config);
    printManifest(manifest);
    assertSmokeHealthy(manifest);
  }
} catch (error) {
  // A boot that timed out still owns the active runtime; disposing it stops the transport's reconnects.
  disposeActiveGameSyncRuntime();
  process.stderr.write(`[headless] ${error instanceof Error ? error.message : String(error)}\n`, () => process.exit(1));
}
