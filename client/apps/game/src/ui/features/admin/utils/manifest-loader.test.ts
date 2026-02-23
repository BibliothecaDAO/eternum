import { describe, expect, it, vi } from "vitest";
import { getManifestJsonString, type ChainType, type ManifestSourceLoader } from "./manifest-loader";

const CHAINS: ChainType[] = ["local", "sepolia", "mainnet", "slot", "slottest"];

describe("admin manifest-loader", () => {
  it.each(CHAINS)("returns parseable manifest JSON for %s via async loader", async (chain) => {
    const result = getManifestJsonString(chain);
    expect(result).toBeInstanceOf(Promise);

    const manifestJson = await result;
    const manifest = JSON.parse(manifestJson);

    expect(manifest.world).toBeTruthy();
    expect(Array.isArray(manifest.contracts)).toBe(true);
    expect(Array.isArray(manifest.models)).toBe(true);
    expect(Array.isArray(manifest.events)).toBe(true);
  });

  it("returns an empty string for unknown chain values", async () => {
    expect(await getManifestJsonString("unknown" as ChainType)).toBe("");
  });

  it("returns an empty string when manifest source loading throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingLoader = vi.fn<ManifestSourceLoader>().mockRejectedValue(new Error("manifest exploded"));

    const manifestJson = await getManifestJsonString("slot", failingLoader);

    expect(failingLoader).toHaveBeenCalledWith("slot");
    expect(manifestJson).toBe("");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
