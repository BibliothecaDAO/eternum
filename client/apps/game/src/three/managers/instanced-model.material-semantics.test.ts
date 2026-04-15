import { beforeEach, describe, expect, it, vi } from "vitest";
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry } from "three";

vi.mock("../utils/contact-shadow", () => ({
  disposeContactShadowResources: vi.fn(),
  getContactShadowResources: () => ({
    geometry: new PlaneGeometry(1, 1),
    material: new MeshBasicMaterial({ color: 0x000000 }),
  }),
}));

function createInstancedModelTestGltf(material: MeshStandardMaterial) {
  const scene = new Group();
  const mesh = new Mesh(new SphereGeometry(1, 8, 8), material);
  mesh.name = "chest";
  scene.add(mesh);

  return {
    scene,
    animations: [],
  };
}

describe("InstancedModel material semantics", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("navigator", {
      getBattery: vi.fn(async () => ({ charging: false })),
      userAgent: "vitest",
    });
  });

  it("preserves blended chest materials instead of forcing alpha-cutout depth writes", async () => {
    const { default: InstancedModel } = await import("./instanced-model");
    const transparentChestMaterial = new MeshStandardMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
      emissiveIntensity: 4,
    });

    const model = new InstancedModel(createInstancedModelTestGltf(transparentChestMaterial), 1, false, "Chest");
    const chestMesh = model.instancedMeshes[0];
    const resolvedMaterial = chestMesh.material as MeshStandardMaterial;

    expect(resolvedMaterial.transparent).toBe(true);
    expect(resolvedMaterial.depthWrite).toBe(false);
    expect(resolvedMaterial.alphaTest).toBe(0);
    expect(resolvedMaterial.emissiveIntensity).toBe(1.5);
  });
});
