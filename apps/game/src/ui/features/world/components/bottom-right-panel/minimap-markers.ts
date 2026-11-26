import { configManager, getExplorerOwner, readDefaultTick, realmShowsWonder } from "@bibliothecadao/eternum";
import {
  isAspectAlly,
  readSyncedDeepSites,
  viewerAspects,
  type DeepSiteView,
} from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import type { FactView } from "@/sync/fact-views";
import { sideOf, watchedSide } from "@/utils/entity-ownership";
import {
  deepSiteMeaning,
  mineMeaning,
  readStructureMeaning,
  realmMarkerMeaning,
} from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import type { MarkerOwner } from "@/ui/design-system/hex-marker";
export interface MinimapMarker {
  name: IconMeaning;
  owner: MarkerOwner;
  value?: string;
  undefended?: boolean;
  scale?: number;
}
const DEEP_SITE_SCALE = 1.75;
const LOCKED_SITE_SCALE = 1.45;
export const minimapMarkersView: FactView<Map<string, MinimapMarker>> = {
  models: [
    "Structure",
    "RealmSkin",
    "ExplorerTroops",
    "PlayerEntry",
    "GameRegistry",
    "ExpeditionSite",
    "SliceRules",
    "SettlementRules",
    "DepthRules",
    "HomeAspect",
    "DeepSite",
    "DeepEntries",
    "DeepRules",
    "DeepTick",
    "Guard",
    "GarrisonSlot",
    "TileOccupancy",
  ],
  read: (store, viewer) => {
    const game = configManager.getActiveGameId();
    const account = viewer === null ? null : BigInt(viewer);
    // Whose a mark is by the map labels' own rules: a watching viewer's seat colours, else the viewer's side.
    const ownership = (owner: bigint, isAlly: boolean): MarkerOwner => {
      const watched = watchedSide(owner);
      if (watched) return watched.seat === null ? "nobody" : `seat-${watched.seat}`;
      return sideOf({
        isMine: account !== null && owner === account,
        isAlly,
        owner: { address: owner },
      });
    };
    const aspects = viewerAspects(store, game, account);
    const markers = new Map<string, MinimapMarker>();
    for (const row of store.inGame("Structure", game)) {
      const category = row.base.category;
      if (category === StructureType.DeepSite) continue;
      const name =
        category === StructureType.Realm
          ? realmMarkerMeaning(row.base.level, realmShowsWonder(store, row))
          : category === StructureType.Village
            ? "map-village"
            : category === StructureType.Mine
              ? mineMeaning(row.metadata.mine_kind)
              : readStructureMeaning(store, row);
      markers.set(String(row.entity_id), {
        name,
        owner: ownership(row.owner, false),
        value: category === StructureType.Realm ? String(row.base.level) : undefined,
      });
    }
    for (const site of readSyncedDeepSites(store, readDefaultTick(), game)) {
      markers.set(String(site.id), deepSiteMarker(site, aspects, ownership));
    }
    for (const row of store.inGame("ExplorerTroops", game)) {
      const count = Number(row.troops.count) / RESOURCE_PRECISION;
      const owner = getExplorerOwner(store, row);
      const mine = account !== null && owner === account;
      markers.set(String(row.explorer_id), {
        name: "map-army",
        owner: ownership(owner, !mine && isAspectAlly(store, game, account, row.owner)),
        value: count < 1000 ? "•" : count <= 5000 ? "••" : "•••",
      });
    }
    return markers;
  },
};

const deepSiteMarker = (
  site: DeepSiteView,
  aspects: ReadonlySet<number>,
  ownership: (owner: bigint, isAlly: boolean) => MarkerOwner,
): MinimapMarker => {
  if (!site.open) return { name: "lock", owner: "nobody", scale: LOCKED_SITE_SCALE };
  const held = site.aspect !== 0 && site.holder !== 0n;
  return {
    name: deepSiteMeaning(site.kind),
    owner: held ? ownership(site.holder, aspects.has(site.aspect)) : "nobody",
    undefended: held && site.garrisons.length === 0,
    scale: DEEP_SITE_SCALE,
  };
};
