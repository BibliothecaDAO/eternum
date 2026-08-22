import { Bone, type Object3D, Quaternion, Vector3 } from "three";

export interface SegmentBoneBinding {
  bone: Bone;
  orientationOffset: Quaternion;
}

const DEFAULT_SEGMENT_AXIS = new Vector3(0, 1, 0);

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
  binding.bone.updateWorldMatrix(false, true);
}

function resolveSegmentOrientationOffset(bone: Bone, childBone: Bone, segmentAxis: Vector3): Quaternion {
  const bonePosition = bone.getWorldPosition(new Vector3());
  const childPosition = childBone.getWorldPosition(new Vector3());
  const bindDirection = childPosition.sub(bonePosition).normalize();
  const alignedQuaternion = new Quaternion().setFromUnitVectors(segmentAxis, bindDirection);
  const bindWorldQuaternion = bone.getWorldQuaternion(new Quaternion());
  return alignedQuaternion.invert().multiply(bindWorldQuaternion).normalize();
}
