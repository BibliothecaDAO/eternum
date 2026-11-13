import { readRealmSkin } from "@/three/structures/realm-skins";
import { configManager, currentArmy, getExplorerOwner } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import type { FactView } from "@/sync/fact-views";
import { ALLIANCE_MODELS, arePlayersAllied, sideOf, watchedSide } from "@/utils/entity-ownership";
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
    // Whose side a mark is on reads these (arePlayersAllied).
    ...ALLIANCE_MODELS,
