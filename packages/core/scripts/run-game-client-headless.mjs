#!/usr/bin/env node
/**
 * Headless game client smoke: boots one live game through `createGameClient` (the same composition the web client's
 * bootstrap uses) in plain Node (no DOM, no `ws` package, Node 22's built-in WebSocket) and prints one JSON manifest
 * line with the snapshot/apply timings. M0 item 2 and the M1b gate in docs/plans/hired-agents-milestones.md.
 *
 * Run from the repo root (`pnpm build:packages` first so packages/*\/dist exists):
 *
 *   pnpm exec tsx packages/core/scripts/run-game-client-headless.mjs --game-id 33
 *
 * The world is built from the committed manifest (contracts/l3/game/manifest_<chain>.json) plus the gameplay-account
 * contracts, which come from flags or the same env vars apps/game/.env carries. The lab stack's values live in that
 * .env (VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH, VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS, VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS):
 *
 *   set -a; source apps/game/.env; set +a; pnpm exec tsx packages/core/scripts/run-game-client-headless.mjs
 *
 * Options:
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
import { parseArgs as parseNodeArgs } from "node:util";

import { createGameClient } from "@bibliothecadao/eternum";
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
    rpcUrl: values["rpc-url"],
    heraldUrl: values["herald-url"],
    chain: requireKnownChain(values.chain),
    gameId: values["game-id"] === undefined ? undefined : requirePositiveInteger("--game-id", values["game-id"]),
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

/** The registry row carries the preset the game runs on, so the directory is read even when the id is given. */
const resolveGame = async (config, world) => {
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

/** The web client reads the game mode off WorldConfig once the snapshot landed; the smoke resolves config the same way. */
const resolveGameConfig = (chain) => (setup) => {
  const worldConfig = getComponentValue(setup.components.WorldConfig, worldConfigKey());
  return getConfigFromNetwork(chain, worldConfig?.blitz_mode_on ? "blitz" : "eternum");
};

/** Node 22's global WebSocket, watched for the handshake, the snapshot rows per model, and the first failure. */
const createObservedSocketFactory = () => {
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
    const socket = new WebSocket(url);
    socket.addEventListener("error", (event) => {
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

const bytesToMb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

// Node reports maxRSS in kilobytes on every platform.
const peakRssMb = () => bytesToMb(process.resourceUsage().maxRSS * 1024);

const runSmoke = async (config) => {
  const startedAt = performance.now();
  const world = buildWorld(config, readCommittedManifest(config.chain));
  const game = await resolveGame(config, world);
  const socket = createObservedSocketFactory();
  const smoke = createSmokeObserver(startedAt);

  const client = await withTimeout(
    createGameClient({
      world,
      gameId: game.game_id,
      presetId: game.preset_id,
      dojoConfig: { rpcUrl: world.rpcUrl, manifest: readCommittedManifest(config.chain) },
      setupEnvironment: { vrfProviderAddress: "0x0" },
      scheduler: createMicrotaskGameSyncScheduler(),
      socketFactory: socket.socketFactory,
      observer: smoke.observer,
      resolveGameConfig: resolveGameConfig(config.chain),
    }),
    config.timeoutMs,
    () => `Timed out after ${config.timeoutMs}ms booting game ${game.game_id} against ${world.heraldBaseUrl}`,
  );

  try {
    const firstDiffMs = await smoke.waitForFirstDiff(config.watchMs);
    const metrics = client.runtime.getMetrics();
    return {
      event: "game_client_headless_smoke",
      gameId: game.game_id,
      presetId: game.preset_id,
      status: client.runtime.getStatus(),
      snapshot: { ...socket.summary(), applyMs: Math.round(metrics.snapshotApplyDurationMs) },
      ...(firstDiffMs === undefined ? {} : { firstDiffMs }),
      confirmedBlock: smoke.confirmedBlock() ?? null,
      entities: countStoredEntities(client.setup.network.contractComponents),
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

const printUsage = () => {
  console.log(
    "Usage: pnpm exec tsx packages/core/scripts/run-game-client-headless.mjs " +
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
    printManifest(await runSmoke(config));
  }
} catch (error) {
  // A boot that timed out still owns the active runtime; disposing it stops the transport's reconnects.
  disposeActiveGameSyncRuntime();
  process.stderr.write(`[headless] ${error instanceof Error ? error.message : String(error)}\n`, () => process.exit(1));
}
