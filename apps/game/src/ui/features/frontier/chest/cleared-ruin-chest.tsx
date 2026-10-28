import { useGame } from "@/hooks/context/game-context";
import type { Tier } from "@/ui/design-system/kit/words";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { AnimatePresence } from "framer-motion";

import { siteClearXp } from "../sites/site-card-plan";
import { closeRuinChest, useRuinChest } from "../sites/site-clear-moment";
import { RuinChestMoment } from "./ruin-chest-moment";

/**
 * A cleared ruin's result over the game's facts: its chest opens with its moment (its tier and the LORDS it paid, from
 * its clear receipt), the XP the clear paid and the troops it cost, and goes by itself.
 */
export const ClearedRuinChest = () => {
  const opening = useRuinChest();
  const { setup } = useGame();
  const chest = opening && ruinChest(setup.store, opening.siteId);
  return (
    <AnimatePresence>
      {opening && chest && (
        <RuinChestMoment
          key={opening.shownAt}
          tier={chest.tier}
          lords={chest.lords}
          xp={clearedSiteXp(setup.store, opening.siteId)}
          troopsLost={opening.troopsLost}
          onDone={closeRuinChest}
        />
      )}
    </AnimatePresence>
  );
};

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
