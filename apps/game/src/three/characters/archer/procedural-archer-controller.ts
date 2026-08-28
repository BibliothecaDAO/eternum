import { Group, Vector3 } from "three";

import { resolveBallisticLaunchVelocity } from "../../projectiles/arrow-ballistics";
import { resolveProceduralArcherAim } from "./procedural-archer-aim";
import { applyProceduralArcherConfigPatch, type ProceduralArcherConfig } from "./procedural-archer-config";
import { resolveProceduralArcherUpperBodyPose, type ProceduralArcherUpperBodyPose } from "./procedural-archer-pose";
import {
  advanceProceduralArcherShot,
  cancelProceduralArcherShot,
  createIdleProceduralArcherShotState,
  startProceduralArcherShot,
  type ProceduralArcherShotPhase,
  type ProceduralArcherShotState,
} from "./procedural-archer-shot-cycle";

const APPROXIMATE_PROJECTILE_ORIGIN_HEIGHT = 1.35;

export interface ProceduralArcherControllerStats {
  phase: ProceduralArcherShotPhase;
  releaseCount: number;
  shotGeneration: number;
}

export class ProceduralArcherController {
  private config: ProceduralArcherConfig;
  private state = createIdleProceduralArcherShotState();
  private readonly targetWorld = new Vector3();
  private readonly targetLocal = new Vector3();
  private readonly aimDirection = new Vector3();
  private readonly launchVelocity = new Vector3();
  private readonly gravity = new Vector3();
  private readonly pendingReleaseGenerations: number[] = [];
  private elapsedSeconds = 0;
  private hasTarget = false;

  public constructor(
    config: ProceduralArcherConfig,
    private seed: number,
  ) {
    this.config = applyProceduralArcherConfigPatch(config, {});
  }

  public updateConfig(config: ProceduralArcherConfig, seed = this.seed): void {
    this.config = applyProceduralArcherConfigPatch(this.config, config);
    this.seed = seed;
  }

  public setTarget(targetWorld?: Readonly<Vector3>): void {
    this.hasTarget = Boolean(targetWorld);
    if (targetWorld) this.targetWorld.copy(targetWorld);
  }

  public fireAt(targetWorld: Readonly<Vector3>): boolean {
    if (this.state.phase !== "idle") return false;
    this.setTarget(targetWorld);
    this.state = startProceduralArcherShot(this.state);
    return true;
  }

  public cancel(): void {
    this.state = cancelProceduralArcherShot(this.state);
  }

  public update(deltaSeconds: number, coordinateSpace: Group): ProceduralArcherUpperBodyPose {
    const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    this.elapsedSeconds += elapsed;
    const advanced = advanceProceduralArcherShot(
      this.state,
      this.config,
      elapsed,
      this.hasTarget && this.config.autoFire,
    );
    this.state = advanced.state;
    advanced.events.forEach((event) => {
      if (event.type === "release") this.pendingReleaseGenerations.push(event.shotGeneration);
    });

    this.targetLocal.copy(this.targetWorld);
    if (this.hasTarget) coordinateSpace.worldToLocal(this.targetLocal);
    else this.targetLocal.set(0, APPROXIMATE_PROJECTILE_ORIGIN_HEIGHT, this.config.targetDistance);
    this.targetLocal.y -= APPROXIMATE_PROJECTILE_ORIGIN_HEIGHT;
    resolveBallisticLaunchVelocity(
      ZERO_VECTOR,
      this.targetLocal,
      ZERO_VECTOR,
      this.gravity.set(0, this.config.projectileGravity, 0),
      this.config.projectileFlightSeconds,
      this.launchVelocity,
    );
    const aim = resolveProceduralArcherAim(this.launchVelocity, this.config, this.aimDirection);
    return resolveProceduralArcherUpperBodyPose(this.state, this.config, aim, this.elapsedSeconds, this.seed);
  }

  public consumeReleaseGeneration(): number | undefined {
    return this.pendingReleaseGenerations.shift();
  }

  public writeTarget(out: Vector3): boolean {
    if (!this.hasTarget) return false;
    out.copy(this.targetWorld);
    return true;
  }

  public getStats(): ProceduralArcherControllerStats {
    return {
      phase: this.state.phase,
      releaseCount: this.state.releaseCount,
      shotGeneration: this.state.shotGeneration,
    };
  }

  public reset(): void {
    this.state = createIdleProceduralArcherShotState();
    this.pendingReleaseGenerations.length = 0;
    this.elapsedSeconds = 0;
  }
}

const ZERO_VECTOR = new Vector3();
