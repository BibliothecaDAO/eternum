import { env } from "../../env";
import type { PredictionMarketChain } from "./manifest-loader";

type PredictionMarketConfig = {
  toriiUrl: string;
  worldAddress: string;
  collateralToken: string;
  oracleAddress: string;
  marketsAddress: string;
};

// Keep these addresses in sync with ./manifests/*.json. We avoid eager JSON imports here to keep PM manifests lazy.
const SLOT_CONFIG: PredictionMarketConfig = {
  toriiUrl: env.VITE_PUBLIC_GLOBAL_TORII,
  worldAddress: "0x172e470e28b6ad5f4c397019a3aca0c9b451a5e06f5255fbb8c4eefcd6f2b58",
  collateralToken: "0x062cbbb9e30d90264ac63586d4f000be3cf5c178f11ae48f11f8b659eb060ac5",
  oracleAddress: "0x693278fb06d7041f884c50cb9d0e2d4620ed16f282cf8c76fddb712ef1060d2",
  marketsAddress: "0x1d2b6e5a030a8af64587c80ebdcb7a8a6be71902d4f4c32617674c7221f70aa",
};

const MAINNET_CONFIG: PredictionMarketConfig = {
  toriiUrl: env.VITE_PUBLIC_GLOBAL_TORII,
  worldAddress: "0x50ed913cc4b5fb11f50b5e1118d2999ee3e7917a7349bc34900fd76b307b5d",
  collateralToken: "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
  oracleAddress: "0x29a5b569aafbaef3ee0fa7d9f247a9c0543dc89091f2b974e4a18b24e2fc426",
  marketsAddress: "0x2a9a4c1dfec9ee967e9a5dae8e2126ef837bdcecd0b2c9fd5f2afafd6fd314a",
};

const CONFIG_BY_CHAIN: Record<PredictionMarketChain, PredictionMarketConfig> = {
  slot: SLOT_CONFIG,
  mainnet: MAINNET_CONFIG,
};

export function getPredictionMarketConfigForChain(chain: PredictionMarketChain): PredictionMarketConfig {
  return CONFIG_BY_CHAIN[chain];
}

/**
 * Returns the prediction market chain based on VITE_PUBLIC_CHAIN env variable.
 * Maps "mainnet" to "mainnet", everything else to "slot".
 */
export function getPredictionMarketChain(): PredictionMarketChain {
  return env.VITE_PUBLIC_CHAIN === "mainnet" ? "mainnet" : "slot";
}

/**
 * Returns the prediction market configuration based on the current chain.
 */
export function getPredictionMarketConfig(): PredictionMarketConfig {
  return getPredictionMarketConfigForChain(getPredictionMarketChain());
}
