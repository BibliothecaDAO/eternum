import type { ApibaraConfig } from "apibara/types";

type RuntimeConfig = {
  [key: string]: unknown;
  factoryAddress: string;
  rpcUrl: string;
  startingBlock: number;
  streamUrl: string;
};

const config: ApibaraConfig<Record<string, never>, RuntimeConfig> = {
  runtimeConfig: {
    factoryAddress: process.env.FACTORY_ADDRESS ?? "",
    rpcUrl: process.env.RPC_URL ?? "",
    streamUrl: process.env.STREAM_URL ?? "https://mainnet.starknet.a5a.ch",
    startingBlock: Number(process.env.STARTING_BLOCK ?? "0"),
  },
};

export default config;
