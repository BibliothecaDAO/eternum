import { type Object3D, Quaternion, Vector3 } from "three";

import type { ProceduralCharacterConfig } from "./procedural-character-config";
import type { ProceduralCharacterPose } from "./procedural-character-pose";
import {
  JoltRagdollInstance,
  JoltRagdollWorld,
  preloadJoltCharacterPhysics,
  resolveJoltColliderScale,
  type JoltRagdollBodyConfig,
  type JoltRagdollDefinition,
  type JoltRagdollPartDefinition,
  type JoltRagdollStats,
} from "./jolt-ragdoll-world";
import { CHARACTER_PART_IDS, type CharacterPartId, type ResolvedCharacterRig } from "./procedural-character-rig";

export { preloadJoltCharacterPhysics };
export type { JoltRagdollStats };

export class JoltCharacterRagdoll {
  private constructor(
    private readonly instance: JoltRagdollInstance<CharacterPartId>,
    private readonly world: JoltRagdollWorld,
    private readonly ownsWorld: boolean,
    private config: ProceduralCharacterConfig,
  ) {}

  public static async create(
    rig: ResolvedCharacterRig,
    pose: ProceduralCharacterPose,
    config: ProceduralCharacterConfig,
    sharedWorld?: JoltRagdollWorld,
    coordinateSpace?: Object3D,
  ): Promise<JoltCharacterRagdoll> {
    const world = sharedWorld ?? (await JoltRagdollWorld.create(resolveWorldConfig(config)));
    const instance = world.createRagdoll(
      createCharacterRagdollDefinition(rig, pose, config, coordinateSpace),
      resolveJoltBodyConfig(config),
    );
    return new JoltCharacterRagdoll(instance, world, !sharedWorld, config);
  }

  public update(deltaSeconds: number): number {
    return this.ownsWorld ? this.world.update(deltaSeconds) : this.world.getLastStepCount();
  }

  public stepOnce(): void {
    if (this.ownsWorld) this.world.stepOnce();
  }

  public updateConfig(config: ProceduralCharacterConfig): void {
    this.config = config;
    this.world.updateConfig(resolveWorldConfig(config));
    this.instance.updateConfig(resolveJoltBodyConfig(config));
  }

  public applyConfiguredImpulse(partId: CharacterPartId = "chest"): void {
    this.instance.applyImpulse(partId, [this.config.impulseX, this.config.impulseY, this.config.impulseZ]);
  }

  public writePartTransforms(
    write: (
      partId: CharacterPartId,
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
    if (!this.ownsWorld) return this.instance.getStats();
    return this.world.getStats();
  }

  public dispose(): void {
    if (this.ownsWorld) this.world.dispose();
    else this.instance.dispose();
  }
}

export function createCharacterRagdollDefinition(
  rig: ResolvedCharacterRig,
  pose: ProceduralCharacterPose,
  config: ProceduralCharacterConfig,
  coordinateSpace?: Object3D,
): JoltRagdollDefinition<CharacterPartId> {
  const colliderScale = resolveJoltColliderScale(coordinateSpace);
  const parts = Object.fromEntries(
    CHARACTER_PART_IDS.map((partId) => {
      const source = rig.parts[partId];
      const definition: JoltRagdollPartDefinition<CharacterPartId> = {
        halfExtents: source.halfExtents && scaleVectorTuple(source.halfExtents, colliderScale),
        id: source.id,
        joint: resolveJoint(partId, source.jointKind, config),
        length: source.length === undefined ? undefined : source.length * colliderScale,
        mass: source.mass,
        parentId: source.parentId,
        radius: source.radius === undefined ? undefined : source.radius * colliderScale,
        shape: source.shape,
      };
      return [partId, definition];
    }),
  ) as Record<CharacterPartId, JoltRagdollPartDefinition<CharacterPartId>>;
  const worldPose = Object.fromEntries(
    CHARACTER_PART_IDS.map((partId) => [partId, transformPoseToWorld(pose.parts[partId], coordinateSpace)]),
  ) as Record<CharacterPartId, ProceduralCharacterPose["parts"][CharacterPartId]>;
  return { partIds: CHARACTER_PART_IDS, parts, pose: worldPose };
}

function scaleVectorTuple(value: readonly [number, number, number], scale: number): readonly [number, number, number] {
  return [value[0] * scale, value[1] * scale, value[2] * scale];
}

export function resolveJoltWorldConfig(config: ProceduralCharacterConfig) {
  return resolveWorldConfig(config);
}

function resolveWorldConfig(config: ProceduralCharacterConfig) {
  return { collisionSteps: config.collisionSteps, fixedStep: config.fixedStep, gravity: config.gravity };
}

export function resolveJoltBodyConfig(config: ProceduralCharacterConfig): JoltRagdollBodyConfig {
  return {
    angularDamping: config.angularDamping,
    friction: config.friction,
    linearDamping: config.linearDamping,
    massScale: config.massScale,
    restitution: config.restitution,
    selfCollision: config.selfCollision,
  };
}

function resolveJoint(
  partId: CharacterPartId,
  jointKind: ResolvedCharacterRig["parts"][CharacterPartId]["jointKind"],
  config: ProceduralCharacterConfig,
) {
  if (!jointKind) return undefined;
  const role = resolveConstraintRole(partId);
  if (jointKind === "hinge") {
    const [minimum, maximum] = resolveHingeLimits(config, role);
    return { kind: "hinge" as const, maximum, minimum };
  }
  const limits = resolveSwingTwistLimits(config, role);
  return { kind: "swing-twist" as const, ...limits };
}

type ConstraintRole = "elbow" | "hip" | "knee" | "neck" | "shoulder" | "spine";

function resolveConstraintRole(partId: CharacterPartId): ConstraintRole {
  if (partId === "chest") return "spine";
  if (partId === "head") return "neck";
  if (partId.startsWith("upperArm")) return "shoulder";
  if (partId.startsWith("forearm")) return "elbow";
  if (partId.startsWith("thigh")) return "hip";
  return "knee";
}

function resolveSwingTwistLimits(config: ProceduralCharacterConfig, role: ConstraintRole) {
  if (role === "shoulder") {
    return {
      swing: degreesToRadians(config.shoulderSwingDegrees),
      twist: degreesToRadians(config.shoulderTwistDegrees),
    };
  }
  if (role === "hip") {
    return { swing: degreesToRadians(config.hipSwingDegrees), twist: degreesToRadians(config.hipTwistDegrees) };
  }
  if (role === "neck") {
    const value = degreesToRadians(config.neckSwingDegrees);
    return { swing: value, twist: value * 0.65 };
  }
  const value = degreesToRadians(config.spineSwingDegrees);
  return { swing: value, twist: value * 0.55 };
}

function resolveHingeLimits(config: ProceduralCharacterConfig, role: ConstraintRole): readonly [number, number] {
  return role === "elbow"
    ? [degreesToRadians(config.elbowMinDegrees), degreesToRadians(config.elbowMaxDegrees)]
    : [degreesToRadians(config.kneeMinDegrees), degreesToRadians(config.kneeMaxDegrees)];
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function transformPoseToWorld(
  pose: ProceduralCharacterPose["parts"][CharacterPartId],
  coordinateSpace?: Object3D,
): ProceduralCharacterPose["parts"][CharacterPartId] {
  if (!coordinateSpace) return pose;
  coordinateSpace.updateWorldMatrix(true, false);
  const position = new Vector3(...pose.position).applyMatrix4(coordinateSpace.matrixWorld);
  const jointAnchor = new Vector3(...pose.jointAnchor).applyMatrix4(coordinateSpace.matrixWorld);
  const worldQuaternion = coordinateSpace
    .getWorldQuaternion(new Quaternion())
    .multiply(new Quaternion(...pose.quaternion))
    .normalize();
  return {
    jointAnchor: [jointAnchor.x, jointAnchor.y, jointAnchor.z],
    position: [position.x, position.y, position.z],
    quaternion: [worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w],
  };
}
