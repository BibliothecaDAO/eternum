import type { Group } from "three";

import type { ProceduralUnitImpact, ProceduralUnitReactionInput } from "../collision/procedural-impact";
import type { ProceduralHorseActor } from "../horse/procedural-horse-runtime";
import type { ProceduralUnitConfig } from "../procedural-unit-config";
import type {
  ProceduralMountActor,
  ProceduralMountMode,
  ProceduralMountPose,
  ProceduralMountPoseDiagnostics,
  ProceduralMountStats,
  ProceduralMountTerrainSampler,
} from "./procedural-mount-actor";

/** Adapts grounded horse locomotion to the mounted-creature lifecycle. */
export class ProceduralHorseMountActor implements ProceduralMountActor {
  public readonly kind = "horse" as const;

  public constructor(private readonly horse: ProceduralHorseActor) {}

  public get mode(): ProceduralMountMode {
    return this.horse.mode;
  }

  public get object(): Group {
    return this.horse.object;
  }

  public update(deltaSeconds: number): void {
    this.horse.update(deltaSeconds);
  }

  public stepOnce(): void {
    this.horse.stepOnce();
  }

  public updateConfig(config: ProceduralUnitConfig): void {
    this.horse.updateConfig(config.horse, config.humanoid);
  }

  public startRagdoll(): Promise<void> {
    return this.horse.startRagdoll();
  }

  public applyReaction(reaction: ProceduralUnitReactionInput): void {
    this.horse.applyReaction(reaction);
  }

  public applyImpact(impact: ProceduralUnitImpact): Promise<void> {
    return this.horse.applyImpact(impact);
  }

  public applyImpulse(): Promise<void> {
    return this.horse.applyImpulse();
  }

  public setTerrainSampler(sampleTerrain?: ProceduralMountTerrainSampler): void {
    this.horse.setGroundSampler(sampleTerrain);
  }

  public reset(): void {
    this.horse.reset();
  }

  public hasFiniteState(): boolean {
    return this.horse.hasFiniteState();
  }

  public getPose(): ProceduralMountPose {
    const pose = this.horse.getPose();
    return {
      phase: pose.phase,
      saddlePosition: pose.saddlePosition,
      saddleRotation: pose.saddleRotation,
    };
  }

  public getStats(): ProceduralMountStats {
    const horse = this.horse.getStats();
    return {
      ...horse,
      ...this.horse.getPhysicsStats(),
      contactCount: horse.stanceHoofCount,
      kind: this.kind,
    };
  }

  public getPoseDiagnostics(): ProceduralMountPoseDiagnostics {
    return { horse: this.horse.getPoseDiagnostics(), kind: this.kind };
  }

  public dispose(): void {
    this.horse.dispose();
  }
}
