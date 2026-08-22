import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";

import type { ProceduralHorseConfig } from "./procedural-horse-config";
import type { ProceduralHorsePose } from "./procedural-horse-pose";

/** Bounded, art-directed upgrade pieces shared by horse and mounted actors. */
export class ProceduralHorseUpgrades {
  public readonly group = new Group();

  private readonly resources = acquireUpgradeGeometryResources();
  private readonly saddleGroup = new Group();
  private readonly headGroup = new Group();
  private readonly clothMaterial = new MeshStandardMaterial({ roughness: 0.72, metalness: 0.04 });
  private readonly armorMaterial = new MeshStandardMaterial({ roughness: 0.34, metalness: 0.76 });
  private readonly wingMaterial = new MeshStandardMaterial({ roughness: 0.48, metalness: 0.2, side: DoubleSide });
  private readonly hornMaterial = new MeshStandardMaterial({ roughness: 0.3, metalness: 0.68 });
  private readonly saddleCloth = new Mesh(this.resources.saddle, this.clothMaterial);
  private readonly armorPieces = createArmorPieces(this.armorMaterial, this.resources.armor);
  private readonly wings = createWings(this.wingMaterial, this.resources.wing);
  private readonly horns = createHorns(this.hornMaterial, this.resources.horn);

  public constructor(config: ProceduralHorseConfig) {
    this.group.name = "procedural-horse-upgrades";
    this.saddleGroup.name = "horse-saddle-upgrades";
    this.headGroup.name = "horse-head-upgrades";
    this.saddleCloth.position.set(0, -0.22, -0.08);
    this.saddleCloth.castShadow = true;
    this.saddleGroup.add(this.saddleCloth, ...this.armorPieces, ...this.wings);
    this.headGroup.add(...this.horns);
    this.group.add(this.saddleGroup, this.headGroup);
    this.updateConfig(config);
  }

  public updateConfig(config: ProceduralHorseConfig): void {
    const heraldry = new Color(config.primaryColor);
    this.clothMaterial.color.copy(heraldry).multiplyScalar(0.72);
    this.armorMaterial.color.set(config.tier >= 3 ? 0x5e6373 : 0xb7bdc8);
    this.armorMaterial.emissive.copy(heraldry).multiplyScalar(config.tier >= 3 ? 0.16 : 0.02);
    this.wingMaterial.color.set(config.tier >= 3 ? 0x3f465b : 0xc8cbd2);
    this.wingMaterial.emissive.copy(heraldry).multiplyScalar(config.tier >= 3 ? 0.12 : 0.01);
    this.hornMaterial.color.set(0x697083);
    this.clothMaterial.wireframe = config.wireframe;
    this.armorMaterial.wireframe = config.wireframe;
    this.wingMaterial.wireframe = config.wireframe;
    this.hornMaterial.wireframe = config.wireframe;
    this.armorPieces.forEach((mesh) => {
      mesh.visible = config.tier >= 2;
    });
    this.wings.forEach((mesh) => {
      mesh.visible = config.tier >= 2;
    });
    this.horns.forEach((mesh) => {
      mesh.visible = config.tier >= 3;
    });
  }

  public applyPose(pose: ProceduralHorsePose): void {
    this.saddleGroup.position.fromArray(pose.saddlePosition);
    this.saddleGroup.quaternion.fromArray(pose.saddleRotation);
    this.headGroup.position.fromArray(pose.headPosition);
    this.headGroup.quaternion.fromArray(pose.saddleRotation);
    const flap = pose.gait === "idle" ? 0.04 : 0.08 + Math.sin(pose.phase * Math.PI * 2) * 0.055;
    this.wings[0].rotation.z = -flap;
    this.wings[1].rotation.z = flap;
  }

  public applyPhysicsPose(
    bodyPosition: readonly [number, number, number],
    bodyQuaternion: readonly [number, number, number, number],
  ): void {
    this.saddleGroup.position.fromArray(bodyPosition);
    this.saddleGroup.quaternion.fromArray(bodyQuaternion);
    this.headGroup.position.fromArray(bodyPosition);
    this.headGroup.quaternion.fromArray(bodyQuaternion);
    this.headGroup.translateY(0.42);
    this.headGroup.translateZ(0.82);
  }

  public dispose(): void {
    this.clothMaterial.dispose();
    this.armorMaterial.dispose();
    this.wingMaterial.dispose();
    this.hornMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
    releaseUpgradeGeometryResources();
  }
}

function createArmorPieces(material: MeshStandardMaterial, geometry: BufferGeometry): Mesh[] {
  const left = new Mesh(geometry, material);
  const right = new Mesh(geometry, material);
  left.position.set(0.53, -0.33, -0.05);
  right.position.set(-0.53, -0.33, -0.05);
  left.rotation.z = -0.08;
  right.rotation.z = 0.08;
  left.castShadow = true;
  right.castShadow = true;
  return [left, right];
}

function createWings(material: MeshStandardMaterial, geometry: BufferGeometry): Mesh[] {
  const left = new Mesh(geometry, material);
  const right = new Mesh(geometry, material);
  right.scale.x = -1;
  left.position.set(0.18, 0.02, 0.08);
  right.position.set(-0.18, 0.02, 0.08);
  left.castShadow = true;
  right.castShadow = true;
  return [left, right];
}

function createHorns(material: MeshStandardMaterial, geometry: BufferGeometry): Mesh[] {
  const left = new Mesh(geometry, material);
  const right = new Mesh(geometry, material);
  left.position.set(0.17, 0.18, 0.08);
  right.position.set(-0.17, 0.18, 0.08);
  left.rotation.x = Math.PI * 0.42;
  right.rotation.x = Math.PI * 0.42;
  left.rotation.z = -0.18;
  right.rotation.z = 0.18;
  left.castShadow = true;
  right.castShadow = true;
  return [left, right];
}

interface UpgradeGeometryResources {
  armor: BufferGeometry;
  horn: BufferGeometry;
  saddle: BufferGeometry;
  wing: BufferGeometry;
}

let sharedGeometryResources: UpgradeGeometryResources | undefined;
let sharedGeometryReferenceCount = 0;

function acquireUpgradeGeometryResources(): UpgradeGeometryResources {
  sharedGeometryReferenceCount += 1;
  sharedGeometryResources ??= {
    armor: new BoxGeometry(0.13, 0.46, 0.82),
    horn: new ConeGeometry(0.085, 0.5, 7),
    saddle: new BoxGeometry(0.94, 0.09, 1.08),
    wing: createWingGeometry(),
  };
  return sharedGeometryResources;
}

function releaseUpgradeGeometryResources(): void {
  sharedGeometryReferenceCount = Math.max(0, sharedGeometryReferenceCount - 1);
  if (sharedGeometryReferenceCount > 0 || !sharedGeometryResources) return;
  Object.values(sharedGeometryResources).forEach((geometry) => geometry.dispose());
  sharedGeometryResources = undefined;
}

function createWingGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [0.24, 0.08, 0.16, 1.42, 0.5, 0.02, 1.1, 0.04, -0.42, 0.24, 0.08, 0.16, 1.1, 0.04, -0.42, 0.52, -0.05, -0.62],
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}
