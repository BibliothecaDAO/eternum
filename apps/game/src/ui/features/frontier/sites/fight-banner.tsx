import "./fight-banner.css";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { Icon } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { FIGHT_RESULT, SUPPLY_POST, TROOPS } from "@/ui/design-system/kit/words";
import { configManager, isSupplyPost, siteDisplayName } from "@bibliothecadao/eternum";
import { formatShort } from "@bibliothecadao/types";
import { useEffect } from "react";
import { create } from "zustand";

import type { SiteClear } from "./site-outcome";

const FIGHT_BANNER_MS = 3_000;

const useFightBannerStore = create<{ clear: SiteClear | null }>(() => ({ clear: null }));

export const showClearBanner = (clear: SiteClear): void => useFightBannerStore.setState({ clear });

const hideClearBanner = (): void => useFightBannerStore.setState({ clear: null });

export const FightBanner = () => {
  const clear = useFightBannerStore((state) => state.clear);
  useEffect(() => {
    if (!clear) return;
    const goes = setTimeout(hideClearBanner, FIGHT_BANNER_MS);
    return () => clearTimeout(goes);
  }, [clear]);
  return clear ? <ClearBanner clear={clear} /> : null;
};

const ClearBanner = ({ clear }: { clear: SiteClear }) => {
  const opensPost = useClearOpenedPost(clear.siteId);
  return (
    <button type="button" role="status" className="ui-panel fight-banner" data-fight-banner onClick={hideClearBanner}>
      <Icon name="victory" size={64} className="fight-banner__crown" />
      <b className="fight-banner__word">{FIGHT_RESULT.victory}</b>
      <span className="fight-banner__site">{FIGHT_RESULT.cleared(siteDisplayName(Number(clear.siteId)))}</span>
      <span className="fight-banner__chips">
        {clear.reward && (
          <HudChip icons={[resourceMeaning(clear.reward.resourceId)]} tone="good">
            {formatShort(clear.reward.amount, { signed: true })}
          </HudChip>
        )}
        {opensPost && <HudChip icons={["flag"]}>{SUPPLY_POST.open}</HudChip>}
        {clear.troopsLost > 0 && (
          <HudChip icons={["troops"]} label={TROOPS} tone="bad">
            {formatShort(-clear.troopsLost, { signed: true })}
          </HudChip>
        )}
      </span>
    </button>
  );
};

const useClearOpenedPost = (siteId: SiteClear["siteId"]) => {
  const { setup } = useGame();
  const now = useCurrentDefaultTick();
  const site = setup.store.get("ExpeditionSite", {
    game_id: configManager.getActiveGameId(),
    entity_id: BigInt(siteId),
  });
  return Boolean(site?.clear && isSupplyPost(setup.store, site, site.clear.home_id, now));
};
