import { Color, Texture } from "three";
import { describe, expect, it } from "vitest";

import { STRATEGIC_MARKER_HEIGHT, StrategicMarkerLayer } from "./strategic-marker-layer";

const createLayer = () => {
  const loads: string[] = [];
  const layer = new StrategicMarkerLayer({
    loadTexture: (path) => {
      loads.push(path);
      return Promise.resolve(new Texture());
    },
  });
  return { layer, loads };
};

const meshNamed = (layer: StrategicMarkerLayer, name: string) => {
  const mesh = layer.object3d.children.find((child) => child.name === name);
  if (!mesh || !("instanceMatrix" in mesh)) throw new Error(`missing ${name}`);
  return mesh as import("three").InstancedMesh;
};

describe("StrategicMarkerLayer", () => {
  it("places one tinted instance per structure in its kind's pool and uploads only the touched range", () => {
    const { layer } = createLayer();
    layer.setStructure(7, "realm", 12.5, -3, new Color(0xff0000));
    layer.setStructure(8, "village", 1, 2, new Color(0x00ff00));
    layer.commit();

    const realms = meshNamed(layer, "strategic-structure:realm");
    expect(realms.count).toBe(1);
    const matrix = Array.from(realms.instanceMatrix.array.slice(12, 15));
    expect(matrix[0]).toBe(12.5);
    expect(matrix[1]).toBeCloseTo(STRATEGIC_MARKER_HEIGHT);
    expect(matrix[2]).toBe(-3);
    expect(Array.from(realms.instanceColor!.array.slice(0, 3))).toEqual([1, 0, 0]);
    expect(meshNamed(layer, "strategic-structure:village").count).toBe(1);
    expect(layer.metrics).toMatchObject({ structures: 2, armies: 0, uploadedInstances: 2, commits: 1 });
  });

  it("moves a structure between pools when its kind changes and swap-removes densely", () => {
    const { layer } = createLayer();
    layer.setStructure(1, "village", 0, 0, new Color(0xffffff));
    layer.setStructure(2, "village", 5, 5, new Color(0x0000ff));
    layer.setStructure(1, "realm", 0, 0, new Color(0xffffff));
    layer.commit();

    const villages = meshNamed(layer, "strategic-structure:village");
    expect(villages.count).toBe(1);
    const moved = Array.from(villages.instanceMatrix.array.slice(12, 15));
    expect([moved[0], moved[2]]).toEqual([5, 5]);
    expect(moved[1]).toBeCloseTo(STRATEGIC_MARKER_HEIGHT);
    expect(meshNamed(layer, "strategic-structure:realm").count).toBe(1);

    layer.removeStructure(2);
    layer.commit();
    expect(villages.count).toBe(0);
    expect(layer.metrics.structures).toBe(1);
  });

  it("keys army markers by tier and re-tilts every marker when the view pitch changes", () => {
    const { layer } = createLayer();
    layer.setArmy(40, "T2", 3, 4, new Color(0x123456));
    layer.commit();
    const tierTwo = meshNamed(layer, "strategic-army:T2");
    const before = Array.from(tierTwo.instanceMatrix.array.slice(0, 12));

    layer.setViewPitch(Math.PI / 2);
    layer.commit();
    const after = Array.from(tierTwo.instanceMatrix.array.slice(0, 12));
    expect(after).not.toEqual(before);
    expect(layer.metrics).toMatchObject({ armies: 1, uploadedInstances: 2 });

    layer.setArmy(40, "T3", 3, 4, new Color(0x123456));
    layer.commit();
    expect(tierTwo.count).toBe(0);
    expect(meshNamed(layer, "strategic-army:T3").count).toBe(1);
  });

  it("keeps a pool hidden until its texture lands and counts only textured pools as draws", async () => {
    const { layer, loads } = createLayer();
    layer.setStructure(1, "hyperstructure", 0, 0, new Color(0xffffff));
    layer.commit();
    expect(layer.metrics.drawCalls).toBe(0);
    await Promise.resolve();
    await Promise.resolve();
    layer.commit();
    expect(meshNamed(layer, "strategic-structure:hyperstructure").visible).toBe(true);
    expect(layer.metrics.drawCalls).toBe(1);
    expect(loads).toContain("/images/labels/hyperstructure.png");
  });

  it("throws loudly when a pool overflows its fixed capacity", () => {
    const { layer } = createLayer();
    for (let index = 0; index < 64; index += 1) layer.setStructure(index, "bank", index, 0, new Color(0xffffff));
    expect(() => layer.setStructure(64, "bank", 0, 0, new Color(0xffffff))).toThrow(/is full/);
  });
});
