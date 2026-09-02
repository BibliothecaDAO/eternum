import { type BattleEventSystemUpdate } from "@bibliothecadao/eternum";
import { type HexPosition, type ID } from "@bibliothecadao/types";

import type { ProceduralMeleeContactEvent, ProceduralRangedReleaseEvent } from "@/three/characters";
import type { ProceduralImpactAuthority } from "@/three/characters/collision/procedural-impact";
import type { CombatPresentationCoordinator } from "@/three/combat/combat-presentation-coordinator";
import type { ArmyManager } from "@/three/managers/army-manager";

import { getWorldPositionForHex } from "../utils";

export interface WorldmapCombatPresentationDeps {
  armyManager: ArmyManager;
  getCombatPresentation: () => CombatPresentationCoordinator | undefined;
  getArmyDisplayPosition: (entityId: ID) => HexPosition | undefined;
  getStructureHexPosition: (entityId: ID) => HexPosition | undefined;
}

/**
 * Bridges the army manager's procedural combat events to the combat presentation coordinator:
 * it subscribes ranged-release, melee-contact and projectile-impact on {@link bind}, replays a
 * confirmed battle (with an immediate-present fallback when the animated attack cannot start),
 * and tears every subscription down on {@link dispose}. It owns the three subscription handles;
 * the coordinator and army manager stay scene-owned and are reached through injected accessors.
 */
export class WorldmapCombatPresentation {
  private unsubscribeRangedRelease?: () => void;
  private unsubscribeMeleeContact?: () => void;
  private unsubscribeProjectileImpact?: () => void;

  constructor(private readonly deps: WorldmapCombatPresentationDeps) {}

  bind(): void {
    this.unsubscribeRangedRelease = this.deps.armyManager.onProceduralRangedRelease(
      (entityId, event, targetEntityId, authority) => {
        this.presentRangedRelease(entityId, event, targetEntityId, authority);
      },
    );
    this.unsubscribeMeleeContact = this.deps.armyManager.onProceduralMeleeContact((entityId, event, targetEntityId) => {
      this.presentMeleeContact(entityId, event, targetEntityId);
    });
    this.unsubscribeProjectileImpact = this.deps.getCombatPresentation()?.onProjectileImpact((event) => {
      this.deps.armyManager.presentProceduralProjectileImpact(event);
    });
  }

  dispose(): void {
    this.unsubscribeMeleeContact?.();
    this.unsubscribeMeleeContact = undefined;
    this.unsubscribeRangedRelease?.();
    this.unsubscribeRangedRelease = undefined;
    this.unsubscribeProjectileImpact?.();
    this.unsubscribeProjectileImpact = undefined;
  }

  replayIndexed(update: BattleEventSystemUpdate): void {
    const { attackerId, defenderId } = update.battleData;
    const attacker = this.deps.armyManager.getArmy(attackerId);
    if (!attacker) return;
    const attackerHex = this.deps.getArmyDisplayPosition(attackerId);
    const defenderHex = this.deps.getArmyDisplayPosition(defenderId) ?? this.deps.getStructureHexPosition(defenderId);
    if (!attackerHex || !defenderHex) return;
    const origin = getWorldPositionForHex(attackerHex);
    const target = getWorldPositionForHex(defenderHex);
    const presentation = {
      attackerId,
      defenderId,
      origin,
      target,
      tier: attacker.tier,
      troopType: attacker.category,
    };
    const combatPresentation = this.deps.getCombatPresentation();
    const replayed = combatPresentation?.replayIndexed(presentation, { deferEffects: true });
    if (!replayed) return;
    if (!this.deps.armyManager.playProceduralAttack(attackerId, target, defenderId, "indexed-replay")) {
      combatPresentation?.presentImmediate(presentation);
    }
  }

  private presentRangedRelease(
    entityId: number,
    event: ProceduralRangedReleaseEvent,
    targetEntityId?: number,
    authority: ProceduralImpactAuthority = "provisional",
  ): void {
    const army = this.deps.armyManager.getArmy(entityId);
    if (!army || targetEntityId === undefined) return;
    this.deps.getCombatPresentation()?.presentRangedRelease({
      authority,
      ownerEntityId: entityId,
      origin: event.origin,
      origins: event.origins,
      presentationId: `procedural:${entityId}:${event.shotGeneration}`,
      projectile: event.projectile,
      seed: event.seed,
      target: event.target,
      targetEntityId,
      tier: army.tier,
    });
  }

  private presentMeleeContact(entityId: number, event: ProceduralMeleeContactEvent, _targetEntityId?: number): void {
    const army = this.deps.armyManager.getArmy(entityId);
    if (!army) return;
    this.deps.getCombatPresentation()?.presentMeleeContact({
      direction: event.direction,
      target: event.target,
      tier: army.tier,
    });
  }
}
