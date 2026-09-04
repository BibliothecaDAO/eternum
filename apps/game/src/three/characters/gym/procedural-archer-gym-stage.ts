import type { ProceduralArcherConfig } from "@/three/characters/archer/procedural-archer-config";
import { resolveBallisticLaunchVelocity } from "@/three/projectiles/arrow-ballistics";
import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  TorusGeometry,
  Vector3,
} from "three";

const TRAJECTORY_SEGMENTS = 48;
const APPROXIMATE_RELEASE_ORIGIN = new Vector3(0, 1.42, 0.38);

export class ProceduralArcherGymStage {
  public readonly group = new Group();

  private readonly target = new Group();
  private readonly targetFaceMaterial = new MeshStandardMaterial({
    color: 0xd6c49b,
    emissive: 0x000000,
    metalness: 0.04,
    roughness: 0.84,
  });
  private readonly trajectoryPositions = new Float32Array((TRAJECTORY_SEGMENTS + 1) * 3);
  private readonly trajectoryGeometry = new BufferGeometry();
  private readonly trajectoryMaterial = new LineBasicMaterial({ color: 0x86d8ff, opacity: 0.62, transparent: true });
  private readonly trajectory: Line;
  private readonly targetPosition = new Vector3();
  private readonly targetVelocity = new Vector3();
  private readonly gravity = new Vector3();
  private readonly launchVelocity = new Vector3();
  private config: ProceduralArcherConfig;
  private elapsedSeconds = 0;
  private impactFlashSeconds = 0;

  public constructor(config: ProceduralArcherConfig) {
    this.config = config;
    this.group.name = "procedural-archer-gym-stage";
    this.target.name = "procedural-archer-target";
    this.createTarget();
    this.trajectoryGeometry.setAttribute("position", new Float32BufferAttribute(this.trajectoryPositions, 3));
    this.trajectory = new Line(this.trajectoryGeometry, this.trajectoryMaterial);
    this.trajectory.name = "procedural-archer-trajectory";
    this.trajectory.frustumCulled = false;
    this.group.add(this.target, this.trajectory);
    this.updateConfig(config);
    this.update(0);
  }

  public update(deltaSeconds: number): void {
    const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    this.elapsedSeconds += elapsed;
    const phase = this.elapsedSeconds * this.config.targetSpeed;
    this.targetPosition.set(
      Math.sin(phase) * this.config.targetMovement,
      this.config.targetHeight,
      this.config.targetDistance,
    );
    this.targetVelocity.set(Math.cos(phase) * this.config.targetMovement * this.config.targetSpeed, 0, 0);
    this.target.position.copy(this.targetPosition);
    this.impactFlashSeconds = Math.max(0, this.impactFlashSeconds - elapsed);
    this.targetFaceMaterial.emissive.set(this.impactFlashSeconds > 0 ? 0x6bc8ff : 0x000000);
    this.targetFaceMaterial.emissiveIntensity = this.impactFlashSeconds > 0 ? this.impactFlashSeconds * 8 : 0;
    this.updateTrajectory();
  }

  public updateConfig(config: ProceduralArcherConfig): void {
    this.config = config;
    this.trajectory.visible = config.showTrajectory;
    this.target.scale.setScalar(config.targetRadius / 0.48);
    this.update(0);
  }

  public writeTargetPosition(out: Vector3): Vector3 {
    return out.copy(this.targetPosition);
  }

  public writeTargetVelocity(out: Vector3): Vector3 {
    return out.copy(this.targetVelocity);
  }

  public registerImpact(targetHit: boolean): void {
    if (targetHit) this.impactFlashSeconds = 0.22;
  }

  public reset(): void {
    this.elapsedSeconds = 0;
    this.impactFlashSeconds = 0;
    this.update(0);
  }

  public dispose(): void {
    this.group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material !== this.targetFaceMaterial) material.dispose();
      });
    });
    this.targetFaceMaterial.dispose();
    this.trajectoryGeometry.dispose();
    this.trajectoryMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
  }

  private createTarget(): void {
    const wood = new MeshStandardMaterial({ color: 0x5d3d2c, metalness: 0.02, roughness: 0.9 });
    const dark = new MeshStandardMaterial({ color: 0x231c24, metalness: 0.2, roughness: 0.62 });
    const blue = new MeshStandardMaterial({ color: 0x4779a8, emissive: 0x162d4a, emissiveIntensity: 0.25 });
    const gold = new MeshStandardMaterial({ color: 0xd6a94f, emissive: 0x4d2e0b, emissiveIntensity: 0.3 });
    const face = new Mesh(new CylinderGeometry(0.48, 0.48, 0.12, 32), this.targetFaceMaterial);
    face.rotation.x = Math.PI / 2;
    face.castShadow = true;
    const outerRing = new Mesh(new TorusGeometry(0.36, 0.018, 8, 36), blue);
    outerRing.position.z = -0.065;
    const innerRing = new Mesh(new TorusGeometry(0.19, 0.016, 8, 28), gold);
    innerRing.position.z = -0.067;
    const bullseye = new Mesh(new CylinderGeometry(0.075, 0.075, 0.012, 20), dark);
    bullseye.rotation.x = Math.PI / 2;
    bullseye.position.z = -0.071;
    const pole = new Mesh(new CylinderGeometry(0.055, 0.07, 1.42, 8), wood);
    pole.position.y = -0.71;
    const base = new Mesh(new RingGeometry(0.28, 0.42, 20), dark);
    base.rotation.x = -Math.PI / 2;
    base.position.y = -1.42;
    this.target.add(face, outerRing, innerRing, bullseye, pole, base);
  }

  private updateTrajectory(): void {
    this.gravity.set(0, this.config.projectileGravity, 0);
    resolveBallisticLaunchVelocity(
      APPROXIMATE_RELEASE_ORIGIN,
      this.targetPosition,
      this.targetVelocity,
      this.gravity,
      this.config.projectileFlightSeconds,
      this.launchVelocity,
    );
    for (let index = 0; index <= TRAJECTORY_SEGMENTS; index += 1) {
      const time = (index / TRAJECTORY_SEGMENTS) * this.config.projectileFlightSeconds;
      const offset = index * 3;
      this.trajectoryPositions[offset] = APPROXIMATE_RELEASE_ORIGIN.x + this.launchVelocity.x * time;
      this.trajectoryPositions[offset + 1] =
        APPROXIMATE_RELEASE_ORIGIN.y + this.launchVelocity.y * time + 0.5 * this.config.projectileGravity * time * time;
      this.trajectoryPositions[offset + 2] = APPROXIMATE_RELEASE_ORIGIN.z + this.launchVelocity.z * time;
    }
    const position = this.trajectoryGeometry.getAttribute("position");
    position.needsUpdate = true;
    this.trajectoryGeometry.computeBoundingSphere();
  }
}
