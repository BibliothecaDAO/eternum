import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/three/world-origin", () => ({ worldHexToWorld: (col: number, row: number) => ({ x: col, z: row }) }));

import type { MapPlate } from "@/three/map-plates/map-plate-model";

import { groundUnder, type MapCamera } from "./map-camera";
import { aimEye, MapLabels } from "./map-labels";

const CAMERA: MapCamera = { target: { x: 3, z: -2 }, distance: 20 };
const VIEWPORT = { width: 1_000, height: 600 };

describe("the labels' camera", () => {
  it.each([
    [500, 300],
    [120, 80],
    [900, 550],
  ])("puts a point of the ground back on the pixel the map's camera sees it under (%i, %i)", (x, y) => {
    const ground = groundUnder(CAMERA, VIEWPORT, x, y);
    const eye = aimEye(new PerspectiveCamera(), CAMERA, VIEWPORT);
    eye.updateMatrixWorld();
    const seen = new Vector3(ground.x, 0, ground.z).project(eye);
    expect(((seen.x + 1) / 2) * VIEWPORT.width).toBeCloseTo(x, 3);
    expect(((1 - seen.y) / 2) * VIEWPORT.height).toBeCloseTo(y, 3);
  });
});

describe("the map's labels", () => {
  const FLAT = { groundAt: () => 0, tops: new Map<string, number>() };
  const plate = { kind: "army", relation: "own", owner: "Ada", homeName: "Temtinos" } as MapPlate;
  const army = (entityId: number, col: number) => ({
    entityId,
    hex: { col, row: -2 },
    plate: { ...plate, troops: { type: "knight", tier: 1, count: entityId } } as MapPlate,
  });
  const labelOf = (entityId: number) => document.querySelector<HTMLElement>(`[data-key="army:${entityId}"]`);
  /** React commits the labels after the frame that asked for them; the next frame places them. */
  const drawn = async (labels: MapLabels, places = new Map<number, { x: number; z: number }>()) => {
    labels.frame(CAMERA, places, FLAT);
    await vi.waitFor(() => expect(labelOf(1)).not.toBeNull());
    labels.frame({ ...CAMERA }, places, FLAT);
  };
  let labels: MapLabels;

  beforeEach(() => {
    document.body.innerHTML = '<div id="world"></div>';
    Object.assign(window, { innerWidth: VIEWPORT.width, innerHeight: VIEWPORT.height });
    labels = new MapLabels();
  });
  afterEach(() => labels.dispose());

  it("show an army in view and hide one far out of it", async () => {
    labels.showArmies([army(1, 3), army(2, 400)], new Map(), FLAT);
    await drawn(labels);
    expect(labelOf(1)!.style.display).toBe("");
    expect(labelOf(2)!.style.display).toBe("none");
  });

  it("follow an army to where its march has it", async () => {
    labels.showArmies([army(1, 400)], new Map(), FLAT);
    await drawn(labels);
    expect(labelOf(1)!.style.display).toBe("none");
    labels.frame(CAMERA, new Map([[1, CAMERA.target]]), FLAT);
    expect(labelOf(1)!.style.display).toBe("");
  });

  it("drop the label of an army that is gone", async () => {
    labels.showArmies([army(1, 3), army(2, 4)], new Map(), FLAT);
    await drawn(labels);
    labels.showArmies([army(1, 3)], new Map(), FLAT);
    await vi.waitFor(() => expect(labelOf(2)).toBeNull());
    expect(labelOf(1)).not.toBeNull();
  });
});
