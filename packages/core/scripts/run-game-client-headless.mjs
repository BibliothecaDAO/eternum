#!/usr/bin/env node
/** Boots a native game through the shared client and measures its Herald snapshot and first diff. */

import { readFileSync } from "node:fs";
import { parseArgs as parseNodeArgs } from "node:util";

import { createGameClient, createGameViews } from "@bibliothecadao/eternum";
import { fetchHeraldGameDirectory, openShard } from "@bibliothecadao/eternum/game-client";
import { createMicrotaskGameSyncScheduler, disposeActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";

const bindings = JSON.parse(
  readFileSync(new URL("../../../contracts/l3/world-native/schema/bindings.json", import.meta.url), "utf8"),
);

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_WATCH_MS = 5_000;

const parseArgs = (args) => {
  const { values } = parseNodeArgs({
    args,
    options: {
      "shard-url": { type: "string" },
      "game-id": { type: "string" },
      "timeout-ms": { type: "string", default: String(DEFAULT_TIMEOUT_MS) },
      "watch-ms": { type: "string", default: String(DEFAULT_WATCH_MS) },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) return { help: true };
  return {
    help: false,
    shardUrl: required(values["shard-url"], "SHARD_URL"),
    gameId: resolveRequestedGameId(values),
    timeoutMs: requirePositiveInteger("--timeout-ms", values["timeout-ms"]),
    watchMs: requireNonNegativeInteger("--watch-ms", values["watch-ms"]),
  };
};

const resolveRequestedGameId = (values) => {
  if (values["game-id"] === undefined) return undefined;
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

const required = (flag, variable) => {
  const value = flag ?? process.env[variable];
  if (!value) throw new Error(`Supply the option or ${variable}`);
  return value;
};

/** The registry row carries the preset the game runs on, so the directory is read even when the id is given. */
const resolveLiveGame = async (config, shard) => {
  const directory = await fetchHeraldGameDirectory(shard);
  const game =
    config.gameId === undefined
      ? directory.games.find((candidate) => candidate.status === "Live")
      : directory.games.find((candidate) => candidate.game_id === config.gameId);
  if (!game) {
    const wanted = config.gameId === undefined ? "a Live game" : `game ${config.gameId}`;
    throw new Error(`No ${wanted} in ${shard.url}/games`);
  }
  if (config.gameId === undefined)
    console.error(`[headless] no --game-id; using first Live game ${game.game_id} (${game.name})`);
  return game;
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

const countStoredEntities = (store) =>
  new Set(bindings.models.flatMap(({ name }) => [...store.listModelEntityIds(name)])).size;

const readViews = (client) => {
  const owner = [...client.setup.store.inGame("Structure", client.gameId)].find((row) => row.owner !== 0n)?.owner ?? 0n;
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
  const shard = await openShard(config.shardUrl, bindings.schemaIdentity);
  const source = {
    kind: "herald",
    game: await resolveLiveGame(config, shard),
    openSocket: (url) => new WebSocket(url),
  };
  const socket = createObservedSocketFactory(source.openSocket);
  const smoke = createSmokeObserver(startedAt);

  const client = await withTimeout(
    createGameClient({
      shard,
      gameId: source.game.game_id,
      presetId: source.game.preset_id,
      native: {
        bindings,
        chainId: shard.chainId,
        signIntent: async () => {
          throw new Error("The headless smoke is read-only");
        },
        submitIntent: async () => {
          throw new Error("The headless smoke is read-only");
        },
      },
      scheduler: createMicrotaskGameSyncScheduler(),
      socketFactory: socket.socketFactory,
      observer: smoke.observer,
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
      entities: countStoredEntities(client.setup.store),
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
  if (manifest.entities === 0) throw new Error("no entity reached the native store");
};

const printUsage = () => {
  console.log(
    "Usage: pnpm smoke:game-client --shard-url <url> [--game-id <number>] [--timeout-ms <n>] [--watch-ms <n>]",
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
