import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import type { ProceduralArcherConfig } from "./archer/procedural-archer-config";
import type { ProceduralArcherUpperBodyPose } from "./archer/procedural-archer-pose";
import {
  ProceduralBowEquipment,
  type ProceduralBowEquipmentStats,
  type ProceduralBowPoseDiagnostics,
} from "./archer/procedural-bow-equipment";
import type { ProceduralCharacterConfig } from "./procedural-character-config";
import type { ProceduralCharacterSocketReader } from "./procedural-character-sockets";
import type { ProceduralMeleeConfig } from "./melee/procedural-melee-config";
import type { ProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";
import {
  ProceduralMeleeEquipment,
  type ProceduralMeleeEquipmentStats,
  type ProceduralMeleePoseDiagnostics,
} from "./melee/procedural-melee-equipment";
import type { ProceduralMeleeWeaponLibrary } from "./melee/procedural-melee-weapon-library";
import type { ProceduralUnitKind } from "./procedural-unit-config";

const LOCAL_Z = new Vector3(0, 0, 1);
const CROSSBOW_LEFT_GRIP = new Vector3(0.2, 0, 0);
const CROSSBOW_RIGHT_GRIP = new Vector3(-0.2, 0, 0);

export interface ProceduralCrossbowPoseDiagnostics {
  centerWorld: readonly [number, number, number];
  leftGripWorld: readonly [number, number, number];
  leftLimbWorld: readonly [number, number, number];
  rightGripWorld: readonly [number, number, number];
  rightLimbWorld: readonly [number, number, number];
  span: number;
  stockTipWorld: readonly [number, number, number];
}

/** Equipment facade shared by every production unit actor. */
export class ProceduralUnitEquipment {
  public readonly group = new Group();

  private readonly resources = acquireEquipmentResources();
  private readonly metalMaterial = new MeshStandardMaterial({ color: 0xaab2c1, metalness: 0.82, roughness: 0.28 });
  private readonly accentMaterial = new MeshStandardMaterial({ color: 0x315f86, metalness: 0.25, roughness: 0.58 });
  private readonly crossbow = createCrossbow(this.resources, this.metalMaterial, this.accentMaterial);
  private readonly bow: ProceduralBowEquipment;
  private readonly melee: ProceduralMeleeEquipment;
  private readonly scratchColor = new Color();
  private readonly scratchWorldPosition = new Vector3();
  private readonly scratchSecondPosition = new Vector3();
  private readonly scratchWorldQuaternion = new Quaternion();
  private readonly scratchCrossbowXAxis = new Vector3();
  private readonly scratchCrossbowYAxis = new Vector3();
  private readonly scratchCrossbowZAxis = new Vector3();
  private readonly scratchCrossbowMatrix = new Matrix4();
  private readonly scratchCrossbowCenter = new Vector3();
  private readonly scratchCrossbowLeftGrip = new Vector3();
  private readonly scratchCrossbowLeft = new Vector3();
  private readonly scratchCrossbowRightGrip = new Vector3();
  private readonly scratchCrossbowRight = new Vector3();
  private readonly scratchCrossbowStockTip = new Vector3();

  public constructor(
    private readonly actorRoot: Group,
    private readonly sockets: ProceduralCharacterSocketReader,
    kind: ProceduralUnitKind,
    config: ProceduralCharacterConfig,
    meleeConfig: ProceduralMeleeConfig,
    meleeLibrary: ProceduralMeleeWeaponLibrary,
  ) {
    this.group.name = "procedural-unit-equipment";
    this.bow = new ProceduralBowEquipment(actorRoot, sockets);
    this.melee = new ProceduralMeleeEquipment(actorRoot, sockets, meleeLibrary);
    this.group.add(this.crossbow, this.bow.group);
    actorRoot.add(this.group);
    this.update(kind, config, meleeConfig);
  }

  public update(
    kind: ProceduralUnitKind,
    config: ProceduralCharacterConfig,
    meleeConfig: ProceduralMeleeConfig,
    meleePose?: ProceduralMeleeUpperBodyPose,
    archerConfig?: ProceduralArcherConfig,
    archerPose?: ProceduralArcherUpperBodyPose,
  ): void {
    this.crossbow.visible = kind === "crossbowman";
    this.bow.setVisible(kind === "archer");
    this.melee.update(kind, meleeConfig, config, meleePose);
    this.scratchColor.set(config.primaryColor);
    this.accentMaterial.color.copy(this.scratchColor);
    this.metalMaterial.emissive.copy(this.scratchColor).multiplyScalar(config.runeGlow * 0.08);
    this.metalMaterial.wireframe = config.wireframe;
    this.accentMaterial.wireframe = config.wireframe;
    if (kind === "horse") return;

    if (kind === "crossbowman") this.updateCrossbowGrip();
    if (kind === "archer" && archerConfig && archerPose) this.bow.update(config, archerConfig, archerPose);
  }

  public writeArcherReleaseTransform(outPosition: Vector3, outDirection: Vector3): boolean {
    return this.bow.writeReleaseTransform(outPosition, outDirection);
  }

  public writeMeleeWeaponTipWorldPosition(outPosition: Vector3): boolean {
    return this.melee.writeWeaponTipWorldPosition(outPosition);
  }

  public getArcherStats(): ProceduralBowEquipmentStats {
    return this.bow.getStats();
  }

  public getArcherPoseDiagnostics(): ProceduralBowPoseDiagnostics {
    return this.bow.getPoseDiagnostics();
  }

  public getMeleeStats(): ProceduralMeleeEquipmentStats {
    return this.melee.getStats();
  }

  public getMeleePoseDiagnostics(): ProceduralMeleePoseDiagnostics | null {
    return this.melee.getPoseDiagnostics();
  }

  public getCrossbowPoseDiagnostics(): ProceduralCrossbowPoseDiagnostics | null {
    if (!this.crossbow.visible) return null;
    this.crossbow.updateWorldMatrix(true, true);
    this.crossbow.getWorldPosition(this.scratchCrossbowCenter);
    this.crossbow.localToWorld(this.scratchCrossbowLeftGrip.copy(CROSSBOW_LEFT_GRIP));
    this.crossbow.localToWorld(this.scratchCrossbowLeft.set(-0.36, 0, 0.2));
    this.crossbow.localToWorld(this.scratchCrossbowRightGrip.copy(CROSSBOW_RIGHT_GRIP));
    this.crossbow.localToWorld(this.scratchCrossbowRight.set(0.36, 0, 0.2));
    this.crossbow.localToWorld(this.scratchCrossbowStockTip.set(0, 0, 0.32));
    return {
      centerWorld: toTuple(this.scratchCrossbowCenter),
      leftGripWorld: toTuple(this.scratchCrossbowLeftGrip),
      leftLimbWorld: toTuple(this.scratchCrossbowLeft),
      rightGripWorld: toTuple(this.scratchCrossbowRightGrip),
      rightLimbWorld: toTuple(this.scratchCrossbowRight),
      span: round(this.scratchCrossbowLeft.distanceTo(this.scratchCrossbowRight)),
      stockTipWorld: toTuple(this.scratchCrossbowStockTip),
    };
  }

  public reset(): void {
    this.bow.reset();
  }

  public dispose(): void {
    this.metalMaterial.dispose();
    this.accentMaterial.dispose();
    this.bow.dispose();
    this.melee.dispose();
    this.group.clear();
    this.group.removeFromParent();
    releaseEquipmentResources();
  }

  private updateCrossbowGrip(): void {
    if (
      !this.sockets.writeSocketWorldTransform("gripRight", this.scratchWorldPosition, this.scratchWorldQuaternion) ||
      !this.sockets.writeSocketWorldTransform("gripLeft", this.scratchSecondPosition, this.scratchWorldQuaternion)
    ) {
      return;
    }
    this.actorRoot.updateWorldMatrix(true, true);
    this.actorRoot.worldToLocal(this.scratchWorldPosition);
    this.actorRoot.worldToLocal(this.scratchSecondPosition);
    this.scratchCrossbowXAxis.copy(this.scratchSecondPosition).sub(this.scratchWorldPosition).normalize();
    this.scratchCrossbowZAxis
      .copy(LOCAL_Z)
      .addScaledVector(this.scratchCrossbowXAxis, -LOCAL_Z.dot(this.scratchCrossbowXAxis));
    if (this.scratchCrossbowZAxis.lengthSq() < 1e-8) this.scratchCrossbowZAxis.set(0, 0, 1);
    else this.scratchCrossbowZAxis.normalize();
    this.scratchCrossbowYAxis.crossVectors(this.scratchCrossbowZAxis, this.scratchCrossbowXAxis).normalize();
    this.scratchCrossbowMatrix.makeBasis(
      this.scratchCrossbowXAxis,
      this.scratchCrossbowYAxis,
      this.scratchCrossbowZAxis,
    );
    this.crossbow.position.copy(this.scratchWorldPosition).add(this.scratchSecondPosition).multiplyScalar(0.5);
    this.crossbow.quaternion.setFromRotationMatrix(this.scratchCrossbowMatrix);
    const handSpan = this.scratchWorldPosition.distanceTo(this.scratchSecondPosition);
    const authoredGripSpan = CROSSBOW_LEFT_GRIP.distanceTo(CROSSBOW_RIGHT_GRIP);
    this.crossbow.scale.setScalar(Math.min(2, Math.max(0.8, handSpan / authoredGripSpan)));
  }
}

interface EquipmentResources {
  crossLimb: BoxGeometry;
  crossbowGrip: CylinderGeometry;
  stock: BoxGeometry;
}

let sharedResources: EquipmentResources | undefined;
let sharedReferenceCount = 0;

function acquireEquipmentResources(): EquipmentResources {
  sharedReferenceCount += 1;
  sharedResources ??= {
    crossLimb: new BoxGeometry(0.72, 0.045, 0.055),
    crossbowGrip: new CylinderGeometry(0.018, 0.024, 0.14, 7),
    stock: new BoxGeometry(0.055, 0.72, 0.035),
  };
  return sharedResources;
}

function releaseEquipmentResources(): void {
  sharedReferenceCount = Math.max(0, sharedReferenceCount - 1);
  if (sharedReferenceCount > 0 || !sharedResources) return;
  Object.values(sharedResources).forEach((geometry) => geometry.dispose());
  sharedResources = undefined;
}

function createCrossbow(
  resources: EquipmentResources,
  metalMaterial: MeshStandardMaterial,
  accentMaterial: MeshStandardMaterial,
): Group {
  const group = new Group();
  const stock = new Mesh(resources.stock, accentMaterial);
  const limb = new Mesh(resources.crossLimb, metalMaterial);
  const leftGrip = new Mesh(resources.crossbowGrip, accentMaterial);
  const rightGrip = new Mesh(resources.crossbowGrip, accentMaterial);
  stock.scale.set(0.8, 0.65, 1.25);
  stock.rotation.x = Math.PI / 2;
  limb.position.z = 0.2;
  leftGrip.position.copy(CROSSBOW_LEFT_GRIP);
  rightGrip.position.copy(CROSSBOW_RIGHT_GRIP);
  stock.castShadow = true;
  limb.castShadow = true;
  leftGrip.castShadow = true;
  rightGrip.castShadow = true;
  group.add(stock, limb, leftGrip, rightGrip);
  return group;
}

function toTuple(vector: Readonly<Vector3>): readonly [number, number, number] {
  return [round(vector.x), round(vector.y), round(vector.z)];
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
