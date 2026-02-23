import { describe, expect, it } from "vitest";
import {
  loadPredictionMarketManifest,
  type PredictionMarketManifest,
  type PredictionMarketChain,
} from "./manifest-loader";
import { getPredictionMarketConfigForChain } from "./prediction-market-config";

const getContractAddress = (manifest: PredictionMarketManifest, tag: string): string => {
  return manifest.contracts.find((contract) => contract.tag === tag)?.address ?? "";
};

describe("prediction-market-config", () => {
  it.each<PredictionMarketChain>(["slot", "mainnet"])(
    "keeps static config addresses in sync with %s manifest",
    async (chain) => {
      const manifest = await loadPredictionMarketManifest(chain);
      const config = getPredictionMarketConfigForChain(chain);

      expect(config.worldAddress).toBe(manifest.world.address);
      expect(config.oracleAddress).toBe(getContractAddress(manifest, "pm-StarknetOracle"));
      expect(config.marketsAddress).toBe(getContractAddress(manifest, "pm-Markets"));
    },
  );
});
