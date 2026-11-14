import { PerspectiveCamera, Vector3 } from "three";

import { ARMY_PLATE_HEIGHT } from "@/three/constants/army-constants";
import { PLATE_CLEARANCE } from "@/three/managers/structure-visible-presentation";
import { MapPlateLayer } from "@/three/map-plates/map-plate-layer";
import { worldHexToWorld } from "@/three/world-origin";

import {
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  cameraWorldMatrix,
  type GroundPoint,
  type MapCamera,
  type Viewport,
} from "./map-camera";
import type { LabelledThing } from "./plate-facts";
import { hexKey, type PackedLand } from "./scene-from-land";

/** Aims a camera of the label layer's kind as the map's own camera stands, so a label lands on what it names. */
export function aimEye(eye: PerspectiveCamera, camera: MapCamera, viewport: Viewport): PerspectiveCamera {
  eye.fov = (CAMERA_FOV * 180) / Math.PI;
  eye.aspect = viewport.width / viewport.height;
  eye.near = CAMERA_NEAR;
  eye.far = CAMERA_FAR;
  eye.updateProjectionMatrix();
  eye.matrixAutoUpdate = false;
  eye.matrix.fromArray(cameraWorldMatrix(camera));
  eye.matrixWorldNeedsUpdate = true;
  return eye;
}

/** The heights of a land that its labels stand on. */
type LabelGround = Pick<PackedLand, "groundAt" | "tops">;

/**
 * The map's labels: today's tokens and plates (`MapPlateLayer`), across the world UI's page (`ui/layouts/world.tsx`)
 * under the HUD, placed over this map through a camera that mirrors its own. A structure's label stands over its
 * model, an army's over the army wherever its march has it.
 */
export class MapLabels {
  private readonly layer = new MapPlateLayer(() => document.getElementById("world"));
  private readonly armies = this.layer.createScope("army");
  private readonly structures = this.layer.createScope("structure");
  private readonly eye = new PerspectiveCamera();
  private readonly point = new Vector3();

  /** The structures that carry a label, each over what stands on its hex. */
  showStructures(things: readonly LabelledThing[], ground: LabelGround): void {
    for (const { entityId, hex, plate } of things) {
      const { x, z } = worldHexToWorld(hex.col, hex.row);
      const top = ground.tops.get(hexKey(hex)) ?? ground.groundAt(x, z);
      this.structures.setLabel({ entityId, plate, position: this.point.set(x, top + PLATE_CLEARANCE, z) });
    }
    this.structures.retainOnly(things.map(({ entityId }) => entityId));
  }

  /** The armies that carry a label, each where `places` has it now, else on its hex. */
  showArmies(things: readonly LabelledThing[], places: ReadonlyMap<number, GroundPoint>, ground: LabelGround): void {
    for (const { entityId, hex, plate } of things) {
      const at = places.get(entityId) ?? worldHexToWorld(hex.col, hex.row);
      this.armies.setLabel({ entityId, plate, position: this.overArmy(at, ground) });
    }
    this.armies.retainOnly(things.map(({ entityId }) => entityId));
  }

  /** A frame: every army's label follows its march, and each label is placed for the camera as it stands. */
  frame(camera: MapCamera, places: ReadonlyMap<number, GroundPoint>, ground: LabelGround): void {
    for (const [entityId, at] of places) this.armies.setPosition(entityId, this.overArmy(at, ground));
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    this.layer.update(aimEye(this.eye, camera, viewport), viewport.width, viewport.height);
  }

  /** The thing picked is ringed; null rings none. */
  select(entityId: number | null): void {
    this.layer.setSelected(entityId);
  }

  /** The pointer is on an army's or a structure's hex: its plate opens. Neither closes the one open. */
  hover(thing: { army?: number; structure?: number }): void {
    if (thing.army !== undefined) return this.armies.setHover(thing.army);
    if (thing.structure !== undefined) return this.structures.setHover(thing.structure);
    this.armies.clearHover();
    this.structures.clearHover();
  }

  dispose(): void {
    this.layer.dispose();
  }

  private overArmy(at: GroundPoint, ground: LabelGround): Vector3 {
    return this.point.set(at.x, ground.groundAt(at.x, at.z) + ARMY_PLATE_HEIGHT, at.z);
  }
}
