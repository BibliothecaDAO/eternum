import { defineIndexer } from "apibara/indexer";
import { drizzle, drizzleStorage, useDrizzleStorage } from "@apibara/plugin-drizzle";
import { StarknetStream } from "@apibara/starknet";
import { EVENT_SELECTORS } from "../src/abi";
import * as schema from "../src/schema";
import { applyAmmV2BlockToDatabase } from "./ammv2-block-processor";
import { ensureFactoryStateSeeded } from "./factory-client";
import { resolveIndexerRuntimeConfig, resolveIndexerStartingBlock } from "./runtime-config";

const runtimeConfig = resolveIndexerRuntimeConfig({
  factoryAddress: process.env.FACTORY_ADDRESS ?? "",
  rpcUrl: process.env.RPC_URL ?? "",
});

const startingBlock = await resolveIndexerStartingBlock({
  factoryAddress: runtimeConfig.factoryAddress,
  rpcUrl: runtimeConfig.rpcUrl,
  startingBlock: process.env.STARTING_BLOCK,
});
const seedBlockNumber = startingBlock > 0n ? startingBlock - 1n : null;

const db = drizzle({
  type: "node-postgres",
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  schema,
});

const STORAGE_ID_COLUMNS = {
  factories: "factory_address",
  pairs: "pair_address",
} as const;

export default defineIndexer(StarknetStream)({
  streamUrl: process.env.STREAM_URL ?? "https://mainnet.starknet.a5a.ch",
  startingBlock,
  plugins: [drizzleStorage({ db, idColumn: STORAGE_ID_COLUMNS })],
  filter: {
    events: [
      { address: runtimeConfig.factoryAddress, keys: [EVENT_SELECTORS.pairCreated] },
      { address: runtimeConfig.factoryAddress, keys: [EVENT_SELECTORS.feeAmountChanged] },
      { address: runtimeConfig.factoryAddress, keys: [EVENT_SELECTORS.feeToChanged] },
      { keys: [EVENT_SELECTORS.transfer] },
      { keys: [EVENT_SELECTORS.sync] },
      { keys: [EVENT_SELECTORS.mint] },
      { keys: [EVENT_SELECTORS.burn] },
      { keys: [EVENT_SELECTORS.swap] },
    ],
  } as any,
  async transform({ block }: { block: any }) {
    const { db: txDb } = useDrizzleStorage();

    await ensureFactoryStateSeeded({
      txDb,
      factoryAddress: runtimeConfig.factoryAddress,
      rpcUrl: runtimeConfig.rpcUrl,
      seedBlockNumber,
    });

    await applyAmmV2BlockToDatabase({
      txDb,
      block,
      factoryAddress: runtimeConfig.factoryAddress,
    });
  },
});
