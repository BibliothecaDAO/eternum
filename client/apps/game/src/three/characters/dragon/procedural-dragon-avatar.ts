import {
  AdditiveBlending,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  Quaternion,
  Skeleton,
  SkeletonHelper,
  SkinnedMesh,
  SphereGeometry,
  Vector3,
} from "three";

import type { ProceduralDragonConfig } from "./procedural-dragon-config";
import type { ProceduralDragonPose } from "./procedural-dragon-pose";
import type { LoadedIcyDragonAsset } from "./icy-dragon-assets";
import {
  applyIcyProceduralRigPose,
  createIcyProceduralDragonRig,
  isIcyProceduralRigFinite,
  writeIcyLowestFootWorldPosition,
  type IcyProceduralDragonRig,
} from "./icy-dragon-procedural-rig";
const DRAGON_FORWARD = new Vector3(0, 0, 1);
const GROUND_BODY_REFERENCE_HEIGHT = 1.18;

export interface ProceduralDragonAvatarStats {
  appearanceId: "icy-dragon-cc-by";
  appearanceLabel: "Icy Dragon";
  assetId: "icy-dragon-gltf";
  assetLabel: "Icy Dragon glTF — CC BY 4.0";
  authoredClipCount: number;
  boneCount: number;
  maximumBoneStretchRatio: 1;
  minimumBendAlignment: 1;
  rigAdapterId: "icy-dragon-gltf-v1";
  skinnedMeshCount: number;
}

/** Presents Eternum's procedural dragon controller through the licensed Icy Dragon rig. */
export class ProceduralDragonAvatar {
  public readonly group = new Group();

  private readonly modelRoot = new Group();
  private readonly scene: Group;
  private readonly rig: IcyProceduralDragonRig;
  private readonly mouthBone: Object3D;
  private readonly saddleBone: Object3D;
  private readonly mouthSocket = new Group();
  private readonly saddleSocket = new Group();
  private readonly fireBreath = new Group();
  private readonly helper: SkeletonHelper;
  private readonly socketMarkers: Mesh[] = [];
  private readonly skeletons = new Set<Skeleton>();
  private readonly materials = new Set<Material>();
  private readonly ownedGeometries = new Set<BufferGeometry>();
  private readonly fireMaterial: MeshBasicMaterial;
  private readonly fireCoreMaterial: MeshBasicMaterial;
  private readonly fireLight = new PointLight(0xff5a18, 0, 5.5, 1.8);
  private readonly scratchMouthWorld = new Vector3();
  private readonly scratchMouthLocal = new Vector3();
  private readonly scratchFireDirection = new Vector3();
  private readonly scratchFireQuaternion = new Quaternion();
  private readonly scratchGroupWorldQuaternion = new Quaternion();
  private readonly scratchLowestFootLocal = new Vector3();
  private readonly scratchLowestFootWorld = new Vector3();
  private config: ProceduralDragonConfig;
  private lastAnimatedModelRootY = 0;
  private boneCount = 0;
  private skinnedMeshCount = 0;

  public constructor(config: ProceduralDragonConfig, asset: LoadedIcyDragonAsset) {
    this.config = config;
    this.group.name = "icy-dragon-avatar";
    this.modelRoot.name = "icy-dragon-model-root";
    this.scene = asset.scene;
    this.fireMaterial = this.createFireMaterial("icy-dragon-fire", "#ff6b1a");
    this.fireCoreMaterial = this.createFireMaterial("icy-dragon-fire-core", "#fff0a6");
    this.prepareScene();
    this.rig = createIcyProceduralDragonRig(this.scene);
    this.mouthBone = this.rig.mouth;
    this.saddleBone = this.rig.saddle;
    this.createSocketsAndFire();
    this.helper = new SkeletonHelper(this.scene);
    this.helper.name = "icy-dragon-skeleton-helper";
    this.modelRoot.add(this.scene, this.helper);
    this.group.add(this.modelRoot, this.fireBreath, this.mouthSocket, this.saddleSocket);
    this.updateConfig(config);
  }

  public updateConfig(config: ProceduralDragonConfig): void {
    this.config = config;
    this.materials.forEach((material) => {
      if ("wireframe" in material) material.wireframe = config.wireframe;
    });
    this.helper.visible = config.showBones;
    this.socketMarkers.forEach((marker) => (marker.visible = config.showSockets));
  }

  public applyPose(pose: ProceduralDragonPose): void {
    applyIcyProceduralRigPose(this.rig, pose);
    this.modelRoot.position.set(
      pose.bodyPosition[0],
      pose.bodyPosition[1] - GROUND_BODY_REFERENCE_HEIGHT,
      pose.bodyPosition[2],
    );
    this.modelRoot.quaternion.fromArray(pose.bodyRotation);
    this.group.updateWorldMatrix(true, true);
    this.applyGroundContact(pose);
    this.lastAnimatedModelRootY = this.modelRoot.position.y;
    this.group.updateWorldMatrix(true, true);
    this.updateSocketTransforms();
    this.updateFireBreath(pose);
    this.group.updateWorldMatrix(true, true);
  }

  public applyRagdollFall(progress: number): void {
    const eased = Math.min(1, Math.max(0, progress));
    this.modelRoot.rotation.z = eased * 1.18;
    this.modelRoot.rotation.x = -eased * 0.28;
    this.modelRoot.position.y = Math.max(-0.7, this.lastAnimatedModelRootY - eased * 1.5);
    this.fireBreath.visible = false;
  }

  public resetRagdollTransform(): void {
    this.modelRoot.rotation.set(0, 0, 0);
  }

  public writeMouthWorldPosition(out: Vector3): Vector3 {
    return this.mouthBone.getWorldPosition(out);
  }

  public writeMouthWorldQuaternion(out: Quaternion): Quaternion {
    return this.mouthBone.getWorldQuaternion(out);
  }

  public hasFiniteTransforms(): boolean {
    const nodes = [this.modelRoot, this.mouthBone, this.saddleBone, this.mouthSocket, this.saddleSocket];
    return (
      isIcyProceduralRigFinite(this.rig) &&
      nodes.every((node) => [...node.position.toArray(), ...node.quaternion.toArray()].every(Number.isFinite))
    );
  }

  public getStats(): ProceduralDragonAvatarStats {
    return {
      appearanceId: "icy-dragon-cc-by",
      appearanceLabel: "Icy Dragon",
      assetId: "icy-dragon-gltf",
      assetLabel: "Icy Dragon glTF — CC BY 4.0",
      authoredClipCount: 0,
      boneCount: this.boneCount,
      maximumBoneStretchRatio: 1,
      minimumBendAlignment: 1,
      rigAdapterId: "icy-dragon-gltf-v1",
      skinnedMeshCount: this.skinnedMeshCount,
    };
  }

  public dispose(): void {
    this.helper.geometry.dispose();
    disposeMaterial(this.helper.material);
    this.skeletons.forEach((skeleton) => skeleton.dispose());
    this.materials.forEach((material) => material.dispose());
    this.ownedGeometries.forEach((geometry) => geometry.dispose());
    this.group.clear();
    this.group.removeFromParent();
  }

  private prepareScene(): void {
    const uniqueBoneNames = new Set<string>();
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = false;
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      meshMaterials.forEach((material) => this.materials.add(material));
      if (!(object instanceof SkinnedMesh)) return;
      this.skeletons.add(object.skeleton);
      object.skeleton.bones.forEach(({ name }) => uniqueBoneNames.add(name));
      this.skinnedMeshCount += 1;
    });
    this.boneCount = uniqueBoneNames.size;
    this.scene.updateWorldMatrix(true, true);
  }

  private applyGroundContact(pose: ProceduralDragonPose): void {
    if (pose.flightBlend >= 1) return;
    writeIcyLowestFootWorldPosition(this.rig, pose, this.scratchLowestFootWorld);
    this.scratchLowestFootLocal.copy(this.scratchLowestFootWorld);
    this.group.worldToLocal(this.scratchLowestFootLocal);
    const clearance = this.scratchLowestFootLocal.y - pose.groundHeight;
    this.modelRoot.position.y -= clearance * (1 - smoothstep(pose.flightBlend));
  }

  private createSocketsAndFire(): void {
    const markerGeometry = this.trackGeometry(new SphereGeometry(0.055, 8, 6));
    const mouthMarker = new Mesh(markerGeometry, this.createDebugMaterial("icy-mouth-socket", "#fb923c"));
    const saddleMarker = new Mesh(markerGeometry, this.createDebugMaterial("icy-saddle-socket", "#facc15"));
    mouthMarker.name = "icy-mouth-socket-marker";
    saddleMarker.name = "icy-saddle-socket-marker";
    this.mouthSocket.add(mouthMarker);
    this.saddleSocket.add(saddleMarker);
    this.socketMarkers.push(mouthMarker, saddleMarker);

    const outer = new Mesh(new CylinderGeometry(0.72, 0.045, 1, 16, 1, true), this.fireMaterial);
    const core = new Mesh(new CylinderGeometry(0.34, 0.02, 1, 12, 1, true), this.fireCoreMaterial);
    this.trackGeometry(outer.geometry);
    this.trackGeometry(core.geometry);
    [outer, core].forEach((mesh) => {
      mesh.position.set(0, 0, 0.5);
      mesh.rotation.x = Math.PI / 2;
      mesh.castShadow = false;
      this.fireBreath.add(mesh);
    });
    this.fireLight.position.set(0, 0, 0.18);
    this.fireBreath.add(this.fireLight);
    this.fireBreath.name = "icy-fire-breath";
    this.fireBreath.visible = false;
  }

  private updateSocketTransforms(): void {
    this.writeNodeWorldTransform(this.mouthBone, this.mouthSocket);
    this.writeNodeWorldTransform(this.saddleBone, this.saddleSocket);
  }

  private writeNodeWorldTransform(source: Object3D, target: Group): void {
    source.getWorldPosition(target.position);
    this.group.worldToLocal(target.position);
    source.getWorldQuaternion(target.quaternion);
    this.group.getWorldQuaternion(this.scratchGroupWorldQuaternion).invert();
    target.quaternion.premultiply(this.scratchGroupWorldQuaternion);
  }

  private updateFireBreath(pose: ProceduralDragonPose): void {
    const intensity = pose.fireIntensity;
    this.mouthBone.getWorldPosition(this.scratchMouthWorld);
    this.scratchMouthLocal.copy(this.scratchMouthWorld);
    this.group.worldToLocal(this.scratchMouthLocal);
    this.fireBreath.position.copy(this.scratchMouthLocal);
    this.scratchFireDirection.fromArray(pose.fireTarget).sub(this.scratchMouthLocal);
    if (this.scratchFireDirection.lengthSq() < 1e-8) this.scratchFireDirection.copy(DRAGON_FORWARD);
    else this.scratchFireDirection.normalize();
    this.scratchFireQuaternion.setFromUnitVectors(DRAGON_FORWARD, this.scratchFireDirection);
    this.fireBreath.quaternion.copy(this.scratchFireQuaternion);
    this.fireBreath.visible = intensity > 0.005;
    this.fireBreath.scale.set(0.72 + intensity * 0.28, 0.72 + intensity * 0.28, this.config.fireRange);
    this.fireMaterial.opacity = intensity * 0.72;
    this.fireCoreMaterial.opacity = intensity * 0.88;
    this.fireLight.intensity = intensity * 7;
  }

  private createFireMaterial(name: string, color: string): MeshBasicMaterial {
    const material = new MeshBasicMaterial({
      blending: AdditiveBlending,
      color,
      depthWrite: false,
      name,
      opacity: 0,
      side: DoubleSide,
      transparent: true,
    });
    this.materials.add(material);
    return material;
  }

  private createDebugMaterial(name: string, color: string): MeshBasicMaterial {
    const material = new MeshBasicMaterial({ color, name });
    this.materials.add(material);
    return material;
  }

  private trackGeometry<T extends BufferGeometry>(geometry: T): T {
    this.ownedGeometries.add(geometry);
    return geometry;
  }
}

function disposeMaterial(material: Material | Material[]): void {
  (Array.isArray(material) ? material : [material]).forEach((entry) => entry.dispose());
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}
