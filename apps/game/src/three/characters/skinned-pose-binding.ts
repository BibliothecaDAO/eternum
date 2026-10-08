import { Bone, Matrix4, type Object3D, Quaternion, Vector3 } from "three";

export interface SegmentBoneBinding {
  bone: Bone;
  orientationOffset: Quaternion;
}

const DEFAULT_SEGMENT_AXIS = new Vector3(0, 1, 0);
const stableSegmentDirection = new Vector3();
const stableSegmentForward = new Vector3();
const stableSegmentRight = new Vector3();
const stableSegmentMatrix = new Matrix4();
const hingeUpperDirection = new Vector3();
const hingeLowerDirection = new Vector3();

/**
 * Below this sine of the angle between a limb's two segments (about 3 degrees) the limb counts as straight: the plane
 * through its three joints is then set by rounding error, not by the limb.
 */
const STRAIGHT_LIMB_SINE = 0.05;

export function createSegmentBoneBinding(
  scene: Object3D,
  boneName: string,
  childBoneName?: string,
  segmentAxis: Vector3 = DEFAULT_SEGMENT_AXIS,
): SegmentBoneBinding {
  const bone = requireSkinnedBone(scene, boneName);
  const orientationOffset = childBoneName
    ? resolveSegmentOrientationOffset(bone, requireSkinnedBone(scene, childBoneName), segmentAxis)
    : bone.getWorldQuaternion(new Quaternion());
  return { bone, orientationOffset };
}

/** Creates a bind offset in the same axial frame used to pose a stable segment. */
export function createStableSegmentBoneBinding(
  scene: Object3D,
  boneName: string,
  childBoneName: string,
  referenceForward: Readonly<Vector3>,
  fallbackForward: Readonly<Vector3>,
): SegmentBoneBinding {
  const bone = requireSkinnedBone(scene, boneName);
  const childBone = requireSkinnedBone(scene, childBoneName);
  const bonePosition = bone.getWorldPosition(new Vector3());
  const bindDirection = childBone.getWorldPosition(new Vector3()).sub(bonePosition).normalize();
  const alignedQuaternion = resolveStableSegmentQuaternion(
    bindDirection,
    referenceForward,
    fallbackForward,
    new Quaternion(),
  );
  const bindWorldQuaternion = bone.getWorldQuaternion(new Quaternion());
  return { bone, orientationOffset: alignedQuaternion.invert().multiply(bindWorldQuaternion).normalize() };
}

/**
 * The hinge axis of a limb that bends like an elbow: the unit normal of the plane through its three joints, taken as
 * lower segment x upper segment. Binding and posing both use this one formula, so no sign convention is needed.
 * Returns false, leaving `out` unset, when the limb is nearly straight and has no plane.
 */
export function resolveLimbHingeAxis(
  start: Readonly<Vector3>,
  joint: Readonly<Vector3>,
  end: Readonly<Vector3>,
  out: Vector3,
): boolean {
  hingeUpperDirection.copy(joint).sub(start).normalize();
  hingeLowerDirection.copy(end).sub(joint).normalize();
  const normal = hingeLowerDirection.cross(hingeUpperDirection);
  if (normal.length() < STRAIGHT_LIMB_SINE) return false;
  out.copy(normal).normalize();
  return true;
}

/** The hinge axis of a limb in its bind pose; a limb that rests straight has none, which is an authoring error. */
export function createRestHingeAxis(scene: Object3D, startName: string, jointName: string, endName: string): Vector3 {
  const axis = new Vector3();
  const [start, joint, end] = [startName, jointName, endName].map((name) =>
    requireSkinnedBone(scene, name).getWorldPosition(new Vector3()),
  );
  if (!resolveLimbHingeAxis(start, joint, end, axis)) {
    throw new Error(`Limb ${startName}, ${jointName}, ${endName} rests straight and has no hinge axis`);
  }
  return axis;
}

export function requireSkinnedBone(scene: Object3D, name: string): Bone {
  const object = scene.getObjectByName(name);
  if (!(object instanceof Bone)) throw new Error(`Skinned asset bone ${name} was not found`);
  return object;
}

export function applySegmentBoneRotation(
  binding: SegmentBoneBinding,
  coordinateSpace: Object3D,
  segmentQuaternion: Quaternion,
  scratchGroupQuaternion: Quaternion,
  scratchParentQuaternion: Quaternion,
  scratchTargetQuaternion: Quaternion,
): void {
  const parent = binding.bone.parent;
  scratchTargetQuaternion
    .copy(coordinateSpace.getWorldQuaternion(scratchGroupQuaternion))
    .multiply(segmentQuaternion)
    .multiply(binding.orientationOffset)
    .normalize();
  if (!parent) {
    binding.bone.quaternion.copy(scratchTargetQuaternion);
  } else {
    parent.getWorldQuaternion(scratchParentQuaternion);
    binding.bone.quaternion.copy(scratchParentQuaternion.invert()).multiply(scratchTargetQuaternion).normalize();
  }
}

/** Aligns a segment while preserving a reference-facing axis near the 180° antipodal case. */
export function resolveStableSegmentQuaternion(
  direction: Readonly<Vector3>,
  referenceForward: Readonly<Vector3>,
  fallbackForward: Readonly<Vector3>,
  out: Quaternion,
): Quaternion {
  stableSegmentDirection.copy(direction);
  if (stableSegmentDirection.lengthSq() < 1e-8) return out.identity();
  stableSegmentDirection.normalize();
  stableSegmentForward
    .copy(referenceForward)
    .addScaledVector(stableSegmentDirection, -referenceForward.dot(stableSegmentDirection));
  if (stableSegmentForward.lengthSq() < 1e-8) {
    stableSegmentForward
      .copy(fallbackForward)
      .addScaledVector(stableSegmentDirection, -fallbackForward.dot(stableSegmentDirection));
  }
  if (stableSegmentForward.lengthSq() < 1e-8) return out.identity();
  stableSegmentForward.normalize();
  stableSegmentRight.crossVectors(stableSegmentDirection, stableSegmentForward).normalize();
  stableSegmentForward.crossVectors(stableSegmentRight, stableSegmentDirection).normalize();
  stableSegmentMatrix.makeBasis(stableSegmentRight, stableSegmentDirection, stableSegmentForward);
  return out.setFromRotationMatrix(stableSegmentMatrix).normalize();
}

function resolveSegmentOrientationOffset(bone: Bone, childBone: Bone, segmentAxis: Vector3): Quaternion {
  const bonePosition = bone.getWorldPosition(new Vector3());
  const childPosition = childBone.getWorldPosition(new Vector3());
  const bindDirection = childPosition.sub(bonePosition).normalize();
  const alignedQuaternion = new Quaternion().setFromUnitVectors(segmentAxis, bindDirection);
  const bindWorldQuaternion = bone.getWorldQuaternion(new Quaternion());
  return alignedQuaternion.invert().multiply(bindWorldQuaternion).normalize();
}
