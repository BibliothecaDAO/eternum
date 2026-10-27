// @vitest-environment jsdom
import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { ARMY_MODEL_TOP, ARMY_PLATE_HEIGHT } from "../constants/army-constants";
import { PLATE_CLEARANCE } from "../managers/structure-visible-presentation";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
  WORLDMAP_CAMERA_ZOOM,
} from "../scenes/worldmap-camera-view-profile";
import { MapPlateLayer } from "./map-plate-layer";
import type { ArmyPlate, StructurePlate } from "./map-plate-model";

const plate: ArmyPlate = {
  kind: "army",
  relation: "own",
  owner: "djizus",
  homeName: "Queuvaingauv",
  troops: { type: "knight", tier: 1, count: 5282 },
  stamina: { current: 8, max: 170, perExplore: 20 },
};

/** The tallest army as drawn over its tile (army-constants.ts, held by army-plate-height.test.ts). */
const MODEL_TOP = ARMY_MODEL_TOP;
/** One row of tiles further from the camera. */
const ROW = 1.5;

/** The world map's camera at a zoom distance, looking at `target` with that distance's pitch. */
const cameraAt = (distance: number, target: Vector3) => {
  const camera = new PerspectiveCamera(resolveWorldmapCameraFieldOfViewDegrees(), 1440 / 900, 0.1, 500);
  const pitch = resolveWorldmapCameraPitchRadians(distance);
  camera.position.set(target.x, target.y + Math.sin(pitch) * distance, target.z + Math.cos(pitch) * distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
};

/** The pointer's ray where `point` is drawn on screen. */
const rayThrough = (camera: PerspectiveCamera, point: Vector3) => {
  const raycaster = new Raycaster();
  const projected = point.clone().project(camera);
  raycaster.setFromCamera(new Vector2(projected.x, projected.y), camera);
  return raycaster.ray;
};

/** Where the ray meets the ground (height 0), as the tile pick reads it. */
const groundUnder = (camera: PerspectiveCamera, point: Vector3) => {
  const ray = rayThrough(camera, point);
  return ray.origin.clone().addScaledVector(ray.direction, -ray.origin.y / ray.direction.y);
};

/** The layer with an army whose label point stands over each tile: as the army manager sets its label. */
const layerWith = (...tiles: Vector3[]) => {
  const layer = new MapPlateLayer(() => null);
  const armies = layer.createScope("army");
  tiles.forEach((tile, index) =>
    armies.setLabel({ entityId: index + 1, position: tile.clone().setY(ARMY_PLATE_HEIGHT), plate }),
  );
  return layer;
};

const ZOOMS = [WORLDMAP_CAMERA_ZOOM.minDistance, 12, 14, 16.5, 20, 27, 35, WORLDMAP_CAMERA_ZOOM.maxDistance];
const HEIGHTS = [0.05, 0.4, 0.7, 1.0, MODEL_TOP];

describe("the thing under the pointer (owner, 2026-10-27: 'at a certain zoom level I cant get the hover modal')", () => {
  const tile = new Vector3(0, 0, 0);

  it.each(ZOOMS)("is the army wherever its model is drawn, at zoom %d", (distance) => {
    const camera = cameraAt(distance, tile);
    const layer = layerWith(tile);
    const seen = HEIGHTS.map((height) => layer.thingHitBy(rayThrough(camera, tile.clone().setY(height)))?.toArray());
    expect(seen).toEqual(HEIGHTS.map(() => [0, ARMY_PLATE_HEIGHT, 0]));
  });

  it("is the army at its head on the closest zoom, where the ground under the pointer is a row behind it", () => {
    const camera = cameraAt(WORLDMAP_CAMERA_ZOOM.minDistance, tile);
    const head = tile.clone().setY(MODEL_TOP);
    expect(groundUnder(camera, head).z).toBeLessThan(-ROW / 2);
    expect(layerWith(tile).thingHitBy(rayThrough(camera, head))?.toArray()).toEqual([0, ARMY_PLATE_HEIGHT, 0]);
  });

  it("is the army in front where its model covers the army behind, and the army behind above it", () => {
    const behind = new Vector3(0, 0, -ROW);
    const camera = cameraAt(WORLDMAP_CAMERA_ZOOM.minDistance, tile);
    const layer = layerWith(tile, behind);
    expect(layer.thingHitBy(rayThrough(camera, tile.clone().setY(1.0)))?.z).toBe(0);
    expect(layer.thingHitBy(rayThrough(camera, behind.clone().setY(1.0)))?.z).toBe(-ROW);
  });

  it.each(ZOOMS)("is nothing on the bare ground beside or in front of the army, at zoom %d", (distance) => {
    const camera = cameraAt(distance, tile);
    const layer = layerWith(tile);
    expect(layer.thingHitBy(rayThrough(camera, new Vector3(0, 0, ROW)))).toBeNull();
    expect(layer.thingHitBy(rayThrough(camera, new Vector3(1.5, 0.5, 0)))).toBeNull();
  });

  it("is nothing a model's height over the army's label point", () => {
    const camera = cameraAt(WORLDMAP_CAMERA_ZOOM.defaultDistance, tile);
    expect(layerWith(tile).thingHitBy(rayThrough(camera, tile.clone().setY(ARMY_PLATE_HEIGHT + 1)))).toBeNull();
  });
});

/** A beast's site, as the structure manager labels it: a ruin guarded by 518. */
const site: StructurePlate = {
  kind: "structure",
  relation: "enemy",
  owner: "",
  name: "Ruin",
  named: false,
  guards: [{ type: "knight", tier: 1, count: 518 }],
  arrivals: [],
  icon: "ruin",
};

/** A model 1.2 tall on its tile, its label point over its roof as the structure manager sets it. */
const SITE_TOP = 1.2;
const layerWithSite = (tile: Vector3) => {
  const layer = new MapPlateLayer(() => null);
  layer
    .createScope("structure")
    .setLabel({ entityId: 9, position: tile.clone().setY(SITE_TOP + PLATE_CLEARANCE), plate: site });
  return layer;
};

describe("the tile under the pointer over a thing (owner, 2026-10-27: 'right clicking here I'd expect the army to move')", () => {
  const tile = new Vector3(0, 0, 0);
  const behind = new Vector3(0, 0, -ROW);

  it.each(ZOOMS)(
    "is the tile behind an army where its ground shows between the army's head and token, at zoom %d",
    (distance) => {
      const camera = cameraAt(distance, tile);
      const gap = tile.clone().setY((MODEL_TOP + ARMY_PLATE_HEIGHT) / 2 + 0.05);
      expect(layerWith(tile).thingHitBy(rayThrough(camera, gap))).toBeNull();
      expect(layerWith(tile).thingHitBy(rayThrough(camera, tile.clone().setY(ARMY_PLATE_HEIGHT)))).toBeNull();
    },
  );

  it.each(ZOOMS)("is a structure's tile on its model, edge to edge and up to its roof, at zoom %d", (distance) => {
    const camera = cameraAt(distance, tile);
    const layer = layerWithSite(tile);
    const label = [0, SITE_TOP + PLATE_CLEARANCE, 0];
    const roof = tile.clone().setY(SITE_TOP - 0.05);
    const wall = new Vector3(0.8, SITE_TOP / 2, 0);
    expect(layer.thingHitBy(rayThrough(camera, roof))?.toArray()).toEqual(label);
    expect(layer.thingHitBy(rayThrough(camera, wall))?.toArray()).toEqual(label);
  });

  it.each(ZOOMS)("is the tile behind a structure over its roof, under its token, at zoom %d", (distance) => {
    const camera = cameraAt(distance, tile);
    const layer = layerWithSite(tile);
    const overRoof = tile.clone().setY(SITE_TOP + PLATE_CLEARANCE / 2);
    expect(layer.thingHitBy(rayThrough(camera, overRoof))).toBeNull();
    expect(groundUnder(camera, overRoof).z).toBeLessThan(behind.z / 3);
  });
});
