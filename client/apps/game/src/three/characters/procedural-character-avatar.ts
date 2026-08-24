import {
  Bone,
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
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { ProceduralCharacterConfig } from "./procedural-character-config";
import type { ProceduralHumanoidJointId } from "./procedural-character-diagnostics";
import type { ProceduralCharacterUpperBodyAction } from "./procedural-character-action";
import type { HumanoidRigAdapter, HumanoidSide } from "./humanoid-rig-adapter";
import {
  PROCEDURAL_HAND_DIGIT_IDS,
  resolveProceduralCharacterHandPose,
  type ProceduralHandDigitId,
  type ProceduralHandGripProfile,
  type ProceduralHandPose,
} from "./procedural-character-hand-pose";
import type { ProceduralCharacterPose, QuaternionTuple, Vector3Tuple } from "./procedural-character-pose";
import type { LoadedProceduralCharacterAsset } from "./procedural-character-assets";
import { CHARACTER_PART_IDS, type CharacterPartId, type ResolvedCharacterRig } from "./procedural-character-rig";
import { type CharacterSocketId, type ProceduralCharacterSocketReader } from "./procedural-character-sockets";
import {
  applySegmentBoneRotation,
  createSegmentBoneBinding,
  createStableSegmentBoneBinding,
  requireSkinnedBone,
  resolveStableSegmentQuaternion,
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
  fingerCurlAxis: Vector3;
  palm: { index: Bone; middle: Bone; normalSign: -1 | 1; pinky: Bone };
  rollCorrection: Quaternion;
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
  baseNormalMap: MeshStandardMaterial["normalMap"];
  baseRoughness: number;
  material: MeshStandardMaterial;
  role: "body" | "outfit" | "other";
}

interface PreparedCharacterModel {
  adapter: HumanoidRigAdapter;
  asset: LoadedProceduralCharacterAsset;
  authoredPelvisToAnkle: number;
  bindings: Readonly<Record<CharacterPartId, SegmentBoneBinding>>;
  crowdHiddenMeshes: ReadonlyArray<{ heroVisible: boolean; mesh: Mesh }>;
  diagnosticBones: Readonly<Record<ProceduralHumanoidJointId, Bone>>;
  feet: Readonly<Record<HumanoidSide, { ankle: Bone; toe: Bone }>>;
  hands: Readonly<Record<HumanoidSide, CharacterHandBinding>>;
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
  appearanceId: string;
  appearanceLabel: string;
  assetId: string;
  assetLabel: string;
  authoredClipCount: number;
  boneCount: number;
  leftPalmInwardDot: number;
  leftGripProfile: ProceduralHandGripProfile;
  rightPalmInwardDot: number;
  rightGripProfile: ProceduralHandGripProfile;
  rigAdapterId: string;
  skinnedMeshCount: number;
}

interface ProceduralFootFacingDiagnostics {
  forwardDot: number;
  toePosition: Vector3Tuple;
}

const Y_AXIS = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const MAX_LIMB_BEND_PLANE_STEP = Math.PI / 8;
const IDENTITY_QUATERNION = new Quaternion();
const FINGER_CURL_RADIANS = [Math.PI * 0.4, Math.PI * 0.5, Math.PI * 0.34] as const;
const THUMB_CURL_RADIANS = [Math.PI * 0.18, Math.PI * 0.3, Math.PI * 0.2] as const;
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

export class ProceduralCharacterAvatar implements ProceduralCharacterSocketReader {
  public readonly group = new Group();

  private readonly partTransforms = createCharacterPartTransforms();
  private readonly scratchParentQuaternion = new Quaternion();
  private readonly scratchGroupQuaternion = new Quaternion();
  private readonly scratchTargetQuaternion = new Quaternion();
  private readonly scratchWorldPosition = new Vector3();
  private readonly scratchWorldScale = new Vector3();
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
  private readonly scratchFootCorrection = new Quaternion();
  private readonly scratchFootCross = new Vector3();
  private readonly scratchFootDirection = new Vector3();
  private readonly scratchFootDesiredDirection = new Vector3();
  private readonly scratchFootPosition = new Vector3();
  private readonly scratchToePosition = new Vector3();
  private readonly scratchRootForward = new Vector3();
  private readonly scratchRootLateral = new Vector3();
  private readonly scratchRootUp = new Vector3();
  private activeModel: PreparedCharacterModel;
  private rig: ResolvedCharacterRig;
  private config: ProceduralCharacterConfig;
  private lastPose?: ProceduralCharacterPose;
  private upperBodyAction?: ProceduralCharacterUpperBodyAction;
  private readonly scratchHandCorrection = new Quaternion();
  private readonly scratchFingerCurl = new Quaternion();

  constructor(asset: LoadedProceduralCharacterAsset, rig: ResolvedCharacterRig, config: ProceduralCharacterConfig) {
    this.rig = rig;
    this.config = config;
    this.group.name = "procedural-character-avatar";
    this.activeModel = prepareCharacterModel(asset);
    this.group.add(this.activeModel.scene, this.activeModel.helper);
    resetCharacterModelPose(this.activeModel, rig);
    this.updateConfig(config);
  }

  public rebuild(
    rig: ResolvedCharacterRig,
    config: ProceduralCharacterConfig,
    replacement?: LoadedProceduralCharacterAsset,
  ): void {
    if (replacement) this.replaceActiveModel(replacement);
    this.rig = rig;
    this.config = config;
    resetCharacterModelPose(this.activeModel, rig);
    this.updateConfig(config);
    if (this.lastPose) this.applyPose(this.lastPose);
  }

  public updateConfig(config: ProceduralCharacterConfig): void {
    this.config = config;
    updateCharacterModelStyle(this.activeModel, config);
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
      appearanceId: this.activeModel.asset.appearanceId,
      appearanceLabel: this.activeModel.asset.appearanceLabel,
      assetId: this.activeModel.asset.id,
      assetLabel: this.activeModel.asset.label,
      authoredClipCount: this.activeModel.asset.gltf.animations.length,
      boneCount: bones.size,
      leftPalmInwardDot: resolvePalmInwardDot(this.activeModel, "left"),
      leftGripProfile: handPose.left.profile,
      rightPalmInwardDot: resolvePalmInwardDot(this.activeModel, "right"),
      rightGripProfile: handPose.right.profile,
      rigAdapterId: this.activeModel.adapter.id,
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
    binding.bone.updateWorldMatrix(true, false);
    outPosition.copy(binding.offset).applyMatrix4(binding.bone.matrixWorld);
    binding.bone.matrixWorld.decompose(this.scratchWorldPosition, outQuaternion, this.scratchWorldScale);
    return hasFiniteVector(outPosition) && hasFiniteQuaternion(outQuaternion);
  }

  public readWorldDiagnosticJoints(): Readonly<Record<ProceduralHumanoidJointId, Vector3Tuple>> {
    this.activeModel.scene.updateWorldMatrix(true, true);
    return Object.fromEntries(
      Object.entries(this.activeModel.diagnosticBones).map(([jointId, bone]) => {
        const position = bone.getWorldPosition(new Vector3());
        return [jointId, [position.x, position.y, position.z] as Vector3Tuple];
      }),
    ) as unknown as Record<ProceduralHumanoidJointId, Vector3Tuple>;
  }

  public readWorldDiagnosticFootRotations(): Readonly<Record<"left" | "right", QuaternionTuple>> {
    this.activeModel.scene.updateWorldMatrix(true, true);
    return Object.fromEntries(
      (["left", "right"] as const).map((side) => {
        this.activeModel.feet[side].ankle.getWorldQuaternion(this.scratchTargetQuaternion);
        return [side, toQuaternionTuple(this.scratchTargetQuaternion)];
      }),
    ) as unknown as Record<"left" | "right", QuaternionTuple>;
  }

  public readWorldDiagnosticFootFacing(): Readonly<Record<"left" | "right", ProceduralFootFacingDiagnostics>> {
    this.group.updateWorldMatrix(true, true);
    const rootQuaternion = this.group.getWorldQuaternion(new Quaternion());
    const rootForward = new Vector3(0, 0, 1).applyQuaternion(rootQuaternion);
    const rootUp = new Vector3(0, 1, 0).applyQuaternion(rootQuaternion);
    return Object.fromEntries(
      (["left", "right"] as const).map((side) => {
        const ankle = this.activeModel.feet[side].ankle.getWorldPosition(new Vector3());
        const toePosition = this.activeModel.feet[side].toe.getWorldPosition(new Vector3());
        const toeDirection = toePosition.clone().sub(ankle);
        toeDirection.addScaledVector(rootUp, -toeDirection.dot(rootUp));
        const forwardDot = toeDirection.lengthSq() > 1e-8 ? toeDirection.normalize().dot(rootForward) : 0;
        return [side, { forwardDot, toePosition: toVectorTuple(toePosition) }];
      }),
    ) as unknown as Record<"left" | "right", ProceduralFootFacingDiagnostics>;
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
    const partTransformsFinite = CHARACTER_PART_IDS.every((partId) => {
      return hasFiniteBoneTransform(this.activeModel.bindings[partId].bone);
    });
    return (
      partTransformsFinite && Object.values(this.activeModel.feet).every(({ ankle }) => hasFiniteBoneTransform(ankle))
    );
  }

  public dispose(): void {
    disposeCharacterModel(this.activeModel);
    this.group.clear();
    this.group.removeFromParent();
  }

  private replaceActiveModel(asset: LoadedProceduralCharacterAsset): void {
    const replacement = prepareCharacterModel(asset);
    const previous = this.activeModel;
    this.activeModel = replacement;
    this.group.add(replacement.scene, replacement.helper);
    disposeCharacterModel(previous);
  }

  private updateDebugVisibility(): void {
    this.activeModel.helper.visible = this.config.showJoints;
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
    if (this.config.animationMode !== "mounted") {
      this.alignFootProgression("left");
      this.alignFootProgression("right");
    }
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

  private applyArmIk(side: HumanoidSide): void {
    const pose = this.lastPose;
    if (!pose) return;
    const suffix = side === "left" ? "Left" : "Right";
    const upperPartId = `upperArm${suffix}` as const;
    const forearmPartId = `forearm${suffix}` as const;
    const upperBinding = this.activeModel.bindings[upperPartId];
    const forearmBinding = this.activeModel.bindings[forearmPartId];
    const handBone = this.activeModel.hands[side].bone;

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

  private applyLegIk(side: HumanoidSide): void {
    const pose = this.lastPose;
    if (!pose) return;
    const suffix = side === "left" ? "Left" : "Right";
    const thighPartId = `thigh${suffix}` as const;
    const shinPartId = `shin${suffix}` as const;
    const thighBinding = this.activeModel.bindings[thighPartId];
    const shinBinding = this.activeModel.bindings[shinPartId];
    const footBone = this.activeModel.feet[side].ankle;

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
    const grounded = this.config.animationMode !== "mounted";
    if (grounded) this.scratchIkPole.copy(this.scratchIkRoot).add(Z_AXIS);
    // Grounded legs use the skinned rig's true hip as the forward pole origin. Reusing
    // an absolute solver-rig knee introduces lateral bias when the two hip sockets differ.
    this.solveTwoBoneTarget(thighLength, shinLength, !grounded);

    this.applySolvedLegSegment(thighBinding, this.scratchIkRoot, this.scratchIkSolvedJoint);
    this.applySolvedLegSegment(shinBinding, this.scratchIkSolvedJoint, this.scratchIkSolvedEnd);
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

  private applySolvedLegSegment(binding: SegmentBoneBinding, start: Vector3, end: Vector3): void {
    this.scratchIkDirection.copy(end).sub(start).normalize();
    resolveStableSegmentQuaternion(this.scratchIkDirection, Z_AXIS, X_AXIS, this.scratchIkSegmentQuaternion);
    applySegmentBoneRotation(
      binding,
      this.group,
      this.scratchIkSegmentQuaternion,
      this.scratchGroupQuaternion,
      this.scratchParentQuaternion,
      this.scratchTargetQuaternion,
    );
  }

  private alignFootProgression(side: "left" | "right"): void {
    const { ankle: foot, toe } = this.activeModel.feet[side];
    if (!foot.parent) return;

    this.group.getWorldQuaternion(this.scratchGroupQuaternion);
    foot.getWorldQuaternion(this.scratchTargetQuaternion);
    this.scratchRootForward.copy(Z_AXIS).applyQuaternion(this.scratchGroupQuaternion).normalize();
    this.scratchRootLateral.copy(X_AXIS).applyQuaternion(this.scratchGroupQuaternion).normalize();
    this.scratchRootUp.copy(Y_AXIS).applyQuaternion(this.scratchGroupQuaternion).normalize();
    foot.getWorldPosition(this.scratchFootPosition);
    toe.getWorldPosition(this.scratchToePosition);
    this.scratchFootDirection.copy(this.scratchToePosition).sub(this.scratchFootPosition);
    this.scratchFootDirection.addScaledVector(this.scratchRootUp, -this.scratchFootDirection.dot(this.scratchRootUp));
    if (this.scratchFootDirection.lengthSq() < 1e-8) return;
    this.scratchFootDirection.normalize();

    const progressionRadians = (this.config.footProgressionDegrees * Math.PI) / 180;
    const sideSign = side === "left" ? 1 : -1;
    this.scratchFootDesiredDirection
      .copy(this.scratchRootForward)
      .multiplyScalar(Math.cos(progressionRadians))
      .addScaledVector(this.scratchRootLateral, sideSign * Math.sin(progressionRadians))
      .normalize();
    const correctionRadians = Math.atan2(
      this.scratchFootCross
        .crossVectors(this.scratchFootDirection, this.scratchFootDesiredDirection)
        .dot(this.scratchRootUp),
      this.scratchFootDirection.dot(this.scratchFootDesiredDirection),
    );
    this.scratchFootCorrection.setFromAxisAngle(this.scratchRootUp, correctionRadians);
    this.scratchTargetQuaternion.premultiply(this.scratchFootCorrection).normalize();
    foot.parent.getWorldQuaternion(this.scratchParentQuaternion);
    foot.quaternion.copy(this.scratchParentQuaternion.invert()).multiply(this.scratchTargetQuaternion).normalize();
  }

  private solveTwoBoneTarget(firstLength: number, secondLength: number, preserveCurrentBendPlane = true): void {
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
    if (preserveCurrentBendPlane) this.stabilizeLimbBendPlane();
    this.scratchIkSolvedJoint
      .copy(this.scratchIkRoot)
      .addScaledVector(this.scratchIkDirection, along)
      .addScaledVector(this.scratchIkPoleDirection, bendDistance);
    if (preserveCurrentBendPlane) {
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

  private measureArmLengths(side: HumanoidSide): {
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

  private measureLegLengths(side: HumanoidSide): { shinLength: number; thighLength: number } {
    const suffix = side === "left" ? "Left" : "Right";
    this.readBonePositionInCharacterSpace(this.activeModel.bindings[`thigh${suffix}`].bone, this.scratchIkRoot);
    this.readBonePositionInCharacterSpace(this.activeModel.bindings[`shin${suffix}`].bone, this.scratchIkCurrentJoint);
    this.readBonePositionInCharacterSpace(this.activeModel.feet[side].ankle, this.scratchIkCurrentEnd);
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

  private applyHandRoll(side: HumanoidSide): void {
    const binding = this.activeModel.hands[side];
    binding.bone.quaternion.copy(binding.bindQuaternion);
    if (side === "left") {
      binding.bone.quaternion.multiply(binding.rollCorrection);
    } else {
      const archerWeight = this.upperBodyAction?.kind === "archer" ? this.upperBodyAction.actionWeight : 0;
      this.scratchHandCorrection
        .copy(binding.rollCorrection)
        .slerp(IDENTITY_QUATERNION, Math.min(1, Math.max(0, archerWeight)));
      binding.bone.quaternion.multiply(this.scratchHandCorrection);
    }
  }

  private applyFingerCurls(): void {
    const handPose = resolveProceduralCharacterHandPose(this.upperBodyAction);
    this.applyFingerCurl("left", handPose.left);
    this.applyFingerCurl("right", handPose.right);
  }

  private applyFingerCurl(side: HumanoidSide, pose: ProceduralHandPose): void {
    const binding = this.activeModel.hands[side];
    PROCEDURAL_HAND_DIGIT_IDS.forEach((digitId) => {
      const bones = binding.digits[digitId];
      const curlAngles = digitId === "thumb" ? THUMB_CURL_RADIANS : FINGER_CURL_RADIANS;
      bones.forEach((finger, index) => {
        finger.bone.quaternion
          .copy(finger.bindQuaternion)
          .multiply(
            this.scratchFingerCurl.setFromAxisAngle(binding.fingerCurlAxis, curlAngles[index] * pose.curls[digitId]),
          );
      });
    });
  }
}

function hasFiniteVector(value: Readonly<Vector3>): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function hasFiniteQuaternion(value: Readonly<Quaternion>): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z) && Number.isFinite(value.w);
}

function hasFiniteBoneTransform(bone: Readonly<Bone>): boolean {
  return [...bone.position.toArray(), ...bone.quaternion.toArray()].every(Number.isFinite);
}

function toQuaternionTuple(quaternion: Readonly<Quaternion>): QuaternionTuple {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function toVectorTuple(vector: Readonly<Vector3>): Vector3Tuple {
  return [vector.x, vector.y, vector.z];
}

function prepareCharacterModel(asset: LoadedProceduralCharacterAsset): PreparedCharacterModel {
  const crowdHiddenMeshes: Array<{ heroVisible: boolean; mesh: Mesh }> = [];
  const scene = asset.gltf.scene;
  const ownedGeometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const skeletons = new Set<Skeleton>();
  const styledMaterials: StyledCharacterMaterial[] = [];
  let skinnedMeshCount = 0;

  scene.name = `procedural-character:${asset.appearanceId}:${asset.id}`;
  scene.quaternion.premultiply(new Quaternion().fromArray(asset.adapter.sceneRotation));
  mergeCompatibleOutfitMeshes(scene, asset.materials, ownedGeometries);
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = false;
    object.frustumCulled = false;
    if (asset.materials.crowdHiddenMesh.test(object.name)) {
      crowdHiddenMeshes.push({ heroVisible: object.visible, mesh: object });
    }
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      if (material instanceof MeshStandardMaterial && !styledMaterials.some((entry) => entry.material === material)) {
        styledMaterials.push(createStyledMaterial(material, asset.materials));
      }
    });
    if (object instanceof SkinnedMesh) {
      skinnedMeshCount += 1;
      skeletons.add(object.skeleton);
    }
  });
  scene.updateWorldMatrix(true, true);
  const bindings = createCharacterBoneBindings(scene, asset.adapter);
  const diagnosticBones = createDiagnosticBoneBindings(scene, asset.adapter);
  const feet = createFootBoneBindings(scene, asset.adapter);

  const helper = new SkeletonHelper(scene);
  helper.name = `procedural-character-skeleton:${asset.adapter.id}:${asset.id}`;
  helper.frustumCulled = false;
  forEachMaterial(helper.material, (material) => {
    material.depthTest = false;
    material.transparent = true;
    material.opacity = 0.72;
  });

  return {
    adapter: asset.adapter,
    asset,
    authoredPelvisToAnkle: resolveAuthoredPelvisToAnkle(bindings.pelvis.bone, feet.left.ankle, asset.adapter),
    bindings,
    crowdHiddenMeshes,
    diagnosticBones,
    feet,
    hands: createCharacterHandBindings(scene, asset.adapter),
    helper,
    materials,
    ownedGeometries,
    scene,
    sockets: createCharacterSocketBindings(scene, asset.adapter),
    skeletons,
    skinnedMeshCount,
    styledMaterials,
  };
}

function mergeCompatibleOutfitMeshes(
  scene: Group,
  materials: LoadedProceduralCharacterAsset["materials"],
  ownedGeometries: Set<BufferGeometry>,
): void {
  const candidates = new Map<string, SkinnedMesh[]>();
  scene.traverse((object) => {
    if (!(object instanceof SkinnedMesh) || Array.isArray(object.material) || !object.parent) return;
    if (!materials.mergeableOutfit.test(object.material.name) || materials.crowdHiddenMesh.test(object.name)) {
      return;
    }
    if (!hasIdentityLocalTransform(object)) return;
    const key = `${object.parent.uuid}:${object.material.name}`;
    const group = candidates.get(key) ?? [];
    group.push(object);
    candidates.set(key, group);
  });

  candidates.forEach((meshes) => {
    if (meshes.length < 2 || !haveCompatibleSkinBindings(meshes)) return;
    const source = meshes[0];
    const geometry = mergeGeometries(
      meshes.map((mesh) => mesh.geometry),
      false,
    );
    if (!geometry || !source.parent || Array.isArray(source.material)) return;
    const merged = new SkinnedMesh(geometry, source.material);
    merged.name = `CrowdMerged_${source.material.name}`;
    merged.bindMode = source.bindMode;
    merged.bind(source.skeleton, source.bindMatrix);
    source.parent.add(merged);
    ownedGeometries.add(geometry);
    const discardedSkeletons = new Set<Skeleton>();
    meshes.forEach((mesh, index) => {
      mesh.removeFromParent();
      if (index > 0 && !Array.isArray(mesh.material)) mesh.material.dispose();
      if (mesh.skeleton !== source.skeleton) discardedSkeletons.add(mesh.skeleton);
    });
    discardedSkeletons.forEach((skeleton) => skeleton.dispose());
  });
}

function haveCompatibleSkinBindings(meshes: readonly SkinnedMesh[]): boolean {
  const source = meshes[0];
  return meshes.every(
    (mesh) =>
      mesh.parent === source.parent &&
      haveMatchingSkeletonBones(mesh.skeleton, source.skeleton) &&
      mesh.bindMode === source.bindMode &&
      mesh.bindMatrix.equals(source.bindMatrix),
  );
}

function haveMatchingSkeletonBones(left: Skeleton, right: Skeleton): boolean {
  return (
    left.bones.length === right.bones.length &&
    left.bones.every((bone, index) => bone === right.bones[index]) &&
    left.boneInverses.length === right.boneInverses.length &&
    left.boneInverses.every((inverse, index) => inverse.equals(right.boneInverses[index]))
  );
}

function hasIdentityLocalTransform(mesh: SkinnedMesh): boolean {
  return (
    mesh.position.lengthSq() < 1e-10 &&
    Math.abs(mesh.quaternion.x) < 1e-5 &&
    Math.abs(mesh.quaternion.y) < 1e-5 &&
    Math.abs(mesh.quaternion.z) < 1e-5 &&
    Math.abs(mesh.quaternion.w - 1) < 1e-5 &&
    Math.abs(mesh.scale.x - 1) < 1e-5 &&
    Math.abs(mesh.scale.y - 1) < 1e-5 &&
    Math.abs(mesh.scale.z - 1) < 1e-5
  );
}

function createCharacterSocketBindings(
  scene: Group,
  adapter: HumanoidRigAdapter,
): Record<CharacterSocketId, CharacterSocketBinding> {
  return Object.fromEntries(
    Object.entries(adapter.sockets).map(([socketId, definition]) => {
      const bone = requireRigBone(scene, adapter, definition.bone);
      const offset =
        definition.offset.kind === "fixed"
          ? new Vector3().fromArray(definition.offset.value)
          : resolveKnuckleCenterOffset(scene, adapter, bone, definition.offset.bones, definition.offset.scale);
      return [socketId, { bone, offset }];
    }),
  ) as Record<CharacterSocketId, CharacterSocketBinding>;
}

function createCharacterHandBindings(
  scene: Group,
  adapter: HumanoidRigAdapter,
): Record<HumanoidSide, CharacterHandBinding> {
  return {
    left: createCharacterHandBinding(scene, adapter, "left"),
    right: createCharacterHandBinding(scene, adapter, "right"),
  };
}

function createCharacterHandBinding(
  scene: Group,
  adapter: HumanoidRigAdapter,
  side: HumanoidSide,
): CharacterHandBinding {
  const definition = adapter.hands[side];
  const bone = requireRigBone(scene, adapter, definition.hand);
  return {
    bindQuaternion: bone.quaternion.clone(),
    bone,
    digits: createCharacterFingerBindings(scene, adapter, side),
    fingerCurlAxis: new Vector3().fromArray(definition.fingerCurlAxis).normalize(),
    palm: {
      index: requireRigBone(scene, adapter, definition.palm.index),
      middle: requireRigBone(scene, adapter, definition.palm.middle),
      normalSign: definition.palm.normalSign,
      pinky: requireRigBone(scene, adapter, definition.palm.pinky),
    },
    rollCorrection: new Quaternion().fromArray(definition.rollCorrection).normalize(),
  };
}

function createCharacterFingerBindings(
  scene: Group,
  adapter: HumanoidRigAdapter,
  side: HumanoidSide,
): Record<ProceduralHandDigitId, CharacterFingerBoneBinding[]> {
  return Object.fromEntries(
    Object.entries(adapter.hands[side].digits).map(([digitId, names]) => [
      digitId,
      names.map((name) => {
        const bone = requireRigBone(scene, adapter, name);
        return { bindQuaternion: bone.quaternion.clone(), bone };
      }),
    ]),
  ) as Record<ProceduralHandDigitId, CharacterFingerBoneBinding[]>;
}

function resolveKnuckleCenterOffset(
  scene: Group,
  adapter: HumanoidRigAdapter,
  hand: Bone,
  knuckleNames: readonly string[],
  scale: number,
): Vector3 {
  const knuckleCenter = new Vector3();
  knuckleNames.forEach((name) => {
    const knuckle = requireRigBone(scene, adapter, name).getWorldPosition(new Vector3());
    knuckleCenter.add(hand.worldToLocal(knuckle));
  });
  return knuckleCenter.multiplyScalar(scale / knuckleNames.length);
}

function createCharacterBoneBindings(
  scene: Group,
  adapter: HumanoidRigAdapter,
): Record<CharacterPartId, SegmentBoneBinding> {
  return Object.fromEntries(
    CHARACTER_PART_IDS.map((partId) => [partId, createCharacterBoneBinding(scene, adapter, partId)]),
  ) as Record<CharacterPartId, SegmentBoneBinding>;
}

function createCharacterBoneBinding(
  scene: Group,
  adapter: HumanoidRigAdapter,
  partId: CharacterPartId,
): SegmentBoneBinding {
  const definition = adapter.partBindings[partId];
  if (definition.childBone && definition.stable) {
    return createStableSegmentBoneBinding(
      scene,
      definition.bone,
      definition.childBone,
      new Vector3().fromArray(adapter.stableSegmentAxes.referenceForward),
      new Vector3().fromArray(adapter.stableSegmentAxes.fallbackForward),
    );
  }
  return createSegmentBoneBinding(scene, definition.bone, definition.childBone);
}

function requireRigBone(scene: Group, adapter: HumanoidRigAdapter, name: string): Bone {
  try {
    return requireSkinnedBone(scene, name);
  } catch {
    throw new Error(`${adapter.label} bone ${name} was not found`);
  }
}

function createDiagnosticBoneBindings(
  scene: Group,
  adapter: HumanoidRigAdapter,
): Record<ProceduralHumanoidJointId, Bone> {
  return Object.fromEntries(
    Object.entries(adapter.diagnosticBones).map(([jointId, boneName]) => [
      jointId,
      requireRigBone(scene, adapter, boneName),
    ]),
  ) as Record<ProceduralHumanoidJointId, Bone>;
}

function createFootBoneBindings(
  scene: Group,
  adapter: HumanoidRigAdapter,
): Record<HumanoidSide, { ankle: Bone; toe: Bone }> {
  return {
    left: {
      ankle: requireRigBone(scene, adapter, adapter.feet.left.ankle),
      toe: requireRigBone(scene, adapter, adapter.feet.left.toe),
    },
    right: {
      ankle: requireRigBone(scene, adapter, adapter.feet.right.ankle),
      toe: requireRigBone(scene, adapter, adapter.feet.right.toe),
    },
  };
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

function resolveAuthoredPelvisToAnkle(pelvisBone: Bone, ankleBone: Bone, adapter: HumanoidRigAdapter): number {
  const distance = pelvisBone.getWorldPosition(new Vector3()).distanceTo(ankleBone.getWorldPosition(new Vector3()));
  if (distance <= 0) throw new Error(`${adapter.label} has an invalid authored leg length`);
  return distance;
}

function resolvePalmInwardDot(model: PreparedCharacterModel, side: HumanoidSide): number {
  const binding = model.hands[side];
  const hand = binding.bone.getWorldPosition(new Vector3());
  const index = binding.palm.index.getWorldPosition(new Vector3());
  const middle = binding.palm.middle.getWorldPosition(new Vector3());
  const pinky = binding.palm.pinky.getWorldPosition(new Vector3());
  const pelvis = model.bindings.pelvis.bone.getWorldPosition(new Vector3());
  const forward = middle.sub(hand).normalize();
  const across = side === "left" ? index.sub(pinky).normalize() : pinky.sub(index).normalize();
  const palmNormal = across.cross(forward).normalize().multiplyScalar(binding.palm.normalSign);
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

function createStyledMaterial(
  material: MeshStandardMaterial,
  materials: LoadedProceduralCharacterAsset["materials"],
): StyledCharacterMaterial {
  return {
    baseColor: material.color.clone(),
    baseMetalness: material.metalness,
    baseNormalMap: material.normalMap,
    baseRoughness: material.roughness,
    material,
    role: resolveMaterialRole(materials, material.name),
  };
}

function resolveMaterialRole(
  materials: LoadedProceduralCharacterAsset["materials"],
  materialName: string,
): StyledCharacterMaterial["role"] {
  if (materials.outfit.test(materialName)) return "outfit";
  if (materials.body.test(materialName)) return "body";
  return "other";
}

function updateCharacterModelStyle(model: PreparedCharacterModel, config: ProceduralCharacterConfig): void {
  const heraldry = new Color(config.primaryColor);
  const crowdDetail = config.renderDetail === "crowd";
  model.crowdHiddenMeshes.forEach(({ heroVisible, mesh }) => {
    mesh.visible = crowdDetail ? false : heroVisible;
  });
  model.styledMaterials.forEach(({ baseColor, baseMetalness, baseNormalMap, baseRoughness, material, role }) => {
    material.color.copy(baseColor);
    material.normalMap = crowdDetail ? null : baseNormalMap;
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
