// @vitest-environment node
import { readFileSync } from "node:fs";
import { Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TERRAIN_HEX_HORIZONTAL_SPACING } from "../../terrain/terrain-coordinates";
import { createShipDesign, type ShipArmyClass, type ShipTier } from "./ship-design";

const classes: ShipArmyClass[] = ["knight", "crossbowman", "paladin"];
const tiers: ShipTier[] = [1, 2, 3];
const templates = new Map<string, Group>();

async function loadFleetGeometry(army: ShipArmyClass, tier: ShipTier) {
  const bytes = readFileSync(new URL(`../../../../public/models/ships/${army}-t${tier}.glb`, import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  // Retain real geometry, pivots and materials; image decoding belongs to the browser smoke check.
  const binary = bytes.subarray(28 + jsonLength);
  json.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString("base64")}`;
  for (const material of json.materials) {
    delete material.pbrMetallicRoughness?.baseColorTexture;
  }
  json.images = [];
  json.textures = [];
  return (await new GLTFLoader().parseAsync(JSON.stringify(json), "")).scene;
}

beforeAll(async () => {
  vi.stubGlobal("ProgressEvent", class extends Event {});
  for (const army of classes)
    for (const tier of tiers) templates.set(`${army}-${tier}`, await loadFleetGeometry(army, tier));
});

afterAll(() => vi.unstubAllGlobals());

function template(army: ShipArmyClass, tier: ShipTier) {
  return templates.get(`${army}-${tier}`)!;
}

describe("Blender fleet assets", () => {
  it("keeps every real ship at the same size and inside one hex throughout sailing", () => {
    const point = new Vector3();
    const apothem = TERRAIN_HEX_HORIZONTAL_SPACING / 2;
    const lengths = new Set<number>();
    const scales = new Set<number>();
    for (const army of classes)
      for (const tier of tiers) {
        const design = createShipDesign(template(army, tier), army, tier);
        lengths.add(design.length);
        scales.add(design.object.scale.x);
        design.setWind(2);
        let radius = 0;
        let finite = true;
        for (const seconds of [0, 0.5, 1, 2, 3, 4, 5, 6]) {
          design.animate(seconds, true);
          design.object.rotation.y = seconds;
          design.object.updateMatrixWorld(true);
          design.object.traverseVisible((object) => {
            if (!(object instanceof Mesh)) return;
            const positions = object.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
              point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
              finite &&= Number.isFinite(point.lengthSq());
              radius = Math.max(radius, Math.hypot(point.x, point.z));
            }
          });
        }
        expect(finite).toBe(true);
        expect(radius).toBeLessThan(apothem);
        expect(design.triangles).toBeGreaterThan(1000);
        expect(design.triangles).toBeLessThan(60000);
        design.dispose();
      }
    expect([...lengths]).toEqual([1.26]);
    expect([...scales]).toEqual([0.3]);
  });

  it("animates sail cloth and pennants, pins sail heads, and loops without a seam", () => {
    for (const army of classes)
      for (const tier of tiers) {
        const source = template(army, tier);
        const design = createShipDesign(source, army, tier);
        const sails: Mesh[] = [];
        design.object.traverse((node) => {
          if (node instanceof Mesh && /^Sail_/.test(node.name)) sails.push(node);
        });
        expect(sails).toHaveLength(tier === 1 ? 1 : 2);
        expect(design.object.getObjectByName("BoardingRamp")).toBeUndefined();
        const sail = sails[0];
        const rest = (source.getObjectByName(sail.name) as Mesh).geometry.attributes.position;
        const uv = Array.from(sail.geometry.attributes.uv.array);
        design.setWind(0);
        design.animate(2, true);
        expect(
          Math.max(
            ...Array.from(sail.geometry.attributes.position.array, (value, i) => Math.abs(value - rest.array[i])),
          ),
        ).toBeLessThan(1e-7);
        design.setWind(1.8);
        design.animate(1.5, true);
        let displacement = 0;
        const positions = sail.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          displacement = Math.max(displacement, Math.abs(positions.getZ(i) - rest.getZ(i)));
          if (
            sail.geometry.attributes.uv.getY(i) < 1e-5 ||
            Math.abs(sail.geometry.attributes.uv.getX(i) * 2 - 1) > 0.99999
          )
            expect(positions.getZ(i)).toBeCloseTo(rest.getZ(i), 5);
        }
        expect(displacement).toBeGreaterThan(0.08);
        expect(Array.from(sail.geometry.attributes.uv.array)).toEqual(uv);
        design.animate(0, true);
        const start = Array.from(positions.array);
        design.animate(6, true);
        Array.from(positions.array).forEach((value, i) => expect(value).toBeCloseTo(start[i], 5));
        design.dispose();
      }
  });

  it("keeps every sail in front of its mast throughout a full cycle at maximum wind", () => {
    for (const army of classes)
      for (const tier of tiers) {
        const design = createShipDesign(template(army, tier), army, tier);
        design.setWind(2);
        for (let frame = 0; frame <= 48; frame++) {
          design.animate(frame / 8, true);
          design.object.traverse((node) => {
            if (!(node instanceof Mesh) || !node.name.startsWith("Sail_")) return;
            const [, , mastZ] = node.userData.clothMastStart;
            const radius = node.userData.clothMastRadius;
            const positions = node.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) expect(positions.getZ(i)).toBeLessThan(mastZ - radius - 0.014);
          });
        }
        design.dispose();
      }
  });

  it("keeps player sail prints independent while preserving the shared texture owner", () => {
    const first = createShipDesign(template("knight", 3), "knight", 3);
    const second = createShipDesign(template("knight", 3), "knight", 3);
    const print = new Texture(),
      disposed = vi.fn();
    print.addEventListener("dispose", disposed);
    first.setSailPrint(print, "#123456");
    second.setSailPrint(null, "#abcdef");
    first.object.traverse((node) => {
      if (node instanceof Mesh && node.name.startsWith("Sail_"))
        expect((node.material as MeshStandardMaterial).map).toBe(print);
    });
    second.object.traverse((node) => {
      if (node instanceof Mesh && node.name.startsWith("Sail_"))
        expect((node.material as MeshStandardMaterial).map).toBeNull();
    });
    first.dispose();
    second.dispose();
    expect(disposed).not.toHaveBeenCalled();
  });

  it("preserves shared source resources and releases each clone once", () => {
    const asset = template("paladin", 3);
    let source: Mesh | undefined;
    asset.traverse((object) => {
      if (object instanceof Mesh) source ??= object;
    });
    const original = source!;
    const positions = Array.from(original.geometry.attributes.position.array);
    const sharedTexture = new Texture();
    (original.material as MeshStandardMaterial).map = sharedTexture;
    const sourceDisposed = vi.fn(),
      textureDisposed = vi.fn(),
      cloneDisposed = vi.fn();
    original.geometry.addEventListener("dispose", sourceDisposed);
    sharedTexture.addEventListener("dispose", textureDisposed);
    const design = createShipDesign(asset, "paladin", 3);
    design.object.traverse((object) => {
      if (object instanceof Mesh) object.geometry.addEventListener("dispose", cloneDisposed);
    });
    design.animate(2, true);
    design.setWireframe(true);
    design.dispose();
    const calls = cloneDisposed.mock.calls.length;
    design.dispose();
    expect(calls).toBeGreaterThan(0);
    expect(cloneDisposed).toHaveBeenCalledTimes(calls);
    expect(Array.from(original.geometry.attributes.position.array)).toEqual(positions);
    expect((original.material as MeshStandardMaterial).wireframe).toBe(false);
    expect(sourceDisposed).not.toHaveBeenCalled();
    expect(textureDisposed).not.toHaveBeenCalled();
  });
});
