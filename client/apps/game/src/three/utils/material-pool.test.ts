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

  it("shares exact materials whose embedded textures have the same content", () => {
    const textureA = new Texture();
    const textureB = new Texture();
    textureA.userData.eternumContentHash = "same-content";
    textureB.userData.eternumContentHash = "same-content";
    const sourceA = new MeshStandardMaterial({ map: textureA, roughness: 0.7 });
    const sourceB = new MeshStandardMaterial({ map: textureB, roughness: 0.7 });
    sourceA.name = "source-a";
    sourceB.name = "source-b";

    const pooledA = MaterialPool.getInstance().getStandardMaterial(sourceA);
    const pooledB = MaterialPool.getInstance().getStandardMaterial(sourceB);

    expect(pooledB).toBe(pooledA);
    expect(MaterialPool.getInstance().getStats()).toMatchObject({
      totalReferences: 2,
      uniqueMaterials: 1,
    });
  });

  it("keeps different texture content and rendering parameters distinct", () => {
    const textureA = new Texture();
    const textureB = new Texture();
    textureA.userData.eternumContentHash = "content-a";
    textureB.userData.eternumContentHash = "content-b";

    const contentA = MaterialPool.getInstance().getStandardMaterial(
      new MeshStandardMaterial({ map: textureA, roughness: 0.7 }),
    );
    const contentB = MaterialPool.getInstance().getStandardMaterial(
      new MeshStandardMaterial({ map: textureB, roughness: 0.7 }),
    );
    const differentRoughness = MaterialPool.getInstance().getStandardMaterial(
      new MeshStandardMaterial({ map: textureA, roughness: 0.2 }),
    );

    expect(contentB).not.toBe(contentA);
    expect(differentRoughness).not.toBe(contentA);
  });

  it("includes non-color texture slots in the exact signature", () => {
    const normalA = new Texture();
    const normalB = new Texture();
    normalA.userData.eternumContentHash = "normal-a";
    normalB.userData.eternumContentHash = "normal-b";

    const pooledA = MaterialPool.getInstance().getStandardMaterial(new MeshStandardMaterial({ normalMap: normalA }));
    const pooledB = MaterialPool.getInstance().getStandardMaterial(new MeshStandardMaterial({ normalMap: normalB }));

    expect(pooledB).not.toBe(pooledA);
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
