import { Mesh, Raycaster, Triangle, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createHyperstructureKit } from "./hyperstructure-kit";

it("grounds the shared foundation and keeps every construction course flush at its ends", () => {
  const kit = createHyperstructureKit();
  for (const child of kit.scene.children) {
    const mesh = child as Mesh;
    mesh.geometry.computeBoundingBox();
    if (mesh.name === "base") expect(mesh.geometry.boundingBox!.min.y).toBeCloseTo(0, 6);
    if (mesh.name.startsWith("course:")) {
      expect(mesh.geometry.boundingBox!.min.y, mesh.name).toBeCloseTo(0, 6);
      expect(mesh.geometry.boundingBox!.max.y, mesh.name).toBeCloseTo(1, 6);
    }
    mesh.geometry.dispose();
  }
});

describe("hyperstructure construction geometry", () => {
  it("has finite surface attributes and no collapsed faces after beveling and joining", () => {
    const kit = createHyperstructureKit();
    const triangle = new Triangle();
    for (const child of kit.scene.children) {
      const mesh = child as Mesh;
      const geometry = mesh.geometry;
      const positions = geometry.getAttribute("position");
      const index = geometry.getIndex();
      for (const name of ["position", "normal", "uv"]) {
        expect(Array.from(geometry.getAttribute(name).array).every(Number.isFinite), `${mesh.name} ${name}`).toBe(true);
      }
      const count = index?.count ?? positions.count;
      for (let face = 0; face < count; face += 3) {
        triangle.a.fromBufferAttribute(positions, index ? index.getX(face) : face);
        triangle.b.fromBufferAttribute(positions, index ? index.getX(face + 1) : face + 1);
        triangle.c.fromBufferAttribute(positions, index ? index.getX(face + 2) : face + 2);
        expect(triangle.getArea(), `${mesh.name} face ${face / 3}`).toBeGreaterThan(1e-12);
        expect(triangle.getNormal(new Vector3()).length(), mesh.name).toBeCloseTo(1, 6);
      }
      geometry.dispose();
    }
  });
});

it("supports every pillar foot across the open families' course seams", () => {
  const kit = createHyperstructureKit();
  const ray = new Raycaster();
  ray.ray.direction.set(0, -1, 0);
  for (const family of ["helix", "trident", "reliquary"]) {
    for (let course = 1; course < 8; course++) {
      const below = kit.scene.getObjectByName(`course:${family}:${course - 1}`) as Mesh;
      const above = kit.scene.getObjectByName(`course:${family}:${course}`) as Mesh;
      const positions = above.geometry.getAttribute("position");
      const indices = above.geometry.index;
      for (let vertex = 0; vertex < (indices?.count ?? positions.count); vertex += 3) {
        const points = [0, 1, 2].map((offset) =>
          new Vector3().fromBufferAttribute(positions, indices ? indices.getX(vertex + offset) : vertex + offset),
        );
        if (!points.every((point) => Math.abs(point.y) < 1e-6)) continue;
        const center = points.reduce((sum, point) => sum.add(point), new Vector3()).multiplyScalar(1 / 3);
        ray.ray.origin.set(center.x, 1.001, center.z);
        const hits = ray.intersectObject(below, false);
        expect(
          hits.some((hit) => hit.distance < 0.002),
          `${family} course ${course} foot at ${center.x}, ${center.z}`,
        ).toBe(true);
      }
    }
  }
  for (const child of kit.scene.children) (child as Mesh).geometry.dispose();
});
