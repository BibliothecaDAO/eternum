import { useGame } from "@/hooks/context/game-context";
import type { Fix } from "@/ui/design-system/kit/refused-verb";
import { ESSENCE, exploreFor, LABOR } from "@/ui/design-system/kit/words";
import { configManager, readRevealPercent, revealYield } from "@bibliothecadao/eternum";
import { ResourcesIds, type TroopTier } from "@bibliothecadao/types";

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

/** What a reveal pays, by its glossary word: Essence or labor, where a game's reveals pay supplies at all. */
const REVEAL_PAYS: Partial<Record<number, string>> = { [ResourcesIds.Labor]: LABOR, [ResourcesIds.Essence]: ESSENCE };

/**
 * The fix for a shortfall the map can pay: "Explore for labor", leading to the map. None for a resource a reveal never
 * pays, or in a game whose reveals pay no supplies: the button says Map only when the fix is there.
 */
export const exploreFix = (resource: number, toMap: () => void): Fix | undefined => {
  const pays = REVEAL_PAYS[resource];
  if (!pays || !configManager.paysRevealSupplies()) return undefined;
  return { icon: "Mp", word: exploreFor(pays), onFix: toMap };
};
