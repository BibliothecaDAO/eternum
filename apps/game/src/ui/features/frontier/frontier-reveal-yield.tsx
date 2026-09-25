import { useGame } from "@/hooks/context/game-context";
import { configManager, readRevealPercent, revealYield } from "@bibliothecadao/eternum";
import type { TroopTier } from "@bibliothecadao/types";

/**
 * An army's per-reveal payout at a depth, scaled, from the game's own depth rules: undefined where the depth has none,
 * null in a game whose reveals pay the drawn exploration reward instead.
 */
export const useRevealYield = (
  troops: { tier: TroopTier; count: bigint },
  depth: number,
): bigint | undefined | null => {
  const { setup } = useGame();
  if (!configManager.paysRevealSupplies()) return null;
  const percent = readRevealPercent(setup.store, configManager.getActiveGameId(), depth);
  return percent === undefined
    ? undefined
    : revealYield(troops, configManager.getTroopConfig().troop_limit_config, percent);
};
