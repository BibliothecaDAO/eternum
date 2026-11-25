import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { SPIRE_WORDS } from "@/ui/design-system/kit/words";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { openPlace } from "@/play/navigation/open-place";
import { requestLayerView } from "@/three/scenes/worldmap-layer-request";
import type { IconMeaning } from "@/ui/design-system/icon";
import {
  type EtherealLayer,
  type ExpeditionRules,
  Position,
  expeditionDepth,
  hasSharedDeep,
  reachableDepth,
  structureMapPosition,
  viewInLayer,
} from "@bibliothecadao/eternum";
import { deepViewFor, isDeepTile, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { layerName } from "@bibliothecadao/types";

import { reachMark } from "../depth-art";

/** A layer the map shows: the day's surface, the world (0), or an Ethereal layer below it. */
export type MapLayer = 0 | EtherealLayer | "deep";

/** The layers a realm can look into, the one the map shows, and the way to each. */
export type MapLayers = {
  /** The world, then each Ethereal layer the realm has researched, in order down. */
  layers: readonly MapLayer[];
  shown: MapLayer;
  go: (layer: MapLayer) => void;
};

const LAYER_MODELS = ["RealmKnowledge", "Structure", "DeepRules", "HomeAspect"] as const;
export const DEEP_LAYER_TIERS: readonly EtherealLayer[] = [1, 2, 3];
const DEEP_TIER: EtherealLayer = 3;

export const layerLockLine = (tier: EtherealLayer) => SPIRE_WORDS.lockedAt(tier);

export const deepLockLine = (store: Parameters<typeof reachableDepth>[0], realm: NativeRows["Structure"]) =>
  (reachableDepth(store, realm.game_id, realm.entity_id) ?? 0) < DEEP_TIER ? layerLockLine(DEEP_TIER) : null;

export const realmLayers = (
  store: Parameters<typeof reachableDepth>[0],
  realm: NativeRows["Structure"],
): MapLayer[] => {
  const deepest = reachableDepth(store, realm.game_id, realm.entity_id) ?? 0;
  const sharedDeep = hasSharedDeep(store, realm.game_id);
  return [
    0,
    ...Array.from(
      { length: deepest },
      (_, index): MapLayer => (index === 2 && sharedDeep ? "deep" : ((index + 1) as EtherealLayer)),
    ),
  ];
};

export const useMapLayers = (
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
  player: NativeRows["Structure"] | null,
): MapLayers | null => {
  const facts = useNativeFacts(LAYER_MODELS);
  const camera = useUIStore((state) => state.cameraTargetHex);
  const { isMapView } = useQuery();
  if (!realm) return null;
  const site = realmSite(facts.store, realm);
  const from = isMapView ? (camera ?? site) : site;
  const sharedDeep = hasSharedDeep(facts.store, realm.game_id);
  return {
    layers: realmLayers(facts.store, realm),
    shown:
      isMapView && from
        ? sharedDeep && isDeepTile(rules.spacing, { ...from, alt: false })
          ? "deep"
          : (expeditionDepth(rules, { y: from.row }) as MapLayer)
        : 0,
    go: (layer) => {
      if (!from) return;
      const fromDeep = isMapView && sharedDeep && isDeepTile(rules.spacing, { ...from, alt: false });
      const origin = fromDeep ? site : from;
      if (!origin) return;
      const to =
        layer === "deep"
          ? deepViewFor(facts.store, realm.game_id, player?.entity_id ?? null, rules.spacing)
          : viewInLayer(rules, origin, layer);
      if (isMapView) requestLayerView(to);
      else openPlace("map", Position.fromContract({ x: to.col, y: to.row }));
    },
  };
};

const realmSite = (store: Parameters<typeof structureMapPosition>[0], realm: NativeRows["Structure"]) => {
  const site = structureMapPosition(store, realm);
  return site && { col: site.x, row: site.y };
};

export const layerWord = (layer: MapLayer): string => layerName(layer === "deep" ? 3 : layer);

export const layerMark = (layer: MapLayer): IconMeaning =>
  layer === 0 ? "map" : reachMark(layer === "deep" ? 3 : layer);

export const selectLayer = ({ shown, go }: MapLayers, layer: MapLayer, chosen: () => void = () => {}) => {
  if (layer !== shown) go(layer);
  chosen();
};

export const unlockedLayerForTier = (mapLayers: MapLayers | null, tier: EtherealLayer): MapLayer | null => {
  if (!mapLayers) return null;
  if (tier === 3) {
    if (mapLayers.layers.includes("deep")) return "deep";
    if (mapLayers.layers.includes(3)) return 3;
    return null;
  }
  return mapLayers.layers.includes(tier) ? tier : null;
};
