import { Object3D, Quaternion, Vector3 } from "three";

import { smootherStep, type ProceduralContactCycle } from "./procedural-motion-curves";

export type ProceduralPlantTargetResolver<FootId extends string> = (
  footId: FootId,
  cycle: ProceduralContactCycle,
  localTarget: readonly [number, number, number],
  planting: number,
) => readonly [number, number, number];

interface PlantState {
  active: boolean;
  contact: ProceduralContactCycle["contact"];
  worldAnchor: Vector3;
}

const CONTACT_BLEND_FRACTION = 0.06;
const SWING_RELEASE_BLEND_FRACTION = 0.12;
const ROOT_MOTION_THRESHOLD = 1e-4;

/** Keeps renderer-local contact anchors stable while a scene actor translates. */
export class ProceduralPlantController<FootId extends string> {
  private readonly plants = new Map<FootId, PlantState>();
  private readonly rootPosition = new Vector3();
  private readonly previousRootPosition = new Vector3();
  private readonly rootQuaternion = new Quaternion();
  private readonly previousRootQuaternion = new Quaternion();
  private readonly candidateWorld = new Vector3();
  private readonly targetWorld = new Vector3();
  private coordinateSpace?: Object3D;
  private frameTravelDistance = 0;
  private rootMoved = false;
  private initialized = false;

  public beginFrame(coordinateSpace: Object3D): void {
    this.coordinateSpace = coordinateSpace;
    coordinateSpace.updateWorldMatrix(true, false);
    coordinateSpace.getWorldPosition(this.rootPosition);
    coordinateSpace.getWorldQuaternion(this.rootQuaternion);
    this.frameTravelDistance = this.initialized ? this.rootPosition.distanceTo(this.previousRootPosition) : 0;
    this.rootMoved =
      this.initialized &&
      (this.rootPosition.distanceToSquared(this.previousRootPosition) > ROOT_MOTION_THRESHOLD * ROOT_MOTION_THRESHOLD ||
        this.rootQuaternion.angleTo(this.previousRootQuaternion) > ROOT_MOTION_THRESHOLD);
    this.previousRootPosition.copy(this.rootPosition);
    this.previousRootQuaternion.copy(this.rootQuaternion);
    this.initialized = true;
  }

  public getFrameTravelDistance(): number {
    return this.frameTravelDistance;
  }

  public resolveTarget: ProceduralPlantTargetResolver<FootId> = (footId, cycle, localTarget, planting) => {
    const coordinateSpace = this.coordinateSpace;
    if (!coordinateSpace) return localTarget;

    this.candidateWorld.fromArray(localTarget);
    coordinateSpace.localToWorld(this.candidateWorld);
    let plant = this.plants.get(footId);
    if (!plant) {
      plant = { active: false, contact: cycle.contact, worldAnchor: this.candidateWorld.clone() };
      this.plants.set(footId, plant);
    }

    if (cycle.contact === "swing") {
      plant.contact = "swing";
      if (!plant.active) return localTarget;
      const releaseProgress = smootherStep(cycle.progress / SWING_RELEASE_BLEND_FRACTION);
      const releaseWeight = (1 - releaseProgress) * clamp(planting, 0, 1);
      this.targetWorld.copy(this.candidateWorld).lerp(plant.worldAnchor, releaseWeight);
      if (cycle.progress >= SWING_RELEASE_BLEND_FRACTION) plant.active = false;
      coordinateSpace.worldToLocal(this.targetWorld);
      return [this.targetWorld.x, this.targetWorld.y, this.targetWorld.z];
    }

    if (plant.contact !== "stance") plant.worldAnchor.copy(this.candidateWorld);
    if (!plant.active) {
      if (this.rootMoved) plant.active = true;
      else plant.worldAnchor.copy(this.candidateWorld);
    }
    plant.contact = "stance";
    if (!plant.active) return localTarget;

    const blend = resolveContactBlend(cycle.progress) * clamp(planting, 0, 1);
    this.targetWorld.copy(this.candidateWorld).lerp(plant.worldAnchor, blend);
    coordinateSpace.worldToLocal(this.targetWorld);
    return [this.targetWorld.x, this.targetWorld.y, this.targetWorld.z];
  };

  public reset(): void {
    this.plants.clear();
    this.coordinateSpace = undefined;
    this.frameTravelDistance = 0;
    this.rootMoved = false;
    this.initialized = false;
  }
}

function resolveContactBlend(progress: number): number {
  return smootherStep(progress / CONTACT_BLEND_FRACTION);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
