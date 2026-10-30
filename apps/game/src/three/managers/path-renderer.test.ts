import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import { PathRenderer } from "./path-renderer";

// The node environment has no animation frames: the renderer rebuilds on update() instead.
beforeEach(() => {
  globalThis.requestAnimationFrame = (() => 1) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = () => undefined;
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).requestAnimationFrame;
  delete (globalThis as Record<string, unknown>).cancelAnimationFrame;
});

const RED = new THREE.Color("#ff7b6b");
const GREEN = new THREE.Color("#66ddab");
/** A walk of four tiles east along a flat row: the army stands at x 0, its end at x ≈ 5.2. */
const walkEast = (fromZ = 0) => [0, 1, 2, 3].map((tile) => new THREE.Vector3(tile * Math.sqrt(3), 0, fromZ));

/** What the renderer leaves in the scene: its chevrons and its flat marks (rings, pins, arrows). */
const drawn = (scene: THREE.Scene) => {
  const trail = scene.getObjectByName("army-path-trail") as THREE.InstancedMesh;
  const marks = scene.getObjectByName("army-path-marks") as THREE.Mesh;
  const count = marks.geometry.drawRange.count;
  const position = marks.geometry.getAttribute("position");
  const color = marks.geometry.getAttribute("color");
  const markPoints = Array.from({ length: count }, (_, index) =>
    new THREE.Vector3().fromBufferAttribute(position, index),
  );
  const markColours = Array.from({ length: count }, (_, index) => new THREE.Color().fromBufferAttribute(color, index));
  const chevrons = Array.from({ length: trail.count }, (_, index) => {
    const matrix = new THREE.Matrix4();
    trail.getMatrixAt(index, matrix);
    const colour = new THREE.Color();
    trail.getColorAt(index, colour);
    return { at: new THREE.Vector3().setFromMatrixPosition(matrix), colour };
  });
  return { chevrons, markPoints, markColours };
};

const renderer = () => {
  const scene = new THREE.Scene();
  const paths = new PathRenderer();
  paths.initialize(scene);
  return { scene, paths, frame: () => paths.update(0) };
};

/** Two colours alike, as float32 buffers hold them. */
const same = (a: THREE.Color, b: THREE.Color) =>
  Math.abs(a.r - b.r) < 1e-4 && Math.abs(a.g - b.g) < 1e-4 && Math.abs(a.b - b.b) < 1e-4;

const nearEnd = (points: THREE.Vector3[], end: THREE.Vector3, radius: number) =>
  points.every((point) => Math.hypot(point.x - end.x, point.z - end.z) <= radius + 1e-6);

describe("an army's path on the map", () => {
  it("draws only a pin on a walking army's end while it is neither selected nor under the pointer", () => {
    const { scene, paths, frame } = renderer();
    paths.createPath(7, walkEast(), RED);
    frame();
    const { chevrons, markPoints, markColours } = drawn(scene);
    expect(chevrons).toHaveLength(0);
    expect(markPoints.length).toBeGreaterThan(0);
    expect(nearEnd(markPoints, walkEast()[3], 0.3)).toBe(true);
    expect(markColours.every((colour) => same(colour, RED))).toBe(true);
  });

  it("draws the selected army's walk as chevrons along it, in its colour, and a ring on its end tile", () => {
    const { scene, paths, frame } = renderer();
    // Selected before its walk starts, as the map selects an army and then orders it.
    paths.setSelectedPath(7);
    paths.createPath(7, walkEast(), GREEN);
    frame();
    const { chevrons, markPoints, markColours } = drawn(scene);
    expect(chevrons.length).toBeGreaterThanOrEqual(8);
    const xs = chevrons.map(({ at }) => at.x);
    expect(xs).toEqual(xs.toSorted((a, b) => a - b));
    expect(xs[0]).toBeGreaterThan(0.4);
    expect(xs.at(-1)!).toBeLessThan(walkEast()[3].x - 0.5);
    expect(chevrons.every(({ colour }) => same(colour, GREEN))).toBe(true);
    // The ring: a hex around the end tile, inside its edge, not a pin at its centre.
    expect(nearEnd(markPoints, walkEast()[3], 0.8)).toBe(true);
    expect(markPoints.some((point) => Math.hypot(point.x - walkEast()[3].x, point.z) > 0.6)).toBe(true);
    expect(markColours.every((colour) => same(colour, GREEN))).toBe(true);
  });

  it("draws the army under the pointer as a slim arrow from its feet to its end, edged dark, and a pin there", () => {
    const { scene, paths, frame } = renderer();
    paths.createPath(9, walkEast(), RED);
    paths.setHoveredPath(9);
    frame();
    const { chevrons, markPoints, markColours } = drawn(scene);
    expect(chevrons).toHaveLength(0);
    const xs = markPoints.map((point) => point.x);
    expect(Math.min(...xs)).toBeLessThan(0.6);
    expect(Math.max(...xs)).toBeGreaterThan(walkEast()[3].x - 0.1);
    expect(markPoints.every((point) => Math.abs(point.z) <= 0.35)).toBe(true);
    expect(markColours.some((colour) => same(colour, RED))).toBe(true);
    expect(markColours.some((colour) => !same(colour, RED))).toBe(true);
  });

  it("previews the selected army's route before the order as its trail alone, and takes it away", () => {
    const { scene, paths, frame } = renderer();
    paths.showPreview(walkEast(), GREEN);
    frame();
    expect(drawn(scene).chevrons.length).toBeGreaterThanOrEqual(8);
    // No ring of its own: the map's order ring already marks the tile under the pointer.
    expect(drawn(scene).markPoints).toHaveLength(0);
    paths.showPreview(null, GREEN);
    frame();
    expect(drawn(scene).chevrons).toHaveLength(0);
    expect(drawn(scene).markPoints).toHaveLength(0);
  });

  it("follows the selection and the pointer as they move: a path let go of goes back to its pin", () => {
    const { scene, paths, frame } = renderer();
    paths.createPath(1, walkEast(0), GREEN);
    paths.createPath(2, walkEast(6), RED);
    paths.setSelectedPath(1);
    frame();
    expect(drawn(scene).chevrons.every(({ at }) => at.z === 0)).toBe(true);
    paths.setSelectedPath(2);
    frame();
    const { chevrons, markPoints } = drawn(scene);
    expect(chevrons.length).toBeGreaterThan(0);
    expect(chevrons.every(({ at }) => at.z === 6)).toBe(true);
    // The first army's walk is a pin again.
    expect(
      nearEnd(
        markPoints.filter((point) => point.z < 3),
        walkEast(0)[3],
        0.3,
      ),
    ).toBe(true);
  });

  it("draws Blitz's many walking armies in two meshes, and nothing once they arrive", () => {
    const { scene, paths, frame } = renderer();
    for (let army = 0; army < 20; army += 1) paths.createPath(army, walkEast(army * 3), army % 2 ? RED : GREEN);
    paths.setSelectedPath(0);
    paths.setHoveredPath(1);
    frame();
    expect(paths.getStats()).toMatchObject({ activePaths: 20, drawCalls: 2 });
    const meshes: THREE.Object3D[] = [];
    scene.traverseVisible((object) => object instanceof THREE.Mesh && meshes.push(object));
    expect(meshes).toHaveLength(2);
    for (let army = 0; army < 20; army += 1) paths.removePath(army);
    frame();
    expect(paths.getStats()).toMatchObject({ activePaths: 0, chevrons: 0, markVertices: 0, drawCalls: 0 });
  });

  it("leaves the scene when disposed", () => {
    const { scene, paths } = renderer();
    paths.dispose();
    expect(scene.getObjectByName("army-paths")).toBeUndefined();
  });
});
