import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene } from "three";
import { ArrivalGhostManager } from "./arrival-ghost-manager";

const hex = (col: number, row: number) => ({ col, row });

function createTemplateScene(): Group {
  const group = new Group();
  group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: "#6699ff" })));
  return group;
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
      visualStyle: {
        color: "#ffffff",
        opacity: 0.38,
        scaleMultiplier: 0.97,
        yOffset: 0.05,
      },
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
      visualStyle: {
        color: "#ffffff",
        opacity: 0.38,
        scaleMultiplier: 0.97,
        yOffset: 0.05,
      },
    });
    manager.upsertLocalArrivalGhost({
      entityId: 1,
      hexCoords: hex(2, 2),
      sourceScene: createTemplateScene(),
      visualStyle: {
        color: "#ffffff",
        opacity: 0.38,
        scaleMultiplier: 0.97,
        yOffset: 0.05,
      },
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
      visualStyle: {
        color: "#ffffff",
        opacity: 0.38,
        scaleMultiplier: 0.97,
        yOffset: 0.05,
      },
    });

    const ghostContainer = scene.children.at(-1) as Group;
    const ghostMesh = ghostContainer.children[0].children[0] as Mesh;

    expect(ghostContainer.position.y).toBeCloseTo(0.2);
    expect(ghostMesh.renderOrder).toBe(10);
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
      visualStyle: {
        color: "#ffffff",
        opacity: 0.38,
        scaleMultiplier: 0.97,
        yOffset: 0.05,
      },
    });

    manager.clearArrivalGhost(1, "tx_failed");
    expect(manager.hasArrivalGhost(1)).toBe(false);

    manager.upsertLocalArrivalGhost({
      entityId: 2,
      hexCoords: hex(0, 0),
      sourceScene: createTemplateScene(),
      visualStyle: {
        color: "#ffffff",
        opacity: 0.38,
        scaleMultiplier: 0.97,
        yOffset: 0.05,
      },
    });
    manager.destroy();
    expect(manager.getTrackedEntityIds()).toEqual([]);
  });
});
