import { type ID, TroopTier, TroopType } from "@bibliothecadao/types";
import { Color, Scene, Vector3 } from "three";

import { ArrowProjectileSystem, type ArrowImpactEvent } from "../projectiles/arrow-projectile-system";
import type { ProjectileHitQuery } from "../projectiles/projectile-hit-query";
import type { ProceduralImpactAuthority } from "../characters/collision/procedural-impact";
import type { ProceduralProjectileReleaseSpec } from "../characters/procedural-unit-runtime";
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

interface CombatPresentationCoordinatorOptions {
  projectileHitQuery?: ProjectileHitQuery;
}

export interface ProceduralRangedPresentation {
  authority?: ProceduralImpactAuthority;
  ownerEntityId: number;
  origin: Readonly<Vector3>;
  origins?: readonly Readonly<Vector3>[];
  presentationId?: string;
  projectile: ProceduralProjectileReleaseSpec;
  seed: number;
  target: Readonly<Vector3>;
  targetEntityId: number;
  tier: TroopTier;
}

export interface ProceduralMeleePresentation {
  direction: Readonly<Vector3>;
  target: Readonly<Vector3>;
  tier: TroopTier;
}

const WORLD_ARROW_CAPACITY = 512;

/**
 * Owns transient attack visuals for the world map. Combat results never flow
 * back through this class; Cairo/RECS remains the only gameplay authority.
 */
export class CombatPresentationCoordinator {
  private readonly projectiles: ArrowProjectileSystem;
  private readonly meleeImpacts = new MeleeImpactSystem();
  private readonly projectileImpactListeners = new Set<(event: ArrowImpactEvent) => void>();
  private readonly unsubscribeProjectileImpact: () => void;
  private presentationSequence = 0;
  private disposed = false;

  public constructor(scene: Scene, options: CombatPresentationCoordinatorOptions = {}) {
    this.projectiles = new ArrowProjectileSystem(
      {
        capacity: WORLD_ARROW_CAPACITY,
        fixedStep: 1 / 60,
        gravity: -6.5,
        maxSubsteps: 4,
        stickSeconds: 2.4,
        sweepRadius: 0.04,
        visualScale: 0.55,
      },
      options.projectileHitQuery,
    );
    this.unsubscribeProjectileImpact = this.projectiles.onImpact((event) => {
      this.projectileImpactListeners.forEach((listener) => listener(event));
    });
    scene.add(this.projectiles.group, this.meleeImpacts.group);
  }

  public replayIndexed(presentation: CombatPresentation, options: CombatPresentationOptions = {}): boolean {
    if (this.disposed || !supportsPresentation(presentation.troopType)) return false;
    const presentationId = `indexed:${++this.presentationSequence}`;
    if (!options.deferEffects) this.spawnPresentation(presentation, presentationId, "indexed-replay");
    return true;
  }

  public presentImmediate(presentation: CombatPresentation): void {
    if (this.disposed || !supportsPresentation(presentation.troopType)) return;
    this.spawnPresentation(presentation, `fallback:${++this.presentationSequence}`, "indexed-replay");
  }

  public presentRangedRelease(presentation: ProceduralRangedPresentation): void {
    if (this.disposed) return;
    this.spawnProceduralProjectiles(presentation);
  }

  public onProjectileImpact(listener: (event: ArrowImpactEvent) => void): () => void {
    this.projectileImpactListeners.add(listener);
    return () => this.projectileImpactListeners.delete(listener);
  }

  public presentMeleeContact(presentation: ProceduralMeleePresentation): void {
    if (this.disposed) return;
    this.meleeImpacts.spawn(presentation);
  }

  /** The far zoom band shows no combat FX; the systems keep simulating so nothing desynchronises. */
  public setVisible(visible: boolean): void {
    this.projectiles.group.visible = visible;
    this.meleeImpacts.group.visible = visible;
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    const elapsed = Number.isFinite(deltaSeconds) ? Math.min(Math.max(0, deltaSeconds), 0.1) : 0;
    this.projectiles.update(elapsed);
    this.meleeImpacts.update(elapsed);
  }

  public getStats(): CombatPresentationStats {
    return { arrows: this.projectiles.getStats(), melee: this.meleeImpacts.getStats() };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeProjectileImpact();
    this.projectileImpactListeners.clear();
    this.projectiles.dispose();
    this.meleeImpacts.dispose();
  }

  private spawnPresentation(
    presentation: CombatPresentation,
    presentationId: string,
    authority: ProceduralImpactAuthority,
  ): void {
    if (presentation.troopType === TroopType.Crossbowman) {
      this.spawnRangedPresentation(presentation, presentationId, authority);
      return;
    }
    const direction = new Vector3().copy(presentation.target).sub(presentation.origin);
    if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
    else direction.normalize();
    this.meleeImpacts.spawn({ direction, target: presentation.target, tier: presentation.tier });
  }

  private spawnProceduralProjectiles(presentation: ProceduralRangedPresentation): void {
    const origins = presentation.origins?.length ? presentation.origins : [presentation.origin];
    const projectileCount = Math.max(1, Math.round(presentation.projectile.count));
    for (let index = 0; index < projectileCount; index += 1) {
      this.projectiles.spawnVolley({
        authority: presentation.authority ?? "provisional",
        color: presentation.projectile.kind === "cannonball" ? CANNONBALL_COLOR : resolveTierColor(presentation.tier),
        count: 1,
        flightSeconds: presentation.projectile.flightSeconds,
        kind: presentation.projectile.kind,
        origin: origins[index % origins.length],
        ownerEntityId: presentation.ownerEntityId,
        presentationId: presentation.presentationId,
        seed: (presentation.seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0,
        spreadDegrees: presentation.projectile.spreadDegrees,
        target: presentation.target,
        targetEntityId: presentation.targetEntityId,
        targetRadius: presentation.projectile.targetRadius,
      });
    }
  }

  private spawnRangedPresentation(
    presentation: CombatPresentation,
    presentationId: string,
    authority: ProceduralImpactAuthority,
  ): void {
    const origin = new Vector3().copy(presentation.origin).addScaledVector(WORLD_UP, 0.72);
    const target = new Vector3().copy(presentation.target).addScaledVector(WORLD_UP, 0.62);
    this.projectiles.spawnVolley({
      authority,
      color: resolveTierColor(presentation.tier),
      count: resolveTierVolleyCount(presentation.tier),
      flightSeconds: 0.56 + origin.distanceTo(target) * 0.035,
      origin,
      ownerEntityId: Number(presentation.attackerId),
      presentationId,
      seed: hashPresentationId(presentationId, presentation.attackerId, presentation.defenderId),
      spreadDegrees: presentation.tier === TroopTier.T3 ? 1.2 : 0.8,
      target,
      targetEntityId: Number(presentation.defenderId),
      targetRadius: 0.48,
    });
  }
}

const WORLD_UP = new Vector3(0, 1, 0);
const CANNONBALL_COLOR = new Color(0x25272b);

function supportsPresentation(troopType: TroopType): boolean {
  return troopType === TroopType.Crossbowman || troopType === TroopType.Knight || troopType === TroopType.Paladin;
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
