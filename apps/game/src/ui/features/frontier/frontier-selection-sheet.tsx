import { FrontierSpireSheet } from "./frontier-spire-sheet";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BuildSheet, useOpenPlot } from "./build/build-sheet";
import { MapSiteCard, useSelectedMapSite } from "./sites/map-site-card";
import { TileCard, useSelectedSite } from "./sites/tile-card";
import { ChestCard, SpireCard, useSelectedTileObject } from "./sites/tile-object-cards";
import { CastleUpgrade, useKeepSelected } from "./upgrade/castle-upgrade";

/**
 * What the player tapped, as its Frontier card: an open plot of the realm the build sheet, the keep its upgrade sheet,
 * a standing site the tile card, a Shrine or Well its card, a loose chest or a spire theirs. Anything else, an empty
 * tile, a standing building (its type's tiers are bought at the castle) or an army the dock already shows, has no card
 * and opens nothing.
 */
export const FrontierSelectionSheet = ({ realm }: { realm: NativeRows["Structure"] | null }) => {
  const openPlot = useOpenPlot(realm);
  const site = useSelectedSite();
  const mapSite = useSelectedMapSite();
  const tileObject = useSelectedTileObject();
  const keep = useKeepSelected(realm);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const close = () => {
    setSelectedHex(null);
    setSelectedBuildingHex(null);
  };
  if (realm && openPlot) return <BuildSheet realm={realm} plot={openPlot} onClose={close} />;
  if (site) return <TileCard selected={site} onClose={close} />;
  if (mapSite) return <MapSiteCard selected={mapSite} onClose={close} />;
  if (tileObject?.kind === "chest") return <ChestCard tile={tileObject.tile} onClose={close} />;
  if (tileObject?.kind === "spire") return <SpireCard onClose={close} />;
  if (realm && keep) return <CastleUpgrade realm={realm} onClose={close} />;
  return realm ? <FrontierSpireSheet realm={realm} onClose={close} /> : null;
};
