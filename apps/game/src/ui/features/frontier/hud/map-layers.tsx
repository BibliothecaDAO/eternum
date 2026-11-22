import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { openPlace } from "@/play/navigation/open-place";
import { requestLayerView } from "@/three/scenes/worldmap-layer-request";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import type { MenuItem } from "@/ui/design-system/kit/hud-elements";
import {
  type EtherealLayer,
  type ExpeditionRules,
  expeditionDepth,
  Position,
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
  /** The layer the camera looks at; none in the realm's view, where no layer is shown. */
  shown: MapLayer | null;
  go: (layer: MapLayer) => void;
};

const LAYER_MODELS = ["RealmKnowledge", "Structure", "DeepRules", "HomeAspect"] as const;

export const useMapLayers = (
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
  player: NativeRows["Structure"] | null,
): MapLayers | null => {
  const facts = useNativeFacts(LAYER_MODELS);
  const camera = useUIStore((state) => state.cameraTargetHex);
  const { isMapView } = useQuery();
  const deepest = realm ? (reachableDepth(facts.store, realm.game_id, realm.entity_id) ?? 0) : 0;
  if (!realm) return null;
  const site = realmSite(facts.store, realm);
  const from = isMapView ? (camera ?? site) : site;
  const sharedDeep = facts.store.get("DeepRules", { game_id: realm.game_id }) !== undefined;
  return {
    layers: [
      0,
      ...Array.from(
        { length: deepest },
        (_, index): MapLayer => (index === 2 && sharedDeep ? "deep" : ((index + 1) as EtherealLayer)),
      ),
    ],
    shown: !isMapView
      ? null
      : from
        ? sharedDeep && isDeepTile(rules.spacing, { ...from, alt: false })
          ? "deep"
          : (expeditionDepth(rules, { y: from.row }) as MapLayer)
        : 0,
    go: (layer) => {
      if (!from) return;
      const fromDeep = sharedDeep && isDeepTile(rules.spacing, { ...from, alt: false });
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

export const layerMark = (layer: MapLayer): IconMeaning => (layer === 0 ? "map" : reachMark(layer === "deep" ? 3 : layer));

export const selectLayer = ({ shown, go }: MapLayers, layer: MapLayer, chosen: () => void = () => {}) => {
  if (layer !== shown) go(layer);
  chosen();
};

export const layerChoices = (mapLayers: MapLayers, chosen: () => void = () => {}): MenuItem[] =>
  mapLayers.layers.map((layer) => ({
    label: layerWord(layer),
    lead: <Icon name={layerMark(layer)} size={22} />,
    checked: layer === mapLayers.shown,
    onSelect: () => selectLayer(mapLayers, layer, chosen),
  }));
