import { resolve } from "node:path";

import { loadConfirmedWorld } from "./checkpoint-loader";
import { CheckpointStore } from "./checkpoint-store";
import type { GameStreamSession } from "./game-stream";
import { createHeraldRequestHandler } from "./http";
import { LiveWorld } from "./live-world";
import { MadaraRpc } from "./madara-rpc";
import { MadaraSubscriptions } from "./madara-subscriptions";
import { createModelRegistry, readWorldManifest } from "./model-registry";
import type { ResumeRequest } from "./stream-protocol";
import { WorldEventDecodeMonitor } from "./world-event-decoder";

const CHECKPOINT_EVERY_BLOCKS = 100;

interface HeraldConfig {
  chain: string;
  databaseUrl: string;
  manifestPath: string;
  port: number;
  rpcUrl: string;
  wsUrl: string;
}

interface HeraldSocketData {
  gameId: string;
  session?: GameStreamSession;
}

const requireEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const readPort = (): number => {
  const port = Number(process.env.PORT ?? 3_003);
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
    chain: requireEnvironment("HERALD_CHAIN"),
    databaseUrl: requireEnvironment("DATABASE_URL"),
    manifestPath:
      process.env.HERALD_MANIFEST_PATH ?? resolve(import.meta.dir, "../../../contracts/game/manifest_madara.json"),
    port: readPort(),
    rpcUrl,
    wsUrl: websocketUrl(rpcUrl),
  };
};

const streamGameId = (pathname: string, chain: string): string | undefined => {
  const escapedChain = chain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^/${escapedChain}/games/([0-9]+)$`).exec(pathname)?.[1];
};

const parseResume = (message: string | Buffer): ResumeRequest => {
  const request = JSON.parse(String(message)) as Partial<ResumeRequest>;
  const seq = request.seq;
  if (
    request.type !== "resume" ||
    typeof request.epoch !== "string" ||
    !Number.isSafeInteger(seq) ||
    seq === undefined ||
    seq < 0
  ) {
    throw new Error("Expected resume{epoch,seq}");
  }
  return request as ResumeRequest;
};

const main = async (): Promise<void> => {
  const config = readConfig();
  const manifest = await readWorldManifest(config.manifestPath);
  const registry = createModelRegistry(manifest);
  const rpc = new MadaraRpc(config.rpcUrl);
  const checkpointStore = new CheckpointStore(config.databaseUrl);
  const decodeMonitor = new WorldEventDecodeMonitor();
  const loaded = await loadConfirmedWorld({
    chain: config.chain,
    checkpointStore,
    decodeMonitor,
    onPage: ({ number, eventCount }) => {
      if (number % 25 === 0) {
        console.info(JSON.stringify({ event: "herald_replay_progress", eventCount, page: number }));
      }
    },
    registry,
    rpc,
  });
  const live = new LiveWorld({
    chain: config.chain,
    checkpointBlock: loaded.checkpointBlock,
    checkpointEveryBlocks: CHECKPOINT_EVERY_BLOCKS,
    checkpointStore,
    confirmedBlock: loaded.confirmedBlock,
    confirmedFold: loaded.fold,
    decodeMonitor,
    registry,
    rpc,
  });
  let server: ReturnType<typeof Bun.serve<HeraldSocketData>> | undefined;
  let shuttingDown = false;

  const subscriptions = new MadaraSubscriptions(config.wsUrl, registry, {
    onEvent: (event) => live.acceptPreconfirmedEvent(event),
    onFatal: (error) => {
      console.error(JSON.stringify({ error: error.message, event: "herald_fatal" }));
      void shutdown(1);
    },
    onHead: (head) => live.acceptSubscribedHead(head),
    onReady: () => live.reconcileAfterSubscribe(),
    onReceipt: (receipt) => live.acceptReceipt(receipt),
    onTransaction: (transaction) => live.acceptTransaction(transaction),
  });

  const shutdown = async (exitCode: number): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    subscriptions.stop();
    server?.stop();
    try {
      await live.checkpoint();
      await checkpointStore.close();
    } finally {
      process.exit(exitCode);
    }
  };

  await subscriptions.start();
  const http = createHeraldRequestHandler({
    chain: config.chain,
    confirmedBlock: () => live.confirmedBlock,
    decodedModelCount: registry.bySelector.size,
    fold: {
      modelRows: (model) => live.modelRows(model),
      snapshot: (gameId, _confirmedBlock, models) => live.snapshot(gameId, models),
    },
    metrics: loaded.metrics,
    undecodableEventCount: () => decodeMonitor.failures,
  });
  server = Bun.serve<HeraldSocketData>({
    port: config.port,
    fetch: (request, bunServer) => {
      const gameId = streamGameId(new URL(request.url).pathname, config.chain);
      if (gameId && bunServer.upgrade(request, { data: { gameId } })) return;
      return http(request);
    },
    websocket: {
      close: (socket) => {
        if (socket.data.session) live.detach(socket.data.session);
      },
      message: (socket, message) => {
        try {
          if (!socket.data.session) throw new Error("Stream session is not attached");
          live.resume(socket.data.session, parseResume(message));
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          socket.close(1008, reason);
        }
      },
      open: (socket) => {
        socket.data.session = live.attach(socket.data.gameId, socket);
      },
    },
  });

  process.once("SIGINT", () => void shutdown(0));
  process.once("SIGTERM", () => void shutdown(0));
  console.info(
    JSON.stringify({
      chain: config.chain,
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
