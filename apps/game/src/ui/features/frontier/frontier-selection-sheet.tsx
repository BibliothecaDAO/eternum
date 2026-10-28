import { ClearedSiteSheet, SiteReceipt, useSelectedClearedSite } from "./sites/site-receipt";
import { useQuery } from "@/hooks/helpers/use-query";
import { useChestOpening } from "@/hooks/store/use-chest-opening-store";
import { ChestTilePanel } from "@/ui/features/military/chest/chest-tile-panel";
import { formatTilePanelTitle } from "@/ui/features/world/components/bottom-right-panel/tile-panel-title";
import { RealmSpireSheet, useSelectedSpire } from "./spire-card";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { ReactNode } from "react";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildSheet, useOpenPlot } from "./build/build-sheet";
import { HudSheet } from "@/ui/design-system/kit/hud-elements";
import { MapSiteCard, useSelectedMapSite } from "./sites/map-site-card";
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
 * its tile card, a Shrine or Well its use card, and a spire or reward chest its own card. Cleared sites and opened
 * chests keep their receipts on the tile.
 * A cleared site shows its receipt when the player selects its tile (owner, 27 October 2026: "this stays of course"),
 * another's army on it too, in that army's card. The player's own army selected where it stands is the army's panel,
 * whatever site it stands on (owner, 28 October 2026: "when I click on a tile that was cleared but an army is standing
 * on it, army panel must be displayed not the cleared one"); the clear's Feed row selects the tile itself, and shows the
 * receipt. Its spire too: Spire on the army's panel, or a tap on the spire's tile, opens the spire's card for it. Other empty tiles and armies the dock already shows open no card. No card takes the panel after a fight: a
 * clear hands it back to the army (onArmyBack), and the Feed tells how the fight went.
 */
export const useSelectionCard = ({
  realm,
  onResearch,
  onArmyBack,
}: {
  realm: NativeRows["Structure"] | null;
  /** Opens Research, on a node where the card names one, for a card whose next step is there. */
  onResearch: (node?: string) => void;
  /** Hands the HUD back to the army a target's card acted for, once it cleared the target (useArmyPanelOpens). */
  onArmyBack: (armyId: number) => void;
}): { key: string; sheet: ReactNode } | null => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const mapLayer = useUIStore((state) => state.mapLayer);
  const opening = useChestOpening(selectedHex);
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
  const armyWhereItStands = useUIStore(
    (state) => state.mapSelection?.kind === "army" && state.mapSelection.tile === "own",
  );
  const close = () => {
    closeSelectedTile();
    setSelectedBuildingHex(null);
  };
  const at = `${selectedHex?.col},${selectedHex?.row}:${selectedBuildingHex?.innerCol},${selectedBuildingHex?.innerRow}`;
  const card = (kind: string, sheet: ReactNode) => ({ key: `${kind}@${at}`, sheet });
  if (realm && transfer) return card("transfer", <TransferTroopsSheet realm={realm} pair={transfer} onClose={close} />);
  if (realm && openPlot)
    return card("plot", <BuildSheet realm={realm} plot={openPlot} onResearch={onResearch} onClose={close} />);
  if (target)
    return card(
      "target",
      <TileCard
        selected={target}
        onClose={close}
        onArmyBack={onArmyBack}
        receipt={cleared ? <SiteReceipt selected={cleared} /> : undefined}
      />,
    );
  if (cleared && !armyWhereItStands) return card("cleared", <ClearedSiteSheet selected={cleared} onClose={close} />);
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
  if (spire && !armyWhereItStands)
    return card("realm-spire", <RealmSpireSheet spire={spire} onResearch={onResearch} onClose={close} />);
  if (realm && keep) return card("keep", <CastleUpgrade realm={realm} onResearchPage={onResearch} onClose={close} />);
  if (realm && building)
    return card(
      "building",
      <BuildingCard realm={realm} building={building} onResearchPage={onResearch} onClose={close} />,
    );
  return null;
};
