import type { Group } from "three";

import type { ProceduralUnitImpact, ProceduralUnitReactionInput } from "../collision/procedural-impact";
import type { ProceduralDragonActor, ProceduralDragonFireRelease } from "../dragon/procedural-dragon-runtime";
import type { ProceduralUnitConfig } from "../procedural-unit-config";
import type {
  ProceduralMountActor,
  ProceduralMountMode,
  ProceduralMountPose,
  ProceduralMountPoseDiagnostics,
  ProceduralMountStats,
  ProceduralMountTerrainSampler,
} from "./procedural-mount-actor";

/** Adapts procedural ground and flight locomotion to the shared mounted-creature lifecycle. */
export class ProceduralDragonMountActor implements ProceduralMountActor {
  public readonly kind = "dragon" as const;

  public constructor(private readonly dragon: ProceduralDragonActor) {}

  public get mode(): ProceduralMountMode {
    return this.dragon.mode;
  }

  public get object(): Group {
    return this.dragon.object;
  }

  public update(deltaSeconds: number): void {
    this.dragon.update(deltaSeconds);
  }

  public stepOnce(): void {
    this.dragon.stepOnce();
  }

  public updateConfig(config: ProceduralUnitConfig): void {
    this.dragon.updateConfig(config.dragon);
  }

  public fireAt(targetWorld: Parameters<ProceduralDragonActor["fireAt"]>[0]): boolean {
    return this.dragon.fireAt(targetWorld);
  }

  public setFireTarget(targetWorld?: Parameters<ProceduralDragonActor["setFireTarget"]>[0]): void {
    this.dragon.setFireTarget(targetWorld);
  }

  public cancelFire(): void {
    this.dragon.cancelFire();
  }

  public onFireRelease(listener: (event: ProceduralDragonFireRelease) => void): () => void {
    return this.dragon.onFireRelease(listener);
  }

  public startRagdoll(): Promise<void> {
    return this.dragon.startRagdoll();
  }

  public applyReaction(reaction: ProceduralUnitReactionInput): void {
    this.dragon.applyReaction(reaction);
  }

  public applyImpact(impact: ProceduralUnitImpact): Promise<void> {
    return this.dragon.applyImpact(impact);
  }

  public applyImpulse(): Promise<void> {
    return this.dragon.applyImpulse();
  }

  public setTerrainSampler(sampleTerrain?: ProceduralMountTerrainSampler): void {
    this.dragon.setGroundSampler(sampleTerrain);
  }

  public reset(): void {
    this.dragon.reset();
  }

  public hasFiniteState(): boolean {
    return this.dragon.hasFiniteState();
  }

  public getPose(): ProceduralMountPose {
    const pose = this.dragon.getPose();
    return {
      actionOriginPosition: pose.mouthPosition,
      actionOriginRotation: pose.mouthRotation,
      phase: pose.phase,
      saddlePosition: pose.saddlePosition,
      saddleRotation: pose.saddleRotation,
    };
  }

  public getStats(): ProceduralMountStats {
    const dragon = this.dragon.getStats();
    return {
      ...dragon,
      ...this.dragon.getPhysicsStats(),
      contactCount: this.dragon.getPose().contactCount,
      kind: this.kind,
    };
  }

  public getFireStats(): { phase: ReturnType<ProceduralDragonActor["getStats"]>["firePhase"]; releaseCount: number } {
    const stats = this.dragon.getStats();
    return { phase: stats.firePhase, releaseCount: stats.releaseCount };
  }

  public getPoseDiagnostics(): Extract<ProceduralMountPoseDiagnostics, { kind: "dragon" }> {
    return { dragon: this.dragon.getPoseDiagnostics(), kind: this.kind };
  }

  public dispose(): void {
    this.dragon.dispose();
  }
}
