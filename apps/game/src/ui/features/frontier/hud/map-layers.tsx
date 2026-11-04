import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requestLayerView } from "@/three/scenes/worldmap-layer-request";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import type { MenuItem } from "@/ui/design-system/kit/hud-elements";
import { depthName, WORLD } from "@/ui/design-system/kit/words";
import {
  type EtherealLayer,
  type ExpeditionRules,
  expeditionDepth,
  researchedDepth,
  structureMapPosition,
  viewInLayer,
} from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { reachMark } from "../depth-art";

/** A layer the map shows: the day's surface, the world (0), or an Ethereal layer below it. */
export type MapLayer = 0 | EtherealLayer;

/** The layers a realm can look into, the one the map shows, and the way to each. */
export type MapLayers = {
  /** The world, then each Ethereal layer the realm has researched, in order down. */
  layers: readonly MapLayer[];
  /** The layer the camera looks at. */
  shown: MapLayer;
  go: (layer: MapLayer) => void;
};

const LAYER_MODELS = ["RealmKnowledge", "Structure"] as const;

/**
 * The map's layers once the realm has researched Ethereal I, its spire a portal into them (owner, 4 November 2026: "its
 * a portal to the ethereal layer bro"): the world and each Ethereal layer it opens. None on the realm's board or before
 * Ethereal I, where the view switch stays Realm / World. Going to a layer keeps the camera's spot and moves it that many
 * regions down the map (viewInLayer), as a spire's portal does; the route's move, like Realm / World's, lets go of what
 * was selected. The one source of the desktop's Map view and the phone's view slot (layerChoices).
 */
export const useMapLayers = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null): MapLayers | null => {
  const facts = useNativeFacts(LAYER_MODELS);
  const camera = useUIStore((state) => state.cameraTargetHex);
  const { isMapView } = useQuery();
  const deepest = realm ? (researchedDepth(facts.store, realm.game_id, realm.entity_id) ?? 0) : 0;
  if (!realm || !isMapView || deepest === 0) return null;
  const from = camera ?? realmSite(facts.store, realm);
  return {
    layers: [0, ...Array.from({ length: deepest }, (_, index) => (index + 1) as EtherealLayer)],
    shown: from ? (expeditionDepth(rules, { y: from.row }) as MapLayer) : 0,
    go: (layer) => {
      if (!from) return;
      requestLayerView(viewInLayer(rules, from, layer));
    },
  };
};

const realmSite = (store: Parameters<typeof structureMapPosition>[0], realm: NativeRows["Structure"]) => {
  const site = structureMapPosition(store, realm);
  return site && { col: site.x, row: site.y };
};

/** A layer's word: World, or Ethereal I to III. */
export const layerName = (layer: MapLayer): string => (layer === 0 ? WORLD : depthName(layer));

/** A layer's painting: the world map's, or the depth's own mark. */
export const layerMark = (layer: MapLayer): IconMeaning => (layer === 0 ? "map" : reachMark(layer));

/** One view in a list of views, by its word and painting: a layer, or a phone's Realm. */
export const viewChoice = (label: string, icon: IconMeaning, checked: boolean, onSelect: () => void): MenuItem => ({
  label,
  lead: <Icon name={icon} size={22} />,
  checked,
  onSelect: checked ? undefined : onSelect,
});

/** The layers as a list's choices, each with its painting, the one shown checked. */
export const layerChoices = ({ layers, shown, go }: MapLayers): MenuItem[] =>
  layers.map((layer) => viewChoice(layerName(layer), layerMark(layer), layer === shown, () => go(layer)));
