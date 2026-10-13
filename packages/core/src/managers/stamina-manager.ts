import { ID, TickIds, Troops, TroopTier, TroopType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "./config-manager";
import { affordableAt, staminaAt, troopStaminaLimits, resolveExplorerTroops } from "./troop-stamina";

export class StaminaManager {
  constructor(
    private store: NativeFactStore,
    private armyEntityId: ID,
  ) {}

  public getStamina(timestamp: number) {
    const explorer = this.store.get("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: this.armyEntityId,
    });
    if (!explorer) return undefined;

    const troops = resolveExplorerTroops(this.store, explorer);
    return troops ? StaminaManager.getStamina(troops, timestamp) : undefined;
  }

  /** The active game's stamina at the chain-proven second used by both figures and actions. */
  public static getStamina(troops: Troops, timestamp: number) {
    return staminaAt(
      troops,
      timestamp,
      configManager.getTroopStaminaRules(),
      Number(configManager.getTick(TickIds.Armies)),
    );
  }

  /** The first second this army can pay the requested stamina cost. */
  public static getAffordableAt(troops: Troops, cost: number, timestamp: number): number | null {
    return affordableAt(
      troops,
      timestamp,
      configManager.getTroopStaminaRules(),
      Number(configManager.getTick(TickIds.Armies)),
      cost,
    );
  }

  public static getMaxStamina = (troopCategory: TroopType, troopTier: TroopTier, resolvedMaximum?: number): number =>
    resolvedMaximum ?? troopStaminaLimits(configManager.getTroopStaminaRules(), troopCategory, troopTier).staminaMax;
}
