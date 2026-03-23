import type { ApibaraConfig } from "apibara/types";

type RuntimeConfig = {
  [key: string]: unknown;
  ammAddress: string;
  streamUrl: string;
  startingBlock: number;
};

const config: ApibaraConfig<Record<string, never>, RuntimeConfig> = {
  runtimeConfig: {
    ammAddress: process.env.AMM_ADDRESS ?? "",
    streamUrl: process.env.STREAM_URL ?? "https://mainnet.starknet.a5a.ch",
    startingBlock: Number(process.env.STARTING_BLOCK ?? "0"),
  },
};

export default config;
