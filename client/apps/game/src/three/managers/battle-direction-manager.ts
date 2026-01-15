import { HexPosition, ID } from "@bibliothecadao/types";
import { getAngleBetweenHexPositions } from "../utils/combat-directions";

export class BattleDirectionManager {
  private attackers: Map<ID, ID> = new Map(); // defender -> attacker
  private defenders: Map<ID, ID> = new Map(); // attacker -> defender

  constructor(
    private updateArmyArrow: (entityId: ID, degrees: number | undefined, role: "attacker" | "defender") => void,
    private updateStructureArrow: (entityId: ID, degrees: number | undefined, role: "attacker" | "defender") => void,
    private getEntityPosition: (entityId: ID) => HexPosition | undefined,
  ) {}

  public addCombatRelationship(attackerId: ID, defenderId: ID): void {
    // Remove old relationships to ensure 1-to-1 mapping
    const oldAttacker = this.attackers.get(defenderId);
    if (oldAttacker && oldAttacker !== attackerId) {
      this.defenders.delete(oldAttacker);
      // Clear old attacker's arrow
      this.recalculateArrowsForEntity(oldAttacker);
    }

    const oldDefender = this.defenders.get(attackerId);
    if (oldDefender && oldDefender !== defenderId) {
      this.attackers.delete(oldDefender);
      // Clear old defender's arrow
      this.recalculateArrowsForEntity(oldDefender);
    }

    // Set new relationship
    this.attackers.set(defenderId, attackerId);
    this.defenders.set(attackerId, defenderId);

    // Update arrows for both entities
    this.recalculateArrowsForEntity(attackerId);
    this.recalculateArrowsForEntity(defenderId);
  }

  public recalculateArrowsForEntity(entityId: ID): void {
    const entityPos = this.getEntityPosition(entityId);
    if (!entityPos) return;

    // Calculate attacker degrees (who this entity attacked)
    const defenderId = this.defenders.get(entityId);
    let attackerDegrees: number | undefined;
    if (defenderId) {
      const defenderPos = this.getEntityPosition(defenderId);
      if (defenderPos) {
        attackerDegrees = getAngleBetweenHexPositions(entityPos, defenderPos) ?? undefined;
      }
    }

    // Calculate defender degrees (who attacked this entity)
    const attackerId = this.attackers.get(entityId);
    let defenderDegrees: number | undefined;
    if (attackerId) {
      const attackerPos = this.getEntityPosition(attackerId);
      if (attackerPos) {
        defenderDegrees = getAngleBetweenHexPositions(entityPos, attackerPos) ?? undefined;
      }
    }

    // console.log(`[RECALCULATE ARROWS FOR ENTITY ${entityId}]`, { entityId, attackerDegrees, defenderDegrees });

    // Update arrows using the appropriate callback
    this.updateArmyArrow(entityId, attackerDegrees, "attacker");
    this.updateArmyArrow(entityId, defenderDegrees, "defender");
    this.updateStructureArrow(entityId, attackerDegrees, "attacker");
    this.updateStructureArrow(entityId, defenderDegrees, "defender");
  }

  public recalculateArrowsForEntitiesRelatedTo(entityId: ID): void {
    // Recalculate for entities that this entity attacked
    const defenderId = this.defenders.get(entityId);
    if (defenderId) {
      this.recalculateArrowsForEntity(defenderId);
    }

    // Recalculate for entities that attacked this entity
    const attackerId = this.attackers.get(entityId);
    if (attackerId) {
      this.recalculateArrowsForEntity(attackerId);
    }
  }

  public removeEntityFromTracking(entityId: ID): void {
    // Remove as attacker
    const defenderId = this.defenders.get(entityId);
    if (defenderId) {
      this.attackers.delete(defenderId);
      this.defenders.delete(entityId);
      // Recalculate arrows for the defender
      this.recalculateArrowsForEntity(defenderId);
    }

    // Remove as defender
    const attackerId = this.attackers.get(entityId);
    if (attackerId) {
      this.defenders.delete(attackerId);
      this.attackers.delete(entityId);
      // Recalculate arrows for the attacker
      this.recalculateArrowsForEntity(attackerId);
    }
  }

  public getAttacker(defenderId: ID): ID | undefined {
    return this.attackers.get(defenderId);
  }

  public getDefender(attackerId: ID): ID | undefined {
    return this.defenders.get(attackerId);
  }

  public clear(): void {
    this.attackers.clear();
    this.defenders.clear();
  }
}
