import { normalizeProceduralReaction, type ProceduralImpactSource } from "./procedural-impact";

export interface ProceduralContactReactionPose {
  localDirectionX: number;
  localDirectionY: number;
  localDirectionZ: number;
  source: ProceduralImpactSource;
  weight: number;
}

export interface ProceduralLocalReactionInput {
  localDirectionX: number;
  localDirectionY: number;
  localDirectionZ: number;
  source: ProceduralImpactSource;
  strength: number;
}

interface ActiveReaction extends ProceduralLocalReactionInput {
  durationSeconds: number;
  elapsedSeconds: number;
  normalizedStrength: number;
}

const REACTION_DURATION_SECONDS: Readonly<Record<ProceduralImpactSource, number>> = {
  arrow: 0.46,
  "body-contact": 0.32,
  melee: 0.4,
};

const REACTION_STRENGTH_SCALE: Readonly<Record<ProceduralImpactSource, number>> = {
  arrow: 8,
  "body-contact": 0.25,
  melee: 10,
};

export class ProceduralContactReactionController {
  private active?: ActiveReaction;
  private pose?: ProceduralContactReactionPose;

  public trigger(input: ProceduralLocalReactionInput): void {
    const normalized = normalizeProceduralReaction({
      directionX: input.localDirectionX,
      directionY: input.localDirectionY,
      directionZ: input.localDirectionZ,
      source: input.source,
      strength: input.strength,
    });
    const normalizedStrength = Math.min(1, normalized.strength / REACTION_STRENGTH_SCALE[input.source]);
    if (normalizedStrength <= 1e-4) return;
    if (this.active && normalizedStrength < this.active.normalizedStrength * 0.45) return;
    this.active = {
      durationSeconds: REACTION_DURATION_SECONDS[input.source],
      elapsedSeconds: 0,
      localDirectionX: normalized.directionX,
      localDirectionY: normalized.directionY,
      localDirectionZ: normalized.directionZ,
      normalizedStrength,
      source: normalized.source,
      strength: normalized.strength,
    };
    this.pose = this.resolvePose();
  }

  public update(deltaSeconds: number): ProceduralContactReactionPose | undefined {
    if (!this.active) return undefined;
    const elapsed = Number.isFinite(deltaSeconds) ? Math.min(0.1, Math.max(0, deltaSeconds)) : 0;
    this.active.elapsedSeconds += elapsed;
    if (this.active.elapsedSeconds >= this.active.durationSeconds) {
      this.reset();
      return undefined;
    }
    this.pose = this.resolvePose();
    return this.pose;
  }

  public getPose(): ProceduralContactReactionPose | undefined {
    return this.pose;
  }

  public reset(): void {
    this.active = undefined;
    this.pose = undefined;
  }

  private resolvePose(): ProceduralContactReactionPose | undefined {
    const active = this.active;
    if (!active) return undefined;
    const progress = Math.min(1, active.elapsedSeconds / active.durationSeconds);
    const attack = Math.min(1, active.elapsedSeconds / 0.055);
    const recovery = (1 - progress) * (1 - progress);
    return {
      localDirectionX: active.localDirectionX,
      localDirectionY: active.localDirectionY,
      localDirectionZ: active.localDirectionZ,
      source: active.source,
      weight: active.normalizedStrength * attack * recovery,
    };
  }
}
