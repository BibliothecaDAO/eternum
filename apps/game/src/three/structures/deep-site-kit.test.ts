import { ASPECT_HEX } from "@/tokens";
import { aspects } from "@bibliothecadao/types";
import { Box3, Color, Mesh, MeshStandardMaterial, Triangle, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import {
  createDeepAltarKit,
  createDeepArchiveKit,
  createDeepCoreKit,
  createDeepGateKit,
  createDeepGateVeilGeometry,
  createDeepGateVeilMaterial,
  createDeepMineKit,
  DEEP_ALTAR_HEIGHT,
  DEEP_ARCHIVE_HEIGHT,
  DEEP_CORE_HEIGHT,
  DEEP_GATE_HEIGHT,
  DEEP_MINE_HEIGHT,
} from "./deep-site-kit";
import { createProcgenMasonryMaterial, isProcgenMasonryMaterial } from "./procgen-masonry-material";

const HEX_APOTHEM = Math.sqrt(3) / 2;
const MAX_GATE_TRIANGLES = 3_500;
const MAX_GATE_HEIGHT_TO_WIDTH = 1.2;
const MAX_ARCHIVE_TRIANGLES = 4_500;
const MAX_ARCHIVE_HEIGHT_TO_WIDTH = 1.15;
const MAX_CORE_TRIANGLES = 4_500;
const MAX_CORE_HEIGHT_TO_WIDTH = 1.15;
const MAX_MINE_TRIANGLES = 4_500;
const MAX_MINE_HEIGHT_TO_WIDTH = 1.15;
const MAX_ALTAR_TRIANGLES = 4_500;
const MAX_ALTAR_HEIGHT_TO_WIDTH = 1.15;

function countTriangles(mesh: Mesh): number {
  const index = mesh.geometry.getIndex();
  const count = index?.count ?? mesh.geometry.getAttribute("position").count;
  return count / 3;
}

describe("procedural Deep site kits", () => {
  it("builds grounded, floorless, hex-fit Deep Gates with shared ProcgenMasonryNodeMaterial for all four Aspects", () => {
    const sharedMasonry = createProcgenMasonryMaterial();
    const sharedKey = sharedMasonry.customProgramCacheKey();
    const triangle = new Triangle();
    const normal = new Vector3();
    const aspectSignatures = new Set<string>();

    for (const { id: aspect, name } of aspects) {
      const kit = createDeepGateKit(aspect);
      const meshes: Mesh[] = [];
      let totalTriangles = 0;
      const bounds = new Box3();

      kit.scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        meshes.push(node);
        expect(node.scale.x).toBe(1);
        expect(node.scale.y).toBe(1);
        expect(node.scale.z).toBe(1);

        const geometry = node.geometry;
        for (const attr of ["position", "normal", "uv"]) {
          const buffer = geometry.getAttribute(attr);
          expect(buffer, `${name} ${node.name} ${attr}`).toBeDefined();
          expect(Array.from(buffer.array).every(Number.isFinite), `${name} ${node.name} ${attr}`).toBe(true);
        }
        const positions = geometry.getAttribute("position");
        const index = geometry.getIndex();
        const count = index?.count ?? positions.count;
        for (let face = 0; face < count; face += 3) {
          triangle.a.fromBufferAttribute(positions, index ? index.getX(face) : face);
          triangle.b.fromBufferAttribute(positions, index ? index.getX(face + 1) : face + 1);
          triangle.c.fromBufferAttribute(positions, index ? index.getX(face + 2) : face + 2);
          expect(triangle.getArea(), `${name} ${node.name} face ${face / 3}`).toBeGreaterThan(1e-12);
          expect(triangle.getNormal(normal).length(), `${name} ${node.name}`).toBeCloseTo(1, 5);
        }

        totalTriangles += countTriangles(node);
        geometry.computeBoundingBox();
        bounds.union(geometry.boundingBox!);
      });

      expect(meshes.length).toBe(2);
      const [masonry, accent] = meshes;
      expect(isProcgenMasonryMaterial(masonry!.material as MeshStandardMaterial)).toBe(true);
      expect(masonry!.material).toBeInstanceOf(FrostedStandardNodeMaterial);
      const masonryMat = masonry!.material as FrostedStandardNodeMaterial;
      expect(masonryMat.customProgramCacheKey()).toBe(sharedKey);
      expect(masonryMat.map).toBeNull();
      expect(masonryMat.bumpMap).toBeNull();
      expect(masonryMat.roughnessMap).toBeNull();
      expect(masonry!.geometry.getAttribute("color")).toBeDefined();

      const accentMat = accent!.material as MeshStandardMaterial;
      expect(accentMat.color.getHex()).toBe(new Color(ASPECT_HEX[aspect]).getHex());
      aspectSignatures.add(accentMat.color.getHexString());

      expect(totalTriangles).toBeGreaterThan(300);
      expect(totalTriangles).toBeLessThanOrEqual(MAX_GATE_TRIANGLES);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.002);
      expect(bounds.min.y).toBeLessThanOrEqual(0.005);
      expect(bounds.max.y).toBeCloseTo(DEEP_GATE_HEIGHT, 2);
      expect(bounds.max.y).toBeLessThanOrEqual(1.4);

      const width = bounds.max.x - bounds.min.x;
      expect(bounds.max.y / width, `${name} H/W`).toBeLessThanOrEqual(MAX_GATE_HEIGHT_TO_WIDTH);

      const maxX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
      const maxZ = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));
      expect(maxX).toBeLessThanOrEqual(HEX_APOTHEM - 0.1);
      expect(maxX + Math.sqrt(3) * maxZ).toBeLessThanOrEqual(2 * HEX_APOTHEM);

      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
      }
    }

    const veilGeometry = createDeepGateVeilGeometry();
    veilGeometry.computeBoundingBox();
    expect(veilGeometry.boundingBox!.min.y).toBeGreaterThanOrEqual(0.1);
    expect(veilGeometry.boundingBox!.max.y).toBeLessThanOrEqual(1.0);
    expect(
      Math.max(Math.abs(veilGeometry.boundingBox!.min.x), Math.abs(veilGeometry.boundingBox!.max.x)),
    ).toBeLessThanOrEqual(0.29);
    const veilMaterial = createDeepGateVeilMaterial(ASPECT_HEX[1]);
    expect(veilMaterial.depthWrite).toBe(false);
    expect(veilMaterial.transparent).toBe(true);
    expect(veilMaterial.color.getHex()).toBe(new Color(ASPECT_HEX[1]).getHex());
    veilGeometry.dispose();
    veilMaterial.dispose();

    expect(aspectSignatures.size).toBe(aspects.length);
    sharedMasonry.dispose();
  });

  it("builds a grounded, floorless, hex-fit Hyperstructure Archive with shared ProcgenMasonryNodeMaterial and deep_gem holder socket", () => {
    const sharedMasonry = createProcgenMasonryMaterial();
    const sharedKey = sharedMasonry.customProgramCacheKey();
    const triangle = new Triangle();
    const normal = new Vector3();

    const kit = createDeepArchiveKit();
    const meshes: Mesh[] = [];
    let totalTriangles = 0;
    const bounds = new Box3();

    kit.scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      meshes.push(node);
      expect(node.scale.x).toBe(1);
      expect(node.scale.y).toBe(1);
      expect(node.scale.z).toBe(1);

      const geometry = node.geometry;
      for (const attr of ["position", "normal", "uv"]) {
        const buffer = geometry.getAttribute(attr);
        expect(buffer, `${node.name} ${attr}`).toBeDefined();
        expect(Array.from(buffer.array).every(Number.isFinite), `${node.name} ${attr}`).toBe(true);
      }
      const positions = geometry.getAttribute("position");
      const index = geometry.getIndex();
      const count = index?.count ?? positions.count;
      for (let face = 0; face < count; face += 3) {
        triangle.a.fromBufferAttribute(positions, index ? index.getX(face) : face);
        triangle.b.fromBufferAttribute(positions, index ? index.getX(face + 1) : face + 1);
        triangle.c.fromBufferAttribute(positions, index ? index.getX(face + 2) : face + 2);
        expect(triangle.getArea(), `${node.name} face ${face / 3}`).toBeGreaterThan(1e-12);
        expect(triangle.getNormal(normal).length(), `${node.name}`).toBeCloseTo(1, 5);
      }

      totalTriangles += countTriangles(node);
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox!);
    });

    expect(meshes.length).toBe(2);
    const [masonry, socket] = meshes;
    expect(isProcgenMasonryMaterial(masonry!.material as MeshStandardMaterial)).toBe(true);
    expect(masonry!.material).toBeInstanceOf(FrostedStandardNodeMaterial);
    const masonryMat = masonry!.material as FrostedStandardNodeMaterial;
    expect(masonryMat.customProgramCacheKey()).toBe(sharedKey);
    expect(masonryMat.map).toBeNull();
    expect(masonryMat.bumpMap).toBeNull();
    expect(masonryMat.roughnessMap).toBeNull();
    expect(masonry!.geometry.getAttribute("color")).toBeDefined();

    expect(socket!.name).toContain("deep_gem");
    socket!.geometry.computeBoundingBox();
    expect(socket!.geometry.boundingBox!.min.y).toBeGreaterThan(0.8);

    expect(totalTriangles).toBeGreaterThan(400);
    expect(totalTriangles).toBeLessThanOrEqual(MAX_ARCHIVE_TRIANGLES);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.002);
    expect(bounds.min.y).toBeLessThanOrEqual(0.005);
    expect(bounds.max.y).toBeCloseTo(DEEP_ARCHIVE_HEIGHT, 2);
    expect(bounds.max.y).toBeLessThanOrEqual(1.4);

    const width = bounds.max.x - bounds.min.x;
    expect(bounds.max.y / width, "archive H/W").toBeLessThanOrEqual(MAX_ARCHIVE_HEIGHT_TO_WIDTH);

    const maxX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
    const maxZ = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));
    expect(maxX).toBeLessThanOrEqual(HEX_APOTHEM - 0.12);
    expect(maxX + Math.sqrt(3) * maxZ).toBeLessThanOrEqual(2 * HEX_APOTHEM);

    for (const mesh of meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
    sharedMasonry.dispose();
  });

  it("builds a grounded, floorless, hex-fit Essence Core with shared ProcgenMasonryNodeMaterial, levitating orb, and deep_gem holder sockets", () => {
    const sharedMasonry = createProcgenMasonryMaterial();
    const sharedKey = sharedMasonry.customProgramCacheKey();
    const triangle = new Triangle();
    const normal = new Vector3();

    const kit = createDeepCoreKit();
    kit.scene.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    let totalTriangles = 0;
    const bounds = new Box3();

    kit.scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      meshes.push(node);
      expect(node.scale.x).toBe(1);
      expect(node.scale.y).toBe(1);
      expect(node.scale.z).toBe(1);

      const geometry = node.geometry;
      for (const attr of ["position", "normal", "uv"]) {
        const buffer = geometry.getAttribute(attr);
        expect(buffer, `${node.name} ${attr}`).toBeDefined();
        expect(Array.from(buffer.array).every(Number.isFinite), `${node.name} ${attr}`).toBe(true);
      }
      const positions = geometry.getAttribute("position");
      const index = geometry.getIndex();
      const count = index?.count ?? positions.count;
      for (let face = 0; face < count; face += 3) {
        triangle.a.fromBufferAttribute(positions, index ? index.getX(face) : face);
        triangle.b.fromBufferAttribute(positions, index ? index.getX(face + 1) : face + 1);
        triangle.c.fromBufferAttribute(positions, index ? index.getX(face + 2) : face + 2);
        expect(triangle.getArea(), `${node.name} face ${face / 3}`).toBeGreaterThan(1e-12);
        expect(triangle.getNormal(normal).length(), `${node.name}`).toBeCloseTo(1, 5);
      }

      totalTriangles += countTriangles(node);
      bounds.union(new Box3().setFromObject(node));
    });

    expect(meshes.length).toBe(3);
    const [masonry, orb, socket] = meshes;
    expect(isProcgenMasonryMaterial(masonry!.material as MeshStandardMaterial)).toBe(true);
    expect(masonry!.material).toBeInstanceOf(FrostedStandardNodeMaterial);
    const masonryMat = masonry!.material as FrostedStandardNodeMaterial;
    expect(masonryMat.customProgramCacheKey()).toBe(sharedKey);
    expect(masonryMat.map).toBeNull();
    expect(masonryMat.bumpMap).toBeNull();
    expect(masonryMat.roughnessMap).toBeNull();
    expect(masonry!.geometry.getAttribute("color")).toBeDefined();

    const orbBounds = new Box3().setFromObject(orb!);
    expect(orbBounds.min.y).toBeGreaterThan(0.25);
    expect(orbBounds.max.y).toBeLessThan(DEEP_CORE_HEIGHT - 0.15);

    expect(socket!.name).toContain("deep_gem");

    expect(totalTriangles).toBeGreaterThan(400);
    expect(totalTriangles).toBeLessThanOrEqual(MAX_CORE_TRIANGLES);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.002);
    expect(bounds.min.y).toBeLessThanOrEqual(0.005);
    expect(bounds.max.y).toBeCloseTo(DEEP_CORE_HEIGHT, 1);
    expect(bounds.max.y).toBeLessThanOrEqual(1.4);

    const width = bounds.max.x - bounds.min.x;
    expect(bounds.max.y / width, "core H/W").toBeLessThanOrEqual(MAX_CORE_HEIGHT_TO_WIDTH);

    const maxX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
    const maxZ = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));
    expect(maxX).toBeLessThanOrEqual(HEX_APOTHEM - 0.12);
    expect(maxX + Math.sqrt(3) * maxZ).toBeLessThanOrEqual(2 * HEX_APOTHEM);

    for (const mesh of meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
    sharedMasonry.dispose();
  });

  it("builds a grounded, floorless, hex-fit Ethereal Mine with shared ProcgenMasonryNodeMaterial, amber & cyan crystals, and deep_gem holder sockets", () => {
    const sharedMasonry = createProcgenMasonryMaterial();
    const sharedKey = sharedMasonry.customProgramCacheKey();
    const triangle = new Triangle();
    const normal = new Vector3();

    const kit = createDeepMineKit();
    kit.scene.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    let totalTriangles = 0;
    const bounds = new Box3();

    kit.scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      meshes.push(node);
      expect(node.scale.x).toBe(1);
      expect(node.scale.y).toBe(1);
      expect(node.scale.z).toBe(1);

      const geometry = node.geometry;
      for (const attr of ["position", "normal", "uv"]) {
        const buffer = geometry.getAttribute(attr);
        expect(buffer, `${node.name} ${attr}`).toBeDefined();
        expect(Array.from(buffer.array).every(Number.isFinite), `${node.name} ${attr}`).toBe(true);
      }
      const positions = geometry.getAttribute("position");
      const index = geometry.getIndex();
      const count = index?.count ?? positions.count;
      for (let face = 0; face < count; face += 3) {
        triangle.a.fromBufferAttribute(positions, index ? index.getX(face) : face);
        triangle.b.fromBufferAttribute(positions, index ? index.getX(face + 1) : face + 1);
        triangle.c.fromBufferAttribute(positions, index ? index.getX(face + 2) : face + 2);
        expect(triangle.getArea(), `${node.name} face ${face / 3}`).toBeGreaterThan(1e-12);
        expect(triangle.getNormal(normal).length(), `${node.name}`).toBeCloseTo(1, 5);
      }

      totalTriangles += countTriangles(node);
      bounds.union(new Box3().setFromObject(node));
    });

    expect(meshes.length).toBe(4);
    const [masonry, amber, cyan, socket] = meshes;
    expect(isProcgenMasonryMaterial(masonry!.material as MeshStandardMaterial)).toBe(true);
    expect(masonry!.material).toBeInstanceOf(FrostedStandardNodeMaterial);
    const masonryMat = masonry!.material as FrostedStandardNodeMaterial;
    expect(masonryMat.customProgramCacheKey()).toBe(sharedKey);
    expect(masonryMat.map).toBeNull();
    expect(masonryMat.bumpMap).toBeNull();
    expect(masonryMat.roughnessMap).toBeNull();
    expect(masonry!.geometry.getAttribute("color")).toBeDefined();

    expect((amber!.material as MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(0.5);
    expect((cyan!.material as MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(0.5);
    expect(socket!.name).toContain("deep_gem");

    expect(totalTriangles).toBeGreaterThan(500);
    expect(totalTriangles).toBeLessThanOrEqual(MAX_MINE_TRIANGLES);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.002);
    expect(bounds.min.y).toBeLessThanOrEqual(0.005);
    expect(bounds.max.y).toBeCloseTo(DEEP_MINE_HEIGHT, 1);
    expect(bounds.max.y).toBeLessThanOrEqual(1.4);

    const width = bounds.max.x - bounds.min.x;
    expect(bounds.max.y / width, "mine H/W").toBeLessThanOrEqual(MAX_MINE_HEIGHT_TO_WIDTH);

    const maxX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
    const maxZ = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));
    expect(maxX).toBeLessThanOrEqual(HEX_APOTHEM - 0.12);
    expect(maxX + Math.sqrt(3) * maxZ).toBeLessThanOrEqual(2 * HEX_APOTHEM);

    for (const mesh of meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
    sharedMasonry.dispose();
  });

  it("builds a floorless procedural Bane Altar sharing the WebGPU masonry material with valid geometry and plate clearance", () => {
    const triangle = new Triangle();
    const normal = new Vector3();
    const sharedMasonry = createProcgenMasonryMaterial();
    const sharedKey = sharedMasonry.customProgramCacheKey();

    const kit = createDeepAltarKit();
    kit.scene.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    let totalTriangles = 0;
    const bounds = new Box3();

    kit.scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      meshes.push(node);
      expect(node.scale.x).toBe(1);
      expect(node.scale.y).toBe(1);
      expect(node.scale.z).toBe(1);
      expect(node.position.x).toBe(0);
      expect(node.position.y).toBe(0);
      expect(node.position.z).toBe(0);

      const geometry = node.geometry;
      for (const attr of ["position", "normal", "uv"]) {
        const buffer = geometry.getAttribute(attr);
        expect(buffer, `${node.name} ${attr}`).toBeDefined();
        expect(Array.from(buffer.array).every(Number.isFinite), `${node.name} ${attr}`).toBe(true);
      }
      const positions = geometry.getAttribute("position");
      const index = geometry.getIndex();
      const count = index?.count ?? positions.count;
      for (let face = 0; face < count; face += 3) {
        triangle.a.fromBufferAttribute(positions, index ? index.getX(face) : face);
        triangle.b.fromBufferAttribute(positions, index ? index.getX(face + 1) : face + 1);
        triangle.c.fromBufferAttribute(positions, index ? index.getX(face + 2) : face + 2);
        expect(triangle.getArea(), `${node.name} face ${face / 3}`).toBeGreaterThan(1e-12);
        expect(triangle.getNormal(normal).length(), `${node.name}`).toBeCloseTo(1, 5);
      }

      totalTriangles += countTriangles(node);
      bounds.union(new Box3().setFromObject(node));
    });

    expect(meshes.length).toBe(4);
    const [masonry, crimson, violet, socket] = meshes;
    expect(isProcgenMasonryMaterial(masonry!.material as MeshStandardMaterial)).toBe(true);
    expect(masonry!.material).toBeInstanceOf(FrostedStandardNodeMaterial);
    const masonryMat = masonry!.material as FrostedStandardNodeMaterial;
    expect(masonryMat.customProgramCacheKey()).toBe(sharedKey);
    expect(masonryMat.map).toBeNull();
    expect(masonryMat.bumpMap).toBeNull();
    expect(masonryMat.roughnessMap).toBeNull();
    expect(masonry!.geometry.getAttribute("color")).toBeDefined();

    expect((crimson!.material as MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(0.5);
    expect((violet!.material as MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(0.5);
    expect(socket!.name).toContain("deep_gem");

    expect(totalTriangles).toBeGreaterThan(400);
    expect(totalTriangles).toBeLessThanOrEqual(MAX_ALTAR_TRIANGLES);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.002);
    expect(bounds.min.y).toBeLessThanOrEqual(0.005);
    expect(bounds.max.y).toBeCloseTo(DEEP_ALTAR_HEIGHT, 1);
    expect(bounds.max.y).toBeLessThanOrEqual(1.4);

    const width = bounds.max.x - bounds.min.x;
    expect(bounds.max.y / width, "altar H/W").toBeLessThanOrEqual(MAX_ALTAR_HEIGHT_TO_WIDTH);

    const maxX = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
    const maxZ = Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z));
    expect(maxX).toBeLessThanOrEqual(HEX_APOTHEM - 0.12);
    expect(maxX + Math.sqrt(3) * maxZ).toBeLessThanOrEqual(2 * HEX_APOTHEM);

    for (const mesh of meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
    }
    sharedMasonry.dispose();
  });
});
