import { resolve } from "node:path";

import { createModelRegistry, readWorldManifest } from "./model-registry";
import { MadaraRpc } from "./madara-rpc";
import { buildGameSnapshot } from "./snapshot-builder";
import { compareSnapshotWithTorii, ToriiOracle } from "./torii-parity";

const requireEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const main = async (): Promise<void> => {
  const gameId = requireEnvironment("HERALD_GAME_ID");
  const rpcUrl = requireEnvironment("HERALD_RPC_URL");
  const torii = new ToriiOracle(requireEnvironment("TORII_URL"));
  const manifestPath =
    process.env.HERALD_MANIFEST_PATH ?? resolve(import.meta.dir, "../../../contracts/game/manifest_madara.json");
  const registry = createModelRegistry(await readWorldManifest(manifestPath));
  const indexedBlock = await torii.indexedBlock();
  const startedAt = Date.now();
  const built = await buildGameSnapshot({
    confirmedBlock: indexedBlock,
    gameId,
    registry,
    rpc: new MadaraRpc(rpcUrl),
    onPage: ({ number }) => {
      if (number % 100 === 0) console.error(JSON.stringify({ event: "herald_parity_replay", page: number }));
    },
  });
  const report = await compareSnapshotWithTorii(built.snapshot, registry, torii);
  const indexedBlockAfterComparison = await torii.indexedBlock();
  const result = {
    ...report,
    elapsed_ms: Date.now() - startedAt,
    metrics: built.metrics,
    torii_block_stable: indexedBlockAfterComparison === indexedBlock,
  };
  console.log(JSON.stringify(result, null, 2));

  if (!result.matched || !result.torii_block_stable) process.exitCode = 1;
};

await main();
