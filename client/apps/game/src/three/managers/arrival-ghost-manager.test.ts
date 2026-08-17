import { describe, expect, it } from "vitest";
import { BoxGeometry, BufferGeometry, Group, Mesh, MeshStandardMaterial, Scene } from "three";
import { ArrivalGhostManager } from "./arrival-ghost-manager";

const hex = (col: number, row: number) => ({ col, row });

function collectMeshGeometriesByName(scene: Scene, name: string): BufferGeometry[] {
  const geometries: BufferGeometry[] = [];
  scene.traverse((object) => {
    if (object instanceof Mesh && object.name === name) {
      geometries.push(object.geometry);
    }
  });
  return geometries;
}

function createTemplateScene(): Group {
  const group = new Group();
  group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: "#6699ff" })));
  return group;
}

function createVisualStyle() {
  return {
    color: "#b8ffb0",
    opacity: 0.52,
    scaleMultiplier: 1,
    yOffset: 0.05,
  };
}

describe("ArrivalGhostManager", () => {
  it("upserts a decorative ghost and tracks it by entity id", () => {
    const manager = new ArrivalGhostManager(new Scene(), {
      chunkStride: 5,
      renderChunkSize: { width: 10, height: 10 },
    });

    manager.setCurrentChunk("0,0");
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });

    expect(manager.hasArrivalGhost(1)).toBe(true);
    expect(manager.getTrackedEntityIds()).toEqual([1]);
  });

  it("replaces an existing ghost for the same entity", () => {
    const manager = new ArrivalGhostManager(new Scene(), {
      chunkStride: 5,
      renderChunkSize: { width: 10, height: 10 },
    });

    manager.setCurrentChunk("0,0");
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(2, 2),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });

    expect(manager.getTrackedEntityIds()).toEqual([1]);
  });

  it("lifts ghost meshes above the terrain surface and assigns the unit render order", () => {
    const scene = new Scene();
    const manager = new ArrivalGhostManager(scene, {
      chunkStride: 5,
      renderChunkSize: { width: 10, height: 10 },
    });

    manager.setCurrentChunk("0,0");
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });

    const ghostContainer = scene.children.at(-1) as Group;
    const ghostMesh = ghostContainer.getObjectByName("arrival-ghost-body") as Group;
    const destinationRing = ghostContainer.getObjectByName("arrival-ghost-ring") as Mesh;

    expect(ghostContainer.position.y).toBeCloseTo(0.2);
    expect(ghostMesh).toBeDefined();
    expect(destinationRing).toBeDefined();
    expect(destinationRing.rotation.x).toBeCloseTo(-Math.PI / 2);
  });

  it("animates an idle pulse while the ghost waits for arrival", () => {
    const scene = new Scene();
    const manager = new ArrivalGhostManager(scene, {
      chunkStride: 5,
      renderChunkSize: { width: 10, height: 10 },
    });

    manager.setCurrentChunk("0,0");
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });

    const ghostContainer = scene.children.at(-1) as Group;
    const ghostBody = ghostContainer.getObjectByName("arrival-ghost-body") as Group;
    const destinationRing = ghostContainer.getObjectByName("arrival-ghost-ring") as Mesh;
    const initialBodyY = ghostBody.position.y;
    const initialRingScale = destinationRing.scale.x;

    manager.update(0.25);

    expect(ghostBody.position.y).not.toBe(initialBodyY);
    expect(destinationRing.scale.x).not.toBe(initialRingScale);
  });

  it("plays an absorb burst before clearing the ghost on arrival", () => {
    const scene = new Scene();
    const manager = new ArrivalGhostManager(scene, {
      chunkStride: 5,
      renderChunkSize: { width: 10, height: 10 },
    });

    manager.setCurrentChunk("0,0");
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });

    const ghostContainer = scene.children.at(-1) as Group;
    const burstRing = ghostContainer.getObjectByName("arrival-ghost-burst-ring") as Mesh;

    manager.resolveArrivalGhost(1);
    manager.update(0.05);

    expect(burstRing.visible).toBe(true);
    expect(burstRing.scale.x).toBeGreaterThan(1);

    manager.update(0.3);
    expect(manager.hasArrivalGhost(1)).toBe(false);
  });

  it("clears ghosts by reason and destroys all tracked ghosts", () => {
    const manager = new ArrivalGhostManager(new Scene(), {
      chunkStride: 5,
      renderChunkSize: { width: 10, height: 10 },
    });

    manager.setCurrentChunk("0,0");
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });

    manager.clearArrivalGhost(1, "failed");
    expect(manager.hasArrivalGhost(1)).toBe(false);

    manager.upsertLocalArrivalGhost({
      entityId: 2,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });
    manager.destroy();
    expect(manager.getTrackedEntityIds()).toEqual([]);
  });

  // Phase 2.1: each ghost used to allocate two new RingGeometry buffers that
  // disposeGhostContainer never freed (it only disposes tagged materials), leaking
  // two GPU geometries per army-arrival ghost. The ring geometries are constant, so
  // every ghost must share one destination-ring and one burst-ring geometry.
  it("shares a single ring geometry instance across all ghosts", () => {
    const scene = new Scene();
    const manager = new ArrivalGhostManager(scene, {
      chunkStride: 5,
      renderChunkSize: { width: 10, height: 10 },
    });

    manager.setCurrentChunk("0,0");
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });
    manager.upsertLocalArrivalGhost({
      entityId: 2,
      hexCoords: hex(1, 1),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });

    const destinationRingGeometries = collectMeshGeometriesByName(scene, "arrival-ghost-ring");
    const burstRingGeometries = collectMeshGeometriesByName(scene, "arrival-ghost-burst-ring");

    expect(destinationRingGeometries).toHaveLength(2);
    expect(burstRingGeometries).toHaveLength(2);
    expect(destinationRingGeometries[0]).toBe(destinationRingGeometries[1]);
    expect(burstRingGeometries[0]).toBe(burstRingGeometries[1]);
  });

  it("keeps the shared ring geometry alive (not disposed) after a ghost is cleared", () => {
    const scene = new Scene();
    const manager = new ArrivalGhostManager(scene, {
      chunkStride: 5,
      renderChunkSize: { width: 10, height: 10 },
    });

    manager.setCurrentChunk("0,0");
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });
    const [sharedGeometryBeforeClear] = collectMeshGeometriesByName(scene, "arrival-ghost-ring");

    manager.clearArrivalGhost(1, "settled");

    // A fresh ghost reuses the same shared geometry and it still has its attributes.
    manager.upsertLocalArrivalGhost({
      entityId: 2,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });
    const [sharedGeometryAfterClear] = collectMeshGeometriesByName(scene, "arrival-ghost-ring");

    expect(sharedGeometryAfterClear).toBe(sharedGeometryBeforeClear);
    expect(sharedGeometryAfterClear.getAttribute("position")).toBeDefined();
  });

  it("tracks created and cleared ghost diagnostics by clear reason", () => {
    const manager = new ArrivalGhostManager(new Scene(), {
      chunkStride: 5,
      renderChunkSize: { width: 10, height: 10 },
    });

    manager.setCurrentChunk("0,0");
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });
    manager.clearArrivalGhost(1, "projection_occupied");
    manager.upsertLocalArrivalGhost({
      entityId: 2,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: createVisualStyle(),
    });
    manager.clearArrivalGhost(2, "failed");

    expect(manager.snapshotDiagnostics()).toMatchObject({
      active: 0,
      created: 2,
      cleared: {
        projection_occupied: 1,
        failed: 1,
      },
    });
  });
});
