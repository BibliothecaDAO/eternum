#!/usr/bin/env node
/**
 * Headless game client smoke: hydrates one live game from Herald through the shared sync runtime into RECS in plain
 * Node (no DOM, no `ws` package, Node 22's built-in WebSocket) and prints one JSON manifest line with the baseline
 * snapshot/apply timings. M0 item 2 in docs/plans/hired-agents-milestones.md.
 *
 * Run from the repo root (`pnpm build:packages` first so packages/*\/dist exists):
 *
 *   pnpm exec tsx --tsconfig apps/game/tsconfig.json packages/core/scripts/run-game-client-headless.mjs --game-id 33
 *
 * `--tsconfig apps/game/tsconfig.json` exists only so the app-local RECS store's `@/` imports resolve; M1a moves that
 * store into packages/core/src/client and the flag goes away. `bun packages/core/scripts/run-game-client-headless.mjs`
 * also runs it, but that exercises bun's WebSocket rather than Node's.
 *
 * Options:
 *   --herald-url <url>     Herald base URL (default: https://herald.realms.party)
 *   --chain <name>         Herald chain segment (default: madara)
 *   --game-id <number>     Game to hydrate; omitted: the first `Live` game in GET {herald}/{chain}/games
 *   --models <a,b,c>       Snapshot models (default: every gamewide-entity model in the sync manifest)
 *   --timeout-ms <number>  Give up on the snapshot after this long (default: 60000)
 *   --watch-ms <number>    How long to wait for the first live diff after the snapshot (default: 5000)
 */

import { parseArgs as parseNodeArgs } from "node:util";

import {
  GameSyncRuntime,
  HeraldGameSyncTransport,
  createMicrotaskGameSyncScheduler,
  getGameSyncModelsForChannel,
} from "@bibliothecadao/eternum/game-sync";
import { defineContractComponents } from "@bibliothecadao/types";
import { createWorld } from "@dojoengine/recs";
// M1a relocates this store to packages/core/src/client/recs-game-sync-store.ts; until then the spike reaches across
// the app boundary so the smoke writes through the same coercion path the web client uses.
import { createRecsGameSyncStore } from "../../../apps/game/src/sync/recs-game-sync-store.ts";

const DEFAULT_HERALD_URL = "https://herald.realms.party";
const DEFAULT_CHAIN = "madara";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_WATCH_MS = 5_000;
// Every chain the app knows resolves to this namespace (packages/core/src/client/game-scope.ts `namespaceForChain`).
const NAMESPACE = "s2";

const parseArgs = (args) => {
  const { values } = parseNodeArgs({
    args,
    options: {
      "herald-url": { type: "string", default: DEFAULT_HERALD_URL },
      chain: { type: "string", default: DEFAULT_CHAIN },
      "game-id": { type: "string" },
      models: { type: "string" },
      "timeout-ms": { type: "string", default: String(DEFAULT_TIMEOUT_MS) },
      "watch-ms": { type: "string", default: String(DEFAULT_WATCH_MS) },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  return {
    help: values.help,
    heraldUrl: values["herald-url"],
    chain: values.chain,
    gameId: values["game-id"] === undefined ? undefined : requirePositiveInteger("--game-id", values["game-id"]),
    models: values.models
      ?.split(",")
      .map((model) => model.trim())
      .filter(Boolean),
    timeoutMs: requirePositiveInteger("--timeout-ms", values["timeout-ms"]),
    watchMs: requireNonNegativeInteger("--watch-ms", values["watch-ms"]),
  };
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

const resolveGameId = async (config) => {
  if (config.gameId !== undefined) return config.gameId;
  const directory = await fetchGameDirectory(config);
  const live = directory.games.find((game) => game.status === "Live");
  if (!live) {
    throw new Error(`No Live game on ${config.heraldUrl}/${config.chain}/games; pass --game-id explicitly`);
  }
  console.error(`[headless] no --game-id; using first Live game ${live.game_id} (${live.name})`);
  return live.game_id;
};

const fetchGameDirectory = async (config) => {
  const url = buildHeraldUrl(config.heraldUrl, `/${config.chain}/games`);
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Herald directory ${url} failed: ${response.status} ${response.statusText}`);
  return response.json();
};

const buildHeraldUrl = (baseUrl, pathname) => {
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}${pathname}`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

// Mirrors apps/game `buildHeraldGameStreamUrl`: the stream is the directory URL over WebSocket.
const buildGameStreamUrl = (config, gameId) => {
  const url = new URL(buildHeraldUrl(config.heraldUrl, `/${config.chain}/games/${gameId}`));
  if (url.protocol === "http:") url.protocol = "ws:";
  else if (url.protocol === "https:") url.protocol = "wss:";
  return url.toString();
};

const resolveSyncModels = (config) => {
  const manifestModels = (channel) =>
    getGameSyncModelsForChannel(channel, { includeS2Only: true }).map(({ name }) => name);
  const entityModels = config.models ?? manifestModels("gamewide-entity");
  return { entityModels, eventModels: manifestModels("global-event") };
};

/** The real RECS store plus a meter: rows per model and the apply time spent while the runtime is still snapshotting. */
const createHeadlessStore = (world, contractComponents, syncModels, isSnapshotting) => {
  const store = createRecsGameSyncStore({ network: { world, contractComponents } }, syncModels);
  let snapshotApplyMs = 0;

  return {
    store: {
      applyEntityOperations(operations) {
        const startedAt = performance.now();
        store.applyEntityOperations(operations);
        if (isSnapshotting()) snapshotApplyMs += performance.now() - startedAt;
      },
      applyEvent: (event) => store.applyEvent(event),
      listModelEntityIds: (model) => store.listModelEntityIds(model),
    },
    snapshotApplyMs: () => Math.round(snapshotApplyMs),
  };
};

/** Wraps the Herald transport to time the handshake and the snapshot stream, and to count the rows each model sent. */
const observeSnapshotTransport = (transport) => {
  const rowsByModel = new Map();
  let connectStartedAt = 0;
  let connectedAt = 0;
  let snapshotEndedAt = 0;

  const countRows = (page) => {
    page.items.forEach((entity) => {
      Object.keys(entity.models).forEach((model) => rowsByModel.set(model, (rowsByModel.get(model) ?? 0) + 1));
    });
  };

  return {
    transport: {
      transactionStatusChannel: transport.transactionStatusChannel,
      async subscribe(handlers) {
        connectStartedAt = performance.now();
        const writer = await transport.subscribe(handlers);
        connectedAt = performance.now();
        return writer;
      },
      async fetchSnapshotPage(cursor) {
        const page = await transport.fetchSnapshotPage(cursor);
        countRows(page);
        if (!page.nextCursor) snapshotEndedAt = performance.now();
        return page;
      },
    },
    summary: () => ({
      rows: [...rowsByModel.values()].reduce((total, count) => total + count, 0),
      models: rowsByModel.size,
      connectMs: Math.round(connectedAt - connectStartedAt),
      receiveMs: Math.round(snapshotEndedAt - connectedAt),
      rowsByModel: Object.fromEntries([...rowsByModel.entries()].sort(([left], [right]) => left.localeCompare(right))),
    }),
  };
};

const createFirstDiffProbe = (startedAt) => {
  let firstDiffMs;
  let notify;
  const seen = new Promise((resolve) => {
    notify = resolve;
  });

  return {
    onLiveUpdate(kind) {
      if (kind !== "entity" || firstDiffMs !== undefined) return;
      firstDiffMs = Math.round(performance.now() - startedAt);
      notify();
    },
    async waitFor(watchMs) {
      if (firstDiffMs === undefined) await Promise.race([seen, delay(watchMs)]);
      return firstDiffMs;
    },
  };
};

// Node 22's global WebSocket; the transport reconnects every 200ms, so only the first failure is worth a line.
const createNodeSocketFactory = () => {
  let reported = false;
  return (url) => {
    const socket = new WebSocket(url);
    socket.addEventListener("error", (event) => {
      if (reported) return;
      reported = true;
      console.error(`[headless] websocket error on ${url}: ${event.message ?? event.error?.message ?? "unknown"}`);
    });
    return socket;
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
  }
};

// Distinct entities that reached RECS, read back through the store: `world.getEntities()` only lists ids that went
// through `registerEntity`, which component writes do not.
const countStoredEntities = (store, models) => {
  const entities = new Set();
  models.forEach((model) => {
    for (const entityId of store.listModelEntityIds(model)) entities.add(entityId);
  });
  return entities.size;
};

const createHeadProbe = () => {
  let confirmedBlock;
  return {
    onHead(head) {
      if (!head.preconfirmed) confirmedBlock = head.block;
    },
    confirmedBlock: () => confirmedBlock,
  };
};

const bytesToMb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

// Node reports maxRSS in kilobytes on every platform.
const peakRssMb = () => bytesToMb(process.resourceUsage().maxRSS * 1024);

const runSmoke = async (config, gameId) => {
  const startedAt = performance.now();
  const streamUrl = buildGameStreamUrl(config, gameId);
  const { entityModels, eventModels } = resolveSyncModels(config);
  const world = createWorld();
  const contractComponents = defineContractComponents(world, NAMESPACE);
  const runtime = new GameSyncRuntime();
  const headlessStore = createHeadlessStore(
    world,
    contractComponents,
    [...entityModels, ...eventModels],
    () => runtime.getStatus() === "snapshotting",
  );
  const snapshot = observeSnapshotTransport(
    new HeraldGameSyncTransport({ url: streamUrl, socketFactory: createNodeSocketFactory() }),
  );
  const firstDiff = createFirstDiffProbe(startedAt);
  const head = createHeadProbe();

  try {
    await withTimeout(
      runtime.startSession({
        transport: snapshot.transport,
        store: headlessStore.store,
        snapshotModels: entityModels,
        scheduler: createMicrotaskGameSyncScheduler(),
        onLiveUpdate: firstDiff.onLiveUpdate,
        onHead: head.onHead,
        onError: (error) => console.error(`[headless] live apply failed: ${error.message}`),
      }),
      config.timeoutMs,
      () => `Timed out after ${config.timeoutMs}ms while ${runtime.getStatus()} against ${streamUrl}`,
    );
    const firstDiffMs = await firstDiff.waitFor(config.watchMs);

    return {
      event: "game_client_headless_smoke",
      gameId,
      status: runtime.getStatus(),
      snapshot: { ...snapshot.summary(), applyMs: headlessStore.snapshotApplyMs() },
      ...(firstDiffMs === undefined ? {} : { firstDiffMs }),
      confirmedBlock: head.confirmedBlock() ?? null,
      entities: countStoredEntities(headlessStore.store, entityModels),
      metrics: runtime.getMetrics(),
      rssMb: bytesToMb(process.memoryUsage().rss),
      peakRssMb: peakRssMb(),
      totalMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    runtime.dispose();
  }
};

const printManifest = (manifest) => {
  console.log(JSON.stringify(manifest));
};

const printUsage = () => {
  console.log(
    "Usage: pnpm exec tsx --tsconfig apps/game/tsconfig.json packages/core/scripts/run-game-client-headless.mjs " +
      "[--herald-url <url>] [--chain <name>] [--game-id <number>] [--models <a,b>] [--timeout-ms <n>] [--watch-ms <n>]",
  );
};

try {
  const config = parseArgs(process.argv.slice(2));
  if (config.help) {
    printUsage();
  } else {
    const gameId = await resolveGameId(config);
    printManifest(await runSmoke(config, gameId));
  }
} catch (error) {
  // A transport that never connected has no writer for the runtime to cancel, so its reconnect timer would keep
  // the process alive; exit once the failure line has flushed.
  process.stderr.write(`[headless] ${error instanceof Error ? error.message : String(error)}\n`, () => process.exit(1));
}
