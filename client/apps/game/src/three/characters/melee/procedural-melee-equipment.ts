import {
  AxesHelper,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import type { ProceduralCharacterConfig } from "../procedural-character-config";
import type { ProceduralCharacterSocketReader } from "../procedural-character-sockets";
import type { ProceduralUnitKind } from "../procedural-unit-config";
import type { ProceduralMeleeConfig } from "./procedural-melee-config";
import type { ProceduralMeleeUpperBodyPose } from "./procedural-melee-pose";
import { mergeStaticEquipmentGeometry } from "../merge-static-equipment-geometry";
import {
  resolveProceduralMeleeOffhand,
  resolveProceduralMeleeWeapon,
  type ProceduralMeleeOffhandId,
  type ProceduralMeleeWeaponId,
} from "./procedural-melee-weapon-catalog";
import { ProceduralMeleeWeaponLibrary, type ProceduralMeleeEquipmentSource } from "./procedural-melee-weapon-library";

export interface ProceduralMeleeEquipmentStats {
  offhandId: ProceduralMeleeOffhandId;
  offhandSource: ProceduralMeleeEquipmentSource | "none";
  weaponId: ProceduralMeleeWeaponId;
  weaponSource: ProceduralMeleeEquipmentSource;
}

export interface ProceduralMeleePoseDiagnostics extends ProceduralMeleeEquipmentStats {
  offhandGripWorld: readonly [number, number, number] | null;
  offhandWorld: readonly [number, number, number] | null;
  weaponGripWorld: readonly [number, number, number];
  weaponTipWorld: readonly [number, number, number];
}

const LOCAL_Y_AXIS = new Vector3(0, 1, 0);
const CARRY_DIRECTION = new Vector3(0, -0.96, 0.28).normalize();
const SLASH_WINDUP_DIRECTION = new Vector3(-0.46, 0.58, -0.68).normalize();
const OVERHEAD_WINDUP_DIRECTION = new Vector3(-0.38, 0.9, -0.2).normalize();
const SLASH_CONTACT_DIRECTION = new Vector3(0.46, -0.16, 0.88).normalize();
const GROUND_CONTACT_DIRECTION = new Vector3(0.08, -0.42, 0.78).normalize();
const MOUNTED_CONTACT_DIRECTION = new Vector3(0.08, -0.62, 0.78).normalize();
const SLASH_FOLLOW_DIRECTION = new Vector3(0.66, -0.64, 0.38).normalize();
const HEAVY_FOLLOW_DIRECTION = new Vector3(0.22, -0.84, 0.5).normalize();

/** Swappable melee visuals that follow the same authoritative hand sockets. */
export class ProceduralMeleeEquipment {
  public readonly group = new Group();

  private readonly resources = acquireMeleeEquipmentResources();
  private readonly metalMaterial = new MeshStandardMaterial({ color: 0xaab2c1, metalness: 0.82, roughness: 0.28 });
  private readonly accentMaterial = new MeshStandardMaterial({ color: 0x315f86, metalness: 0.25, roughness: 0.58 });
  private readonly scratchWorldPosition = new Vector3();
  private readonly scratchWorldQuaternion = new Quaternion();
  private readonly scratchInverseRootQuaternion = new Quaternion();
  private readonly scratchWeaponTip = new Vector3();
  private readonly scratchWeaponGrip = new Vector3();
  private readonly scratchOffhandPosition = new Vector3();
  private readonly scratchOffhandGrip = new Vector3();
  private readonly scratchWeaponDirection = new Vector3();
  private readonly scratchOffhandEuler = new Euler();
  private readonly leftSocketHelper = new AxesHelper(0.18);
  private readonly rightSocketHelper = new AxesHelper(0.18);
  private weapon = new Group();
  private offhand = new Group();
  private weaponId: ProceduralMeleeWeaponId = "iron-longsword";
  private offhandId: ProceduralMeleeOffhandId = "round-shield";
  private weaponSource: ProceduralMeleeEquipmentSource = "procedural";
  private offhandSource: ProceduralMeleeEquipmentSource | "none" = "procedural";
  private detailedEquipment = true;

  public constructor(
    private readonly actorRoot: Group,
    private readonly sockets: ProceduralCharacterSocketReader,
    private readonly library: ProceduralMeleeWeaponLibrary,
  ) {
    this.group.name = "procedural-melee-equipment";
    this.leftSocketHelper.name = "melee-left-hand-socket";
    this.rightSocketHelper.name = "melee-right-hand-socket";
    this.group.add(this.weapon, this.offhand, this.leftSocketHelper, this.rightSocketHelper);
    actorRoot.add(this.group);
    this.rebuildLoadout();
  }

  public update(
    kind: ProceduralUnitKind,
    melee: ProceduralMeleeConfig,
    character: ProceduralCharacterConfig,
    pose?: ProceduralMeleeUpperBodyPose,
  ): void {
    const visible = kind === "knight" || kind === "paladin";
    this.group.visible = visible;
    this.updateMaterials(character);
    this.leftSocketHelper.visible = visible && melee.showSockets;
    this.rightSocketHelper.visible = visible && melee.showSockets;
    if (!visible) return;

    const loadoutChanged =
      melee.weaponId !== this.weaponId ||
      melee.offhandId !== this.offhandId ||
      melee.detailedEquipment !== this.detailedEquipment ||
      this.hasReadyAssetUpgrade();
    if (loadoutChanged) {
      this.weaponId = melee.weaponId;
      this.offhandId = melee.offhandId;
      this.detailedEquipment = melee.detailedEquipment;
      this.rebuildLoadout();
    }
    this.actorRoot.updateWorldMatrix(true, true);
    this.actorRoot.getWorldQuaternion(this.scratchInverseRootQuaternion).invert();
    this.placeAtSocket(this.weapon, "gripRight");
    this.placeAtSocket(this.offhand, "gripLeft");
    this.orientLoadout(pose);
    this.placeAtSocket(this.rightSocketHelper, "gripRight");
    this.placeAtSocket(this.leftSocketHelper, "gripLeft");
  }

  public writeWeaponTipWorldPosition(outPosition: Vector3): boolean {
    if (!this.group.visible || !this.weapon.visible) return false;
    const visualLength = resolveProceduralMeleeWeapon(this.weaponId).visualLength;
    this.scratchWeaponTip.set(0, visualLength, 0);
    this.weapon.localToWorld(this.scratchWeaponTip);
    outPosition.copy(this.scratchWeaponTip);
    return (
      Number.isFinite(this.scratchWeaponTip.x) &&
      Number.isFinite(this.scratchWeaponTip.y) &&
      Number.isFinite(this.scratchWeaponTip.z)
    );
  }

  public getStats(): ProceduralMeleeEquipmentStats {
    return {
      offhandId: this.offhandId,
      offhandSource: this.offhandSource,
      weaponId: this.weaponId,
      weaponSource: this.weaponSource,
    };
  }

  public getPoseDiagnostics(): ProceduralMeleePoseDiagnostics | null {
    if (!this.group.visible || !this.weapon.visible) return null;
    this.actorRoot.updateWorldMatrix(true, true);
    this.weapon.getWorldPosition(this.scratchWeaponGrip);
    if (!this.writeWeaponTipWorldPosition(this.scratchWeaponTip)) return null;
    const offhandDefinition = resolveProceduralMeleeOffhand(this.offhandId);
    const offhandGripWorld = this.offhand.visible
      ? toTuple(this.offhand.getWorldPosition(this.scratchOffhandGrip))
      : null;
    const offhandWorld = this.offhand.visible
      ? toTuple(this.offhand.localToWorld(this.scratchOffhandPosition.fromArray(offhandDefinition.gripToCenter)))
      : null;
    return {
      ...this.getStats(),
      offhandGripWorld,
      offhandWorld,
      weaponGripWorld: toTuple(this.scratchWeaponGrip),
      weaponTipWorld: toTuple(this.scratchWeaponTip),
    };
  }

  public dispose(): void {
    this.metalMaterial.dispose();
    this.accentMaterial.dispose();
    this.leftSocketHelper.dispose();
    this.rightSocketHelper.dispose();
    this.group.clear();
    this.group.removeFromParent();
    releaseMeleeEquipmentResources();
  }

  private rebuildLoadout(): void {
    this.weapon.removeFromParent();
    this.offhand.removeFromParent();
    const weaponAsset = this.detailedEquipment ? this.library.instantiateWeapon(this.weaponId) : undefined;
    const offhandDefinition = resolveProceduralMeleeOffhand(this.offhandId);
    const offhandAsset = this.detailedEquipment ? this.library.instantiateOffhand(this.offhandId) : undefined;
    this.weapon =
      weaponAsset?.object ??
      createProceduralWeapon(
        this.resources,
        this.metalMaterial,
        resolveProceduralMeleeWeapon(this.weaponId).attackStyle,
      );
    this.offhand =
      this.offhandId === "none"
        ? new Group()
        : createShieldGripRoot(
            this.resources,
            this.metalMaterial,
            offhandAsset?.object ?? createProceduralShield(this.resources, this.accentMaterial),
            offhandDefinition.gripToCenter,
          );
    this.weaponSource = weaponAsset?.source ?? "procedural";
    this.offhandSource = this.offhandId === "none" ? "none" : (offhandAsset?.source ?? "procedural");
    this.weapon.visible = true;
    this.offhand.visible = this.offhandId !== "none";
    this.group.add(this.weapon, this.offhand);
  }

  private hasReadyAssetUpgrade(): boolean {
    if (!this.detailedEquipment) return false;
    const weaponReady = this.weaponSource === "procedural" && this.library.isWeaponReady(this.weaponId);
    const offhandReady = this.offhandSource === "procedural" && this.library.isOffhandReady(this.offhandId);
    return weaponReady || offhandReady;
  }

  private updateMaterials(config: ProceduralCharacterConfig): void {
    this.accentMaterial.color.set(config.primaryColor);
    this.metalMaterial.emissive.set(config.primaryColor).multiplyScalar(config.runeGlow * 0.08);
    this.metalMaterial.wireframe = config.wireframe;
    this.accentMaterial.wireframe = config.wireframe;
  }

  private orientLoadout(pose?: ProceduralMeleeUpperBodyPose): void {
    const windup = pose?.attackStyle === "slash" ? SLASH_WINDUP_DIRECTION : OVERHEAD_WINDUP_DIRECTION;
    const contact =
      pose?.attackStyle === "slash"
        ? SLASH_CONTACT_DIRECTION
        : pose?.mounted
          ? MOUNTED_CONTACT_DIRECTION
          : GROUND_CONTACT_DIRECTION;
    const follow = pose?.attackStyle === "slash" ? SLASH_FOLLOW_DIRECTION : HEAVY_FOLLOW_DIRECTION;
    this.scratchWeaponDirection.copy(CARRY_DIRECTION);
    if (pose) {
      this.scratchWeaponDirection.lerp(windup, pose.windupProgress);
      this.scratchWeaponDirection.lerp(contact, pose.strikeProgress);
      this.scratchWeaponDirection.lerp(follow, pose.followThrough);
      this.scratchWeaponDirection.applyAxisAngle(LOCAL_Y_AXIS, pose.aimYawRadians);
    }
    this.scratchWeaponDirection.normalize();
    this.weapon.quaternion.setFromUnitVectors(LOCAL_Y_AXIS, this.scratchWeaponDirection);
    this.scratchOffhandEuler.set(-0.08, pose?.aimYawRadians ?? 0, 0.06);
    this.offhand.quaternion.setFromEuler(this.scratchOffhandEuler);
  }

  private placeAtSocket(target: Group | AxesHelper, socketId: "gripLeft" | "gripRight"): void {
    if (!this.sockets.writeSocketWorldTransform(socketId, this.scratchWorldPosition, this.scratchWorldQuaternion)) {
      return;
    }
    this.actorRoot.worldToLocal(this.scratchWorldPosition);
    target.position.copy(this.scratchWorldPosition);
    target.quaternion.copy(this.scratchWorldQuaternion).premultiply(this.scratchInverseRootQuaternion).normalize();
  }
}

interface MeleeEquipmentResources {
  axeHead: BoxGeometry;
  axeWeapon: BufferGeometry;
  hammerHead: BoxGeometry;
  hammerWeapon: BufferGeometry;
  handle: CylinderGeometry;
  pommel: CylinderGeometry;
  shield: CylinderGeometry;
  shieldHandle: CylinderGeometry;
  swordBlade: BoxGeometry;
  swordGuard: BoxGeometry;
  swordHandle: CylinderGeometry;
  swordWeapon: BufferGeometry;
}

let sharedResources: MeleeEquipmentResources | undefined;
let sharedReferenceCount = 0;

function acquireMeleeEquipmentResources(): MeleeEquipmentResources {
  sharedReferenceCount += 1;
  if (sharedResources) return sharedResources;
  const resources = {
    axeHead: new BoxGeometry(0.3, 0.2, 0.07),
    hammerHead: new BoxGeometry(0.3, 0.18, 0.2),
    handle: new CylinderGeometry(0.025, 0.032, 0.78, 7),
    pommel: new CylinderGeometry(0.045, 0.035, 0.12, 7),
    shield: new CylinderGeometry(0.32, 0.32, 0.07, 12),
    shieldHandle: new CylinderGeometry(0.022, 0.022, 0.16, 7),
    swordBlade: new BoxGeometry(0.055, 0.72, 0.035),
    swordGuard: new BoxGeometry(0.27, 0.035, 0.055),
    swordHandle: new CylinderGeometry(0.026, 0.03, 0.22, 7),
  };
  sharedResources = {
    ...resources,
    axeWeapon: mergeStaticEquipmentGeometry([
      { geometry: resources.handle, transform: new Matrix4().makeTranslation(0, 0.3, 0) },
      { geometry: resources.axeHead, transform: new Matrix4().makeTranslation(0, 0.73, 0) },
    ]),
    hammerWeapon: mergeStaticEquipmentGeometry([
      { geometry: resources.handle, transform: new Matrix4().makeTranslation(0, 0.3, 0) },
      { geometry: resources.hammerHead, transform: new Matrix4().makeTranslation(0, 0.73, 0) },
    ]),
    swordWeapon: mergeStaticEquipmentGeometry([
      { geometry: resources.swordBlade, transform: new Matrix4().makeTranslation(0, 0.49, 0) },
      { geometry: resources.swordGuard, transform: new Matrix4().makeTranslation(0, 0.12, 0) },
      { geometry: resources.swordHandle, transform: new Matrix4() },
      { geometry: resources.pommel, transform: new Matrix4().makeTranslation(0, -0.15, 0) },
    ]),
  };
  return sharedResources;
}

function releaseMeleeEquipmentResources(): void {
  sharedReferenceCount = Math.max(0, sharedReferenceCount - 1);
  if (sharedReferenceCount > 0 || !sharedResources) return;
  Object.values(sharedResources).forEach((geometry) => geometry.dispose());
  sharedResources = undefined;
}

function createProceduralWeapon(
  resources: MeleeEquipmentResources,
  material: MeshStandardMaterial,
  attackStyle: "chop" | "slash" | "smash",
): Group {
  const group = new Group();
  const geometry =
    attackStyle === "slash"
      ? resources.swordWeapon
      : attackStyle === "smash"
        ? resources.hammerWeapon
        : resources.axeWeapon;
  const weapon = new Mesh(geometry, material);
  weapon.castShadow = true;
  group.add(weapon);
  group.rotation.x = Math.PI * 0.1;
  return group;
}

function createProceduralShield(resources: MeleeEquipmentResources, material: MeshStandardMaterial): Group {
  const group = new Group();
  const shield = new Mesh(resources.shield, material);
  shield.rotation.x = Math.PI / 2;
  shield.castShadow = true;
  group.add(shield);
  return group;
}

function createShieldGripRoot(
  resources: MeleeEquipmentResources,
  material: MeshStandardMaterial,
  shieldVisual: Group,
  gripToCenter: readonly [number, number, number],
): Group {
  const gripRoot = new Group();
  const handle = new Mesh(resources.shieldHandle, material);
  handle.castShadow = true;
  shieldVisual.position.fromArray(gripToCenter);
  gripRoot.add(shieldVisual, handle);
  return gripRoot;
}

function toTuple(vector: Readonly<Vector3>): readonly [number, number, number] {
  return [round(vector.x), round(vector.y), round(vector.z)];
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
