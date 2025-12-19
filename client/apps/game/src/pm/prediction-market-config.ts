import { env } from "../../env";

export type PredictionMarketChain = "slot" | "mainnet";

export type PredictionMarketConfig = {
  toriiUrl: string;
  worldAddress: string;
  collateralToken: string;
  oracleAddress: string;
};

const SLOT_CONFIG: PredictionMarketConfig = {
  toriiUrl: "https://api.cartridge.gg/x/blitz-slot-pm-1/torii",
  worldAddress: "0x0172e470e28b6ad5f4c397019a3aca0c9b451a5e06f5255fbb8c4eefcd6f2b58",
  collateralToken: "0x062cbbb9e30d90264ac63586d4f000be3cf5c178f11ae48f11f8b659eb060ac5",
  oracleAddress: "0x0693278fb06d7041f884c50cb9d0e2d4620ed16f282cf8c76fddb712ef1060d2",
};

const MAINNET_CONFIG: PredictionMarketConfig = {
  // TODO: Update these with actual mainnet values
  toriiUrl: "https://api.cartridge.gg/x/blitz-mainnet-pm-1/torii",
  worldAddress: "0x0050ed913cc4b5fb11f50b5e1118d2999ee3e7917a7349bc34900fd76b307b5d", // TODO: Set mainnet world address
  collateralToken: "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49", // TODO: Set mainnet collateral token (LORDS)
  oracleAddress: "0x29a5b569aafbaef3ee0fa7d9f247a9c0543dc89091f2b974e4a18b24e2fc426", // TODO: Set mainnet oracle address
};

const CONFIG_BY_CHAIN: Record<PredictionMarketChain, PredictionMarketConfig> = {
  slot: SLOT_CONFIG,
  mainnet: MAINNET_CONFIG,
};

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
  return CONFIG_BY_CHAIN[getPredictionMarketChain()];
}
