import { ClearedSiteSheet, SiteReceipt, useSelectedClearedSite } from "./sites/site-receipt";
import { useQuery } from "@/hooks/helpers/use-query";
import { useChestOpening } from "@/hooks/store/use-chest-opening-store";
import { ChestTilePanel } from "@/ui/features/military/chest/chest-tile-panel";
import { formatTilePanelTitle } from "@/ui/features/world/components/bottom-right-panel/tile-panel-title";
import { RealmSpireSheet, useSelectedSpire } from "./spire-card";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { ReactNode } from "react";
import { siteDisplayName } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildSheet, useOpenPlot } from "./build/build-sheet";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { closeFightResult, useFightResult } from "./sites/fight-result";
import { FightResultCard } from "./sites/fight-result-card";
import { MapSiteCard, useSelectedMapSite } from "./sites/map-site-card";
import { attackTargetName } from "./sites/site-marks";
import { TileCard, useSelectedTarget } from "./sites/tile-card";
import { SpireCard, useSelectedTileObject } from "./sites/tile-object-cards";
import { CastleUpgrade, useKeepSelected } from "./upgrade/castle-upgrade";
import { TransferTroopsSheet, useSelectedTransfer } from "./army/transfer-troops";
import { BuildingCard } from "./building/building-card";
import { useTappedBuilding } from "./research/selected-building";

/**
 * What the player tapped, as its Frontier card, with its key: which card it is and for which tile, so the HUD's one
 * panel (useOnePanel) knows when a card opens; null when the selection opens none. An open plot of the realm opens the
 * build sheet, the keep its card, a standing building its own card, an adjacent friendly army its troop transfer, a standing site or enemy army
 * its tile card, a Shrine or Well its use card, and a spire or reward chest its own card; so does an army selected on or
 * beside its realm's spire, the spire's (useSelectedSpire). Cleared sites and opened
 * chests keep their receipts on the tile.
 * A cleared site shows its receipt even with an army on the tile. Other empty tiles and armies the dock already
 * shows open no card. The player's own attack result stands in its tile's card while that tile is selected: any other
 * pick opens its own card at once, and coming back to the tile shows the result again until it is closed.
 */
export const useSelectionCard = ({
  realm,
  onResearch,
}: {
  realm: NativeRows["Structure"] | null;
  /** Opens Research, on a node where the card names one, for a card whose next step is there. */
  onResearch: (node?: string) => void;
}): { key: string; sheet: ReactNode } | null => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const mapLayer = useUIStore((state) => state.mapLayer);
  const opening = useChestOpening(selectedHex);
  const fight = useFightResult();
  const openPlot = useOpenPlot(realm);
  const target = useSelectedTarget();
  const cleared = useSelectedClearedSite();
  const mapSite = useSelectedMapSite();
  const tileObject = useSelectedTileObject();
  const keep = useKeepSelected(realm);
  const building = useTappedBuilding(realm);
  const spire = useSelectedSpire();
  const transfer = useSelectedTransfer(realm);
  const closeSelectedTile = useUIStore((state) => state.closeSelectedTile);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const selectOnMap = useUIStore((state) => state.selectOnMap);
  const selectedArmy = useUIStore((state) => state.entityActions.selectedEntityId);
  const close = () => {
    closeSelectedTile();
    setSelectedBuildingHex(null);
  };
  const letGoOfAll = () => {
    selectOnMap(null);
    setSelectedBuildingHex(null);
  };
  // The result stands in the target's card, under the card's name: closing it (its close, Escape) closes the card, not
  // back to before the fight.
  const closeFight = () => {
    closeFightResult();
    close();
  };
  const at = `${selectedHex?.col},${selectedHex?.row}:${selectedBuildingHex?.innerCol},${selectedBuildingHex?.innerRow}`;
  const card = (kind: string, sheet: ReactNode) => ({ key: `${kind}@${at}`, sheet });
  if (fight && selectedHex && fight.tile.col === selectedHex.col && fight.tile.row === selectedHex.row)
    return card(
      "fight",
      <HudSheet
        label={fight.site === "Army" ? attackTargetName(fight.site) : siteDisplayName(fight.targetId)}
        onClose={closeFight}
      >
        <FightResultCard result={fight} onClose={closeFight} />
      </HudSheet>,
    );
  if (realm && transfer) return card("transfer", <TransferTroopsSheet realm={realm} pair={transfer} onClose={close} />);
  if (realm && openPlot)
    return card("plot", <BuildSheet realm={realm} plot={openPlot} onResearch={onResearch} onClose={close} />);
  if (target)
    return card(
      "target",
      <TileCard selected={target} onClose={close} receipt={cleared ? <SiteReceipt selected={cleared} /> : undefined} />,
    );
  if (cleared) return card("cleared", <ClearedSiteSheet selected={cleared} onClose={close} />);
  if (mapSite) return card("site", <MapSiteCard selected={mapSite} onClose={close} />);
  if (selectedHex && isMapView && !mapLayer && (tileObject?.kind === "chest" || opening?.kind === "lords"))
    return card(
      "chest",
      <HudSheet label="Reward Chest" onClose={close}>
        <ChestTilePanel
          rewardChestId={tileObject?.kind === "chest" ? tileObject.tile.occupierId : undefined}
          opening={opening}
          selectedHex={selectedHex}
          coordsLabel={formatTilePanelTitle("Chest Tile", selectedHex)}
        />
      </HudSheet>,
    );
  if (tileObject?.kind === "spire") return card("spire", <SpireCard onClose={close} />);
  // A spire's card is the spire's for the army selected, whichever tile was tapped: a surface letting go of the tile
  // leaves it the same card, which stays put away. Closed, it lets go of the army too, which would open it again.
  if (spire)
    return {
      key: `realm-spire@${spire.col},${spire.row}:${selectedArmy ?? "none"}`,
      sheet: <RealmSpireSheet spire={spire} onResearch={onResearch} onClose={letGoOfAll} />,
    };
  if (realm && keep) return card("keep", <CastleUpgrade realm={realm} onResearchPage={onResearch} onClose={close} />);
  if (realm && building)
    return card(
      "building",
      <BuildingCard realm={realm} building={building} onResearchPage={onResearch} onClose={close} />,
    );
  return null;
};
