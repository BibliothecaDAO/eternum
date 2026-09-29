import { ID, Troops, TroopTier, TroopType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "./config-manager";
import { fullAtTick, staminaAt, troopStaminaLimits, resolveExplorerTroops } from "./troop-stamina";

export class StaminaManager {
  constructor(
    private store: NativeFactStore,
    private armyEntityId: ID,
  ) {}

  public getStamina(currentArmiesTick: number) {
    const explorer = this.store.get("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: this.armyEntityId,
    });
    if (!explorer) return undefined;

    const troops = resolveExplorerTroops(this.store, explorer);
    return troops ? StaminaManager.getStamina(troops, currentArmiesTick) : undefined;
  }

  /** The active game's stamina, for the client that has one active game. */
  public static getStamina(troops: Troops, currentArmiesTick: number) {
    return staminaAt(troops, currentArmiesTick, configManager.getTroopStaminaRules());
  }

  /** The first tick at which the troops are full under the active game's rules; null when stamina never refills. */
  public static getFullAtTick(troops: Troops, currentArmiesTick: number): number | null {
    return fullAtTick(troops, currentArmiesTick, configManager.getTroopStaminaRules());
  }

  public static getMaxStamina = (troopCategory: TroopType, troopTier: TroopTier, resolvedMaximum?: number): number =>
    resolvedMaximum ?? troopStaminaLimits(configManager.getTroopStaminaRules(), troopCategory, troopTier).staminaMax;
}
