import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Matrix4,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

import type { ProceduralCharacterConfig } from "../procedural-character-config";
import type { ProceduralCharacterSocketReader } from "../procedural-character-sockets";
import type { ProceduralArcherConfig } from "./procedural-archer-config";
import type { ProceduralArcherUpperBodyPose } from "./procedural-archer-pose";

export interface ProceduralBowEquipmentStats {
  previewArrowVisible: boolean;
  stringContinuityError: number;
}

export interface ProceduralBowPoseDiagnostics {
  arrowDirectionWorld: readonly [number, number, number];
  bowGripWorld: readonly [number, number, number];
  lowerTipWorld: readonly [number, number, number];
  nockWorld: readonly [number, number, number];
  previewArrowVisible: boolean;
  upperTipWorld: readonly [number, number, number];
}

interface BowResources {
  arrowHead: ConeGeometry;
  arrowShaft: CylinderGeometry;
  bowSegment: CylinderGeometry;
  fletching: BoxGeometry;
  grip: CylinderGeometry;
  quiver: CylinderGeometry;
  socketMarker: SphereGeometry;
  string: CylinderGeometry;
}

const LOCAL_FORWARD = new Vector3(0, 0, 1);
const LOCAL_UP = new Vector3(0, 1, 0);
const ARROW_LENGTH = 0.94;

export class ProceduralBowEquipment {
  public readonly group = new Group();

  private readonly resources = acquireBowResources();
  private readonly woodMaterial = new MeshStandardMaterial({ color: 0x6f4528, metalness: 0.06, roughness: 0.72 });
  private readonly accentMaterial = new MeshStandardMaterial({ color: 0x315f86, metalness: 0.3, roughness: 0.5 });
  private readonly stringMaterial = new MeshStandardMaterial({ color: 0xd8cba9, roughness: 0.9 });
  private readonly arrowMaterial = new MeshStandardMaterial({ color: 0x8f6844, roughness: 0.75 });
  private readonly metalMaterial = new MeshStandardMaterial({ color: 0xb7bec8, metalness: 0.85, roughness: 0.28 });
  private readonly bow = new Group();
  private readonly quiver = new Group();
  private readonly previewArrow = new Group();
  private readonly debugSockets = new Group();
  private readonly crowdBowPositions = new Float32Array(14 * 3);
  private readonly crowdBowGeometry = new BufferGeometry();
  private readonly crowdBowMaterial = new LineBasicMaterial({ color: 0x9c7653 });
  private readonly crowdBow: LineSegments;
  private readonly upperInner: Mesh;
  private readonly upperOuter: Mesh;
  private readonly lowerInner: Mesh;
  private readonly lowerOuter: Mesh;
  private readonly upperString: Mesh;
  private readonly lowerString: Mesh;
  private readonly grip: Mesh;
  private readonly scratchHandPosition = new Vector3();
  private readonly scratchDrawHandPosition = new Vector3();
  private readonly scratchQuiverPosition = new Vector3();
  private readonly scratchSocketQuaternion = new Quaternion();
  private readonly scratchInverseRootQuaternion = new Quaternion();
  private readonly scratchForward = new Vector3();
  private readonly scratchRight = new Vector3();
  private readonly scratchUp = new Vector3();
  private readonly scratchMatrix = new Matrix4();
  private readonly scratchPointA = new Vector3();
  private readonly scratchPointB = new Vector3();
  private readonly scratchNock = new Vector3();
  private readonly scratchLowerMid = new Vector3();
  private readonly scratchLowerTip = new Vector3();
  private readonly scratchSegmentDirection = new Vector3();
  private readonly scratchArrowDirection = new Vector3();
  private readonly scratchCant = new Quaternion();
  private readonly scratchQuiverCorrection = new Quaternion();
  private readonly scratchColor = new Color();
  private readonly cachedReleasePosition = new Vector3();
  private readonly cachedReleaseDirection = new Vector3();
  private readonly scratchDiagnosticGrip = new Vector3();
  private readonly scratchDiagnosticNock = new Vector3();
  private readonly scratchDiagnosticUpperTip = new Vector3();
  private readonly scratchDiagnosticLowerTip = new Vector3();
  private readonly scratchDiagnosticArrowDirection = new Vector3();
  private stringContinuityError = 0;
  private previewArrowOwned = false;
  private hasCachedReleaseTransform = false;

  public constructor(
    private readonly actorRoot: Group,
    private readonly sockets: ProceduralCharacterSocketReader,
  ) {
    this.group.name = "procedural-archer-equipment";
    this.bow.name = "procedural-longbow";
    this.quiver.name = "procedural-archer-quiver";
    this.previewArrow.name = "procedural-archer-preview-arrow";
    this.upperInner = new Mesh(this.resources.bowSegment, this.woodMaterial);
    this.upperOuter = new Mesh(this.resources.bowSegment, this.woodMaterial);
    this.lowerInner = new Mesh(this.resources.bowSegment, this.woodMaterial);
    this.lowerOuter = new Mesh(this.resources.bowSegment, this.woodMaterial);
    this.upperString = new Mesh(this.resources.string, this.stringMaterial);
    this.lowerString = new Mesh(this.resources.string, this.stringMaterial);
    this.grip = new Mesh(this.resources.grip, this.accentMaterial);
    const crowdBowAttribute = new Float32BufferAttribute(this.crowdBowPositions, 3);
    crowdBowAttribute.setUsage(DynamicDrawUsage);
    this.crowdBowGeometry.setAttribute("position", crowdBowAttribute);
    this.crowdBow = new LineSegments(this.crowdBowGeometry, this.crowdBowMaterial);
    this.crowdBow.name = "procedural-longbow-crowd-lod";
    this.crowdBow.frustumCulled = false;
    this.bow.add(
      this.upperInner,
      this.upperOuter,
      this.lowerInner,
      this.lowerOuter,
      this.upperString,
      this.lowerString,
      this.grip,
      this.previewArrow,
      this.debugSockets,
      this.crowdBow,
    );
    for (let index = 0; index < 3; index += 1)
      this.debugSockets.add(new Mesh(this.resources.socketMarker, this.accentMaterial));
    this.createPreviewArrow();
    this.createQuiver();
    this.group.add(this.bow, this.quiver);
    this.group.visible = false;
  }

  public update(
    characterConfig: ProceduralCharacterConfig,
    archerConfig: ProceduralArcherConfig,
    pose: ProceduralArcherUpperBodyPose,
  ): void {
    this.group.visible = true;
    this.updateStyle(characterConfig);
    this.placeBow(pose);
    this.placeQuiver();
    this.updateBowShape(archerConfig, pose);
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public writeReleaseTransform(outPosition: Vector3, outDirection: Vector3): boolean {
    if (!this.group.visible || !this.hasCachedReleaseTransform) return false;
    outPosition.copy(this.cachedReleasePosition);
    outDirection.copy(this.cachedReleaseDirection);
    return true;
  }

  public getStats(): ProceduralBowEquipmentStats {
    return { previewArrowVisible: this.previewArrowOwned, stringContinuityError: this.stringContinuityError };
  }

  public getPoseDiagnostics(): ProceduralBowPoseDiagnostics {
    this.bow.updateWorldMatrix(true, true);
    this.bow.getWorldPosition(this.scratchDiagnosticGrip);
    this.bow.localToWorld(this.scratchDiagnosticNock.copy(this.scratchNock));
    this.bow.localToWorld(this.scratchDiagnosticUpperTip.copy(this.scratchPointB));
    this.bow.localToWorld(this.scratchDiagnosticLowerTip.copy(this.scratchLowerTip));
    this.scratchDiagnosticArrowDirection
      .copy(this.scratchArrowDirection)
      .transformDirection(this.bow.matrixWorld)
      .normalize();
    return {
      arrowDirectionWorld: toVectorTuple(this.scratchDiagnosticArrowDirection),
      bowGripWorld: toVectorTuple(this.scratchDiagnosticGrip),
      lowerTipWorld: toVectorTuple(this.scratchDiagnosticLowerTip),
      nockWorld: toVectorTuple(this.scratchDiagnosticNock),
      previewArrowVisible: this.previewArrowOwned,
      upperTipWorld: toVectorTuple(this.scratchDiagnosticUpperTip),
    };
  }

  public reset(): void {
    this.previewArrow.visible = false;
    this.previewArrowOwned = false;
    this.hasCachedReleaseTransform = false;
    this.stringContinuityError = 0;
  }

  public dispose(): void {
    this.woodMaterial.dispose();
    this.accentMaterial.dispose();
    this.stringMaterial.dispose();
    this.arrowMaterial.dispose();
    this.metalMaterial.dispose();
    this.crowdBowGeometry.dispose();
    this.crowdBowMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
    releaseBowResources();
  }

  private createPreviewArrow(): void {
    const shaft = new Mesh(this.resources.arrowShaft, this.arrowMaterial);
    shaft.rotation.x = Math.PI / 2;
    const head = new Mesh(this.resources.arrowHead, this.metalMaterial);
    head.rotation.x = Math.PI / 2;
    head.position.z = ARROW_LENGTH * 0.5 + 0.045;
    const fletchingA = new Mesh(this.resources.fletching, this.accentMaterial);
    const fletchingB = new Mesh(this.resources.fletching, this.accentMaterial);
    fletchingA.position.z = -ARROW_LENGTH * 0.42;
    fletchingB.position.copy(fletchingA.position);
    fletchingB.rotation.z = Math.PI / 2;
    this.previewArrow.add(shaft, head, fletchingA, fletchingB);
  }

  private createQuiver(): void {
    const body = new Mesh(this.resources.quiver, this.accentMaterial);
    body.rotation.z = -0.22;
    body.castShadow = true;
    this.quiver.add(body);
    for (let index = 0; index < 3; index += 1) {
      const arrow = new Mesh(this.resources.arrowShaft, this.arrowMaterial);
      arrow.scale.setScalar(0.62);
      arrow.position.set((index - 1) * 0.055, 0.25 + index * 0.018, 0);
      this.quiver.add(arrow);
    }
  }

  private updateStyle(config: ProceduralCharacterConfig): void {
    const heraldry = this.scratchColor.set(config.primaryColor);
    this.accentMaterial.color.copy(heraldry);
    this.accentMaterial.emissive.copy(heraldry);
    this.accentMaterial.emissiveIntensity = config.runeGlow * 0.08;
    this.woodMaterial.color.set(config.tier === 3 ? 0x4b3342 : config.tier === 2 ? 0x614832 : 0x744b2c);
    this.woodMaterial.emissive.copy(heraldry);
    this.woodMaterial.emissiveIntensity = config.tier === 3 ? config.runeGlow * 0.1 : 0;
    this.woodMaterial.wireframe = config.wireframe;
    this.accentMaterial.wireframe = config.wireframe;
    this.stringMaterial.wireframe = config.wireframe;
    this.arrowMaterial.wireframe = config.wireframe;
    this.metalMaterial.wireframe = config.wireframe;
    this.crowdBowMaterial.color.copy(heraldry).lerp(this.woodMaterial.color, 0.45);
  }

  private placeBow(pose: ProceduralArcherUpperBodyPose): void {
    if (!this.sockets.writeSocketWorldTransform("gripLeft", this.scratchHandPosition, this.scratchSocketQuaternion)) {
      return;
    }
    this.actorRoot.worldToLocal(this.scratchHandPosition);
    this.bow.position.copy(this.scratchHandPosition);
    this.scratchForward
      .set(
        Math.sin(pose.aimYawRadians) * Math.cos(pose.aimPitchRadians),
        Math.sin(pose.aimPitchRadians),
        Math.cos(pose.aimYawRadians) * Math.cos(pose.aimPitchRadians),
      )
      .normalize();
    this.scratchRight.crossVectors(LOCAL_UP, this.scratchForward).normalize();
    this.scratchUp.crossVectors(this.scratchForward, this.scratchRight).normalize();
    this.scratchCant.setFromAxisAngle(this.scratchForward, pose.bowCantRadians);
    this.scratchRight.applyQuaternion(this.scratchCant);
    this.scratchUp.applyQuaternion(this.scratchCant);
    this.scratchMatrix.makeBasis(this.scratchRight, this.scratchUp, this.scratchForward);
    this.bow.quaternion.setFromRotationMatrix(this.scratchMatrix);
  }

  private placeQuiver(): void {
    if (!this.sockets.writeSocketWorldTransform("quiver", this.scratchQuiverPosition, this.scratchSocketQuaternion)) {
      return;
    }
    this.actorRoot.worldToLocal(this.scratchQuiverPosition);
    this.actorRoot.getWorldQuaternion(this.scratchInverseRootQuaternion).invert();
    this.quiver.position.copy(this.scratchQuiverPosition);
    this.quiver.quaternion
      .copy(this.scratchSocketQuaternion)
      .premultiply(this.scratchInverseRootQuaternion)
      .multiply(this.scratchQuiverCorrection.setFromAxisAngle(LOCAL_FORWARD, -0.24));
  }

  private updateBowShape(config: ProceduralArcherConfig, pose: ProceduralArcherUpperBodyPose): void {
    const halfHeight = pose.bowHeight * 0.5;
    const bend = pose.bowBend * pose.drawFraction;
    const upperMid = this.scratchPointA.set(0, halfHeight * 0.52, -bend * 0.34);
    const upperTip = this.scratchPointB.set(0, halfHeight, -bend);
    this.setCylinderBetween(this.upperInner, ZERO_VECTOR, upperMid, 1);
    this.setCylinderBetween(this.upperOuter, upperMid, upperTip, 0.82);

    const lowerMid = this.scratchLowerMid.set(0, -halfHeight * 0.52, -bend * 0.34);
    const lowerTip = this.scratchLowerTip.set(0, -halfHeight, -bend);
    this.setCylinderBetween(this.lowerInner, ZERO_VECTOR, lowerMid, 1);
    this.setCylinderBetween(this.lowerOuter, lowerMid, lowerTip, 0.82);

    const nock = this.scratchNock.set(0, 0, -pose.drawLength * pose.drawFraction);
    if (
      pose.previewArrowVisible &&
      this.sockets.writeSocketWorldTransform("drawRight", this.scratchDrawHandPosition, this.scratchSocketQuaternion)
    ) {
      this.bow.worldToLocal(this.scratchDrawHandPosition);
      nock.copy(this.scratchDrawHandPosition);
    }
    this.setCylinderBetween(this.upperString, upperTip, nock, 1);
    this.setCylinderBetween(this.lowerString, nock, lowerTip, 1);
    this.previewArrowOwned = pose.previewArrowVisible;
    this.scratchArrowDirection.copy(nock).negate();
    if (this.scratchArrowDirection.lengthSq() < 1e-8) this.scratchArrowDirection.copy(LOCAL_FORWARD);
    else this.scratchArrowDirection.normalize();
    this.previewArrow.position.copy(nock).addScaledVector(this.scratchArrowDirection, ARROW_LENGTH * 0.5);
    this.previewArrow.quaternion.setFromUnitVectors(LOCAL_FORWARD, this.scratchArrowDirection);
    if (pose.previewArrowVisible) this.cacheReleaseTransform();
    this.stringContinuityError = 0;
    this.setEquipmentDetail(config.detailedEquipment, pose.previewArrowVisible);
    this.debugSockets.visible = config.detailedEquipment && config.showSockets;
    this.debugSockets.children[0]?.position.copy(upperTip);
    this.debugSockets.children[1]?.position.copy(nock);
    this.debugSockets.children[2]?.position.copy(lowerTip);
    this.writeCrowdBow(upperMid, upperTip, lowerMid, lowerTip, nock, pose.previewArrowVisible);
  }

  private cacheReleaseTransform(): void {
    this.bow.updateWorldMatrix(true, true);
    this.previewArrow.getWorldPosition(this.cachedReleasePosition);
    this.previewArrow.updateWorldMatrix(true, false);
    this.cachedReleaseDirection.copy(LOCAL_FORWARD).transformDirection(this.previewArrow.matrixWorld).normalize();
    this.hasCachedReleaseTransform =
      this.cachedReleasePosition.toArray().every(Number.isFinite) &&
      this.cachedReleaseDirection.toArray().every(Number.isFinite);
  }

  private setEquipmentDetail(detailed: boolean, previewArrowVisible: boolean): void {
    this.upperInner.visible = detailed;
    this.upperOuter.visible = detailed;
    this.lowerInner.visible = detailed;
    this.lowerOuter.visible = detailed;
    this.upperString.visible = detailed;
    this.lowerString.visible = detailed;
    this.grip.visible = detailed;
    this.previewArrow.visible = detailed && previewArrowVisible;
    this.quiver.visible = detailed;
    this.crowdBow.visible = !detailed;
  }

  private writeCrowdBow(
    upperMid: Readonly<Vector3>,
    upperTip: Readonly<Vector3>,
    lowerMid: Readonly<Vector3>,
    lowerTip: Readonly<Vector3>,
    nock: Readonly<Vector3>,
    previewArrowVisible: boolean,
  ): void {
    let offset = 0;
    offset = writeLineSegment(this.crowdBowPositions, offset, ZERO_VECTOR, upperMid);
    offset = writeLineSegment(this.crowdBowPositions, offset, upperMid, upperTip);
    offset = writeLineSegment(this.crowdBowPositions, offset, ZERO_VECTOR, lowerMid);
    offset = writeLineSegment(this.crowdBowPositions, offset, lowerMid, lowerTip);
    offset = writeLineSegment(this.crowdBowPositions, offset, upperTip, nock);
    offset = writeLineSegment(this.crowdBowPositions, offset, nock, lowerTip);
    this.scratchSegmentDirection.copy(nock);
    if (previewArrowVisible) this.scratchSegmentDirection.addScaledVector(this.scratchArrowDirection, ARROW_LENGTH);
    writeLineSegment(this.crowdBowPositions, offset, nock, this.scratchSegmentDirection);
    this.crowdBowGeometry.getAttribute("position").needsUpdate = true;
  }

  private setCylinderBetween(mesh: Mesh, from: Readonly<Vector3>, to: Readonly<Vector3>, thickness: number): void {
    this.scratchSegmentDirection.copy(to).sub(from);
    const length = Math.max(1e-5, this.scratchSegmentDirection.length());
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(LOCAL_UP, this.scratchSegmentDirection.multiplyScalar(1 / length));
    mesh.scale.set(thickness, length, thickness);
    mesh.castShadow = true;
  }
}

let sharedBowResources: BowResources | undefined;
let sharedBowReferenceCount = 0;

function acquireBowResources(): BowResources {
  sharedBowReferenceCount += 1;
  sharedBowResources ??= {
    arrowHead: new ConeGeometry(0.035, 0.1, 5),
    arrowShaft: new CylinderGeometry(0.012, 0.012, ARROW_LENGTH, 6),
    bowSegment: new CylinderGeometry(0.018, 0.027, 1, 7),
    fletching: new BoxGeometry(0.06, 0.012, 0.15),
    grip: new CylinderGeometry(0.036, 0.032, 0.22, 7),
    quiver: new CylinderGeometry(0.095, 0.125, 0.64, 8, 1, true),
    socketMarker: new SphereGeometry(0.035, 8, 6),
    string: new CylinderGeometry(0.006, 0.006, 1, 5),
  };
  return sharedBowResources;
}

function releaseBowResources(): void {
  sharedBowReferenceCount = Math.max(0, sharedBowReferenceCount - 1);
  if (sharedBowReferenceCount > 0 || !sharedBowResources) return;
  Object.values(sharedBowResources).forEach((geometry) => geometry.dispose());
  sharedBowResources = undefined;
}

const ZERO_VECTOR = new Vector3();

function writeLineSegment(
  positions: Float32Array,
  offset: number,
  from: Readonly<Vector3>,
  to: Readonly<Vector3>,
): number {
  positions[offset] = from.x;
  positions[offset + 1] = from.y;
  positions[offset + 2] = from.z;
  positions[offset + 3] = to.x;
  positions[offset + 4] = to.y;
  positions[offset + 5] = to.z;
  return offset + 6;
}

function toVectorTuple(vector: Readonly<Vector3>): readonly [number, number, number] {
  return [round(vector.x), round(vector.y), round(vector.z)];
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
