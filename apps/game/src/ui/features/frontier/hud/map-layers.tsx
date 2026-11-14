import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { openPlace } from "@/play/navigation/open-place";
import { requestLayerView } from "@/three/scenes/worldmap-layer-request";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import type { MenuItem } from "@/ui/design-system/kit/hud-elements";
import { DEEP_WORDS, depthName, layerChestLine, REALM, WORLD } from "@/ui/design-system/kit/words";
import type { WorldTab } from "@/ui/features/world/containers/top-header/map-view-controls";
import {
  type EtherealLayer,
  type ExpeditionRules,
  expeditionDepth,
  Position,
  researchedDepth,
  type RuinChest,
  type RuinChests,
  dayOf,
  ruinChestsToday,
  structureMapPosition,
  viewInLayer,
} from "@bibliothecadao/eternum";
import { deepCenter, isDeepTile, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { SCOPE_INPUT_MODELS } from "@bibliothecadao/eternum/game-sync";

import { reachMark } from "../depth-art";
import { usePlayerDay } from "../log/player-day";
import { historyRuinClears } from "./ruin-clears";

/** A layer the map shows: the day's surface, the world (0), or an Ethereal layer below it. */
export type MapLayer = 0 | EtherealLayer | "deep";
/** Every layer, the world then Ethereal I to III. */
const MAP_LAYERS = [0, 1, 2, 3] as const satisfies readonly MapLayer[];

/** The layers a realm can look into, the one the map shows, and the way to each. */
export type MapLayers = {
  /** The world, then each Ethereal layer the realm has researched, in order down. */
  layers: readonly MapLayer[];
  /** The layer the camera looks at; none in the realm's view, where no layer is shown. */
  shown: MapLayer | null;
  go: (layer: MapLayer) => void;
  /** The player's ruin chest on each layer today (useRuinChests); none for a spectator or a visit. */
  chests?: RuinChests | null;
};

const LAYER_MODELS = ["RealmKnowledge", "Structure", "DeepRules"] as const;

/**
 * The map's layers once the realm has researched Ethereal I, its spire a portal into them (owner, 4 November 2026: "its
 * a portal to the ethereal layer bro"): the world and each Ethereal layer it opens. Before Ethereal I only the world,
 * so the view switch stays Realm / World and carries the chests' marks alone, with no list. On the map, going to a layer keeps the camera's spot and moves it that many regions
 * down the map (viewInLayer), as a spire's portal does. In the realm's view too (owner, 6 November 2026: "can I get the
 * dropdown even in realms view?"): no layer is shown there, and a layer opens the map at the realm's site in it. The
 * route's move, like Realm / World's, lets go of what was selected. Each layer carries the player's ruin chest on it
 * today (`player`: none for a spectator, nor on a visit, whose list is the visited realm's). The one source of the
 * desktop's Map view (layerTab) and the phone's view slot (layerViews).
 */
export const useMapLayers = (
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
  player: NativeRows["Structure"] | null,
): MapLayers | null => {
  const facts = useNativeFacts(LAYER_MODELS);
  const chests = useRuinChests(rules, player);
  const camera = useUIStore((state) => state.cameraTargetHex);
  const { isMapView } = useQuery();
  const deepest = realm ? (researchedDepth(facts.store, realm.game_id, realm.entity_id) ?? 0) : 0;
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
      const to = layer === "deep" ? deepCenter(rules.spacing) : viewInLayer(rules, origin, layer);
      if (isMapView) requestLayerView(to);
      else openPlace("map", Position.fromContract({ x: to.col, y: to.row }));
    },
    chests,
  };
};

const realmSite = (store: Parameters<typeof structureMapPosition>[0], realm: NativeRows["Structure"]) => {
  const site = structureMapPosition(store, realm);
  return site && { col: site.x, row: site.y };
};

/** A layer's word: World, or Ethereal I to III. */
const layerName = (layer: MapLayer): string =>
  layer === "deep" ? DEEP_WORDS.title : layer === 0 ? WORLD : depthName(layer);

/** A layer's painting: the world map's, or the depth's own mark. */
const layerMark = (layer: MapLayer): IconMeaning => (layer === 0 ? "map" : reachMark(layer === "deep" ? 3 : layer));

/** One view in a list of views, by its word and painting: a layer, or a phone's Realm. */
const viewChoice = (label: string, icon: IconMeaning, checked: boolean, onSelect: () => void): MenuItem => ({
  label,
  lead: <Icon name={icon} size={22} />,
  checked,
  onSelect,
});

/**
 * The layers as a list's choices, each with its painting, the one shown checked. A choice goes to its layer, the one
 * shown staying put, and then runs `chosen` (a phone puts its open page away, so any choice shows the map).
 */
const layerChoices = ({ layers, shown, go, chests }: MapLayers, chosen: () => void = () => {}): MenuItem[] =>
  layers.map((layer) => ({
    ...viewChoice(layerName(layer), layerMark(layer), layer === shown, () => {
      if (layer !== shown) go(layer);
      chosen();
    }),
    trail: chests && layer !== "deep" && <ChestMark chest={chests[layer]} />,
  }));

/**
 * A phone's view slot over the layers: the layer shown, Realm then each layer, and the four layers' chests under its
 * word. In the realm's view Realm is the choice checked, and choosing it keeps the view (`chosen` puts the open page
 * away).
 */
export const layerViews = (layers: MapLayers, realm: { icon: IconMeaning; go: () => void }, chosen: () => void) => {
  const marks = layers.chests && <LayerChests chests={layers.chests} layers={layers.layers} compact />;
  // Before Ethereal I there is one layer: the switch stays Realm / World, carrying the marks.
  if (layers.layers.length === 1) return { marks };
  return {
    icon: layerMark(layers.shown ?? 0),
    word: layerName(layers.shown ?? 0),
    items: [
      viewChoice(REALM, realm.icon, layers.shown === null, () => (layers.shown === null ? chosen() : realm.go())),
      ...layerChoices(layers, chosen),
    ],
    marks,
  };
};

/** The desktop's World tab over the layers: the layer shown, its list, and the four layers' chests before it opens. */
export const layerTab = (layers: MapLayers): WorldTab => ({
  label: layerName(layers.shown ?? 0),
  menu: layers.layers.length > 1 ? layerChoices(layers) : undefined,
  badge: layers.chests && <LayerChests chests={layers.chests} layers={layers.layers} />,
});

/** What a layer's chest is read from: the receipts and today's discovery, and what the client's scope is derived from. */
const CHEST_MODELS = ["ExpeditionDiscovery", "RealmKnowledge", "GameRelease", ...SCOPE_INPUT_MODELS] as const;

/**
 * The player's ruin chest on each layer today, the World then Ethereal I to III (ruinChestsToday): today's clears from
 * the player's own history of the day when it holds the whole day (the read Today and the day-done card share, so it
 * costs no fetch of its own), else from the clears the client holds. Read again as the day turns, so a new day's
 * chests are open. None for a spectator.
 */
const useRuinChests = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null): RuinChests | null => {
  const facts = useNativeFacts(CHEST_MODELS);
  const now = useNowSeconds();
  const player = useAccountStore((state) => state.account?.address ?? null);
  const snapshotBlock = useConnectionStore((state) => state.snapshotBlock);
  const day = dayOf(rules, now);
  const played = usePlayerDay(player, day, true);
  if (!realm) return null;
  // The history vouches for the facts only once it holds every story through the snapshot the store holds.
  const coversSnapshot =
    played.completeThroughBlock !== null && snapshotBlock !== null && played.completeThroughBlock >= snapshotBlock;
  // A read with no player holds none of their stories, so it proves nothing.
  const history =
    day && player ? historyRuinClears(played, coversSnapshot, realm.entity_id, rules, day.index) : undefined;
  return ruinChestsToday(facts.store, rules, realm, now, history);
};

/**
 * A chest's state as its painting: the chest while it waits, a check once taken, a question while it is not known here
 * (no army holds that layer in view), a lock before the layer is open.
 */
const CHEST_MARKS = {
  open: "chest",
  claimed: "check",
  unknown: "help",
  locked: "lock",
} as const satisfies Record<RuinChest, IconMeaning>;

/**
 * One layer's chest today, at the end of its row in the layer list. The row is chosen by its layer's word, so the mark
 * stays out of its name; the switch's marks (LayerChests) say each layer's chest.
 */
const ChestMark = ({ chest }: { chest: RuinChest }) => (
  <span data-chest={chest} aria-hidden className="ui-chest">
    <Icon name={CHEST_MARKS[chest]} size={18} />
  </span>
);

/**
 * The four layers' chests on the layer switch, read before its list opens: each layer's mark with its chest's state on
 * its corner, faded once its chest is taken or while the layer is locked.
 */
const LayerChests = ({
  chests,
  layers,
  compact = false,
}: {
  chests: RuinChests;
  layers: readonly MapLayer[];
  compact?: boolean;
}) => (
  <span className="ui-layer-chests">
    {MAP_LAYERS.filter((layer) => layer !== 3 || !layers.includes("deep")).map((layer) => (
      <span
        key={layer}
        data-chest={chests[layer]}
        role="img"
        aria-label={layerChestLine(layerName(layer), chests[layer])}
        className="ui-layer-chests__layer"
      >
        <Icon name={layerMark(layer)} size={compact ? 12 : 18} />
        <Icon name={CHEST_MARKS[chests[layer]]} size={compact ? 8 : 11} />
      </span>
    ))}
  </span>
);
