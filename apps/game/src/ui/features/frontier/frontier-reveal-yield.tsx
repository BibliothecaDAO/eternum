import { useGame } from "@/hooks/context/game-context";
import { configManager, readRevealPercent, revealYield } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, type TroopTier } from "@bibliothecadao/types";

/** What each reveal sends home, in whole units; a scout's tenth of a unit reads "Under 1", never zero. */
export const formatRevealYield = (scaled: bigint | undefined): string => {
  if (scaled === undefined) return "—";
  const whole = scaled / BigInt(RESOURCE_PRECISION);
  return whole === 0n ? "Under 1 per reveal" : `${whole.toLocaleString()} per reveal`;
};

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
