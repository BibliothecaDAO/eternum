import { getBlockTimestamp, isRelicActive, RelicEffectSystemUpdate } from "@bibliothecadao/eternum";
import { RelicEffect } from "@bibliothecadao/types";

interface RelicEffectData {
  relicNumber: number;
  effect: RelicEffect;
  fx: { end: () => void; instance?: any };
}

interface PendingRelicEffect {
  relicResourceId: number;
  effect: RelicEffect;
}

export class RelicEffectsManager {
  // Relic effects storage - holds active relic effects for each entity
  private entityRelicEffects: Map<number, RelicEffectData[]> = new Map();

  // Pending relic effects store - holds relic effects for entities that aren't loaded yet
  private pendingRelicEffects: Map<number, Set<PendingRelicEffect>> = new Map();

  // Relic effect validation timer
  private relicValidationInterval: NodeJS.Timeout | null = null;

  // Dependencies
  private fxManager: any = null;
  private unitTileRenderer: any = null;

  constructor(fxManager: any) {
    this.fxManager = fxManager;
    this.startRelicValidationTimer();
  }

  public setUnitTileRenderer(renderer: any): void {
    this.unitTileRenderer = renderer;
  }

  /**
   * Handle relic effect updates from the game system
   */
  public async handleRelicEffectUpdate(
    update: RelicEffectSystemUpdate,
    getEntityPosition: (entityId: number) => { col: number; row: number } | undefined,
  ): Promise<void> {
    const { entityId, relicEffects } = update;

    const entityPosition = getEntityPosition(entityId);

    if (entityPosition) {
      // Convert RelicEffectWithEndTick to the format expected by updateRelicEffects
      const { currentArmiesTick } = getBlockTimestamp();
      const newEffects = relicEffects.map((relicEffect) => ({
        relicNumber: relicEffect.id,
        effect: {
          start_tick: currentArmiesTick,
          end_tick: relicEffect.endTick,
          usage_left: 1,
        },
      }));

      await this.updateEntityRelicEffects(entityId, newEffects, entityPosition);
    } else {
      // Entity is not currently loaded, store as pending effects
      this.storePendingRelicEffects(entityId, relicEffects);
    }
  }

  /**
   * Update entity relic effects and display them visually
   */
  public async updateEntityRelicEffects(
    entityId: number,
    newRelicEffects: Array<{ relicNumber: number; effect: RelicEffect }>,
    entityPosition: { col: number; row: number },
  ): Promise<void> {
    const currentEffects = this.entityRelicEffects.get(entityId) || [];
    const currentRelicNumbers = new Set(currentEffects.map((e) => e.relicNumber));
    const newRelicNumbers = new Set(newRelicEffects.map((e) => e.relicNumber));

    // Batch process effects to remove - collect first, then execute
    const effectsToRemove = currentEffects.filter(effect => !newRelicNumbers.has(effect.relicNumber));
    
    if (effectsToRemove.length > 0) {
      effectsToRemove.forEach(effect => {
        effect.fx.end();
      });
    }

    // Add new effects that weren't previously active
    const effectsToAdd: RelicEffectData[] = [];
    for (const newEffect of newRelicEffects) {
      if (!currentRelicNumbers.has(newEffect.relicNumber)) {
        try {
          // Register the relic FX if not already registered (wait for texture to load)
          await this.fxManager.registerRelicFX(newEffect.relicNumber);

          // Create the relic effect at relative coordinates (0, 1.5, 0) within the tile group
          const fx = this.fxManager.playFxAtCoords(
            `relic_${newEffect.relicNumber}`,
            0, // x relative to tile group
            1.5, // y relative to tile group (height above the tile)
            0, // z relative to tile group
            0.8,
            undefined,
            true,
          );

          // Add the effect's Three.js group to the army's tile group if we have the renderer
          if (fx.instance && fx.instance.group && this.unitTileRenderer) {
            this.unitTileRenderer.addObjectToTileGroup(entityPosition.col, entityPosition.row, fx.instance.group);
          }

          effectsToAdd.push({ 
            relicNumber: newEffect.relicNumber, 
            effect: newEffect.effect, 
            fx
          });
        } catch (error) {
          console.error(`Failed to add relic effect ${newEffect.relicNumber} for entity ${entityId}:`, error);
        }
      }
    }

    // Update the stored effects
    if (newRelicEffects.length === 0) {
      this.entityRelicEffects.delete(entityId);
    } else {
      // Keep existing effects that are still in the new list, add new ones
      const updatedEffects = currentEffects.filter((e) => newRelicNumbers.has(e.relicNumber)).concat(effectsToAdd);
      this.entityRelicEffects.set(entityId, updatedEffects);
    }
  }

  /**
   * Get entity relic effects for external access
   */
  public getEntityRelicEffects(entityId: number): { relicId: number; effect: RelicEffect }[] {
    const effects = this.entityRelicEffects.get(entityId);
    if (!effects || effects.length === 0) return [];
    
    return effects.map((effect) => ({ relicId: effect.relicNumber, effect: effect.effect }));
  }

  /**
   * Apply all pending relic effects for an entity (called when entity is loaded)
   */
  public async applyPendingRelicEffects(entityId: number, entityPosition: { col: number; row: number }): Promise<void> {
    const entityPendingSet = this.pendingRelicEffects.get(entityId);
    if (!entityPendingSet || entityPendingSet.size === 0) return;

    try {
      // Convert pending relics to array format for updateRelicEffects
      const relicEffectsArray = Array.from(entityPendingSet).map((pendingRelic) => ({
        relicNumber: pendingRelic.relicResourceId,
        effect: pendingRelic.effect,
      }));

      await this.updateEntityRelicEffects(entityId, relicEffectsArray, entityPosition);
      console.log(`Applied ${relicEffectsArray.length} pending relic effects to entity ${entityId}`);
    } catch (error) {
      console.error(`Failed to apply pending relic effects to entity ${entityId}:`, error);
    }

    // Clear the pending effects
    this.pendingRelicEffects.delete(entityId);
  }

  /**
   * Clear all pending relic effects for an entity (called when entity is removed)
   */
  public clearPendingRelicEffects(entityId: number): void {
    const entityPendingSet = this.pendingRelicEffects.get(entityId);
    if (entityPendingSet) {
      console.log(`Cleared ${entityPendingSet.size} pending relic effects for entity ${entityId}`);
      this.pendingRelicEffects.delete(entityId);
    }
  }


  /**
   * Start the periodic relic effect validation timer
   */
  private startRelicValidationTimer(): void {
    // Clear any existing timer first
    this.stopRelicValidationTimer();

    // Set up new timer to run every 5 seconds
    this.relicValidationInterval = setInterval(() => {
      if (this.entityRelicEffects.size > 0) {
        this.validateActiveRelicEffects();
      }
    }, 5000);
  }

  /**
   * Stop the periodic relic effect validation timer
   */
  private stopRelicValidationTimer(): void {
    if (this.relicValidationInterval) {
      clearInterval(this.relicValidationInterval);
      this.relicValidationInterval = null;
    }
  }

  /**
   * Validate all currently displayed relic effects and remove inactive ones
   */
  private async validateActiveRelicEffects(): Promise<void> {
    // Skip validation if no entities have relic effects
    if (this.entityRelicEffects.size === 0) return;

    try {
      const { currentArmiesTick } = getBlockTimestamp();
      let removedCount = 0;
      const entitiesToDelete: number[] = [];

      // Validate entity relic effects
      for (const [entityId, relicEffects] of this.entityRelicEffects) {
        if (relicEffects.length === 0) {
          entitiesToDelete.push(entityId);
          continue;
        }

        // Separate active from inactive effects in a single pass
        const activeRelics: RelicEffectData[] = [];
        const inactiveRelics: RelicEffectData[] = [];

        relicEffects.forEach((relicEffect) => {
          if (isRelicActive(relicEffect.effect, currentArmiesTick)) {
            activeRelics.push(relicEffect);
          } else {
            inactiveRelics.push(relicEffect);
          }
        });

        // Process inactive effects if any
        if (inactiveRelics.length > 0) {
          console.log(`Removing ${inactiveRelics.length} inactive relic effect(s) from entity: entityId=${entityId}`);

          inactiveRelics.forEach((effect) => {
            effect.fx.end();
          });

          // Update stored effects
          if (activeRelics.length === 0) {
            entitiesToDelete.push(entityId);
          } else {
            this.entityRelicEffects.set(entityId, activeRelics);
          }

          removedCount += inactiveRelics.length;
        }
      }

      // Batch delete entities with no active effects
      entitiesToDelete.forEach(entityId => this.entityRelicEffects.delete(entityId));

      if (removedCount > 0) {
        console.log(`Removed ${removedCount} total inactive relic effects`);
      }
    } catch (error) {
      console.error("Error during relic effect validation:", error);
    }
  }

  private storePendingRelicEffects(entityId: number, relicEffects: Array<{ id: number; endTick: number }>): void {
    // Get or create the entity's pending effects set
    let entityPendingSet = this.pendingRelicEffects.get(entityId);
    if (!entityPendingSet) {
      entityPendingSet = new Set();
      this.pendingRelicEffects.set(entityId, entityPendingSet);
    }

    // Clear existing pending effects for this entity and add new ones
    entityPendingSet.clear();
    for (const relicEffect of relicEffects) {
      entityPendingSet.add({
        relicResourceId: relicEffect.id,
        effect: {
          end_tick: relicEffect.endTick,
          usage_left: 1,
        },
      });
    }

    // If no effects, remove the entity from pending
    if (entityPendingSet.size === 0) {
      this.pendingRelicEffects.delete(entityId);
    }
  }

  public clearEntityRelicEffects(entityId: number): void {
    const effects = this.entityRelicEffects.get(entityId);
    if (effects) {
      effects.forEach((effect) => {
        effect.fx.end();
      });
      this.entityRelicEffects.delete(entityId);
    }

    // Also clear any pending effects
    this.clearPendingRelicEffects(entityId);
  }

  public dispose(): void {
    // Stop relic validation timer
    this.stopRelicValidationTimer();

    // Clean up all relic effects
    for (const [entityId] of this.entityRelicEffects) {
      this.clearEntityRelicEffects(entityId);
    }
    this.entityRelicEffects.clear();
    this.pendingRelicEffects.clear();
  }
}
