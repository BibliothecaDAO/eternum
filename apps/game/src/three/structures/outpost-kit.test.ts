import { Box3, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CAMP_MODEL_PATH, SUPPLY_POST_STANDARD_MODEL_PATH, VILLAGE_MODEL_PATH } from "../constants/scene-constants";
import {
  OUTPOST_PATHS,
  isProceduralOutpostKitPath,
  parseOutpostKitPath,
  resolveProceduralOutpostKit,
} from "./outpost-kit";
import { isProceduralModelPath, resolveProceduralModel } from "./procedural-model-resolver";
import { isProcgenMasonryMaterial } from "./procgen-masonry-material";
import { SettlementModel } from "./settlement-model";

vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: () => ({ geometry: new PlaneGeometry(1, 1), material: new MeshBasicMaterial() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const HEX_APOTHEM = Math.sqrt(3) / 2;
const OUTPOST_ENTRIES = Object.entries(OUTPOST_PATHS);

describe("procedural outpost kits", () => {
  it("resolves every outpost path and rejects unknown paths", () => {
    expect(VILLAGE_MODEL_PATH).toBe(OUTPOST_PATHS.village);
    expect(CAMP_MODEL_PATH).toBe(OUTPOST_PATHS.camp);
    expect(SUPPLY_POST_STANDARD_MODEL_PATH).toBe(OUTPOST_PATHS["cleared-standard"]);

    for (const [kind, path] of OUTPOST_ENTRIES) {
      expect(isProceduralOutpostKitPath(path)).toBe(true);
      expect(isProceduralModelPath(path)).toBe(true);
      expect(parseOutpostKitPath(path)).toBe(kind);
      expect(resolveProceduralOutpostKit(path)).not.toBeNull();
      expect(resolveProceduralModel(path)).not.toBeNull();
    }

    expect(isProceduralOutpostKitPath("procedural:outpost:unknown")).toBe(false);
    expect(isProceduralOutpostKitPath("/models/outposts/shrine.glb")).toBe(false);
    expect(parseOutpostKitPath("procedural:outpost:shrine")).toBeNull();
    expect(resolveProceduralOutpostKit("/models/outposts/ruin.glb")).toBeNull();
  });

  it.each(OUTPOST_ENTRIES)(
    "%s sits floorless on y=0 inside the pointy hex with shared masonry and ownership cloth",
    (_kind, path) => {
      const gltf = resolveProceduralOutpostKit(path)!;
      const meshes: Mesh[] = [];
      gltf.scene.traverse((node) => {
        expect(node.scale.x).toBe(1);
        expect(node.scale.y).toBe(1);
        expect(node.scale.z).toBe(1);
        if (node instanceof Mesh) meshes.push(node);
      });

      expect(meshes).toHaveLength(2);
      const body = meshes.find((mesh) => mesh.name.endsWith(":body"))!;
      const cloth = meshes.find((mesh) => mesh.name.endsWith(":cloth"))!;
      expect(body).toBeDefined();
      expect(cloth).toBeDefined();
      expect(isProcgenMasonryMaterial(body.material as MeshStandardMaterial)).toBe(true);
      expect(cloth.material).toBeInstanceOf(MeshStandardMaterial);
      expect(cloth.userData.relationshipCloth).toBe("trim");

      const bounds = new Box3().setFromObject(gltf.scene);
      expect(bounds.min.y).toBeCloseTo(0, 4);
      expect(bounds.max.y).toBeGreaterThan(0.7);
      expect(bounds.max.y).toBeLessThan(1.25);

      const maxAbsX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
      expect(maxAbsX).toBeLessThanOrEqual(HEX_APOTHEM + 0.03);
      expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThanOrEqual(1.0);
    },
  );

  it("keeps the cleared standard outside the supply post centre radius", () => {
    const gltf = resolveProceduralOutpostKit(OUTPOST_PATHS["cleared-standard"])!;
    const bounds = new Box3().setFromObject(gltf.scene);
    const closestX = Math.max(bounds.min.x, Math.min(0, bounds.max.x));
    const closestZ = Math.max(bounds.min.z, Math.min(0, bounds.max.z));
    expect(Math.hypot(closestX, closestZ)).toBeGreaterThanOrEqual(0.45);
  });

  it("mounts every outpost in SettlementModel with working ownership heraldry", () => {
    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn(),
    };
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });

    for (const [, path] of OUTPOST_ENTRIES) {
      const gltf = resolveProceduralOutpostKit(path)!;
      const model = new SettlementModel(gltf, 2, "village");
      model.setCount(2);
      model.setRelationshipAt(0, "owned");
      model.setRelationshipAt(1, "enemy");
      expect(model.instancedMeshes).toHaveLength(2);
      const clothInstance = model.instancedMeshes.find((mesh) => mesh.geometry.getAttribute("settlementHeraldry"));
      expect(clothInstance).toBeDefined();
      expect(Array.from(clothInstance!.geometry.getAttribute("settlementHeraldry").array.slice(0, 2))).toEqual([0, 1]);
      model.dispose();
    }
  });
});
