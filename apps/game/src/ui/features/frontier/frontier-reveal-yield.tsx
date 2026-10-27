import { useGame } from "@/hooks/context/game-context";
import {
  configManager,
  entityMapPosition,
  expeditionDepth,
  readRevealPercent,
  revealYield,
} from "@bibliothecadao/eternum";
import { scaledToUnits, type TroopTier } from "@bibliothecadao/types";

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
