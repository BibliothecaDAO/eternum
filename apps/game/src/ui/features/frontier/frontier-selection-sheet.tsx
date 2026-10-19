import { SiteReceipt, useSelectedClearedSite } from "./sites/site-receipt";
import { structureName } from "@bibliothecadao/types";
import { useQuery } from "@/hooks/helpers/use-query";
import { useChestOpening } from "@/hooks/store/use-chest-opening-store";
import { ChestTilePanel } from "@/ui/features/military/chest/chest-tile-panel";
import { formatTilePanelTitle } from "@/ui/features/world/components/bottom-right-panel/tile-panel-title";
import { FrontierSpireSheet } from "./frontier-spire-sheet";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildSheet, useOpenPlot } from "./build/build-sheet";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { closeFightResult, useFightResult } from "./sites/fight-result";
import { FightResultCard } from "./sites/fight-result-card";
import { MapSiteCard, useSelectedMapSite } from "./sites/map-site-card";
import { TARGET_MARKS } from "./sites/site-marks";
import { TileCard, useSelectedTarget } from "./sites/tile-card";
import { SpireCard, useSelectedTileObject } from "./sites/tile-object-cards";
import { TypeUpgrade } from "./research/type-upgrade";
import { useSelectedBuildingRow } from "./research/selected-building";
import { CastleUpgrade, useKeepSelected } from "./upgrade/castle-upgrade";

/**
 * What the player tapped, as its Frontier card: an open plot of the realm the build sheet, the keep its upgrade sheet,
 * a standing building its type's Upgrade sheet, a standing site or another player's army the tile card, a Shrine or
 * Well its card, a spire or reward chest its own. Cleared sites and opened chests keep their receipts on the tile.
 * A cleared site shows its receipt even with an army on the tile. Other empty tiles and armies the dock already
 * shows open no card. The player's own attack result stands in the card's place until it is closed.
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
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const mapLayer = useUIStore((state) => state.mapLayer);
  const opening = useChestOpening(selectedHex);
  const fight = useFightResult();
  const openPlot = useOpenPlot(realm);
  const target = useSelectedTarget();
  const cleared = useSelectedClearedSite();
  const mapSite = useSelectedMapSite();
  const tileObject = useSelectedTileObject();
  const keep = useKeepSelected(realm);
  const building = useSelectedBuildingRow(realm);
  const closeSelectedTile = useUIStore((state) => state.closeSelectedTile);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const close = () => {
    closeSelectedTile();
    setSelectedBuildingHex(null);
  };
  if (fight)
    return (
      <HudSheet label={TARGET_MARKS[fight.site].word} onClose={closeFightResult}>
        <FightResultCard result={fight} onClose={closeFightResult} />
      </HudSheet>
    );
  if (realm && openPlot) return <BuildSheet realm={realm} plot={openPlot} onResearch={onResearch} onClose={close} />;
  if (target)
    return (
      <TileCard selected={target} onClose={close} receipt={cleared ? <SiteReceipt selected={cleared} /> : undefined} />
    );
  if (cleared)
    return (
      <HudSheet label={structureName(cleared.structure.base.category)} onClose={close}>
        <SiteReceipt selected={cleared} />
      </HudSheet>
    );
  if (mapSite) return <MapSiteCard selected={mapSite} onClose={close} />;
  if (selectedHex && isMapView && !mapLayer && (tileObject?.kind === "chest" || opening?.kind === "lords"))
    return (
      <HudSheet label="Reward Chest" onClose={close}>
        <ChestTilePanel
          rewardChestId={tileObject?.kind === "chest" ? tileObject.tile.occupierId : undefined}
          opening={opening}
          selectedHex={selectedHex}
          coordsLabel={formatTilePanelTitle("Chest Tile", selectedHex)}
        />
      </HudSheet>
    );
  if (tileObject?.kind === "spire") return <SpireCard onClose={close} />;
  if (realm && keep) return <CastleUpgrade realm={realm} onClose={close} />;
  if (realm && building)
    return (
      <TypeUpgrade
        realm={realm}
        rules={rules}
        view={building.view}
        essence={building.essence}
        onResearch={onResearch}
        onClose={close}
      />
    );
  return realm ? <FrontierSpireSheet realm={realm} onClose={close} /> : null;
};
