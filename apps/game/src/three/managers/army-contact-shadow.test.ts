import { BiomeType } from "@bibliothecadao/types";
import { Euler, type InstancedMesh, Matrix4, Scene, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { ArmyModel } from "./army-model";
import { getContactShadowResources } from "../utils/contact-shadow";

vi.mock("@/ui/config", async (importOriginal) => ({ ...(await importOriginal<object>()), FELT_CENTER: () => 0 }));

const ARMY = 7;
const SLOT = 3;

const armyOnTheMap = () => {
  const scene = new Scene();
  const model = new ArmyModel(scene, () => BiomeType.Grassland);
  const shadows = scene.getObjectByName("army-contact-shadows") as InstancedMesh;
  model.updateInstance(ARMY, SLOT, new Vector3(4, 0.5, -2), new Vector3(1, 1, 1), new Euler());
  return { model, shadows };
};

const shadowAt = (shadows: InstancedMesh, slot: number) => {
  const matrix = new Matrix4();
  shadows.getMatrixAt(slot, matrix);
  return new Vector3().setFromMatrixPosition(matrix);
};

const shadowScale = (shadows: InstancedMesh, slot: number) => {
  const matrix = new Matrix4();
  shadows.getMatrixAt(slot, matrix);
  return new Vector3().setFromMatrixScale(matrix).x;
};

describe("an army's contact shadow", () => {
  it("lies on the ground under the army", () => {
    const { shadows } = armyOnTheMap();

    const at = shadowAt(shadows, SLOT);
    expect([at.x, at.z]).toEqual([4, -2]);
    expect(at.y).toBeCloseTo(0.52, 6);
    expect(shadowScale(shadows, SLOT)).toBeGreaterThan(0);
    expect(shadows.count).toBe(SLOT + 1);
  });

  it("stays under an army whose rig draws it in place of its model", () => {
    const { model, shadows } = armyOnTheMap();

    model.setEntityRepresentationVisible(ARMY, false);

    expect(shadowScale(shadows, SLOT)).toBeGreaterThan(0);
  });

  it("leaves the map with its army", () => {
    const { model, shadows } = armyOnTheMap();

    model.releaseEntity(ARMY);

    expect(shadowScale(shadows, SLOT)).toBe(0);
  });

  it("is hidden with the armies when the zoom band draws none", () => {
    const { model, shadows } = armyOnTheMap();

    model.setModelsVisible(false);

    expect(shadows.visible).toBe(false);
  });

  it("shares the structure contact-shadow material so one opacity control moves both", () => {
    const { model, shadows } = armyOnTheMap();
    const shared = getContactShadowResources();

    expect(shadows.material).toBe(shared.material);
    expect(shadows.geometry).toBe(shared.geometry);

    const disposeMaterial = vi.spyOn(shared.material, "dispose");
    const disposeGeometry = vi.spyOn(shared.geometry, "dispose");
    model.dispose();

    expect(disposeMaterial).not.toHaveBeenCalled();
    expect(disposeGeometry).not.toHaveBeenCalled();
  });
});
