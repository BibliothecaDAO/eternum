import { readRealmSkin } from "@/three/structures/realm-skins";
import { configManager, getExplorerOwner } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import type { FactView } from "@/sync/fact-views";
import { arePlayersAllied, sideOf, watchedSide } from "@/utils/entity-ownership";
import { mineMeaning, readStructureMeaning, realmMarkerMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import type { MarkerOwner } from "@/ui/design-system/hex-marker";
export interface MinimapMarker {
  name: IconMeaning;
  owner: MarkerOwner;
  value?: string;
}
export const minimapMarkersView: FactView<Map<string, MinimapMarker>> = {
  models: [
    "Structure",
    "CampaignHome",
    "ExplorerTroops",
    "GuildMember",
    "PlayerEntry",
    "BlitzRoster",
    "GameRegistry",
    "ExpeditionSite",
    "SliceRules",
    "SettlementRules",
    "DepthRules",
  ],
  read: (store, viewer) => {
    const game = configManager.getActiveGameId();
    // Whose a mark is by the map labels' own rules: a watching viewer's seat colours, else the viewer's side.
    const ownership = (owner: bigint): MarkerOwner => {
      const watched = watchedSide(store, owner);
      if (watched) return watched.seat === null ? "nobody" : `seat-${watched.seat}`;
      return sideOf({
        isMine: viewer !== null && owner === BigInt(viewer),
        isAlly: arePlayersAllied(store, viewer, owner),
        owner: { address: owner },
      });
    };
    const markers = new Map<string, MinimapMarker>();
    for (const row of store.inGame("Structure", game)) {
      const category = row.base.category;
      const name =
        category === StructureType.Realm
          ? realmMarkerMeaning(row.base.level, readRealmSkin(store, row))
          : category === StructureType.Village
            ? "map-village"
            : category === StructureType.Mine
              ? mineMeaning(row.metadata.mine_kind)
              : readStructureMeaning(store, row);
      markers.set(String(row.entity_id), {
        name,
        owner: ownership(row.owner),
        value: category === StructureType.Realm ? String(row.base.level) : undefined,
      });
    }
    for (const row of store.inGame("ExplorerTroops", game)) {
      const count = Number(row.troops.count) / RESOURCE_PRECISION;
      markers.set(String(row.explorer_id), {
        name: "map-army",
        owner: ownership(getExplorerOwner(store, row)),
        value: count < 1000 ? "•" : count <= 5000 ? "••" : "•••",
      });
    }
    return markers;
  },
};
