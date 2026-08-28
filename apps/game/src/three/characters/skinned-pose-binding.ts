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
