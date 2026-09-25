import { ID, Troops, TroopTier, TroopType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "./config-manager";
import { fullAtTick, staminaAt, troopStaminaLimits } from "./troop-stamina";

export class StaminaManager {
  constructor(
    private store: NativeFactStore,
    private armyEntityId: ID,
  ) {}

  public getStamina(currentArmiesTick: number) {
    const troops = this.store.get("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: this.armyEntityId,
    })?.troops;
    if (!troops) return undefined;

    return StaminaManager.getStamina(troops, currentArmiesTick);
  }

  /** The active game's stamina, for the client that has one active game. */
  public static getStamina(troops: Troops, currentArmiesTick: number) {
    return staminaAt(troops, currentArmiesTick, configManager.getTroopStaminaRules());
  }

  /** The first tick at which the troops are full under the active game's rules; null when stamina never refills. */
  public static getFullAtTick(troops: Troops, currentArmiesTick: number): number | null {
    return fullAtTick(troops, currentArmiesTick, configManager.getTroopStaminaRules());
  }

  public static getMaxStamina = (troopCategory: TroopType, troopTier: TroopTier): number =>
    troopStaminaLimits(configManager.getTroopStaminaRules(), troopCategory, troopTier).staminaMax;
}
