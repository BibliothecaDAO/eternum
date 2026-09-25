import { createNativeWorldIngestion } from "./native/world-ingestion";
import { NativeDecoder } from "./native/decoder";
import { NativeIngestion } from "./native/ingestion";
import { readFile } from "node:fs/promises";

import { CheckpointStore } from "./checkpoint-store";
import { createHeraldRequestHandler } from "./http";
import { MadaraRpc } from "./madara-rpc";
import { MadaraSubscriptions } from "./madara-subscriptions";
import { acceptGameStream, answerSafely, createStreamSocketHandlers, type HeraldSocketData } from "./request-guards";
import { HistoryStore } from "./history-store";
import { assertShardChain, buildShardManifest, readShardDocument } from "./shard-manifest";

const CHECKPOINT_EVERY_BLOCKS = 100;
/** How often Herald reads the sequencer clock off the pre-confirmed block. */
const CHAIN_CLOCK_INTERVAL_MS = 500;

interface HeraldConfig {
  databaseUrl: string;
  manifestPath: string;
  port: number;
  publicAdmissionUrl: string;
  publicRpcUrl: string;
  rpcUrl: string;
  wsUrl: string;
}

const requireEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

/** The shard's runtime files name the port (3003 in the package); a Herald started without one refuses to start. */
const readPort = (): number => {
  const port = Number(requireEnvironment("PORT"));
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error(`Invalid PORT ${process.env.PORT}`);
  return port;
};

const websocketUrl = (rpcUrl: string): string => {
  const url = new URL(rpcUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

const readConfig = (): HeraldConfig => {
  const rpcUrl = requireEnvironment("HERALD_RPC_URL");
  return {
    databaseUrl: requireEnvironment("DATABASE_URL"),
    manifestPath: requireEnvironment("NATIVE_WORLD_MANIFEST"),
    port: readPort(),
    publicAdmissionUrl: requireEnvironment("HERALD_PUBLIC_ADMISSION_URL"),
    publicRpcUrl: requireEnvironment("HERALD_PUBLIC_RPC_URL"),
    rpcUrl,
    wsUrl: websocketUrl(rpcUrl),
  };
};

const streamGameId = (pathname: string): string | undefined => /^\/games\/([0-9]+)$/.exec(pathname)?.[1];

const main = async (): Promise<void> => {
  const config = readConfig();
  const manifest = readShardDocument(await readFile(config.manifestPath, "utf8"));
  const shardManifest = buildShardManifest(manifest, {
    rpcUrl: config.publicRpcUrl,
    admissionUrl: config.publicAdmissionUrl,
  });
  const native = new NativeIngestion(new NativeDecoder(manifest));
  const ingestion = createNativeWorldIngestion(native);
  const registry = ingestion.registry;
  const rpc = new MadaraRpc(config.rpcUrl);
  const chain = await rpc.chainId();
  assertShardChain(manifest, chain);
  const checkpointStore = new CheckpointStore(config.databaseUrl);
  const historyStore = new HistoryStore(config.databaseUrl, chain, registry.worldAddress, ingestion.historyCodec);
  await historyStore.initialize();
  const loaded = await ingestion.load({ chain, checkpointStore, history: historyStore, rpc });
  const liveInput = {
    chain,
    checkpointBlock: loaded.checkpointBlock,
    checkpointEveryBlocks: CHECKPOINT_EVERY_BLOCKS,
    checkpointStore,
    confirmedBlock: loaded.confirmedBlock,
    confirmedFold: loaded.fold,
    historyStore,
    registry,
    rpc,
  };
  const live = ingestion.createLive(liveInput);
  await live.archiveFinalizedGames();
  let server: ReturnType<typeof Bun.serve<HeraldSocketData>> | undefined;
  let shuttingDown = false;

  const subscriptions = new MadaraSubscriptions(config.wsUrl, {
    onFatal: (error) => {
      console.error(JSON.stringify({ error: error.message, event: "herald_fatal" }));
      void shutdown(1);
    },
    onHead: (head) => live.acceptSubscribedHead(head),
    onReady: () => live.reconcileAfterSubscribe(),
    onReceipt: (receipt) => live.acceptReceipt(receipt),
    onTransaction: (transaction) => live.acceptTransaction(transaction),
  });

  const chainClock = setInterval(() => {
    live.publishChainClock().catch((error: Error) => {
      console.warn(JSON.stringify({ error: error.message, event: "herald_chain_clock_failed" }));
    });
  }, CHAIN_CLOCK_INTERVAL_MS);

  const shutdown = async (exitCode: number): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(chainClock);
    subscriptions.stop();
    server?.stop();
    try {
      await live.checkpoint();
      await historyStore.close();
      await checkpointStore.close();
    } finally {
      process.exit(exitCode);
    }
  };

  await subscriptions.start();
  const http = createHeraldRequestHandler({
    subscribeConfirmedChanges: (listener) => live.subscribeConfirmedChanges(listener),
    readModels: ingestion.readModels,
    chain,
    manifest: shardManifest,
    schemas: manifest.native.schemas,
    worldAddress: registry.worldAddress,
    confirmedBlock: () => live.confirmedBlock,
    chainTimestamp: () => live.chainTimestamp,
    decodedModelCount: registry.bySelector.size,
    fold: {
      modelRows: (model) => live.modelRows(model),
      structurePosition: (game, entity) => live.structurePosition(game, entity),
      directoryRevision: () => live.directoryRevision(),
      snapshot: (gameId, _confirmedBlock, models, actor, owner) => live.snapshot(gameId, models, actor, owner),
    },
    history: historyStore,
    metrics: loaded.metrics,
    undecodableEventCount: () => native.receiptFailures,
    ingestionFailure: () =>
      native.halted
        ? { block: native.halted.block, transactionHash: native.halted.transactionHash, error: native.halted.message }
        : undefined,
  });
  server = Bun.serve<HeraldSocketData>({
    port: config.port,
    fetch: (request, bunServer) =>
      answerSafely(request, () => {
        const url = new URL(request.url);
        if (url.pathname === "/games/updates") bunServer.timeout(request, 0);
        const gameId = streamGameId(url.pathname);
        const actor = url.searchParams.get("actor") ?? undefined;
        if (
          actor !== undefined &&
          (!/^0x[0-9a-f]{1,64}$/i.test(actor) || BigInt(actor) === 0n || BigInt(actor) >= (1n << 251n) - 256n)
        )
          return new Response("Invalid gameplay account", { status: 400 });
        if (gameId) {
          const stream = acceptGameStream(gameId, actor, live);
          if (stream instanceof Response) return stream;
          if (bunServer.upgrade(request, { data: stream })) return;
        }
        return http(request);
      }),
    websocket: createStreamSocketHandlers(live),
  });

  process.once("SIGINT", () => void shutdown(0));
  process.once("SIGTERM", () => void shutdown(0));
  console.info(
    JSON.stringify({
      chain,
      checkpointBlock: loaded.checkpointBlock ?? null,
      confirmedBlock: live.confirmedBlock,
      epoch: live.hub.epoch,
      event: "herald_ready",
      metrics: loaded.metrics,
      port: config.port,
      startupMs: loaded.startupMs,
      worldAddress: registry.worldAddress,
      wsUrl: config.wsUrl,
    }),
  );
};

await main();
