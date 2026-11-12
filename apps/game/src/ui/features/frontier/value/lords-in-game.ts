import { configManager } from "@bibliothecadao/eternum";

/**
 * Whether the game holds LORDS in play: its preset enables WithdrawLords. Season 1's does not (no LORDS in the game:
 * no chest, no refill for LORDS, no purse), so every LORDS surface of the HUD asks here, never the game's name.
 */
export const lordsInGame = (): boolean => configManager.isCommandEnabled("WithdrawLords");
