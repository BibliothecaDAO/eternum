import { describe, expect, it } from "vitest";
import { loadPredictionMarketManifest, type PredictionMarketChain } from "./manifest-loader";

describe("prediction market manifest-loader", () => {
  it("loads slot manifest on demand", async () => {
    const manifest = await loadPredictionMarketManifest("slot");

    expect(manifest.world.address).toBe("0x172e470e28b6ad5f4c397019a3aca0c9b451a5e06f5255fbb8c4eefcd6f2b58");
    expect(Array.isArray(manifest.contracts)).toBe(true);
  });

  it("loads mainnet manifest on demand", async () => {
    const manifest = await loadPredictionMarketManifest("mainnet");

    expect(manifest.world.address).toBe("0x50ed913cc4b5fb11f50b5e1118d2999ee3e7917a7349bc34900fd76b307b5d");
    expect(Array.isArray(manifest.contracts)).toBe(true);
  });

  it("rejects unsupported chain values", async () => {
    await expect(loadPredictionMarketManifest("invalid" as PredictionMarketChain)).rejects.toThrow(
      /unsupported prediction market chain/i,
    );
  });
});
