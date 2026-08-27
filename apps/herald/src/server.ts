import { resolve } from "node:path";

import { createHeraldRequestHandler } from "./http";
import { createModelRegistry, readWorldManifest } from "./model-registry";
import { MadaraRpc } from "./madara-rpc";
import { buildWorldFold } from "./snapshot-builder";

interface HeraldConfig {
  chain: string;
  manifestPath: string;
  port: number;
  rpcUrl: string;
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

const readConfig = (): HeraldConfig => ({
  chain: requireEnvironment("HERALD_CHAIN"),
  manifestPath:
    process.env.HERALD_MANIFEST_PATH ?? resolve(import.meta.dir, "../../../contracts/game/manifest_madara.json"),
  port: readPort(),
  rpcUrl: requireEnvironment("HERALD_RPC_URL"),
});

const main = async (): Promise<void> => {
  const config = readConfig();
  const manifest = await readWorldManifest(config.manifestPath);
  const registry = createModelRegistry(manifest);
  const built = await buildWorldFold({
    registry,
    rpc: new MadaraRpc(config.rpcUrl),
    onPage: ({ number, eventCount }) => {
      if (number % 25 === 0)
        console.info(JSON.stringify({ event: "herald_replay_progress", eventCount, page: number }));
    },
  });
  const fetch = createHeraldRequestHandler({
    chain: config.chain,
    confirmedBlock: built.confirmedBlock,
    decodedModelCount: registry.bySelector.size,
    fold: built.fold,
    metrics: built.metrics,
  });

  Bun.serve({
    port: config.port,
    fetch,
  });

  console.info(
    JSON.stringify({
      chain: config.chain,
      confirmedBlock: built.confirmedBlock,
      event: "herald_ready",
      metrics: built.metrics,
      port: config.port,
      worldAddress: registry.worldAddress,
    }),
  );
};

await main();
