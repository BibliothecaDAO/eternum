// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadPredictionMarketManifest,
  type PredictionMarketManifest,
  type PredictionMarketChain,
} from "./manifest-loader";
import { getPredictionMarketChain, getPredictionMarketConfigForChain } from "./prediction-market-config";

const ACTIVE_KEY = "ACTIVE_WORLD_NAME";
const CHAIN_KEY = "ACTIVE_WORLD_CHAIN";
const PROFILES_KEY = "WORLD_PROFILES";

const createLocalStorage = () => {
  const values = new Map<string, string>();

  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

const getContractAddress = (manifest: PredictionMarketManifest, tag: string): string => {
  return manifest.contracts.find((contract) => contract.tag === tag)?.address ?? "";
};

describe("prediction-market-config", () => {
  beforeEach(() => {
    const localStorage = createLocalStorage();
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("window", { localStorage });
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it.each<PredictionMarketChain>(["mainnet"])(
    "keeps static config addresses in sync with %s manifest",
    async (chain) => {
      const manifest = await loadPredictionMarketManifest(chain);
      const config = getPredictionMarketConfigForChain(chain);

      expect(config.worldAddress).toBe(manifest.world.address);
      expect(config.oracleAddress).toBe(getContractAddress(manifest, "pm-StarknetOracle"));
      expect(config.marketsAddress).toBe(getContractAddress(manifest, "pm-Markets"));
    },
  );

  it("resolves to the prediction market deployment chain regardless of the active world", () => {
    window.localStorage.setItem(ACTIVE_KEY, "bltz-riff-363");
    window.localStorage.setItem(CHAIN_KEY, "appchain");
    window.localStorage.setItem(
      PROFILES_KEY,
      JSON.stringify({
        "bltz-riff-363": {
          name: "bltz-riff-363",
          chain: "appchain",
          toriiBaseUrl: "http://realms-appchain.invalid:8080",
          rpcUrl: "http://realms-appchain.invalid",
          worldAddress: "0x123",
          contractsBySelector: {},
          fetchedAt: 1,
        },
      }),
    );

    expect(getPredictionMarketChain()).toBe("mainnet");
  });

  it("always resolves to the prediction market deployment chain", () => {
    expect(getPredictionMarketChain()).toBe("mainnet");
  });
});
