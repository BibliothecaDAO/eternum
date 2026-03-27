import { defineIndexer } from "apibara/indexer";
import { StarknetStream, getSelector } from "@apibara/starknet";
import { drizzleStorage, useDrizzleStorage, drizzle } from "@apibara/plugin-drizzle";
import * as schema from "../src/schema";
import { EVENT_NAME } from "../src/abi";
import { applyAmmBlockToDatabase } from "./amm-block-processor";
import { resolveIndexerRuntimeConfig } from "./runtime-config";

const runtimeConfig = resolveIndexerRuntimeConfig({
  ammAddress: process.env.AMM_ADDRESS ?? "",
  lordsAddress: process.env.LORDS_ADDRESS ?? "",
});
const ammAddress = runtimeConfig.ammAddress as `0x${string}`;

const db = drizzle({
  type: "node-postgres",
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  schema,
});

export default defineIndexer(StarknetStream)({
  streamUrl: process.env.STREAM_URL ?? "https://mainnet.starknet.a5a.ch",
  startingBlock: BigInt(process.env.STARTING_BLOCK ?? "0"),
  plugins: [drizzleStorage({ db })],
  filter: {
    events: [
      {
        address: ammAddress,
        keys: [getSelector("PoolCreated")],
      },
      {
        address: ammAddress,
        keys: [getSelector("LiquidityAdded")],
      },
      {
        address: ammAddress,
        keys: [getSelector("LiquidityRemoved")],
      },
      {
        address: ammAddress,
        keys: [getSelector("Swap")],
      },
      {
        address: ammAddress,
        keys: [getSelector("PoolFeeChanged")],
      },
      {
        address: ammAddress,
        keys: [getSelector("FeeRecipientChanged")],
      },
    ],
  },
  async transform({ block }) {
    const { db: txDb } = useDrizzleStorage();
    await applyAmmBlockToDatabase({
      txDb,
      block,
      lordsAddress: runtimeConfig.lordsAddress,
    });
  },
});
