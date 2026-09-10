import { queueInstanceUpdate } from "../utils/instance-update-ranges";
import { createInstancedMesh } from "../utils/create-instanced-mesh";
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
    forceSinglePass: true,
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
  private activeCount = 0;
  private spawnedCount = 0;
  private droppedCount = 0;
  private disposed = false;

  public constructor(private readonly capacity = 128) {
    this.group.name = "melee-impact-system";
    this.slashMesh = createInstancedMesh(this.slashGeometry, this.slashMaterial, capacity);
    this.impactMesh = createInstancedMesh(this.impactGeometry, this.impactMaterial, capacity);
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
    this.setRenderCount(0);
  }

  public spawn(input: MeleeImpactSpawn): boolean {
    if (this.disposed) return false;
    const entry = this.entries.find(({ active }) => !active);
    if (!entry) {
      this.droppedCount += 1;
      return false;
    }
    this.activeCount++;
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
    if (this.disposed || this.activeCount === 0) return;
    const elapsed = Number.isFinite(deltaSeconds) ? Math.min(Math.max(0, deltaSeconds), 0.1) : 0;
    let renderCount = 0;
    for (const entry of this.entries) {
      if (this.updateEntry(entry, renderCount, elapsed)) renderCount++;
    }
    this.setRenderCount(renderCount);
    if (renderCount === 0) return;
    for (const mesh of [this.slashMesh, this.impactMesh]) {
      queueInstanceUpdate(mesh.instanceMatrix, 0, renderCount);
      if (mesh.instanceColor) queueInstanceUpdate(mesh.instanceColor, 0, renderCount);
    }
  }

  public getStats(): MeleeImpactSystemStats {
    return {
      activeCount: this.activeCount,
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
    this.activeCount = 0;
    this.spawnedCount = 0;
    this.droppedCount = 0;
    this.setRenderCount(0);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.slashMesh.dispose();
    this.impactMesh.dispose();
    this.slashGeometry.dispose();
    this.impactGeometry.dispose();
    this.slashMaterial.dispose();
    this.impactMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
  }

  private updateEntry(entry: MeleeImpactEntry, index: number, deltaSeconds: number): boolean {
    if (!entry.active) return false;
    entry.elapsedSeconds += deltaSeconds;
    const progress = Math.min(1, entry.elapsedSeconds / IMPACT_SECONDS);
    if (progress >= 1) {
      entry.active = false;
      this.activeCount--;
      return false;
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
    return true;
  }

  private setRenderCount(count: number): void {
    this.slashMesh.count = count;
    this.impactMesh.count = count;
    this.slashMesh.visible = count > 0;
    this.impactMesh.visible = count > 0;
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
