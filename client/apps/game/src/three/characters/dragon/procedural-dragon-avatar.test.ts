import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";

import { ProceduralDragonAvatar } from "./procedural-dragon-avatar";
import { applyProceduralDragonConfigPatch, createDefaultProceduralDragonConfig } from "./procedural-dragon-config";
import { createIcyDragonTestLibrary } from "./icy-dragon-test-fixture";

describe("procedural dragon avatar", () => {
  it("never enables real-time shadows on the animated Icy Dragon meshes", () => {
    const library = createIcyDragonTestLibrary();
    const asset = library.instantiate();
    const geometry = new BoxGeometry();
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.castShadow = true;
    asset.scene.add(mesh);
    const baseConfig = createDefaultProceduralDragonConfig();
    const avatar = new ProceduralDragonAvatar(baseConfig, asset);

    expect(mesh.castShadow).toBe(false);

    avatar.updateConfig(applyProceduralDragonConfigPatch(baseConfig, { renderDetail: "crowd" }));
    avatar.updateConfig(applyProceduralDragonConfigPatch(baseConfig, { renderDetail: "quality" }));
    expect(mesh.castShadow).toBe(false);

    avatar.dispose();
    geometry.dispose();
    library.dispose();
  });
});
