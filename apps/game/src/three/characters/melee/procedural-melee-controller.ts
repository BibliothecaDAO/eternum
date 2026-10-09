import { Group, Vector3 } from "three";

import {
  advanceProceduralMeleeAttack,
  cancelProceduralMeleeAttack,
  createIdleProceduralMeleeAttackState,
  startProceduralMeleeAttack,
  type ProceduralMeleeAttackPhase,
} from "./procedural-melee-attack-cycle";
import { applyProceduralMeleeConfigPatch, type ProceduralMeleeConfig } from "./procedural-melee-config";
import {
  resolveProceduralMeleeUpperBodyPose,
  type ProceduralMeleeGuardHolds,
  type ProceduralMeleeUpperBodyPose,
} from "./procedural-melee-pose";
import { resolveProceduralMeleeWeapon, type ProceduralMeleeAttackVariantId } from "./procedural-melee-weapon-catalog";

const APPROXIMATE_HAND_HEIGHT = 1.25;
const MIN_PITCH = (-45 * Math.PI) / 180;
const MAX_PITCH = (30 * Math.PI) / 180;
const MAX_YAW = (60 * Math.PI) / 180;
/** Time constant, in seconds, of the guard holds easing in and out when the bearer starts or stops moving or fighting. */
const GUARD_HOLD_EASE_SECONDS = 0.12;
/** A bearer that attacked standing holds its guard for this long after the attack started, then relaxes. */
const GUARD_HOLD_AFTER_ATTACK_SECONDS = 4;

/** How the bearer moves on its own legs; a rider is standing. */
export type ProceduralMeleeBearerMotion = "standing" | "walking" | "running";

export interface ProceduralMeleeControllerStats {
  attackGeneration: number;
  /** The attack being made, or the last one made. */
  attackVariant?: ProceduralMeleeAttackVariantId;
  contactCount: number;
  phase: ProceduralMeleeAttackPhase;
  weaponId: ProceduralMeleeConfig["weaponId"];
}

export class ProceduralMeleeController {
  private config: ProceduralMeleeConfig;
  private state = createIdleProceduralMeleeAttackState();
  private readonly targetWorld = new Vector3();
  private readonly targetLocal = new Vector3();
  private readonly pendingContactGenerations: number[] = [];
  private hasTarget = false;
  private holds: ProceduralMeleeGuardHolds = { guard: 0, move: 0, run: 0 };
  private secondsSinceStandingAttack = Number.POSITIVE_INFINITY;
  private lastAttackGeneration = 0;

  /** `seed` is the bearer's: it picks where in the weapon's attack variants this bearer starts. */
  public constructor(
    config: ProceduralMeleeConfig,
    private readonly mounted: boolean,
    private seed: number,
  ) {
    this.config = applyProceduralMeleeConfigPatch(config, {});
  }

  public updateConfig(config: ProceduralMeleeConfig, seed: number): void {
    this.config = applyProceduralMeleeConfigPatch(this.config, config);
    this.seed = seed;
  }

  public setTarget(targetWorld?: Readonly<Vector3>): void {
    this.hasTarget = Boolean(targetWorld);
    if (targetWorld) this.targetWorld.copy(targetWorld);
  }

  public attack(targetWorld: Readonly<Vector3>): boolean {
    if (this.state.phase !== "idle") return false;
    this.setTarget(targetWorld);
    this.state = startProceduralMeleeAttack(this.state, this.config, this.seed);
    return true;
  }

  public cancel(): void {
    this.state = cancelProceduralMeleeAttack(this.state);
  }

  public update(
    deltaSeconds: number,
    coordinateSpace: Group,
    motion: ProceduralMeleeBearerMotion,
  ): ProceduralMeleeUpperBodyPose {
    const advanced = advanceProceduralMeleeAttack(
      this.state,
      this.config,
      this.seed,
      deltaSeconds,
      this.hasTarget && this.config.autoAttack,
    );
    this.state = advanced.state;
    advanced.events.forEach((event) => {
      if (event.type === "contact") this.pendingContactGenerations.push(event.attackGeneration);
    });

    this.targetLocal.copy(this.targetWorld);
    if (this.hasTarget) coordinateSpace.worldToLocal(this.targetLocal);
    else this.targetLocal.set(0, APPROXIMATE_HAND_HEIGHT, this.config.targetDistance);
    this.targetLocal.y -= APPROXIMATE_HAND_HEIGHT;
    const horizontal = Math.max(1e-6, Math.hypot(this.targetLocal.x, this.targetLocal.z));
    const yaw = clamp(Math.atan2(this.targetLocal.x, this.targetLocal.z), -MAX_YAW, MAX_YAW);
    const pitch = clamp(Math.atan2(this.targetLocal.y, horizontal), MIN_PITCH, MAX_PITCH);
    this.trackStandingAttack(deltaSeconds, motion);
    this.holds = easeGuardHolds(this.holds, this.resolveHeldGuards(motion), deltaSeconds);
    return resolveProceduralMeleeUpperBodyPose({
      aimPitchRadians: pitch,
      aimYawRadians: yaw,
      attackStyle: resolveProceduralMeleeWeapon(this.config.weaponId).attackStyle,
      config: this.config,
      holds: this.holds,
      mounted: this.mounted,
      seed: this.seed,
      state: this.state,
    });
  }

  public consumeContactGeneration(): number | undefined {
    return this.pendingContactGenerations.shift();
  }

  public writeTarget(out: Vector3): boolean {
    if (!this.hasTarget) return false;
    out.copy(this.targetWorld);
    return true;
  }

  public getStats(): ProceduralMeleeControllerStats {
    return {
      attackGeneration: this.state.attackGeneration,
      attackVariant: this.state.variant,
      contactCount: this.state.contactCount,
      phase: this.state.phase,
      weaponId: this.config.weaponId,
    };
  }

  public reset(): void {
    this.state = createIdleProceduralMeleeAttackState();
    this.holds = { guard: 0, move: 0, run: 0 };
    this.secondsSinceStandingAttack = Number.POSITIVE_INFINITY;
    this.lastAttackGeneration = 0;
    this.pendingContactGenerations.length = 0;
  }

  /** Restarts the after-attack guard when an attack started while the bearer stood. */
  private trackStandingAttack(deltaSeconds: number, motion: ProceduralMeleeBearerMotion): void {
    const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    this.secondsSinceStandingAttack += elapsed;
    if (this.state.attackGeneration === this.lastAttackGeneration) return;
    this.lastAttackGeneration = this.state.attackGeneration;
    if (motion === "standing") this.secondsSinceStandingAttack = 0;
  }

  private resolveHeldGuards(motion: ProceduralMeleeBearerMotion): Record<keyof ProceduralMeleeGuardHolds, boolean> {
    const moving = motion !== "standing";
    return {
      guard: moving || this.secondsSinceStandingAttack < GUARD_HOLD_AFTER_ATTACK_SECONDS,
      move: moving,
      run: motion === "running",
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A bearer that starts or stops moving or fighting goes to its guard, or back, over a moment, not in one frame. */
function easeGuardHolds(
  current: ProceduralMeleeGuardHolds,
  held: Record<keyof ProceduralMeleeGuardHolds, boolean>,
  deltaSeconds: number,
): ProceduralMeleeGuardHolds {
  const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const ease = (value: number, target: boolean) =>
    value + ((target ? 1 : 0) - value) * (1 - Math.exp(-elapsed / GUARD_HOLD_EASE_SECONDS));
  return {
    guard: ease(current.guard, held.guard),
    move: ease(current.move, held.move),
    run: ease(current.run, held.run),
  };
}
