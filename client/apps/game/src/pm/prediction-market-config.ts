import { env } from "../../env";
import manifestMainnet from "./manifests/manifest_mainnet_1-7.json";
import manifestSlot from "./manifests/manifest_slot.json";

type PredictionMarketChain = "slot" | "mainnet";

type PredictionMarketConfig = {
  toriiUrl: string;
  worldAddress: string;
  collateralToken: string;
  oracleAddress: string;
};

const getOracleAddress = (manifest: typeof manifestSlot): string => {
  const oracle = manifest.contracts.find((c) => c.tag === "pm-StarknetOracle");
  return oracle?.address ?? "";
};

const SLOT_CONFIG: PredictionMarketConfig = {
  toriiUrl: "https://api.cartridge.gg/x/blitz-slot-pm-1/torii",
  worldAddress: manifestSlot.world.address,
  collateralToken: "0x062cbbb9e30d90264ac63586d4f000be3cf5c178f11ae48f11f8b659eb060ac5",
  oracleAddress: getOracleAddress(manifestSlot),
};

const MAINNET_CONFIG: PredictionMarketConfig = {
  toriiUrl: "https://api.cartridge.gg/x/blitz-mainnet-pm-1/torii",
  worldAddress: manifestMainnet.world.address,
  collateralToken: "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
  oracleAddress: getOracleAddress(manifestMainnet as typeof manifestSlot),
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
