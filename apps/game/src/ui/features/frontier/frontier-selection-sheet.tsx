import { FrontierSpireSheet } from "./frontier-spire-sheet";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildSheet, useOpenPlot } from "./build/build-sheet";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { closeFightResult, useFightResult } from "./sites/fight-result";
import { FightResultCard } from "./sites/fight-result-card";
import { MapSiteCard, useSelectedMapSite } from "./sites/map-site-card";
import { SITE_MARKS } from "./sites/site-marks";
import { TileCard, useSelectedSite } from "./sites/tile-card";
import { SpireCard, useSelectedTileObject } from "./sites/tile-object-cards";
import { TypeUpgrade } from "./research/type-upgrade";
import { useSelectedBuildingRow } from "./research/selected-building";
import { CastleUpgrade, useKeepSelected } from "./upgrade/castle-upgrade";

/**
 * What the player tapped, as its Frontier card: an open plot of the realm the build sheet, the keep its upgrade sheet,
 * a standing building its type's Upgrade sheet, a standing site the tile card, a Shrine or Well its card, a spire its
 * own. Anything else, an empty tile or an army the dock already shows, has no card and opens nothing. The result of
 * the player's own attack stands in the card's place until it is closed.
 */
export const FrontierSelectionSheet = ({
  rules,
  realm,
  onResearch,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  /** Opens Research, for a card whose next step is there. */
  onResearch: () => void;
}) => {
  const fight = useFightResult();
  const openPlot = useOpenPlot(realm);
  const site = useSelectedSite();
  const mapSite = useSelectedMapSite();
  const tileObject = useSelectedTileObject();
  const keep = useKeepSelected(realm);
  const building = useSelectedBuildingRow(realm);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const close = () => {
    setSelectedHex(null);
    setSelectedBuildingHex(null);
  };
  if (fight)
    return (
      <Sheet label={SITE_MARKS[fight.site].word} onClose={closeFightResult}>
        <FightResultCard result={fight} onClose={closeFightResult} />
      </Sheet>
    );
  if (realm && openPlot) return <BuildSheet realm={realm} plot={openPlot} onResearch={onResearch} onClose={close} />;
  if (site) return <TileCard selected={site} onClose={close} />;
  if (mapSite) return <MapSiteCard selected={mapSite} onClose={close} />;
  if (tileObject?.kind === "spire") return <SpireCard onClose={close} />;
  if (realm && keep) return <CastleUpgrade realm={realm} onClose={close} />;
  if (realm && building)
    return <TypeUpgrade realm={realm} rules={rules} view={building.view} essence={building.essence} onClose={close} />;
  return realm ? <FrontierSpireSheet realm={realm} onClose={close} /> : null;
};
