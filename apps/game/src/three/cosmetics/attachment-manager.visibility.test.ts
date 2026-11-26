import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Scene } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as assetCache from "./asset-cache";
import { CosmeticAttachmentManager } from "./attachment-manager";
import type { CosmeticAttachmentTemplate, CosmeticRegistryEntry } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CosmeticAttachmentManager slot visibility", () => {
  it("hides procedural-owned props without hiding an unrelated aura", () => {
    const manager = new CosmeticAttachmentManager(new Scene());
    const weapon = new Object3D();
    const quiver = new Object3D();
    const aura = new Object3D();
    (manager as unknown as { attachments: Map<number, unknown[]> }).attachments.set(17, [
      { id: "weapon", object: weapon, template: { id: "weapon", slot: "weapon" } },
      { id: "quiver", object: quiver, template: { id: "quiver", slot: "back" } },
      { id: "aura", object: aura, template: { id: "aura", slot: "aura" } },
    ]);

    manager.setAttachmentSlotsVisible(17, new Set(["back", "offhand", "weapon"]), false);

    expect(weapon.visible).toBe(false);
    expect(quiver.visible).toBe(false);
    expect(aura.visible).toBe(true);

    manager.setAttachmentSlotsVisible(17, new Set(["back", "offhand", "weapon"]), true);
    expect(weapon.visible).toBe(true);
    expect(quiver.visible).toBe(true);
    expect(aura.visible).toBe(true);
  });

  it("keeps a ready cosmetic attachment behind a placeholder until compilePipelines finishes", async () => {
    const scene = new Scene();
    const gltfScene = new Group();
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.name = "cosmetic-aura-mesh";
    gltfScene.add(mesh);
    const payload = {
      gltfs: [{ scene: gltfScene }],
      textures: [],
      materials: [],
    } as unknown as assetCache.CosmeticAssetPayload;
    const entry = {
      id: "aura-entry",
      assetPaths: ["/models/aura.glb"],
      attachments: [],
    } as unknown as CosmeticRegistryEntry;
    const template: CosmeticAttachmentTemplate = { id: "aura-template", slot: "aura" };

    vi.spyOn(assetCache, "ensureCosmeticAsset").mockReturnValue({
      entry,
      status: "ready",
      payload,
    });
    vi.spyOn(assetCache, "loadCosmeticAsset").mockResolvedValue(payload);

    let finishCompile!: () => void;
    const compilePipelines = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCompile = resolve;
        }),
    );

    const manager = new CosmeticAttachmentManager(scene, compilePipelines);
    (
      manager as unknown as {
        templateSources: Map<string, { entry: CosmeticRegistryEntry; template: CosmeticAttachmentTemplate }>;
      }
    ).templateSources.set(template.id, { entry, template });

    manager.spawnAttachments(99, [template]);

    expect(scene.getObjectByName("cosmetic-aura-mesh")).toBeUndefined();
    await vi.waitFor(() => expect(compilePipelines).toHaveBeenCalledWith(gltfScene, scene));
    expect(scene.getObjectByName("cosmetic-aura-mesh")).toBeUndefined();

    finishCompile();
    await vi.waitFor(() => expect(scene.getObjectByName("cosmetic-aura-mesh")).toBeDefined());
    manager.clear();
  });
});
