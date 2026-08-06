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
const MAINNET_CONFIG: PredictionMarketConfig = {
  toriiUrl: env.VITE_PUBLIC_GLOBAL_TORII,
  worldAddress: "0x50ed913cc4b5fb11f50b5e1118d2999ee3e7917a7349bc34900fd76b307b5d",
  collateralToken: "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
  oracleAddress: "0x29a5b569aafbaef3ee0fa7d9f247a9c0543dc89091f2b974e4a18b24e2fc426",
  marketsAddress: "0x2a9a4c1dfec9ee967e9a5dae8e2126ef837bdcecd0b2c9fd5f2afafd6fd314a",
};

const CONFIG_BY_CHAIN: Record<PredictionMarketChain, PredictionMarketConfig> = {
  mainnet: MAINNET_CONFIG,
};

export function getPredictionMarketConfigForChain(chain: PredictionMarketChain): PredictionMarketConfig {
  return CONFIG_BY_CHAIN[chain];
}

/**
 * Returns the prediction market chain for the active runtime world.
 * Prediction markets are only deployed on mainnet, so every runtime chain
 * resolves there.
 */
export function getPredictionMarketChain(): PredictionMarketChain {
  return "mainnet";
}

/**
 * Returns the prediction market configuration for the deployment chain.
 */
export function getPredictionMarketConfig(): PredictionMarketConfig {
  return getPredictionMarketConfigForChain(getPredictionMarketChain());
}
