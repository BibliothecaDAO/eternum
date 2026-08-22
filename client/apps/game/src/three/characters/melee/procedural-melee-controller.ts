import { Group, Vector3 } from "three";

import {
  advanceProceduralMeleeAttack,
  cancelProceduralMeleeAttack,
  createIdleProceduralMeleeAttackState,
  startProceduralMeleeAttack,
  type ProceduralMeleeAttackPhase,
} from "./procedural-melee-attack-cycle";
import { applyProceduralMeleeConfigPatch, type ProceduralMeleeConfig } from "./procedural-melee-config";
import { resolveProceduralMeleeUpperBodyPose, type ProceduralMeleeUpperBodyPose } from "./procedural-melee-pose";
import { resolveProceduralMeleeWeapon } from "./procedural-melee-weapon-catalog";

const APPROXIMATE_HAND_HEIGHT = 1.25;
const MIN_PITCH = (-45 * Math.PI) / 180;
const MAX_PITCH = (30 * Math.PI) / 180;
const MAX_YAW = (60 * Math.PI) / 180;

export interface ProceduralMeleeControllerStats {
  attackGeneration: number;
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

  public constructor(
    config: ProceduralMeleeConfig,
    private readonly mounted: boolean,
  ) {
    this.config = applyProceduralMeleeConfigPatch(config, {});
  }

  public updateConfig(config: ProceduralMeleeConfig): void {
    this.config = applyProceduralMeleeConfigPatch(this.config, config);
  }

  public setTarget(targetWorld?: Readonly<Vector3>): void {
    this.hasTarget = Boolean(targetWorld);
    if (targetWorld) this.targetWorld.copy(targetWorld);
  }

  public attack(targetWorld: Readonly<Vector3>): boolean {
    if (this.state.phase !== "idle") return false;
    this.setTarget(targetWorld);
    this.state = startProceduralMeleeAttack(this.state);
    return true;
  }

  public cancel(): void {
    this.state = cancelProceduralMeleeAttack(this.state);
  }

  public update(deltaSeconds: number, coordinateSpace: Group): ProceduralMeleeUpperBodyPose {
    const advanced = advanceProceduralMeleeAttack(
      this.state,
      this.config,
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
    return resolveProceduralMeleeUpperBodyPose({
      aimPitchRadians: pitch,
      aimYawRadians: yaw,
      attackStyle: resolveProceduralMeleeWeapon(this.config.weaponId).attackStyle,
      config: this.config,
      mounted: this.mounted,
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
      contactCount: this.state.contactCount,
      phase: this.state.phase,
      weaponId: this.config.weaponId,
    };
  }

  public reset(): void {
    this.state = createIdleProceduralMeleeAttackState();
    this.pendingContactGenerations.length = 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
