// @vitest-environment jsdom
import { BiomeType } from "@bibliothecadao/types";
import { Color, Euler, type InstancedMesh, Matrix4, Scene, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { ArmyModel } from "./army-model";

vi.mock("@/ui/config", async (importOriginal) => ({ ...(await importOriginal<object>()), FELT_CENTER: () => 0 }));

const ARMY = 7;
const SLOT = 3;
const GREEN = new Color("#3fbf7f");

const armyOnTheMap = () => {
  const scene = new Scene();
  const model = new ArmyModel(scene, () => BiomeType.Grassland);
  const plates = scene.getObjectByName("army-side-plates") as InstancedMesh;
  model.setEntitySide(ARMY, GREEN);
  model.updateInstance(ARMY, SLOT, new Vector3(4, 0.5, -2), new Vector3(1, 1, 1), new Euler());
  return { model, plates };
};

const plateAt = (plates: InstancedMesh, slot: number) => {
  const matrix = new Matrix4();
  plates.getMatrixAt(slot, matrix);
  return new Vector3().setFromMatrixPosition(matrix);
};

const plateScale = (plates: InstancedMesh, slot: number) => {
  const matrix = new Matrix4();
  plates.getMatrixAt(slot, matrix);
  return new Vector3().setFromMatrixScale(matrix).x;
};

describe("an army's side plate", () => {
  it("lies on the ground under the army, in its side's colour", () => {
    const { plates } = armyOnTheMap();

    const at = plateAt(plates, SLOT);
    expect([at.x, at.z]).toEqual([4, -2]);
    expect(at.y).toBeCloseTo(0.52, 6);
    expect(plateScale(plates, SLOT)).toBeGreaterThan(0);
    expect(plates.count).toBe(SLOT + 1);
    const colour = new Color();
    plates.getColorAt(SLOT, colour);
    expect(colour.getHex()).toBe(GREEN.getHex());
  });

  it("stays under an army whose rig draws it in place of its model", () => {
    const { model, plates } = armyOnTheMap();

    model.setEntityRepresentationVisible(ARMY, false);

    expect(plateScale(plates, SLOT)).toBeGreaterThan(0);
  });

  it("takes a new side's colour at once", () => {
    const { model, plates } = armyOnTheMap();
    const red = new Color("#d04040");

    model.setEntitySide(ARMY, red);

    const colour = new Color();
    plates.getColorAt(SLOT, colour);
    expect(colour.getHex()).toBe(red.getHex());
  });

  it("leaves the map with its army", () => {
    const { model, plates } = armyOnTheMap();

    model.releaseEntity(ARMY);

    expect(plateScale(plates, SLOT)).toBe(0);
  });

  it("is hidden with the armies when the zoom band draws none", () => {
    const { model, plates } = armyOnTheMap();

    model.setModelsVisible(false);

    expect(plates.visible).toBe(false);
  });
});
