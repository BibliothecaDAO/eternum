import { TroopTier } from "@bibliothecadao/types";
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  TorusGeometry,
  Vector3,
} from "three";

export interface MeleeImpactSpawn {
  direction: Readonly<Vector3>;
  target: Readonly<Vector3>;
  tier: TroopTier;
}

export interface MeleeImpactSystemStats {
  activeCount: number;
  capacity: number;
  droppedCount: number;
  spawnedCount: number;
}

interface MeleeImpactEntry {
  active: boolean;
  direction: Vector3;
  elapsedSeconds: number;
  position: Vector3;
  tier: TroopTier;
}

const IMPACT_SECONDS = 0.42;
const FORWARD = new Vector3(0, 0, 1);
const TIER_ONE_COLOR = new Color(0xffc277);
const TIER_TWO_COLOR = new Color(0xc5e4ed);
const TIER_THREE_COLOR = new Color(0xd4a6ff);

/** Two-draw-call pool for crowd-scale melee contact flourishes. */
export class MeleeImpactSystem {
  public readonly group = new Group();

  private readonly slashGeometry = new TorusGeometry(0.42, 0.035, 5, 22, Math.PI * 1.35);
  private readonly impactGeometry = new RingGeometry(0.07, 0.22, 16);
  private readonly slashMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.84, vertexColors: true });
  private readonly impactMaterial = new MeshBasicMaterial({
    depthWrite: false,
    transparent: true,
    opacity: 0.72,
    side: DoubleSide,
    vertexColors: true,
  });
  private readonly slashMesh: InstancedMesh;
  private readonly impactMesh: InstancedMesh;
  private readonly entries: MeleeImpactEntry[];
  private readonly matrix = new Matrix4();
  private readonly quaternion = new Quaternion();
  private readonly spinQuaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly color = new Color();
  private spawnedCount = 0;
  private droppedCount = 0;
  private disposed = false;

  public constructor(private readonly capacity = 128) {
    this.group.name = "melee-impact-system";
    this.slashMesh = new InstancedMesh(this.slashGeometry, this.slashMaterial, capacity);
    this.impactMesh = new InstancedMesh(this.impactGeometry, this.impactMaterial, capacity);
    this.slashMesh.name = "melee-slash-arcs";
    this.impactMesh.name = "melee-contact-rings";
    this.slashMesh.frustumCulled = false;
    this.impactMesh.frustumCulled = false;
    this.entries = Array.from({ length: capacity }, () => ({
      active: false,
      direction: new Vector3(0, 0, 1),
      elapsedSeconds: 0,
      position: new Vector3(),
      tier: TroopTier.T1,
    }));
    this.group.add(this.slashMesh, this.impactMesh);
    this.hideInactiveInstances();
  }

  public spawn(input: MeleeImpactSpawn): boolean {
    if (this.disposed) return false;
    const entry = this.entries.find(({ active }) => !active);
    if (!entry) {
      this.droppedCount += 1;
      return false;
    }
    entry.active = true;
    entry.elapsedSeconds = 0;
    entry.position.copy(input.target);
    entry.position.y += 0.68;
    entry.direction.copy(input.direction);
    if (entry.direction.lengthSq() < 1e-8) entry.direction.set(0, 0, 1);
    else entry.direction.normalize();
    entry.tier = input.tier;
    this.spawnedCount += 1;
    return true;
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    const elapsed = Number.isFinite(deltaSeconds) ? Math.min(Math.max(0, deltaSeconds), 0.1) : 0;
    this.entries.forEach((entry, index) => this.updateEntry(entry, index, elapsed));
    this.slashMesh.instanceMatrix.needsUpdate = true;
    this.impactMesh.instanceMatrix.needsUpdate = true;
    if (this.slashMesh.instanceColor) this.slashMesh.instanceColor.needsUpdate = true;
    if (this.impactMesh.instanceColor) this.impactMesh.instanceColor.needsUpdate = true;
  }

  public getStats(): MeleeImpactSystemStats {
    return {
      activeCount: this.entries.filter(({ active }) => active).length,
      capacity: this.capacity,
      droppedCount: this.droppedCount,
      spawnedCount: this.spawnedCount,
    };
  }

  public reset(): void {
    this.entries.forEach((entry) => {
      entry.active = false;
      entry.elapsedSeconds = 0;
    });
    this.spawnedCount = 0;
    this.droppedCount = 0;
    this.hideInactiveInstances();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.slashGeometry.dispose();
    this.impactGeometry.dispose();
    this.slashMaterial.dispose();
    this.impactMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
  }

  private updateEntry(entry: MeleeImpactEntry, index: number, deltaSeconds: number): void {
    if (!entry.active) return;
    entry.elapsedSeconds += deltaSeconds;
    const progress = Math.min(1, entry.elapsedSeconds / IMPACT_SECONDS);
    if (progress >= 1) {
      entry.active = false;
      this.hideInstance(index);
      return;
    }

    const intensity = 1 - progress;
    this.quaternion.setFromUnitVectors(FORWARD, entry.direction);
    this.scale.setScalar((0.55 + progress * 0.85) * resolveTierScale(entry.tier));
    this.matrix.compose(entry.position, this.quaternion, this.scale);
    this.slashMesh.setMatrixAt(index, this.matrix);
    this.quaternion.multiply(this.spinQuaternion.setFromAxisAngle(FORWARD, progress * Math.PI));
    this.scale.setScalar((0.45 + progress * 1.4) * resolveTierScale(entry.tier));
    this.matrix.compose(entry.position, this.quaternion, this.scale);
    this.impactMesh.setMatrixAt(index, this.matrix);
    this.color.copy(resolveTierColor(entry.tier)).multiplyScalar(Math.max(0.08, intensity));
    this.slashMesh.setColorAt(index, this.color);
    this.impactMesh.setColorAt(index, this.color);
  }

  private hideInactiveInstances(): void {
    this.entries.forEach((_entry, index) => this.hideInstance(index));
    this.slashMesh.instanceMatrix.needsUpdate = true;
    this.impactMesh.instanceMatrix.needsUpdate = true;
  }

  private hideInstance(index: number): void {
    this.scale.setScalar(0);
    this.matrix.compose(this.group.position, this.group.quaternion, this.scale);
    this.slashMesh.setMatrixAt(index, this.matrix);
    this.impactMesh.setMatrixAt(index, this.matrix);
  }
}

function resolveTierScale(tier: TroopTier): number {
  if (tier === TroopTier.T3) return 1.24;
  if (tier === TroopTier.T2) return 1.1;
  return 1;
}

function resolveTierColor(tier: TroopTier): Color {
  if (tier === TroopTier.T3) return TIER_THREE_COLOR;
  if (tier === TroopTier.T2) return TIER_TWO_COLOR;
  return TIER_ONE_COLOR;
}
