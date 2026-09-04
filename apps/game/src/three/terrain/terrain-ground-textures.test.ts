import { beforeEach, describe, expect, it, vi } from "vitest";

const loadKtx2Texture = vi.fn();

vi.mock("@/three/utils/utils", () => ({ loadKtx2Texture }));

describe("terrain ground texture ownership", () => {
  beforeEach(() => {
    loadKtx2Texture.mockReset();
    vi.resetModules();
  });

  it("shares one loaded array pair and disposes it after the final release", async () => {
    const albedoHeight = createTextureArray();
    const normalMaterial = createTextureArray();
    loadKtx2Texture.mockResolvedValueOnce(albedoHeight).mockResolvedValueOnce(normalMaterial);
    const { acquireTerrainGroundTextures } = await import("./terrain-ground-textures");

    const first = await acquireTerrainGroundTextures();
    const second = await acquireTerrainGroundTextures();

    expect(loadKtx2Texture).toHaveBeenCalledTimes(2);
    expect(first.textures).toBe(second.textures);
    first.release();
    first.release();
    expect(albedoHeight.dispose).not.toHaveBeenCalled();
    second.release();
    expect(albedoHeight.dispose).toHaveBeenCalledOnce();
    expect(normalMaterial.dispose).toHaveBeenCalledOnce();
  });

  it("disposes the complete pair when array validation fails", async () => {
    const albedoHeight = createTextureArray();
    const normalMaterial = createTextureArray({ depth: 7 });
    loadKtx2Texture.mockResolvedValueOnce(albedoHeight).mockResolvedValueOnce(normalMaterial);
    const { acquireTerrainGroundTextures } = await import("./terrain-ground-textures");

    await expect(acquireTerrainGroundTextures()).rejects.toThrow("expected 8 layers, received 7");
    expect(albedoHeight.dispose).toHaveBeenCalledOnce();
    expect(normalMaterial.dispose).toHaveBeenCalledOnce();
  });

  it("disposes a successful sibling when the other asset load fails", async () => {
    const albedoHeight = createTextureArray();
    loadKtx2Texture.mockResolvedValueOnce(albedoHeight).mockRejectedValueOnce(new Error("network failure"));
    const { acquireTerrainGroundTextures } = await import("./terrain-ground-textures");

    await expect(acquireTerrainGroundTextures()).rejects.toThrow("network failure");
    expect(albedoHeight.dispose).toHaveBeenCalledOnce();
  });
});

function createTextureArray({ depth = 8, mipLevels = 10 } = {}) {
  return {
    dispose: vi.fn(),
    image: { depth },
    isCompressedArrayTexture: true,
    mipmaps: Array.from({ length: mipLevels }, () => ({})),
  };
}
