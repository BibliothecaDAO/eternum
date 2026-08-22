import type { ProvisionalIntent } from "@bibliothecadao/eternum/game-sync";
import { type ID, TroopTier, TroopType } from "@bibliothecadao/types";
import { Color, Scene, Vector3 } from "three";

import { ArrowProjectileSystem } from "../projectiles/arrow-projectile-system";
import { MeleeImpactSystem } from "./melee-impact-system";

export interface CombatPresentation {
  attackerId: ID;
  defenderId: ID;
  origin: Readonly<Vector3>;
  target: Readonly<Vector3>;
  tier: TroopTier;
  troopType: TroopType;
}

export interface CombatPresentationStats {
  arrows: ReturnType<ArrowProjectileSystem["getStats"]>;
  melee: ReturnType<MeleeImpactSystem["getStats"]>;
}

interface CombatPresentationOptions {
  deferEffects?: boolean;
}

export interface ProceduralRangedPresentation {
  origin: Readonly<Vector3>;
  seed: number;
  target: Readonly<Vector3>;
  tier: TroopTier;
}

export interface ProceduralMeleePresentation {
  direction: Readonly<Vector3>;
  target: Readonly<Vector3>;
  tier: TroopTier;
}

interface RecentProvisionalPresentation {
  createdAtSeconds: number;
  unsubscribe: () => void;
}

const RECENT_PROVISIONAL_SECONDS = 8;
const WORLD_ARROW_CAPACITY = 512;

/**
 * Owns transient attack visuals for the world map. Combat results never flow
 * back through this class; Cairo/RECS remains the only gameplay authority.
 */
export class CombatPresentationCoordinator {
  private readonly projectiles = new ArrowProjectileSystem({
    capacity: WORLD_ARROW_CAPACITY,
    fixedStep: 1 / 60,
    gravity: -6.5,
    maxSubsteps: 4,
    stickSeconds: 2.4,
    sweepRadius: 0.04,
    visualScale: 0.55,
  });
  private readonly meleeImpacts = new MeleeImpactSystem();
  private readonly recentProvisional = new Map<string, RecentProvisionalPresentation[]>();
  private elapsedSeconds = 0;
  private presentationSequence = 0;
  private disposed = false;

  public constructor(scene: Scene) {
    scene.add(this.projectiles.group, this.meleeImpacts.group);
  }

  public startProvisional(
    presentation: CombatPresentation,
    intent: ProvisionalIntent,
    options: CombatPresentationOptions = {},
  ): boolean {
    if (this.disposed || !supportsPresentation(presentation.troopType)) return false;
    const presentationId = `local:${++this.presentationSequence}`;
    if (!options.deferEffects) this.spawnPresentation(presentation, presentationId);
    const key = resolveCombatKey(presentation.attackerId, presentation.defenderId);
    const entry: RecentProvisionalPresentation = {
      createdAtSeconds: this.elapsedSeconds,
      unsubscribe: () => undefined,
    };
    const queue = this.recentProvisional.get(key) ?? [];
    queue.push(entry);
    this.recentProvisional.set(key, queue);
    entry.unsubscribe = intent.subscribe((outcome) => {
      if (outcome !== "failed") return;
      entry.unsubscribe();
      this.removeRecentProvisional(key, entry);
    });
    return true;
  }

  public replayIndexed(presentation: CombatPresentation, options: CombatPresentationOptions = {}): boolean {
    if (this.disposed || !supportsPresentation(presentation.troopType)) return false;
    const key = resolveCombatKey(presentation.attackerId, presentation.defenderId);
    const queue = this.recentProvisional.get(key);
    const provisional = queue?.shift();
    if (provisional) {
      provisional.unsubscribe();
      if (queue?.length === 0) this.recentProvisional.delete(key);
      return false;
    }
    const presentationId = `indexed:${++this.presentationSequence}`;
    if (!options.deferEffects) this.spawnPresentation(presentation, presentationId);
    return true;
  }

  public presentImmediate(presentation: CombatPresentation): void {
    if (this.disposed || !supportsPresentation(presentation.troopType)) return;
    this.spawnPresentation(presentation, `fallback:${++this.presentationSequence}`);
  }

  public presentRangedRelease(presentation: ProceduralRangedPresentation): void {
    if (this.disposed) return;
    this.projectiles.spawnVolley({
      color: resolveTierColor(presentation.tier),
      count: resolveTierVolleyCount(presentation.tier),
      flightSeconds: 0.56 + presentation.origin.distanceTo(presentation.target) * 0.035,
      origin: presentation.origin,
      seed: presentation.seed,
      spreadDegrees: presentation.tier === TroopTier.T3 ? 1.2 : 0.8,
      target: presentation.target,
      targetRadius: 0.48,
    });
  }

  public presentMeleeContact(presentation: ProceduralMeleePresentation): void {
    if (this.disposed) return;
    this.meleeImpacts.spawn(presentation);
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    const elapsed = Number.isFinite(deltaSeconds) ? Math.min(Math.max(0, deltaSeconds), 0.1) : 0;
    this.elapsedSeconds += elapsed;
    this.projectiles.update(elapsed);
    this.meleeImpacts.update(elapsed);
    this.pruneRecentProvisional();
  }

  public getStats(): CombatPresentationStats {
    return { arrows: this.projectiles.getStats(), melee: this.meleeImpacts.getStats() };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.recentProvisional.forEach((entries) => entries.forEach(({ unsubscribe }) => unsubscribe()));
    this.recentProvisional.clear();
    this.projectiles.dispose();
    this.meleeImpacts.dispose();
  }

  private spawnPresentation(presentation: CombatPresentation, presentationId: string): void {
    if (presentation.troopType === TroopType.Crossbowman) {
      this.spawnRangedPresentation(presentation, presentationId);
      return;
    }
    const direction = new Vector3().copy(presentation.target).sub(presentation.origin);
    if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
    else direction.normalize();
    this.meleeImpacts.spawn({ direction, target: presentation.target, tier: presentation.tier });
  }

  private spawnRangedPresentation(presentation: CombatPresentation, presentationId: string): void {
    const origin = new Vector3().copy(presentation.origin).addScaledVector(WORLD_UP, 0.72);
    const target = new Vector3().copy(presentation.target).addScaledVector(WORLD_UP, 0.62);
    this.projectiles.spawnVolley({
      color: resolveTierColor(presentation.tier),
      count: resolveTierVolleyCount(presentation.tier),
      flightSeconds: 0.56 + origin.distanceTo(target) * 0.035,
      origin,
      seed: hashPresentationId(presentationId, presentation.attackerId, presentation.defenderId),
      spreadDegrees: presentation.tier === TroopTier.T3 ? 1.2 : 0.8,
      target,
      targetRadius: 0.48,
    });
  }

  private pruneRecentProvisional(): void {
    this.recentProvisional.forEach((entries, key) => {
      const retained = entries.filter((entry) => {
        if (this.elapsedSeconds - entry.createdAtSeconds <= RECENT_PROVISIONAL_SECONDS) return true;
        entry.unsubscribe();
        return false;
      });
      if (retained.length === 0) this.recentProvisional.delete(key);
      else if (retained.length !== entries.length) this.recentProvisional.set(key, retained);
    });
  }

  private removeRecentProvisional(key: string, target: RecentProvisionalPresentation): void {
    const entries = this.recentProvisional.get(key);
    if (!entries) return;
    const index = entries.indexOf(target);
    if (index !== -1) entries.splice(index, 1);
    if (entries.length === 0) this.recentProvisional.delete(key);
  }
}

const WORLD_UP = new Vector3(0, 1, 0);

function supportsPresentation(troopType: TroopType): boolean {
  return troopType === TroopType.Crossbowman || troopType === TroopType.Knight || troopType === TroopType.Paladin;
}

function resolveCombatKey(attackerId: ID, defenderId: ID): string {
  return `${String(attackerId)}:${String(defenderId)}`;
}

function resolveTierVolleyCount(tier: TroopTier): number {
  if (tier === TroopTier.T3) return 7;
  if (tier === TroopTier.T2) return 5;
  return 3;
}

function resolveTierColor(tier: TroopTier): Color {
  if (tier === TroopTier.T3) return new Color(0xb58cff);
  if (tier === TroopTier.T2) return new Color(0x9fc7d8);
  return new Color(0xcaa878);
}

function hashPresentationId(presentationId: string, attackerId: ID, defenderId: ID): number {
  const value = `${presentationId}:${String(attackerId)}:${String(defenderId)}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
