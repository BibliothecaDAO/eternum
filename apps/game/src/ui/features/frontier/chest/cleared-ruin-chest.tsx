import { useGame } from "@/hooks/context/game-context";
import { type ChestPrize, chestRewardPrizes } from "@/three/rewards/chest-reward-reveal";
import { requestRewardChest } from "@/three/scenes/worldmap-reward-chest-request";
import { type Tier, TROOPS, XP } from "@/ui/design-system/kit/words";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { formatShort, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useEffect } from "react";

import { siteClearXp } from "../sites/site-card-plan";
import { closeRuinChest, useRuinChest } from "../sites/site-clear-moment";

/**
 * A cleared ruin's chest, opened as Blitz's chests open (owner, 28 October 2026: "I want a real animation, like the
 * chest opening in blitz, but on the center of the screen"): the world map stages it at the screen's centre, where it
 * arrives, opens in its tier's glow and gives what the clear paid (its LORDS, the clear's XP, the troops it cost), then
 * goes by itself. Nothing to press, no panel; the map stays in play.
 */
export const ClearedRuinChest = () => {
  const opening = useRuinChest();
  const { setup } = useGame();
  const chest = opening && ruinChest(setup.store, opening.siteId);
  useEffect(() => {
    if (!opening || !chest) return;
    requestRewardChest({
      rarity: chest.tier,
      prizes: ruinChestPrizes(chest.lords, clearedSiteXp(setup.store, opening.siteId), opening.troopsLost),
    });
    closeRuinChest();
  }, [opening, chest?.tier, chest?.lords, setup.store]);
  return null;
};

/** What a ruin's chest gives as it opens: its LORDS, as every chest shows them, the clear's XP and the troops lost. */
export const ruinChestPrizes = (lords: number, xp: number | undefined, troopsLost: number): ChestPrize[] => [
  ...chestRewardPrizes({ kind: "lords", amount: lords }),
  ...(xp !== undefined ? [{ name: XP, figure: `${formatShort(xp, { signed: true })} ${XP}` }] : []),
  ...(troopsLost > 0 ? [{ icon: "skull" as const, name: TROOPS, figure: `−${formatShort(troopsLost)}` }] : []),
];

/** A cleared ruin's tier and actual credited amount; unavailable until the clear receipt is known. */
const ruinChest = (store: NativeFactStore, siteId: number): { tier: Tier; lords: number } | undefined => {
  const chest = store.get("SiteChest", { game_id: configManager.getActiveGameId(), entity_id: siteId });
  // The contract's tiers run 0 (common) to 4 (legendary); the kit counts from 1.
  const site = store.get("ExpeditionSite", { game_id: configManager.getActiveGameId(), entity_id: siteId });
  return chest && site?.clear?.reward
    ? { tier: (chest.tier + 1) as Tier, lords: Number(site.clear.reward.amount) / RESOURCE_PRECISION }
    : undefined;
};

/** The XP the cleared site paid, from the guard it started with; unknown once its row has left the store. */
const clearedSiteXp = (store: NativeFactStore, siteId: number): number | undefined => {
  const site = store.get("ExpeditionSite", { game_id: configManager.getActiveGameId(), entity_id: siteId });
  return site && siteClearXp(site);
};
