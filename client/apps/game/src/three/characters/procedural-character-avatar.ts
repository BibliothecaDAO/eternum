import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Skeleton,
  SkeletonHelper,
  SkinnedMesh,
  Vector3,
} from "three";

import type { ProceduralCharacterConfig } from "./procedural-character-config";
import type { ProceduralHumanoidJointId } from "./procedural-character-diagnostics";
import type { ProceduralCharacterUpperBodyAction } from "./procedural-character-action";
import {
  PROCEDURAL_HAND_DIGIT_IDS,
  resolveProceduralCharacterHandPose,
  type ProceduralHandDigitId,
  type ProceduralHandGripProfile,
  type ProceduralHandPose,
} from "./procedural-character-hand-pose";
import type { ProceduralCharacterPose, QuaternionTuple, Vector3Tuple } from "./procedural-character-pose";
import { CHARACTER_PART_IDS, type CharacterPartId, type ResolvedCharacterRig } from "./procedural-character-rig";
import { type CharacterSocketId, type ProceduralCharacterSocketReader } from "./procedural-character-sockets";
import { QUATERNIUS_BONE_NAMES, type LoadedQuaterniusCharacterAsset } from "./quaternius-character-assets";
import {
  applySegmentBoneRotation,
  createSegmentBoneBinding,
  requireSkinnedBone,
  type SegmentBoneBinding,
} from "./skinned-pose-binding";

interface CharacterPartTransform {
  position: Vector3;
  quaternion: Quaternion;
}

interface CharacterHandBinding {
  bindQuaternion: Quaternion;
  bone: Bone;
  digits: Readonly<Record<ProceduralHandDigitId, readonly CharacterFingerBoneBinding[]>>;
}

interface CharacterFingerBoneBinding {
  bindQuaternion: Quaternion;
  bone: Bone;
}

interface CharacterSocketBinding {
  bone: Bone;
  offset: Vector3;
}

interface StyledCharacterMaterial {
  baseColor: Color;
  baseMetalness: number;
  baseRoughness: number;
  material: MeshStandardMaterial;
  role: "body" | "outfit" | "other";
}

interface PreparedCharacterModel {
  asset: LoadedQuaterniusCharacterAsset;
  authoredPelvisToAnkle: number;
  bindings: Readonly<Record<CharacterPartId, SegmentBoneBinding>>;
  hands: Readonly<Record<keyof typeof HAND_BONE_NAMES, CharacterHandBinding>>;
  helper: SkeletonHelper;
  materials: Set<Material>;
  ownedGeometries: Set<BufferGeometry>;
  scene: Group;
  sockets: Readonly<Record<CharacterSocketId, CharacterSocketBinding>>;
  skeletons: Set<Skeleton>;
  skinnedMeshCount: number;
  styledMaterials: StyledCharacterMaterial[];
}

export interface ProceduralCharacterAvatarStats {
  assetId: LoadedQuaterniusCharacterAsset["id"];
  assetLabel: string;
  authoredClipCount: number;
  boneCount: number;
  leftPalmInwardDot: number;
  leftGripProfile: ProceduralHandGripProfile;
  rightPalmInwardDot: number;
  rightGripProfile: ProceduralHandGripProfile;
  skinnedMeshCount: number;
}

const Y_AXIS = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const HEAD_NECK_RANGE = 0.42;
const MIN_HEAD_SKIN_WEIGHT = 0.5;
const MAX_LIMB_BEND_PLANE_STEP = Math.PI / 8;
const HAND_ROLL_CORRECTION = new Quaternion().setFromAxisAngle(Y_AXIS, Math.PI);
const IDENTITY_QUATERNION = new Quaternion();
const HAND_BONE_NAMES = {
  left: { hand: "hand_l", index: "index_01_l", middle: "middle_01_l", pinky: "pinky_01_l" },
  right: { hand: "hand_r", index: "index_01_r", middle: "middle_01_r", pinky: "pinky_01_r" },
} as const;
const HAND_DIGIT_BONE_NAMES: Readonly<Record<ProceduralHandDigitId, readonly string[]>> = {
  index: ["index_01", "index_02", "index_03"],
  middle: ["middle_01", "middle_02", "middle_03"],
  pinky: ["pinky_01", "pinky_02", "pinky_03"],
  ring: ["ring_01", "ring_02", "ring_03"],
  thumb: ["thumb_01", "thumb_02", "thumb_03"],
};
const FINGER_CURL_RADIANS = [Math.PI * 0.4, Math.PI * 0.5, Math.PI * 0.34] as const;
const THUMB_CURL_RADIANS = [Math.PI * 0.18, Math.PI * 0.3, Math.PI * 0.2] as const;
const SEGMENT_CHILD_BONE_NAMES: Partial<Record<CharacterPartId, string>> = {
  upperArmLeft: "lowerarm_l",
  forearmLeft: "hand_l",
  upperArmRight: "lowerarm_r",
  forearmRight: "hand_r",
  thighLeft: "calf_l",
  shinLeft: "foot_l",
  thighRight: "calf_r",
  shinRight: "foot_r",
};
const CHARACTER_IK_PART_IDS = new Set<CharacterPartId>([
  "upperArmLeft",
  "forearmLeft",
  "upperArmRight",
  "forearmRight",
  "thighLeft",
  "shinLeft",
  "thighRight",
  "shinRight",
]);
const DIAGNOSTIC_JOINT_BONE_NAMES: Readonly<Record<ProceduralHumanoidJointId, string>> = {
  ankleLeft: "foot_l",
  ankleRight: "foot_r",
  chest: "spine_03",
  elbowLeft: "lowerarm_l",
  elbowRight: "lowerarm_r",
  head: "Head",
  hipLeft: "thigh_l",
  hipRight: "thigh_r",
  kneeLeft: "calf_l",
  kneeRight: "calf_r",
  pelvis: "pelvis",
  shoulderLeft: "upperarm_l",
  shoulderRight: "upperarm_r",
  wristLeft: "hand_l",
  wristRight: "hand_r",
};

export class ProceduralCharacterAvatar implements ProceduralCharacterSocketReader {
  public readonly group = new Group();

  private readonly models = new Map<LoadedQuaterniusCharacterAsset["tier"], PreparedCharacterModel>();
  private readonly partTransforms = createCharacterPartTransforms();
  private readonly scratchParentQuaternion = new Quaternion();
  private readonly scratchGroupQuaternion = new Quaternion();
  private readonly scratchTargetQuaternion = new Quaternion();
  private readonly scratchWorldPosition = new Vector3();
  private readonly scratchDelta = new Vector3();
  private readonly scratchIkRoot = new Vector3();
  private readonly scratchIkCurrentJoint = new Vector3();
  private readonly scratchIkCurrentEnd = new Vector3();
  private readonly scratchIkTarget = new Vector3();
  private readonly scratchIkPole = new Vector3();
  private readonly scratchIkOffset = new Vector3();
  private readonly scratchIkDirection = new Vector3();
  private readonly scratchIkPoleDirection = new Vector3();
  private readonly scratchIkCurrentPoleDirection = new Vector3();
  private readonly scratchIkSolvedJoint = new Vector3();
  private readonly scratchIkAlternateJoint = new Vector3();
  private readonly scratchIkSolvedEnd = new Vector3();
  private readonly scratchIkSegmentQuaternion = new Quaternion();
  private activeModel: PreparedCharacterModel;
  private rig: ResolvedCharacterRig;
  private config: ProceduralCharacterConfig;
  private lastPose?: ProceduralCharacterPose;
  private upperBodyAction?: ProceduralCharacterUpperBodyAction;
  private readonly scratchHandCorrection = new Quaternion();
  private readonly scratchFingerCurl = new Quaternion();

  constructor(assets: LoadedQuaterniusCharacterAsset[], rig: ResolvedCharacterRig, config: ProceduralCharacterConfig) {
    this.rig = rig;
    this.config = config;
    this.group.name = "procedural-character-avatar";
    composeBaseHeadOntoOutfits(assets);
    assets.forEach((asset) => this.addCharacterModel(asset));
    this.activeModel = this.requireModel(config.tier);
    this.activateModel(config.tier);
    this.updateConfig(config);
  }

  public rebuild(rig: ResolvedCharacterRig, config: ProceduralCharacterConfig): void {
    this.rig = rig;
    this.config = config;
    this.activateModel(config.tier);
    this.updateConfig(config);
    if (this.lastPose) this.applyPose(this.lastPose);
  }

  public updateConfig(config: ProceduralCharacterConfig): void {
    this.config = config;
    this.models.forEach((model) => updateCharacterModelStyle(model, config));
    this.updateDebugVisibility();
  }

  public setUpperBodyAction(action?: ProceduralCharacterUpperBodyAction): void {
    this.upperBodyAction = action;
  }

  public applyPose(pose: ProceduralCharacterPose): void {
    this.lastPose = pose;
    CHARACTER_PART_IDS.forEach((partId) => {
      const source = pose.parts[partId];
      const target = this.partTransforms[partId];
      target.position.fromArray(source.position);
      target.quaternion.fromArray(source.quaternion);
    });
    this.applyCurrentTransforms();
  }

  public setPartTransform(partId: CharacterPartId, position: Vector3Tuple, quaternion: QuaternionTuple): void {
    const transform = this.partTransforms[partId];
    transform.position.fromArray(position);
    transform.quaternion.fromArray(quaternion);
    this.applyPartTransform(partId);
  }

  public setPartTransformValues(
    partId: CharacterPartId,
    x: number,
    y: number,
    z: number,
    qx: number,
    qy: number,
    qz: number,
    qw: number,
  ): void {
    const transform = this.partTransforms[partId];
    transform.position.set(x, y, z);
    transform.quaternion.set(qx, qy, qz, qw);
    this.applyPartTransform(partId);
  }

  public getStats(): ProceduralCharacterAvatarStats {
    const bones = new Set<Bone>();
    this.activeModel.skeletons.forEach((skeleton) => skeleton.bones.forEach((bone) => bones.add(bone)));
    const handPose = resolveProceduralCharacterHandPose(this.upperBodyAction);
    return {
      assetId: this.activeModel.asset.id,
      assetLabel: this.activeModel.asset.label,
      authoredClipCount: this.activeModel.asset.gltf.animations.length,
      boneCount: bones.size,
      leftPalmInwardDot: resolvePalmInwardDot(this.activeModel.scene, "left"),
      leftGripProfile: handPose.left.profile,
      rightPalmInwardDot: resolvePalmInwardDot(this.activeModel.scene, "right"),
      rightGripProfile: handPose.right.profile,
      skinnedMeshCount: this.activeModel.skinnedMeshCount,
    };
  }

  public writeSocketWorldTransform(
    socketId: CharacterSocketId,
    outPosition: Vector3,
    outQuaternion: Quaternion,
  ): boolean {
    const binding = this.activeModel.sockets[socketId];
    if (!binding) return false;
    this.activeModel.scene.updateWorldMatrix(true, true);
    binding.bone.localToWorld(outPosition.copy(binding.offset));
    binding.bone.getWorldQuaternion(outQuaternion);
    return outPosition.toArray().every(Number.isFinite) && outQuaternion.toArray().every(Number.isFinite);
  }

  public readWorldDiagnosticJoints(): Readonly<Record<ProceduralHumanoidJointId, Vector3Tuple>> {
    this.activeModel.scene.updateWorldMatrix(true, true);
    return Object.fromEntries(
      Object.entries(DIAGNOSTIC_JOINT_BONE_NAMES).map(([jointId, boneName]) => {
        const position = requireBone(this.activeModel.scene, boneName).getWorldPosition(new Vector3());
        return [jointId, [position.x, position.y, position.z] as Vector3Tuple];
      }),
    ) as unknown as Record<ProceduralHumanoidJointId, Vector3Tuple>;
  }

  public measureActiveLimbLengths(): {
    forearmLength: number;
    shinLength: number;
    thighLength: number;
    upperArmLength: number;
  } {
    this.activeModel.scene.updateWorldMatrix(true, true);
    const left = this.measureArmLengths("left");
    const right = this.measureArmLengths("right");
    const leftLeg = this.measureLegLengths("left");
    const rightLeg = this.measureLegLengths("right");
    return {
      forearmLength: (left.forearmLength + right.forearmLength) * 0.5,
      shinLength: (leftLeg.shinLength + rightLeg.shinLength) * 0.5,
      thighLength: (leftLeg.thighLength + rightLeg.thighLength) * 0.5,
      upperArmLength: (left.upperArmLength + right.upperArmLength) * 0.5,
    };
  }

  public hasFiniteTransforms(): boolean {
    return CHARACTER_PART_IDS.every((partId) => {
      const bone = this.activeModel.bindings[partId].bone;
      return [...bone.position.toArray(), ...bone.quaternion.toArray()].every(Number.isFinite);
    });
  }

  public dispose(): void {
    this.models.forEach(disposeCharacterModel);
    this.models.clear();
    this.group.clear();
    this.group.removeFromParent();
  }

  private addCharacterModel(asset: LoadedQuaterniusCharacterAsset): void {
    const model = prepareCharacterModel(asset);
    model.scene.visible = false;
    model.helper.visible = false;
    this.models.set(asset.tier, model);
    this.group.add(model.scene, model.helper);
  }

  private activateModel(tier: LoadedQuaterniusCharacterAsset["tier"]): void {
    this.models.forEach((model) => {
      model.scene.visible = model.asset.tier === tier;
      model.helper.visible = false;
    });
    this.activeModel = this.requireModel(tier);
    resetCharacterModelPose(this.activeModel, this.rig);
    this.updateDebugVisibility();
  }

  private requireModel(tier: LoadedQuaterniusCharacterAsset["tier"]): PreparedCharacterModel {
    const model = this.models.get(tier);
    if (!model) throw new Error(`No Quaternius character asset is configured for tier ${tier}`);
    return model;
  }

  private updateDebugVisibility(): void {
    this.models.forEach((model) => {
      model.helper.visible = model === this.activeModel && this.config.showJoints;
    });
  }

  private applyCurrentTransforms(): void {
    positionCharacterModelAtPelvis(
      this.group,
      this.activeModel,
      this.partTransforms.pelvis.position,
      this.scratchWorldPosition,
      this.scratchDelta,
    );
    CHARACTER_PART_IDS.forEach((partId) => {
      if (!CHARACTER_IK_PART_IDS.has(partId)) this.applyBoneRotation(partId);
    });
    this.applyArmIk("left");
    this.applyArmIk("right");
    this.applyLegIk("left");
    this.applyLegIk("right");
    this.applyHandRollCorrections();
    this.activeModel.scene.updateWorldMatrix(true, true);
  }

  private applyPartTransform(partId: CharacterPartId): void {
    if (partId === "pelvis") {
      positionCharacterModelAtPelvis(
        this.group,
        this.activeModel,
        this.partTransforms.pelvis.position,
        this.scratchWorldPosition,
        this.scratchDelta,
      );
    }
    this.applyBoneRotation(partId);
    if (partId === "forearmLeft") this.applyHandRoll("left");
    if (partId === "forearmRight") this.applyHandRoll("right");
  }

  private applyBoneRotation(partId: CharacterPartId): void {
    applySegmentBoneRotation(
      this.activeModel.bindings[partId],
      this.group,
      this.partTransforms[partId].quaternion,
      this.scratchGroupQuaternion,
      this.scratchParentQuaternion,
      this.scratchTargetQuaternion,
    );
  }

  private applyArmIk(side: keyof typeof HAND_BONE_NAMES): void {
    const pose = this.lastPose;
    if (!pose) return;
    const suffix = side === "left" ? "Left" : "Right";
    const upperPartId = `upperArm${suffix}` as const;
    const forearmPartId = `forearm${suffix}` as const;
    const upperBinding = this.activeModel.bindings[upperPartId];
    const forearmBinding = this.activeModel.bindings[forearmPartId];
    const handBone = this.activeModel.hands[side].bone;

    this.activeModel.scene.updateWorldMatrix(true, true);
    this.readBonePositionInCharacterSpace(upperBinding.bone, this.scratchIkRoot);
    this.readBonePositionInCharacterSpace(forearmBinding.bone, this.scratchIkCurrentJoint);
    this.readBonePositionInCharacterSpace(handBone, this.scratchIkCurrentEnd);
    const upperLength = this.scratchIkRoot.distanceTo(this.scratchIkCurrentJoint);
    const forearmLength = this.scratchIkCurrentJoint.distanceTo(this.scratchIkCurrentEnd);
    const forearmPose = pose.parts[forearmPartId];
    this.scratchIkTarget
      .fromArray(forearmPose.position)
      .multiplyScalar(2)
      .sub(this.scratchIkPole.fromArray(forearmPose.jointAnchor));
    this.solveTwoBoneTarget(upperLength, forearmLength);

    this.applySolvedLimbSegment(upperBinding, this.scratchIkRoot, this.scratchIkSolvedJoint);
    this.applySolvedLimbSegment(forearmBinding, this.scratchIkSolvedJoint, this.scratchIkSolvedEnd);
  }

  private applyLegIk(side: keyof typeof HAND_BONE_NAMES): void {
    const pose = this.lastPose;
    if (!pose) return;
    const suffix = side === "left" ? "Left" : "Right";
    const thighPartId = `thigh${suffix}` as const;
    const shinPartId = `shin${suffix}` as const;
    const thighBinding = this.activeModel.bindings[thighPartId];
    const shinBinding = this.activeModel.bindings[shinPartId];
    const footBone = requireBone(this.activeModel.scene, side === "left" ? "foot_l" : "foot_r");

    this.activeModel.scene.updateWorldMatrix(true, true);
    this.readBonePositionInCharacterSpace(thighBinding.bone, this.scratchIkRoot);
    this.readBonePositionInCharacterSpace(shinBinding.bone, this.scratchIkCurrentJoint);
    this.readBonePositionInCharacterSpace(footBone, this.scratchIkCurrentEnd);
    const thighLength = this.scratchIkRoot.distanceTo(this.scratchIkCurrentJoint);
    const shinLength = this.scratchIkCurrentJoint.distanceTo(this.scratchIkCurrentEnd);
    const shinPose = pose.parts[shinPartId];
    this.scratchIkTarget
      .fromArray(shinPose.position)
      .multiplyScalar(2)
      .sub(this.scratchIkPole.fromArray(shinPose.jointAnchor));
    this.solveTwoBoneTarget(thighLength, shinLength);

    this.applySolvedLimbSegment(thighBinding, this.scratchIkRoot, this.scratchIkSolvedJoint);
    this.applySolvedLimbSegment(shinBinding, this.scratchIkSolvedJoint, this.scratchIkSolvedEnd);
  }

  private applySolvedLimbSegment(binding: SegmentBoneBinding, start: Vector3, end: Vector3): void {
    this.scratchIkDirection.copy(end).sub(start).normalize();
    this.scratchIkSegmentQuaternion.setFromUnitVectors(Y_AXIS, this.scratchIkDirection);
    applySegmentBoneRotation(
      binding,
      this.group,
      this.scratchIkSegmentQuaternion,
      this.scratchGroupQuaternion,
      this.scratchParentQuaternion,
      this.scratchTargetQuaternion,
    );
  }

  private solveTwoBoneTarget(firstLength: number, secondLength: number): void {
    this.scratchIkOffset.copy(this.scratchIkTarget).sub(this.scratchIkRoot);
    const rawDistance = Math.max(this.scratchIkOffset.length(), 1e-6);
    const distance = Math.min(
      Math.max(rawDistance, Math.abs(firstLength - secondLength) + 1e-4),
      (firstLength + secondLength) * 0.985,
    );
    this.scratchIkDirection.copy(this.scratchIkOffset).multiplyScalar(1 / rawDistance);
    const along = (firstLength * firstLength - secondLength * secondLength + distance * distance) / (2 * distance);
    const bendDistance = Math.sqrt(Math.max(0, firstLength * firstLength - along * along));
    this.scratchIkPoleDirection.copy(this.scratchIkPole).sub(this.scratchIkRoot);
    const poleProjection = this.scratchIkPoleDirection.dot(this.scratchIkDirection);
    this.scratchIkPoleDirection.addScaledVector(this.scratchIkDirection, -poleProjection);
    if (this.scratchIkPoleDirection.lengthSq() < 1e-8) this.scratchIkPoleDirection.set(0, -1, 0);
    this.scratchIkPoleDirection.normalize();
    this.stabilizeLimbBendPlane();
    this.scratchIkSolvedJoint
      .copy(this.scratchIkRoot)
      .addScaledVector(this.scratchIkDirection, along)
      .addScaledVector(this.scratchIkPoleDirection, bendDistance);
    this.scratchIkAlternateJoint
      .copy(this.scratchIkRoot)
      .addScaledVector(this.scratchIkDirection, along)
      .addScaledVector(this.scratchIkPoleDirection, -bendDistance);
    if (
      this.scratchIkAlternateJoint.distanceToSquared(this.scratchIkCurrentJoint) <
      this.scratchIkSolvedJoint.distanceToSquared(this.scratchIkCurrentJoint)
    ) {
      this.scratchIkSolvedJoint.copy(this.scratchIkAlternateJoint);
    }
    this.scratchIkSolvedEnd.copy(this.scratchIkRoot).addScaledVector(this.scratchIkDirection, distance);
  }

  private stabilizeLimbBendPlane(): void {
    this.scratchIkCurrentPoleDirection.copy(this.scratchIkCurrentJoint).sub(this.scratchIkRoot);
    const currentProjection = this.scratchIkCurrentPoleDirection.dot(this.scratchIkDirection);
    this.scratchIkCurrentPoleDirection.addScaledVector(this.scratchIkDirection, -currentProjection);
    if (this.scratchIkCurrentPoleDirection.lengthSq() < 1e-8) return;
    this.scratchIkCurrentPoleDirection.normalize();
    const angle = Math.acos(
      Math.min(1, Math.max(-1, this.scratchIkCurrentPoleDirection.dot(this.scratchIkPoleDirection))),
    );
    if (angle <= MAX_LIMB_BEND_PLANE_STEP) return;
    this.scratchIkCurrentPoleDirection.lerp(this.scratchIkPoleDirection, MAX_LIMB_BEND_PLANE_STEP / angle).normalize();
    this.scratchIkPoleDirection.copy(this.scratchIkCurrentPoleDirection);
  }

  private readBonePositionInCharacterSpace(bone: Bone, target: Vector3): void {
    bone.getWorldPosition(target);
    this.group.worldToLocal(target);
  }

  private measureArmLengths(side: keyof typeof HAND_BONE_NAMES): {
    forearmLength: number;
    upperArmLength: number;
  } {
    const suffix = side === "left" ? "Left" : "Right";
    this.readBonePositionInCharacterSpace(this.activeModel.bindings[`upperArm${suffix}`].bone, this.scratchIkRoot);
    this.readBonePositionInCharacterSpace(
      this.activeModel.bindings[`forearm${suffix}`].bone,
      this.scratchIkCurrentJoint,
    );
    this.readBonePositionInCharacterSpace(this.activeModel.hands[side].bone, this.scratchIkCurrentEnd);
    return {
      forearmLength: this.scratchIkCurrentJoint.distanceTo(this.scratchIkCurrentEnd),
      upperArmLength: this.scratchIkRoot.distanceTo(this.scratchIkCurrentJoint),
    };
  }

  private measureLegLengths(side: keyof typeof HAND_BONE_NAMES): { shinLength: number; thighLength: number } {
    const suffix = side === "left" ? "Left" : "Right";
    this.readBonePositionInCharacterSpace(this.activeModel.bindings[`thigh${suffix}`].bone, this.scratchIkRoot);
    this.readBonePositionInCharacterSpace(this.activeModel.bindings[`shin${suffix}`].bone, this.scratchIkCurrentJoint);
    this.readBonePositionInCharacterSpace(
      requireBone(this.activeModel.scene, side === "left" ? "foot_l" : "foot_r"),
      this.scratchIkCurrentEnd,
    );
    return {
      shinLength: this.scratchIkCurrentJoint.distanceTo(this.scratchIkCurrentEnd),
      thighLength: this.scratchIkRoot.distanceTo(this.scratchIkCurrentJoint),
    };
  }

  private applyHandRollCorrections(): void {
    this.applyHandRoll("left");
    this.applyHandRoll("right");
    this.applyFingerCurls();
  }

  private applyHandRoll(side: keyof typeof HAND_BONE_NAMES): void {
    const binding = this.activeModel.hands[side];
    binding.bone.quaternion.copy(binding.bindQuaternion);
    if (side === "left") {
      binding.bone.quaternion.multiply(HAND_ROLL_CORRECTION);
    } else {
      const archerWeight = this.upperBodyAction?.kind === "archer" ? this.upperBodyAction.actionWeight : 0;
      this.scratchHandCorrection
        .copy(HAND_ROLL_CORRECTION)
        .slerp(IDENTITY_QUATERNION, Math.min(1, Math.max(0, archerWeight)));
      binding.bone.quaternion.multiply(this.scratchHandCorrection);
    }
    binding.bone.updateWorldMatrix(false, true);
  }

  private applyFingerCurls(): void {
    const handPose = resolveProceduralCharacterHandPose(this.upperBodyAction);
    this.applyFingerCurl("left", handPose.left);
    this.applyFingerCurl("right", handPose.right);
  }

  private applyFingerCurl(side: keyof typeof HAND_BONE_NAMES, pose: ProceduralHandPose): void {
    const binding = this.activeModel.hands[side];
    PROCEDURAL_HAND_DIGIT_IDS.forEach((digitId) => {
      const bones = binding.digits[digitId];
      const curlAngles = digitId === "thumb" ? THUMB_CURL_RADIANS : FINGER_CURL_RADIANS;
      bones.forEach((finger, index) => {
        finger.bone.quaternion
          .copy(finger.bindQuaternion)
          .multiply(this.scratchFingerCurl.setFromAxisAngle(X_AXIS, curlAngles[index] * pose.curls[digitId]));
        finger.bone.updateWorldMatrix(false, true);
      });
    });
  }
}

function composeBaseHeadOntoOutfits(assets: LoadedQuaterniusCharacterAsset[]): void {
  const baseAsset = assets.find((asset) => asset.id === "base");
  if (!baseAsset) throw new Error("Quaternius Universal base asset was not loaded");
  const headSources = ["Eyebrows", "Eyes", "SuperHero_Male"].map((name) =>
    requireSkinnedMesh(baseAsset.gltf.scene, name),
  );

  assets.filter((asset) => asset.id !== "base").forEach((asset) => attachHeadToOutfit(asset, headSources));
}

function attachHeadToOutfit(asset: LoadedQuaterniusCharacterAsset, headSources: SkinnedMesh[]): void {
  const targetMesh = findFirstSkinnedMesh(asset.gltf.scene);
  const armature = asset.gltf.scene.getObjectByName("Armature");
  if (!targetMesh || !armature) throw new Error(`${asset.label} cannot accept the Universal base head`);
  validateCompatibleSkeletons(headSources[0].skeleton, targetMesh.skeleton, asset.label);

  headSources.forEach((source) => {
    const geometry = source.name === "SuperHero_Male" ? extractHeadGeometry(source) : source.geometry.clone();
    const material = Array.isArray(source.material)
      ? source.material.map((entry) => entry.clone())
      : source.material.clone();
    const headPiece = new SkinnedMesh(geometry, material);
    headPiece.name = `UniversalHead_${source.name}`;
    headPiece.position.copy(source.position);
    headPiece.quaternion.copy(source.quaternion);
    headPiece.scale.copy(source.scale);
    headPiece.bindMode = source.bindMode;
    headPiece.bind(targetMesh.skeleton, source.bindMatrix);
    headPiece.userData.proceduralCharacterOwnsGeometry = true;
    armature.add(headPiece);
  });
}

function extractHeadGeometry(source: SkinnedMesh): BufferGeometry {
  const geometry = source.geometry.clone();
  geometry.computeBoundingBox();
  const position = geometry.getAttribute("position");
  const skinIndex = geometry.getAttribute("skinIndex");
  const skinWeight = geometry.getAttribute("skinWeight");
  const sourceIndex = geometry.index;
  const maxY = geometry.boundingBox?.max.y;
  if (!sourceIndex || !skinIndex || !skinWeight || maxY === undefined) {
    throw new Error("Universal base body cannot be separated into a head mesh");
  }
  const headBoneIndices = new Set(
    source.skeleton.bones
      .map((bone, index) => ({ index, name: bone.name }))
      .filter(({ name }) => name === "Head" || name === "neck_01")
      .map(({ index }) => index),
  );
  const neckCutY = maxY - HEAD_NECK_RANGE;
  const retainedIndices: number[] = [];

  for (let index = 0; index < sourceIndex.count; index += 3) {
    const a = sourceIndex.getX(index);
    const b = sourceIndex.getX(index + 1);
    const c = sourceIndex.getX(index + 2);
    const centroidY = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    const headWeight = (resolveHeadWeight(a) + resolveHeadWeight(b) + resolveHeadWeight(c)) / 3;
    if (centroidY >= neckCutY && headWeight >= MIN_HEAD_SKIN_WEIGHT) retainedIndices.push(a, b, c);
  }
  if (retainedIndices.length === 0) throw new Error("Universal base head extraction retained no triangles");

  const IndexArray = position.count > 65_535 ? Uint32Array : Uint16Array;
  geometry.setIndex(new BufferAttribute(new IndexArray(retainedIndices), 1));
  geometry.clearGroups();
  geometry.addGroup(0, retainedIndices.length, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;

  function resolveHeadWeight(vertexIndex: number): number {
    let weight = 0;
    for (let item = 0; item < 4; item += 1) {
      if (headBoneIndices.has(skinIndex.getComponent(vertexIndex, item))) {
        weight += skinWeight.getComponent(vertexIndex, item);
      }
    }
    return weight;
  }
}

function requireSkinnedMesh(scene: Group, name: string): SkinnedMesh {
  const object = scene.getObjectByName(name);
  if (!(object instanceof SkinnedMesh)) throw new Error(`Universal base mesh ${name} was not found`);
  return object;
}

function findFirstSkinnedMesh(scene: Group): SkinnedMesh | undefined {
  let result: SkinnedMesh | undefined;
  scene.traverse((object) => {
    if (!result && object instanceof SkinnedMesh) result = object;
  });
  return result;
}

function validateCompatibleSkeletons(source: Skeleton, target: Skeleton, assetLabel: string): void {
  const sourceNames = source.bones.map((bone) => bone.name);
  const targetNames = target.bones.map((bone) => bone.name);
  if (sourceNames.length !== targetNames.length || sourceNames.some((name, index) => name !== targetNames[index])) {
    throw new Error(`${assetLabel} does not share the Universal base skeleton order`);
  }
}

function prepareCharacterModel(asset: LoadedQuaterniusCharacterAsset): PreparedCharacterModel {
  const scene = asset.gltf.scene;
  const ownedGeometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const skeletons = new Set<Skeleton>();
  const styledMaterials: StyledCharacterMaterial[] = [];
  let skinnedMeshCount = 0;

  scene.name = `quaternius-character:${asset.id}`;
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = false;
    object.frustumCulled = false;
    if (object.userData.proceduralCharacterOwnsGeometry === true) ownedGeometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      if (material instanceof MeshStandardMaterial && !styledMaterials.some((entry) => entry.material === material)) {
        styledMaterials.push(createStyledMaterial(material));
      }
    });
    if (object instanceof SkinnedMesh) {
      skinnedMeshCount += 1;
      skeletons.add(object.skeleton);
    }
  });
  scene.updateWorldMatrix(true, true);

  const helper = new SkeletonHelper(scene);
  helper.name = `quaternius-skeleton:${asset.id}`;
  helper.frustumCulled = false;
  forEachMaterial(helper.material, (material) => {
    material.depthTest = false;
    material.transparent = true;
    material.opacity = 0.72;
  });

  return {
    asset,
    authoredPelvisToAnkle: resolveAuthoredPelvisToAnkle(scene),
    bindings: createCharacterBoneBindings(scene),
    hands: createCharacterHandBindings(scene),
    helper,
    materials,
    ownedGeometries,
    scene,
    sockets: createCharacterSocketBindings(scene),
    skeletons,
    skinnedMeshCount,
    styledMaterials,
  };
}

function createCharacterSocketBindings(scene: Group): Record<CharacterSocketId, CharacterSocketBinding> {
  const handLeft = requireBone(scene, HAND_BONE_NAMES.left.hand);
  const handRight = requireBone(scene, HAND_BONE_NAMES.right.hand);
  return {
    drawRight: { bone: requireBone(scene, "middle_01_r"), offset: new Vector3(0, 0.015, 0) },
    gripLeft: { bone: handLeft, offset: resolvePalmGripOffset(scene, "left") },
    gripRight: { bone: handRight, offset: resolvePalmGripOffset(scene, "right") },
    handLeft: { bone: handLeft, offset: new Vector3() },
    handRight: { bone: handRight, offset: new Vector3() },
    jawAnchor: { bone: requireBone(scene, "Head"), offset: new Vector3(-0.025, -0.015, 0.035) },
    projectileOrigin: { bone: handLeft, offset: new Vector3(0, 0, 0.035) },
    quiver: { bone: requireBone(scene, "spine_03"), offset: new Vector3(0.22, 0.08, -0.16) },
  };
}

function createCharacterHandBindings(scene: Group): Record<keyof typeof HAND_BONE_NAMES, CharacterHandBinding> {
  return {
    left: createCharacterHandBinding(scene, "left"),
    right: createCharacterHandBinding(scene, "right"),
  };
}

function createCharacterHandBinding(scene: Group, side: keyof typeof HAND_BONE_NAMES): CharacterHandBinding {
  const bone = requireBone(scene, HAND_BONE_NAMES[side].hand);
  return {
    bindQuaternion: bone.quaternion.clone(),
    bone,
    digits: createCharacterFingerBindings(scene, side),
  };
}

function createCharacterFingerBindings(
  scene: Group,
  side: keyof typeof HAND_BONE_NAMES,
): Record<ProceduralHandDigitId, CharacterFingerBoneBinding[]> {
  const suffix = side === "left" ? "l" : "r";
  return Object.fromEntries(
    Object.entries(HAND_DIGIT_BONE_NAMES).map(([digitId, names]) => [
      digitId,
      names.map((name) => {
        const bone = requireBone(scene, `${name}_${suffix}`);
        return { bindQuaternion: bone.quaternion.clone(), bone };
      }),
    ]),
  ) as Record<ProceduralHandDigitId, CharacterFingerBoneBinding[]>;
}

function resolvePalmGripOffset(scene: Group, side: keyof typeof HAND_BONE_NAMES): Vector3 {
  const hand = requireBone(scene, HAND_BONE_NAMES[side].hand);
  const knuckleCenter = new Vector3();
  const suffix = side === "left" ? "l" : "r";
  const knuckleNames = ["index_01", "middle_01", "ring_01", "pinky_01"];
  knuckleNames.forEach((name) => {
    const knuckle = requireBone(scene, `${name}_${suffix}`).getWorldPosition(new Vector3());
    knuckleCenter.add(hand.worldToLocal(knuckle));
  });
  return knuckleCenter.multiplyScalar(0.82 / knuckleNames.length);
}

function createCharacterBoneBindings(scene: Group): Record<CharacterPartId, SegmentBoneBinding> {
  return Object.fromEntries(
    CHARACTER_PART_IDS.map((partId) => {
      const childBoneName = SEGMENT_CHILD_BONE_NAMES[partId];
      return [partId, createSegmentBoneBinding(scene, QUATERNIUS_BONE_NAMES[partId], childBoneName)];
    }),
  ) as Record<CharacterPartId, SegmentBoneBinding>;
}

function requireBone(scene: Group, name: string): Bone {
  try {
    return requireSkinnedBone(scene, name);
  } catch {
    throw new Error(`Quaternius character bone ${name} was not found`);
  }
}

function createCharacterPartTransforms(): Record<CharacterPartId, CharacterPartTransform> {
  return Object.fromEntries(
    CHARACTER_PART_IDS.map((partId) => [partId, { position: new Vector3(), quaternion: new Quaternion() }]),
  ) as Record<CharacterPartId, CharacterPartTransform>;
}

function resetCharacterModelPose(model: PreparedCharacterModel, rig: ResolvedCharacterRig): void {
  model.skeletons.forEach((skeleton) => skeleton.pose());
  model.scene.position.set(0, 0, 0);
  const targetPelvisToAnkle = rig.morphology.thighLength + rig.morphology.shinLength;
  model.scene.scale.setScalar(targetPelvisToAnkle / model.authoredPelvisToAnkle);
  model.scene.updateWorldMatrix(true, true);
}

function resolveAuthoredPelvisToAnkle(scene: Group): number {
  const pelvisY = requireBone(scene, "pelvis").getWorldPosition(new Vector3()).y;
  const ankleY = requireBone(scene, "foot_l").getWorldPosition(new Vector3()).y;
  const distance = pelvisY - ankleY;
  if (distance <= 0) throw new Error("Quaternius character has an invalid authored leg length");
  return distance;
}

function resolvePalmInwardDot(scene: Group, side: keyof typeof HAND_BONE_NAMES): number {
  const names = HAND_BONE_NAMES[side];
  const hand = requireBone(scene, names.hand).getWorldPosition(new Vector3());
  const index = requireBone(scene, names.index).getWorldPosition(new Vector3());
  const middle = requireBone(scene, names.middle).getWorldPosition(new Vector3());
  const pinky = requireBone(scene, names.pinky).getWorldPosition(new Vector3());
  const pelvis = requireBone(scene, "pelvis").getWorldPosition(new Vector3());
  const forward = middle.sub(hand).normalize();
  const across = side === "left" ? index.sub(pinky).normalize() : pinky.sub(index).normalize();
  // The finger-plane cross product points through the back of the hand in the
  // Quaternius bind pose; the anatomical palm normal is the opposite vector.
  const palmNormal = across.cross(forward).normalize().negate();
  const inward = pelvis.sub(hand).setY(0).normalize();
  return palmNormal.dot(inward);
}

function positionCharacterModelAtPelvis(
  coordinateSpace: Group,
  model: PreparedCharacterModel,
  targetPelvisPosition: Vector3,
  scratchWorldPosition: Vector3,
  scratchDelta: Vector3,
): void {
  const pelvisBone = model.bindings.pelvis.bone;
  pelvisBone.getWorldPosition(scratchWorldPosition);
  coordinateSpace.worldToLocal(scratchWorldPosition);
  scratchDelta.copy(targetPelvisPosition).sub(scratchWorldPosition);
  model.scene.position.add(scratchDelta);
  model.scene.updateWorldMatrix(true, true);
}

function createStyledMaterial(material: MeshStandardMaterial): StyledCharacterMaterial {
  return {
    baseColor: material.color.clone(),
    baseMetalness: material.metalness,
    baseRoughness: material.roughness,
    material,
    role: resolveMaterialRole(material.name),
  };
}

function resolveMaterialRole(materialName: string): StyledCharacterMaterial["role"] {
  if (/ranger|peasant/i.test(materialName)) return "outfit";
  if (/regular|eyes|hair/i.test(materialName)) return "body";
  return "other";
}

function updateCharacterModelStyle(model: PreparedCharacterModel, config: ProceduralCharacterConfig): void {
  const heraldry = new Color(config.primaryColor);
  model.styledMaterials.forEach(({ baseColor, baseMetalness, baseRoughness, material, role }) => {
    material.color.copy(baseColor);
    if (role === "outfit") {
      material.color.lerp(heraldry, 0.3 + config.tier * 0.04);
      material.metalness = Math.min(1, baseMetalness * 0.35 + config.metalness * 0.65);
      material.roughness = Math.min(1, baseRoughness * 0.4 + config.roughness * 0.6);
      material.emissive.copy(heraldry);
      material.emissiveIntensity = config.runeGlow * (config.tier === 3 ? 0.045 : 0.012);
    } else {
      material.metalness = baseMetalness;
      material.roughness = baseRoughness;
      material.emissive.set(0x000000);
      material.emissiveIntensity = 0;
    }
    material.wireframe = config.wireframe;
    material.needsUpdate = true;
  });
}

function disposeCharacterModel(model: PreparedCharacterModel): void {
  model.helper.geometry.dispose();
  forEachMaterial(model.helper.material, (material) => material.dispose());
  model.skeletons.forEach((skeleton) => skeleton.dispose());
  model.ownedGeometries.forEach((geometry) => geometry.dispose());
  model.materials.forEach((material) => material.dispose());
  model.helper.removeFromParent();
  model.scene.removeFromParent();
}

function forEachMaterial(material: Material | Material[], visit: (entry: Material) => void): void {
  (Array.isArray(material) ? material : [material]).forEach(visit);
}
