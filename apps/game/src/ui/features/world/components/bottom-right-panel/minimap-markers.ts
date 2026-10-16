import {
  hasTileOccupier,
  getStructureInfoFromTileOccupier,
  getExplorerInfoFromTileOccupier,
} from "@bibliothecadao/eternum";
import { TileOccupier } from "@bibliothecadao/types";
import type { MinimapTile } from "./hex-minimap";
import { configManager, getExplorerOwner } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import type { FactView } from "@/sync/fact-views";
import { arePlayersAllied } from "@/utils/entity-ownership";
import { mineMeaning, structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import type { MarkerOwner } from "@/ui/design-system/hex-marker";
export interface MinimapMarker {
  name: IconMeaning;
  owner: MarkerOwner;
  value?: string;
}
export const minimapMarkersView: FactView<Map<string, MinimapMarker>> = {
  models: ["Structure", "ExplorerTroops", "GuildMember"],
  read: (store, viewer) => {
    const game = configManager.getActiveGameId();
    const ownership = (owner: bigint): MarkerOwner =>
      owner === 0n || viewer === null
        ? "neutral"
        : owner === BigInt(viewer)
          ? "you"
          : arePlayersAllied(store, viewer, owner)
            ? "ally"
            : "enemy";
    const markers = new Map<string, MinimapMarker>();
    for (const row of store.inGame("Structure", game)) {
      const category = row.base.category;
      const name =
        category === StructureType.Realm
          ? "map-realm"
          : category === StructureType.Village
            ? "map-village"
            : category === StructureType.Mine
              ? mineMeaning(row.metadata.mine_kind)
              : structureMeaning(category);
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

/** Native facts win; fixture tiles supply the same readings at the renderer boundary. */
export function resolveMinimapMarker(
  tile: MinimapTile,
  markers?: ReadonlyMap<string, MinimapMarker>,
  ownedStructures: ReadonlySet<string> = new Set(),
  ownedArmies: ReadonlySet<string> = new Set(),
): MinimapMarker | null {
  const type = tile.occupier_type ?? 0;
  if (!hasTileOccupier(type)) return null;
  const id = tile.occupier_id ?? "";
  const known = id && id !== "0" ? markers?.get(id) : undefined;
  if (known) return known;
  const owner = tile.ownerCue ?? (ownedStructures.has(id) || ownedArmies.has(id) ? "you" : "neutral");
  if (type === TileOccupier.Spire || type === TileOccupier.DormantSpire) return { name: "spire", owner };
  if (type === TileOccupier.Shrine) return { name: "shrine", owner };
  if (type === TileOccupier.Well) return { name: "well", owner };
  if (type === TileOccupier.ReservedHyperstructure) return { name: "hyperstructure", owner };
  if (type === TileOccupier.Chest) return { name: "chest", owner };
  const structure = getStructureInfoFromTileOccupier(type);
  if (structure)
    return {
      name:
        structure.type === StructureType.Realm
          ? "map-realm"
          : structure.type === StructureType.Village
            ? "map-village"
            : structure.type === StructureType.Mine
              ? tile.mineKind === undefined
                ? "map-mine"
                : mineMeaning(tile.mineKind)
              : structureMeaning(structure.type),
      owner,
      value: structure.type === StructureType.Realm ? String(structure.level) : undefined,
    };
  if (getExplorerInfoFromTileOccupier(type))
    return {
      name: "map-army",
      owner,
      value:
        tile.strength === undefined ? undefined : tile.strength < 1000 ? "•" : tile.strength <= 5000 ? "••" : "•••",
    };
  return null;
}
