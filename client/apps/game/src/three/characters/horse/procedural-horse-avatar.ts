import {
  Bone,
  Color,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Skeleton,
  SkeletonHelper,
  SkinnedMesh,
  SphereGeometry,
  Vector3,
} from "three";

import {
  applySegmentBoneRotation,
  createSegmentBoneBinding,
  requireSkinnedBone,
  type SegmentBoneBinding,
} from "../skinned-pose-binding";
import type { ProceduralHorseConfig } from "./procedural-horse-config";
import { HORSE_HOOF_IDS, type HorseHoofId } from "./procedural-horse-gait";
import type { ProceduralHorsePose } from "./procedural-horse-pose";
import {
  HORSE_LEG_SEGMENT_IDS,
  resolveQuaterniusHorseRig,
  type HorseLegSegmentId,
  type ResolvedHorseRig,
} from "./procedural-horse-rig";
import {
  QUATERNIUS_HORSE_BONES,
  type LoadedQuaterniusHorseAsset,
  requireQuaterniusHorseBone,
} from "./quaternius-horse-assets";
import { ProceduralHorseUpgrades } from "./procedural-horse-upgrades";

interface LocalBoneTransform {
  bone: Bone;
  quaternion: Quaternion;
}

interface HorseMaterialBinding {
  baseColor: Color;
  material: MeshStandardMaterial;
  role: "coat" | "dark" | "light" | "detail";
}

export interface ProceduralHorseAvatarStats {
  assetLabel: string;
  authoredClipCount: number;
  boneCount: number;
  minimumBendAlignment: number;
  skinnedMeshCount: number;
  stanceHoofCount: number;
}

export interface ProceduralHorsePhysicsPose {
  bodyPosition: readonly [number, number, number];
  bodyQuaternion: readonly [number, number, number, number];
  chestPosition: readonly [number, number, number];
  chestQuaternion: readonly [number, number, number, number];
  headPosition: readonly [number, number, number];
  headQuaternion: readonly [number, number, number, number];
  segments: Readonly<
    Record<
      HorseLegSegmentId,
      {
        length: number;
        position: readonly [number, number, number];
        quaternion: readonly [number, number, number, number];
      }
    >
  >;
}

const HORSE_SCENE_SCALE = 0.52;
const NECK_BONE_NAMES = [
  QUATERNIUS_HORSE_BONES.neck1,
  QUATERNIUS_HORSE_BONES.neck2,
  QUATERNIUS_HORSE_BONES.neck3,
] as const;
const TAIL_BONE_NAMES = [
  QUATERNIUS_HORSE_BONES.tail1,
  QUATERNIUS_HORSE_BONES.tail2,
  QUATERNIUS_HORSE_BONES.tail3,
  QUATERNIUS_HORSE_BONES.tail4,
  QUATERNIUS_HORSE_BONES.tail5,
  QUATERNIUS_HORSE_BONES.tail6,
  QUATERNIUS_HORSE_BONES.tail7,
] as const;

export class ProceduralHorseAvatar {
  public readonly group = new Group();
  public readonly rig: ResolvedHorseRig;

  private readonly scene: Group;
  private readonly helper: SkeletonHelper;
  private readonly skeletons = new Set<Skeleton>();
  private readonly materials = new Set<Material>();
  private readonly materialBindings: HorseMaterialBinding[] = [];
  private readonly segmentBindings: Readonly<Record<HorseLegSegmentId, SegmentBoneBinding>>;
  private readonly chestPhysicsBinding: SegmentBoneBinding;
  private readonly headPhysicsBinding: SegmentBoneBinding;
  private readonly neckPhysicsBindings: readonly SegmentBoneBinding[];
  private readonly rootTransform: LocalBoneTransform;
  private readonly headTransform: LocalBoneTransform;
  private readonly neckTransforms: LocalBoneTransform[];
  private readonly tailTransforms: LocalBoneTransform[];
  private readonly targetBones: Readonly<Record<HorseHoofId, Bone>>;
  private readonly hoofMarkers: Readonly<Record<HorseHoofId, Mesh>>;
  private readonly saddleMarker: Mesh;
  private readonly upgrades: ProceduralHorseUpgrades;
  private readonly debugGeometry = new SphereGeometry(0.055, 10, 7);
  private readonly hoofDebugMaterial = new MeshStandardMaterial({ color: "#22d3ee", emissive: "#0e7490" });
  private readonly hoofDebugMaterials = new Set<MeshStandardMaterial>();
  private readonly saddleDebugMaterial = new MeshStandardMaterial({ color: "#facc15", emissive: "#854d0e" });
  private readonly scratchParentQuaternion = new Quaternion();
  private readonly scratchGroupQuaternion = new Quaternion();
  private readonly scratchTargetQuaternion = new Quaternion();
  private readonly scratchPhysicsQuaternion = new Quaternion();
  private readonly scratchWorldPosition = new Vector3();
  private readonly scratchLocalPosition = new Vector3();
  private config: ProceduralHorseConfig;
  private readonly authoredClipCount: number;
  private lastPose?: ProceduralHorsePose;
  private skinnedMeshCount = 0;

  public constructor(asset: LoadedQuaterniusHorseAsset, config: ProceduralHorseConfig) {
    this.scene = asset.gltf.scene;
    this.authoredClipCount = asset.gltf.animations.length;
    this.config = config;
    this.group.name = "procedural-horse-avatar";
    this.scene.name = "quaternius-procedural-horse";
    this.group.add(this.scene);
    this.prepareScene();
    this.alignHoovesToGround();
    this.rig = resolveQuaterniusHorseRig(this.group, this.scene);
    this.segmentBindings = this.createSegmentBindings();
    this.chestPhysicsBinding = createSegmentBoneBinding(
      this.scene,
      QUATERNIUS_HORSE_BONES.chest,
      QUATERNIUS_HORSE_BONES.withers,
    );
    this.neckPhysicsBindings = NECK_BONE_NAMES.map((name, index) =>
      createSegmentBoneBinding(this.scene, name, NECK_BONE_NAMES[index + 1] ?? QUATERNIUS_HORSE_BONES.head),
    );
    this.headPhysicsBinding = createSegmentBoneBinding(this.scene, QUATERNIUS_HORSE_BONES.head);
    this.rootTransform = captureLocalTransform(requireQuaterniusHorseBone(this.scene, QUATERNIUS_HORSE_BONES.root));
    this.neckTransforms = NECK_BONE_NAMES.map((name) =>
      captureLocalTransform(requireQuaterniusHorseBone(this.scene, name)),
    );
    this.headTransform = captureLocalTransform(requireQuaterniusHorseBone(this.scene, QUATERNIUS_HORSE_BONES.head));
    this.tailTransforms = TAIL_BONE_NAMES.map((name) =>
      captureLocalTransform(requireQuaterniusHorseBone(this.scene, name)),
    );
    this.targetBones = Object.fromEntries(
      HORSE_HOOF_IDS.map((hoofId) => [hoofId, requireSkinnedBone(this.scene, this.rig.legs[hoofId].targetBoneName)]),
    ) as Record<HorseHoofId, Bone>;
    this.helper = this.createSkeletonHelper();
    this.hoofMarkers = this.createHoofMarkers();
    this.saddleMarker = this.createSaddleMarker();
    this.upgrades = new ProceduralHorseUpgrades(config);
    this.group.add(this.helper, ...Object.values(this.hoofMarkers), this.saddleMarker, this.upgrades.group);
    this.updateConfig(config);
  }

  public updateConfig(config: ProceduralHorseConfig): void {
    this.config = config;
    this.materialBindings.forEach((binding) => updateHorseMaterial(binding, config));
    this.helper.visible = config.showBones;
    Object.values(this.hoofMarkers).forEach((marker) => {
      marker.visible = config.showHoofTargets;
    });
    this.saddleMarker.visible = config.showSockets;
    this.upgrades.updateConfig(config);
  }

  public applyPose(pose: ProceduralHorsePose): void {
    this.lastPose = pose;
    this.applyBodyPose(pose);
    this.applyLegPose(pose);
    this.applyControlTargets(pose);
    this.updateDebugMarkers(pose);
    this.upgrades.applyPose(pose);
    this.scene.updateWorldMatrix(true, true);
  }

  public applyPhysicsPose(pose: ProceduralHorsePhysicsPose): void {
    const bodyOffset = this.scratchLocalPosition.fromArray(pose.bodyPosition).sub(new Vector3(...this.rig.bodyCenter));
    setBonePositionInCoordinateSpace(
      this.rootTransform.bone,
      this.group,
      this.scratchWorldPosition.fromArray(this.rig.rootBindPosition).add(bodyOffset),
      this.scratchWorldPosition,
    );
    this.rootTransform.bone.quaternion
      .copy(this.rootTransform.quaternion)
      .multiply(new Quaternion(...pose.bodyQuaternion));
    this.scene.updateWorldMatrix(true, true);
    this.applyPhysicsUpperBodyPose(pose);
    HORSE_LEG_SEGMENT_IDS.forEach((segmentId) => {
      applySegmentBoneRotation(
        this.segmentBindings[segmentId],
        this.group,
        new Quaternion(...pose.segments[segmentId].quaternion),
        this.scratchGroupQuaternion,
        this.scratchParentQuaternion,
        this.scratchTargetQuaternion,
      );
    });
    HORSE_HOOF_IDS.forEach((hoofId) => {
      const segmentId = this.rig.legs[hoofId].segmentIds.at(-1);
      if (!segmentId) return;
      const segment = pose.segments[segmentId];
      const endpoint = new Vector3(0, segment.length * 0.5, 0)
        .applyQuaternion(new Quaternion(...segment.quaternion))
        .add(new Vector3(...segment.position));
      setBonePositionInCoordinateSpace(this.targetBones[hoofId], this.group, endpoint, this.scratchWorldPosition);
      this.hoofMarkers[hoofId].position.copy(endpoint).add(new Vector3(...this.rig.legs[hoofId].hoofOffset));
    });
    this.saddleMarker.position.fromArray(pose.bodyPosition);
    this.saddleMarker.quaternion.fromArray(pose.bodyQuaternion);
    this.upgrades.applyPhysicsPose(pose.bodyPosition, pose.bodyQuaternion);
    this.scene.updateWorldMatrix(true, true);
  }

  public getStats(): ProceduralHorseAvatarStats {
    const pose = this.lastPose;
    return {
      assetLabel: "Quaternius horse",
      authoredClipCount: this.authoredClipCount,
      boneCount: new Set([...this.skeletons].flatMap(({ bones }) => bones)).size,
      minimumBendAlignment: pose ? Math.min(...Object.values(pose.legs).map(({ bendAlignment }) => bendAlignment)) : 1,
      skinnedMeshCount: this.skinnedMeshCount,
      stanceHoofCount: pose
        ? Object.values(pose.legs).filter(({ cycle }) => cycle.contact === "stance").length
        : HORSE_HOOF_IDS.length,
    };
  }

  public hasFiniteTransforms(): boolean {
    const bones = [
      this.rootTransform.bone,
      this.chestPhysicsBinding.bone,
      ...this.neckPhysicsBindings.map(({ bone }) => bone),
      this.headPhysicsBinding.bone,
      ...HORSE_LEG_SEGMENT_IDS.map((segmentId) => this.segmentBindings[segmentId].bone),
    ];
    return bones.every((bone) => {
      return [...bone.position.toArray(), ...bone.quaternion.toArray()].every(Number.isFinite);
    });
  }

  public dispose(): void {
    this.helper.removeFromParent();
    forEachMaterial(this.helper.material, (material) => material.dispose());
    this.skeletons.forEach((skeleton) => skeleton.dispose());
    this.materials.forEach((material) => material.dispose());
    this.debugGeometry.dispose();
    this.hoofDebugMaterial.dispose();
    this.hoofDebugMaterials.forEach((material) => material.dispose());
    this.saddleDebugMaterial.dispose();
    this.upgrades.dispose();
    this.group.clear();
    this.group.removeFromParent();
  }

  private prepareScene(): void {
    this.scene.scale.setScalar(HORSE_SCENE_SCALE);
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = false;
      object.frustumCulled = false;
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      meshMaterials.forEach((material) => {
        this.materials.add(material);
        if (
          material instanceof MeshStandardMaterial &&
          !this.materialBindings.some(({ material: entry }) => entry === material)
        ) {
          this.materialBindings.push(createHorseMaterialBinding(material));
        }
      });
      if (object instanceof SkinnedMesh) {
        this.skeletons.add(object.skeleton);
        this.skinnedMeshCount += 1;
      }
    });
    this.scene.updateWorldMatrix(true, true);
  }

  private alignHoovesToGround(): void {
    const hoofY = [
      QUATERNIUS_HORSE_BONES.frontHoofLeft,
      QUATERNIUS_HORSE_BONES.frontHoofRight,
      QUATERNIUS_HORSE_BONES.hindHoofLeft,
      QUATERNIUS_HORSE_BONES.hindHoofRight,
    ].map((name) => requireQuaterniusHorseBone(this.scene, name).getWorldPosition(new Vector3()).y);
    this.scene.position.y -= Math.min(...hoofY);
    this.scene.updateWorldMatrix(true, true);
  }

  private createSegmentBindings(): Readonly<Record<HorseLegSegmentId, SegmentBoneBinding>> {
    const entries = HORSE_HOOF_IDS.flatMap((hoofId) => {
      const leg = this.rig.legs[hoofId];
      return leg.segmentIds.map(
        (segmentId, index) =>
          [
            segmentId,
            createSegmentBoneBinding(this.scene, leg.boneNames[index], leg.boneNames[index + 1] ?? leg.targetBoneName),
          ] as const,
      );
    });
    return Object.fromEntries(entries) as Record<HorseLegSegmentId, SegmentBoneBinding>;
  }

  private createSkeletonHelper(): SkeletonHelper {
    const helper = new SkeletonHelper(this.scene);
    helper.name = "quaternius-horse-skeleton";
    helper.frustumCulled = false;
    forEachMaterial(helper.material, (material) => {
      material.depthTest = false;
      material.transparent = true;
      material.opacity = 0.68;
    });
    return helper;
  }

  private createHoofMarkers(): Readonly<Record<HorseHoofId, Mesh>> {
    return Object.fromEntries(
      HORSE_HOOF_IDS.map((hoofId) => {
        const material = this.hoofDebugMaterial.clone();
        this.hoofDebugMaterials.add(material);
        const marker = new Mesh(this.debugGeometry, material);
        marker.name = `horse-hoof-target:${hoofId}`;
        marker.frustumCulled = false;
        return [hoofId, marker];
      }),
    ) as unknown as Record<HorseHoofId, Mesh>;
  }

  private createSaddleMarker(): Mesh {
    const marker = new Mesh(this.debugGeometry, this.saddleDebugMaterial);
    marker.name = "horse-saddle-socket";
    marker.scale.setScalar(1.25);
    marker.frustumCulled = false;
    return marker;
  }

  private applyBodyPose(pose: ProceduralHorsePose): void {
    setBonePositionInCoordinateSpace(
      this.rootTransform.bone,
      this.group,
      this.scratchWorldPosition
        .fromArray(this.rig.rootBindPosition)
        .add(this.scratchLocalPosition.fromArray(pose.rootOffset)),
      this.scratchWorldPosition,
    );
    this.rootTransform.bone.quaternion
      .copy(this.rootTransform.quaternion)
      .multiply(new Quaternion(...pose.bodyRotation));
    this.neckTransforms.forEach((transform, index) => {
      transform.bone.quaternion.copy(transform.quaternion).multiply(new Quaternion(...pose.neckRotations[index]));
    });
    this.headTransform.bone.quaternion
      .copy(this.headTransform.quaternion)
      .multiply(new Quaternion(...pose.neckRotations.at(-1)!));
    this.tailTransforms.forEach((transform, index) => {
      transform.bone.quaternion.copy(transform.quaternion).multiply(new Quaternion(...pose.tailRotations[index]));
    });
    this.scene.updateWorldMatrix(true, true);
  }

  private applyPhysicsUpperBodyPose(pose: ProceduralHorsePhysicsPose): void {
    const chestQuaternion = new Quaternion(...pose.chestQuaternion);
    const headQuaternion = new Quaternion(...pose.headQuaternion);
    applySegmentBoneRotation(
      this.chestPhysicsBinding,
      this.group,
      chestQuaternion,
      this.scratchGroupQuaternion,
      this.scratchParentQuaternion,
      this.scratchTargetQuaternion,
    );
    this.neckPhysicsBindings.forEach((binding, index) => {
      const weight = (index + 1) / (this.neckPhysicsBindings.length + 1);
      this.scratchPhysicsQuaternion.copy(chestQuaternion).slerp(headQuaternion, weight);
      applySegmentBoneRotation(
        binding,
        this.group,
        this.scratchPhysicsQuaternion,
        this.scratchGroupQuaternion,
        this.scratchParentQuaternion,
        this.scratchTargetQuaternion,
      );
    });
    applySegmentBoneRotation(
      this.headPhysicsBinding,
      this.group,
      headQuaternion,
      this.scratchGroupQuaternion,
      this.scratchParentQuaternion,
      this.scratchTargetQuaternion,
    );
    setBonePositionInCoordinateSpace(
      this.chestPhysicsBinding.bone,
      this.group,
      this.scratchLocalPosition.fromArray(pose.chestPosition),
      this.scratchWorldPosition,
    );
    setBonePositionInCoordinateSpace(
      this.headPhysicsBinding.bone,
      this.group,
      this.scratchLocalPosition.fromArray(pose.headPosition),
      this.scratchWorldPosition,
    );
    this.scene.updateWorldMatrix(true, true);
  }

  private applyLegPose(pose: ProceduralHorsePose): void {
    HORSE_LEG_SEGMENT_IDS.forEach((segmentId) => {
      applySegmentBoneRotation(
        this.segmentBindings[segmentId],
        this.group,
        new Quaternion(...pose.segmentRotations[segmentId]),
        this.scratchGroupQuaternion,
        this.scratchParentQuaternion,
        this.scratchTargetQuaternion,
      );
    });
  }

  private applyControlTargets(pose: ProceduralHorsePose): void {
    HORSE_HOOF_IDS.forEach((hoofId) => {
      const target = new Vector3(...pose.legs[hoofId].hoofTarget).sub(new Vector3(...this.rig.legs[hoofId].hoofOffset));
      setBonePositionInCoordinateSpace(this.targetBones[hoofId], this.group, target, this.scratchWorldPosition);
    });
  }

  private updateDebugMarkers(pose: ProceduralHorsePose): void {
    HORSE_HOOF_IDS.forEach((hoofId) => {
      this.hoofMarkers[hoofId].position.fromArray(pose.legs[hoofId].hoofTarget);
      const stance = pose.legs[hoofId].cycle.contact === "stance";
      (this.hoofMarkers[hoofId].material as MeshStandardMaterial).color.set(stance ? "#22d3ee" : "#f472b6");
    });
    this.saddleMarker.position.fromArray(pose.saddlePosition);
    this.saddleMarker.quaternion.fromArray(pose.saddleRotation);
  }
}

function setBonePositionInCoordinateSpace(
  bone: Bone,
  coordinateSpace: Group,
  position: Vector3,
  scratchWorldPosition: Vector3,
): void {
  const parent = bone.parent;
  scratchWorldPosition.copy(position);
  coordinateSpace.localToWorld(scratchWorldPosition);
  if (parent) parent.worldToLocal(scratchWorldPosition);
  bone.position.copy(scratchWorldPosition);
  bone.updateWorldMatrix(false, true);
}

function captureLocalTransform(bone: Bone): LocalBoneTransform {
  return { bone, quaternion: bone.quaternion.clone() };
}

function createHorseMaterialBinding(material: MeshStandardMaterial): HorseMaterialBinding {
  const name = material.name.toLowerCase();
  const role = name.includes("dark") ? "dark" : name.includes("light") ? "light" : name === "main" ? "coat" : "detail";
  return { baseColor: material.color.clone(), material, role };
}

function updateHorseMaterial(binding: HorseMaterialBinding, config: ProceduralHorseConfig): void {
  binding.material.wireframe = config.wireframe;
  if (binding.role === "detail") return;
  const heraldry = new Color(config.primaryColor);
  const mix = binding.role === "coat" ? 0.72 : binding.role === "dark" ? 0.5 : 0.4;
  binding.material.color.copy(binding.baseColor).lerp(heraldry, mix);
  binding.material.roughness = binding.role === "light" && config.tier >= 2 ? 0.38 : 0.72;
  binding.material.metalness = binding.role === "light" && config.tier >= 2 ? 0.42 : 0.04;
}

function forEachMaterial(material: Material | Material[], visit: (entry: Material) => void): void {
  if (Array.isArray(material)) material.forEach(visit);
  else visit(material);
}
