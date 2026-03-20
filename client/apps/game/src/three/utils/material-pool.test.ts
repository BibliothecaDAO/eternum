import { afterEach, describe, expect, it } from "vitest";
import { Color, MeshBasicMaterial, MeshStandardMaterial, Texture } from "three";
import { MaterialPool } from "./material-pool";

describe("MaterialPool", () => {
  afterEach(() => {
    MaterialPool.getInstance().dispose();
  });

  it("preserves alpha and depth semantics for pooled standard materials", () => {
    const texture = new Texture();
    const source = new MeshStandardMaterial({
      map: texture,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      depthTest: false,
      alphaTest: 0.3,
      emissive: new Color("#224466"),
      metalness: 0.8,
      roughness: 0.1,
      vertexColors: true,
    });

    const pooled = MaterialPool.getInstance().getStandardMaterial(source);

    expect(pooled.alphaTest).toBe(0.3);
    expect(pooled.depthWrite).toBe(false);
    expect(pooled.depthTest).toBe(false);
    expect(pooled.vertexColors).toBe(true);
    expect(pooled.emissive.getHex()).toBe(source.emissive.getHex());
    expect(pooled.map).toBe(texture);
  });

  it("disposes pooled materials when the final reference is released", () => {
    const source = new MeshBasicMaterial({ transparent: true, opacity: 0.5 });
    const pooledA = MaterialPool.getInstance().getBasicMaterial(source);
    const pooledB = MaterialPool.getInstance().getBasicMaterial(source);

    MaterialPool.getInstance().releaseMaterial(pooledA);
    expect(MaterialPool.getInstance().getStats().uniqueMaterials).toBe(1);

    MaterialPool.getInstance().releaseMaterial(pooledB);
    expect(MaterialPool.getInstance().getStats().uniqueMaterials).toBe(0);
  });
});
