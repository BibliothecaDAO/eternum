import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, RingGeometry, Vector3 } from "three";

import type { ProceduralBoatConfig } from "../boat/procedural-boat-config";

export class ProceduralBoatGymStage {
  public readonly group = new Group();

  private readonly waterGeometry = new PlaneGeometry(13.6, 13.6, 24, 24);
  private readonly waterMaterial = new MeshStandardMaterial({
    color: 0x123c55,
    metalness: 0.12,
    opacity: 0.84,
    roughness: 0.28,
    transparent: true,
  });
  private readonly targetGeometry = new CylinderGeometry(0.22, 0.3, 0.7, 10);
  private readonly targetMaterial = new MeshStandardMaterial({
    color: 0xc4513d,
    emissive: 0x4d140d,
    emissiveIntensity: 0.45,
    roughness: 0.62,
  });
  private readonly ringGeometry = new RingGeometry(0.42, 0.47, 32);
  private readonly ringMaterial = new MeshStandardMaterial({
    color: 0x9fe8ff,
    emissive: 0x25627a,
    emissiveIntensity: 0.7,
    opacity: 0.75,
    transparent: true,
  });
  private readonly water = new Mesh(this.waterGeometry, this.waterMaterial);
  private readonly target = new Mesh(this.targetGeometry, this.targetMaterial);
  private readonly targetRing = new Mesh(this.ringGeometry, this.ringMaterial);
  private config: ProceduralBoatConfig;
  private elapsedSeconds = 0;
  private impactCount = 0;
  private disposed = false;

  public constructor(config: ProceduralBoatConfig) {
    this.config = config;
    this.group.name = "procedural-boat-gym-stage";
    this.water.name = "procedural-boat-gym-water";
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -0.04;
    this.water.receiveShadow = true;
    this.target.name = "procedural-boat-gym-target-buoy";
    this.target.castShadow = true;
    this.targetRing.name = "procedural-boat-gym-target-ring";
    this.targetRing.rotation.x = -Math.PI / 2;
    this.group.add(this.water, this.target, this.targetRing);
    this.updateTargetPosition();
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    const elapsed = Number.isFinite(deltaSeconds) ? Math.min(0.1, Math.max(0, deltaSeconds)) : 0;
    this.elapsedSeconds += elapsed;
    const heave = Math.sin(this.elapsedSeconds * Math.PI * 2 * this.config.waveFrequency + 0.8) * 0.045;
    this.target.position.y = this.config.targetHeight + heave;
    this.target.rotation.y += elapsed * 0.32;
    this.targetRing.position.set(this.target.position.x, 0.012 + heave * 0.22, this.target.position.z);
    this.targetRing.scale.setScalar(1 + Math.sin(this.elapsedSeconds * 2.2) * 0.06);
  }

  public updateConfig(config: ProceduralBoatConfig): void {
    if (this.disposed) return;
    this.config = config;
    this.updateTargetPosition();
  }

  public writeTargetPosition(out: Vector3): void {
    this.target.getWorldPosition(out);
  }

  public writeTargetVelocity(out: Vector3): void {
    out.set(0, Math.cos(this.elapsedSeconds * Math.PI * 2 * this.config.waveFrequency + 0.8) * 0.09, 0);
  }

  public registerImpact(targetHit: boolean): void {
    if (!targetHit) return;
    this.impactCount += 1;
    this.targetMaterial.emissiveIntensity = 1.8;
  }

  public setTargetVisible(visible: boolean): void {
    this.target.visible = visible;
    this.targetRing.visible = visible;
  }

  public getImpactCount(): number {
    return this.impactCount;
  }

  public reset(): void {
    this.elapsedSeconds = 0;
    this.impactCount = 0;
    this.targetMaterial.emissiveIntensity = 0.45;
    this.updateTargetPosition();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.waterGeometry.dispose();
    this.waterMaterial.dispose();
    this.targetGeometry.dispose();
    this.targetMaterial.dispose();
    this.ringGeometry.dispose();
    this.ringMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
  }

  private updateTargetPosition(): void {
    this.target.position.set(this.config.targetDistance, this.config.targetHeight, 0);
    this.targetRing.position.set(this.config.targetDistance, 0.012, 0);
  }
}
