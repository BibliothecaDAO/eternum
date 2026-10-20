import { useGame } from "@/hooks/context/game-context";
import type { Fix } from "@/ui/design-system/kit/refusal";
import { ESSENCE, exploreFor, LABOR } from "@/ui/design-system/kit/words";
import {
  configManager,
  entityMapPosition,
  expeditionDepth,
  readRevealPercent,
  revealYield,
} from "@bibliothecadao/eternum";
import { ResourcesIds, scaledToUnits, type TroopTier } from "@bibliothecadao/types";

import { useExpeditionRules } from "./frontier-home";
import type { DockArmy } from "./hud/dock-armies";

/**
 * An army's per-reveal payout at a depth, scaled, from the game's own depth rules: undefined where the depth has none,
 * null in a game whose reveals pay the drawn exploration reward instead.
 */
const useRevealYield = (troops: { tier: TroopTier; count: bigint }, depth: number): bigint | undefined | null => {
  const { setup } = useGame();
  if (!configManager.paysRevealSupplies()) return null;
  const percent = readRevealPercent(setup.store, configManager.getActiveGameId(), depth);
  return percent === undefined
    ? undefined
    : revealYield(troops, configManager.getTroopConfig().troop_limit_config, percent);
};

/** What the army's next reveal sends home at the depth it stands on, in a player's units, exact (scaledToUnits). */
export const useArmyRevealYield = (army: DockArmy): number | undefined | null => {
  const { setup } = useGame();
  const rules = useExpeditionRules();
  const coord = entityMapPosition(setup.store, configManager.getActiveGameId(), army.explorerId);
  const scaled = useRevealYield(army.troopsFact, rules ? expeditionDepth(rules, coord) : 0);
  if (scaled === null || scaled === undefined) return scaled;
  return scaledToUnits(scaled);
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
  return { icon: "map", word: exploreFor(pays), onFix: toMap };
};
