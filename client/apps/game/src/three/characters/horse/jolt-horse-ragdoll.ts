import { type Object3D, Quaternion, Vector3 } from "three";

import type { ProceduralCharacterConfig } from "../procedural-character-config";
import { resolveJoltBodyConfig } from "../jolt-character-ragdoll";
import {
  type JoltRagdollDefinition,
  JoltRagdollInstance,
  type JoltRagdollPartDefinition,
  type JoltRagdollPartPose,
  type JoltRagdollStats,
  JoltRagdollWorld,
} from "../jolt-ragdoll-world";
import type { ProceduralHorsePose } from "./procedural-horse-pose";
import { HORSE_LEG_SEGMENT_IDS, type HorseLegSegmentId, type ResolvedHorseRig } from "./procedural-horse-rig";

export const HORSE_RAGDOLL_BODY_IDS = ["horseBody", "horseChest", "horseHead"] as const;
export const HORSE_RAGDOLL_PART_IDS = [...HORSE_RAGDOLL_BODY_IDS, ...HORSE_LEG_SEGMENT_IDS] as const;
export type HorseRagdollPartId = (typeof HORSE_RAGDOLL_PART_IDS)[number];

export interface ResolvedHorseRagdollProfile {
  definition: JoltRagdollDefinition<HorseRagdollPartId>;
  segmentLengths: Readonly<Record<HorseLegSegmentId, number>>;
}

export class JoltHorseRagdoll {
  private constructor(
    private readonly instance: JoltRagdollInstance<HorseRagdollPartId>,
    public readonly profile: ResolvedHorseRagdollProfile,
    private config: ProceduralCharacterConfig,
  ) {}

  public static create(
    world: JoltRagdollWorld,
    rig: ResolvedHorseRig,
    pose: ProceduralHorsePose,
    config: ProceduralCharacterConfig,
    coordinateSpace: Object3D,
  ): JoltHorseRagdoll {
    const profile = createHorseRagdollProfile(rig, pose, coordinateSpace);
    return new JoltHorseRagdoll(
      world.createRagdoll(profile.definition, resolveJoltBodyConfig(config)),
      profile,
      config,
    );
  }

  public updateConfig(config: ProceduralCharacterConfig): void {
    this.config = config;
    this.instance.updateConfig(resolveJoltBodyConfig(config));
  }

  public applyConfiguredImpulse(): void {
    this.instance.applyImpulse("horseChest", [
      this.config.impulseX * 1.45,
      this.config.impulseY * 1.2,
      this.config.impulseZ * 1.45,
    ]);
  }

  public writePartTransforms(
    write: (
      partId: HorseRagdollPartId,
      x: number,
      y: number,
      z: number,
      qx: number,
      qy: number,
      qz: number,
      qw: number,
    ) => void,
  ): void {
    this.instance.writePartTransforms(write);
  }

  public hasFiniteTransforms(): boolean {
    return this.instance.hasFiniteTransforms();
  }

  public getStats(): JoltRagdollStats {
    return this.instance.getStats();
  }

  public dispose(): void {
    this.instance.dispose();
  }
}

export function createHorseRagdollProfile(
  rig: ResolvedHorseRig,
  pose: ProceduralHorsePose,
  coordinateSpace: Object3D,
): ResolvedHorseRagdollProfile {
  coordinateSpace.updateWorldMatrix(true, false);
  const bodyQuaternion = new Quaternion(...pose.bodyRotation);
  const bodyPosition = new Vector3(...rig.bodyCenter).add(new Vector3(...pose.rootOffset));
  const saddle = new Vector3(...pose.saddlePosition);
  const head = new Vector3(...pose.headPosition);
  const chestPosition = saddle
    .clone()
    .lerp(head, 0.22)
    .add(new Vector3(0, -0.34, 0.05));
  const bodyPose = createWorldPose(bodyPosition, bodyQuaternion, bodyPosition, coordinateSpace);
  const chestPose = createWorldPose(
    chestPosition,
    bodyQuaternion,
    bodyPosition.clone().lerp(chestPosition, 0.5),
    coordinateSpace,
  );
  const headPose = createWorldPose(head, bodyQuaternion, chestPosition.clone().lerp(head, 0.62), coordinateSpace);
  const poseEntries: Array<[HorseRagdollPartId, JoltRagdollPartPose]> = [
    ["horseBody", bodyPose],
    ["horseChest", chestPose],
    ["horseHead", headPose],
  ];
  const definitionEntries: Array<[HorseRagdollPartId, JoltRagdollPartDefinition<HorseRagdollPartId>]> = [
    ["horseBody", { halfExtents: [0.42, 0.38, 0.72], id: "horseBody", mass: 9.5, shape: "box" }],
    [
      "horseChest",
      {
        halfExtents: [0.44, 0.4, 0.68],
        id: "horseChest",
        joint: { kind: "swing-twist", swing: degreesToRadians(28), twist: degreesToRadians(18) },
        mass: 8,
        parentId: "horseBody",
        shape: "box",
      },
    ],
    [
      "horseHead",
      {
        id: "horseHead",
        joint: { kind: "swing-twist", swing: degreesToRadians(58), twist: degreesToRadians(35) },
        mass: 2.4,
        parentId: "horseChest",
        radius: 0.29,
        shape: "sphere",
      },
    ],
  ];
  const segmentLengths = {} as Record<HorseLegSegmentId, number>;

  Object.values(rig.legs).forEach((leg) => {
    leg.segmentIds.forEach((segmentId, index) => {
      const start = new Vector3(...pose.legs[leg.hoofId].joints[index]);
      const end = new Vector3(...pose.legs[leg.hoofId].joints[index + 1]);
      const length = start.distanceTo(end);
      segmentLengths[segmentId] = length;
      const parentId = index === 0 ? resolveLegRootParent(segmentId) : leg.segmentIds[index - 1];
      const radius = segmentId.startsWith("hind") ? 0.13 : 0.105;
      definitionEntries.push([
        segmentId,
        {
          id: segmentId,
          joint:
            index === 0
              ? { kind: "swing-twist", swing: degreesToRadians(55), twist: degreesToRadians(24) }
              : { kind: "hinge", maximum: degreesToRadians(150), minimum: degreesToRadians(-150) },
          length,
          mass: Math.max(0.8, length * (segmentId.startsWith("hind") ? 2.1 : 1.65)),
          parentId,
          radius,
          shape: "capsule",
        },
      ]);
      const localQuaternion = new Quaternion(...pose.segmentRotations[segmentId]);
      poseEntries.push([
        segmentId,
        createWorldPose(start.clone().add(end).multiplyScalar(0.5), localQuaternion, start, coordinateSpace),
      ]);
    });
  });

  return {
    definition: {
      partIds: HORSE_RAGDOLL_PART_IDS,
      parts: Object.fromEntries(definitionEntries) as Record<
        HorseRagdollPartId,
        JoltRagdollPartDefinition<HorseRagdollPartId>
      >,
      pose: Object.fromEntries(poseEntries) as Record<HorseRagdollPartId, JoltRagdollPartPose>,
    },
    segmentLengths,
  };
}

function resolveLegRootParent(segmentId: HorseLegSegmentId): "horseBody" | "horseChest" {
  return segmentId.startsWith("front") ? "horseChest" : "horseBody";
}

function createWorldPose(
  localPosition: Vector3,
  localQuaternion: Quaternion,
  localAnchor: Vector3,
  coordinateSpace: Object3D,
): JoltRagdollPartPose {
  const position = localPosition.applyMatrix4(coordinateSpace.matrixWorld);
  const jointAnchor = localAnchor.applyMatrix4(coordinateSpace.matrixWorld);
  const quaternion = coordinateSpace.getWorldQuaternion(new Quaternion()).multiply(localQuaternion).normalize();
  return {
    jointAnchor: [jointAnchor.x, jointAnchor.y, jointAnchor.z],
    position: [position.x, position.y, position.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
