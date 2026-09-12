import { Box3, Matrix4, Triangle, Vector3 } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HYPERSTRUCTURE_HEIGHT, resolveHyperstructureDesign } from "./hyperstructure-design";

// Cold renderer imports and the 100-ID geometry sweep contend with the full client suite.
vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  vi.stubGlobal("navigator", { userAgent: "vitest", getBattery: async () => ({ charging: false }) });
});

describe("procedural hyperstructures", () => {
  it("keeps identity deterministic across reloads and produces every crown family", () => {
    const designs = Array.from({ length: 100 }, (_, id) => resolveHyperstructureDesign(id + 1));
    expect(new Set(designs.map((design) => design.crown)).size).toBe(8);
    expect(new Set(designs.map((design) => design.family)).size).toBe(6);
    expect(new Set(designs.map((design) => design.power))).toEqual(new Set(["stable", "unstable"]));
    expect(new Set(designs.map((design) => JSON.stringify(design))).size).toBe(100);
    expect(resolveHyperstructureDesign(17)).toEqual(resolveHyperstructureDesign(17));
  });

  it("keeps power identity per instance when towers share a draw and rebind slots", async () => {
    const { HyperstructureModel } = await import("./hyperstructure-model");
    const model = new HyperstructureModel(2);
    const ids = ["stable", "unstable"].map(
      (power) =>
        Array.from({ length: 100 }, (_, index) => index + 1).find(
          (id) => resolveHyperstructureDesign(id).power === power,
        )!,
    );
    for (const [slot, entityId] of ids.entries()) {
      model.setMatrixAt(slot, new Matrix4());
      model.setConstructionAt(slot, { entityId, progress: 100, completed: true });
    }
    model.setCount(2);
    const core = model.instancedMeshes.find((mesh) => mesh.name === "core")!;
    const identity = core.geometry.getAttribute("hyperstructurePower");
    expect(identity.getX(0)).toBe(0);
    expect(identity.getX(1)).toBe(1);
    const satellite = model.instancedMeshes.find((mesh) => mesh.name === "spear:satellite")!;
    expect(satellite.geometry.getAttribute("hyperstructurePower")).toBe(identity);
    model.setConstructionAt(0, { entityId: ids[1], progress: 100, completed: true });
    expect(identity.getX(0)).toBe(1);
    expect(identity.getY(0)).toBeCloseTo(resolveHyperstructureDesign(ids[1]).phase);
    model.dispose();
  });

  it("builds additively inside the hex and preserves the completed landmark height", async () => {
    const { HyperstructureModel } = await import("./hyperstructure-model");
    const model = new HyperstructureModel(1);
    model.setMatrixAt(0, new Matrix4());
    model.setCount(1);
    const bounds = (masonryOnly = false) => {
      const result = new Box3();
      for (const mesh of model.instancedMeshes) {
        if (mesh.name === "activation") continue;
        if (masonryOnly && mesh.name !== "base" && !mesh.name.startsWith("course:")) continue;
        const matrix = new Matrix4();
        mesh.getMatrixAt(0, matrix);
        if (matrix.determinant() === 0) continue;
        mesh.geometry.computeBoundingBox();
        if (mesh.name.includes(":") && !mesh.name.startsWith("course:")) {
          const positions = mesh.geometry.getAttribute("position");
          const point = new Vector3();
          for (let vertex = 0; vertex < positions.count; vertex++) {
            result.expandByPoint(point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix));
          }
        } else {
          result.union(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix));
        }
        const center = mesh.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(matrix);
        expect(mesh.boundingSphere!.containsPoint(center)).toBe(true);
      }
      return result;
    };
    for (let id = 1; id <= 100; id++) {
      let previousHeight = 0;
      for (const progress of [0, 25, 50, 75, 95, 100]) {
        model.setConstructionAt(0, { entityId: id, progress, completed: progress === 100 });
        model.updateAnimations(6);
        const box = bounds();
        expect(bounds(true).max.y).toBeGreaterThanOrEqual(previousHeight);
        expect(box.max.x).toBeLessThan(1);
        expect(box.min.x).toBeGreaterThan(-1);
        previousHeight = bounds(true).max.y;
      }
      expect(bounds(true).max.y).toBeCloseTo(3, 4);
      expect(bounds().max.y).toBeGreaterThan(3.5);
      expect(bounds().max.y).toBeLessThanOrEqual(HYPERSTRUCTURE_HEIGHT + 0.001);
    }
    model.dispose();
  });

  it("keeps masonry fixed while completed crowns move and holds every pose at zero delta", async () => {
    const { HyperstructureModel } = await import("./hyperstructure-model");
    const model = new HyperstructureModel(1);
    model.setMatrixAt(0, new Matrix4().makeTranslation(3, 0, 4));
    model.setConstructionAt(0, { entityId: 17, progress: 100, completed: true });
    model.setCount(1);
    const matrices = () => model.instancedMeshes.map((mesh) => Array.from(mesh.instanceMatrix.array));
    const before = matrices();
    model.updateAnimations(1);
    const after = matrices();
    expect(after[0]).toEqual(before[0]);
    model.instancedMeshes.forEach((mesh, index) => {
      if (mesh.name.startsWith("course:")) expect(after[index]).toEqual(before[index]);
    });
    expect(after).not.toEqual(before);
    model.updateAnimations(0);
    expect(matrices()).toEqual(after);
    model.dispose();
  });

  it("leaves clearance around the power core even at peak activation", async () => {
    const { HyperstructureModel } = await import("./hyperstructure-model");
    const model = new HyperstructureModel(1);
    model.setMatrixAt(0, new Matrix4());
    model.setCount(1);
    const triangle = new Triangle();
    const origin = new Vector3();
    const closest = new Vector3();
    for (let entityId = 1; entityId <= 100; entityId++) {
      model.setConstructionAt(0, { entityId, progress: 95, completed: false });
      model.setConstructionAt(0, { entityId, progress: 100, completed: true });
      model.updateAnimations(0.12 + 1.25);
      const core = model.instancedMeshes.find((mesh) => mesh.visible && (mesh.name === "core" || mesh.name === "orb"))!;
      const family = resolveHyperstructureDesign(entityId).crown;
      const crowns = model.instancedMeshes.filter((mesh) => mesh.name.split(":")[0] === family);
      const coreMatrix = new Matrix4();
      core.getMatrixAt(0, coreMatrix);
      coreMatrix.invert();
      for (const crown of crowns) {
        const crownMatrix = new Matrix4();
        crown.getMatrixAt(0, crownMatrix);
        const toCore = new Matrix4().multiplyMatrices(coreMatrix, crownMatrix);
        const positions = crown.geometry.getAttribute("position");
        const indices = crown.geometry.index;
        core.geometry.computeBoundingSphere();
        const radius = core.geometry.boundingSphere!.radius;
        for (let vertex = 0; vertex < (indices?.count ?? positions.count); vertex += 3) {
          triangle.a.fromBufferAttribute(positions, indices ? indices.getX(vertex) : vertex).applyMatrix4(toCore);
          triangle.b
            .fromBufferAttribute(positions, indices ? indices.getX(vertex + 1) : vertex + 1)
            .applyMatrix4(toCore);
          triangle.c
            .fromBufferAttribute(positions, indices ? indices.getX(vertex + 2) : vertex + 2)
            .applyMatrix4(toCore);
          triangle.closestPointToPoint(origin, closest);
          expect(closest.length(), `HS ${entityId} ${crown.name} core clearance`).toBeGreaterThan(radius);
        }
      }
    }
    model.dispose();
  });

  it("draws only occupied families and retires a family's draws when its last tower leaves", async () => {
    const { HyperstructureModel } = await import("./hyperstructure-model");
    const model = new HyperstructureModel(2);
    for (const [index, entityId] of [1, 5].entries()) {
      model.setMatrixAt(index, new Matrix4().makeTranslation(index * 2, 0, 0));
      model.setConstructionAt(index, { entityId, progress: 100, completed: true });
    }
    model.setCount(2);
    const courses = () => model.instancedMeshes.filter((mesh) => mesh.visible && mesh.name.startsWith("course:"));
    expect(courses()).toHaveLength(16);
    model.removeInstance(1);
    model.setCount(1);
    expect(courses()).toHaveLength(8);
    expect(courses().every((mesh) => mesh.name.includes(resolveHyperstructureDesign(1).family))).toBe(true);
    model.removeInstance(0);
    model.setCount(0);
    expect(model.instancedMeshes.some((mesh) => mesh.visible)).toBe(false);
    model.dispose();
  });

  it("replays activation only for a completion transition and retains it across slot rebinding", async () => {
    const { HyperstructureModel } = await import("./hyperstructure-model");
    const model = new HyperstructureModel(2);
    const activation = model.instancedMeshes.at(-1)!;
    const visible = (index: number) => {
      const matrix = new Matrix4();
      activation.getMatrixAt(index, matrix);
      return matrix.determinant() !== 0;
    };
    model.setMatrixAt(0, new Matrix4());
    model.setConstructionAt(0, { entityId: 17, progress: 100, completed: true });
    model.setCount(1);
    expect(visible(0)).toBe(false);
    model.setConstructionAt(0, { entityId: 17, progress: 95, completed: false });
    model.removeInstance(0);
    model.setMatrixAt(1, new Matrix4().setPosition(new Vector3(2, 0, 0)));
    model.setConstructionAt(1, { entityId: 17, progress: 100, completed: true });
    model.setCount(2);
    expect(visible(1)).toBe(false);
    model.updateAnimations(0.2);
    expect(visible(1)).toBe(true);
    model.updateAnimations(3);
    expect(visible(1)).toBe(false);
    model.setConstructionAt(1, { entityId: 17, progress: 100, completed: true });
    expect(visible(1)).toBe(false);
    model.dispose();
  });
  it.each([false, true])("raises an instant Blitz completion before activation (new site: %s)", async (newSite) => {
    const { HyperstructureModel } = await import("./hyperstructure-model");
    const model = new HyperstructureModel(2);
    model.setMatrixAt(0, new Matrix4());
    if (!newSite) model.setConstructionAt(0, { entityId: 4, progress: 0, completed: false });
    model.setConstructionAt(0, { entityId: 4, progress: 100, completed: true }, newSite);
    model.setCount(1);
    const courses = () => model.instancedMeshes.filter((mesh) => mesh.visible && mesh.name.startsWith("course:"));
    const activation = model.instancedMeshes.find((mesh) => mesh.name === "activation")!;
    expect(courses()).toHaveLength(0);
    model.updateAnimations(1.2);
    expect(courses().length).toBeGreaterThan(0);
    expect(courses().length).toBeLessThan(8);
    expect(activation.visible).toBe(false);
    const poses = () => model.instancedMeshes.map((mesh) => Array.from(mesh.instanceMatrix.array));
    const paused = poses();
    model.updateAnimations(0);
    expect(poses()).toEqual(paused);
    // A RECS refresh and manager slot rebind must preserve the build, not restart or skip it.
    model.removeInstance(0);
    model.setMatrixAt(1, new Matrix4());
    model.setConstructionAt(1, { entityId: 4, progress: 100, completed: true });
    model.setCount(2);
    expect(courses().length).toBeLessThan(8);
    model.updateAnimations(1.2);
    expect(courses()).toHaveLength(8);
    expect(activation.visible).toBe(true);
    model.updateAnimations(3);
    expect(activation.visible).toBe(false);
    model.dispose();
  });
  it("articulates both wings and carries the satellite around the core, with frozen poses held", async () => {
    const { HyperstructureModel } = await import("./hyperstructure-model");
    const model = new HyperstructureModel(2);
    for (const [index, entityId] of [1, 4].entries()) {
      model.setMatrixAt(index, new Matrix4());
      model.setConstructionAt(index, { entityId, progress: 100, completed: true });
    }
    model.setCount(2);
    const pose = (name: string, slot: number) => {
      const matrix = new Matrix4();
      model.instancedMeshes.find((mesh) => mesh.name === name)!.getMatrixAt(slot, matrix);
      return matrix;
    };
    const left = pose("wings:left", 0),
      right = pose("wings:right", 0);
    const satellitePositions: Vector3[] = [];
    for (let frame = 0; frame < 60; frame++) {
      model.updateAnimations(0.1);
      satellitePositions.push(new Vector3().setFromMatrixPosition(pose("spear:satellite", 1)));
    }
    expect(pose("wings:left", 0).elements).not.toEqual(left.elements);
    expect(pose("wings:right", 0).elements).not.toEqual(right.elements);
    expect(Math.min(...satellitePositions.map((p) => p.x))).toBeLessThan(-0.3);
    expect(Math.max(...satellitePositions.map((p) => p.x))).toBeGreaterThan(0.3);
    expect(Math.min(...satellitePositions.map((p) => p.y))).toBeLessThan(3.2);
    expect(Math.max(...satellitePositions.map((p) => p.y))).toBeGreaterThan(3.8);
    const frozen = model.instancedMeshes.map((mesh) => Array.from(mesh.instanceMatrix.array));
    model.updateAnimations(0);
    expect(model.instancedMeshes.map((mesh) => Array.from(mesh.instanceMatrix.array))).toEqual(frozen);
    model.dispose();
  });

  it("gives completed prongs occasional pulses without replaying the construction", async () => {
    const { HyperstructureModel } = await import("./hyperstructure-model");
    const model = new HyperstructureModel(1);
    model.setMatrixAt(0, new Matrix4());
    model.setConstructionAt(0, { entityId: 5, progress: 100, completed: true });
    model.setCount(1);
    const pulse = model.instancedMeshes.find((mesh) => mesh.name === "activation")!;
    expect(pulse.visible).toBe(false);
    const base = Array.from(model.instancedMeshes[0].instanceMatrix.array);
    let starts = 0,
      lastVisible = false;
    for (let frame = 0; frame < 400; frame++) {
      model.updateAnimations(0.1);
      if (pulse.visible && !lastVisible) starts++;
      lastVisible = pulse.visible;
    }
    expect(starts).toBeGreaterThanOrEqual(2);
    expect(starts).toBeLessThanOrEqual(3);
    expect(Array.from(model.instancedMeshes[0].instanceMatrix.array)).toEqual(base);
    model.dispose();
  });
});
