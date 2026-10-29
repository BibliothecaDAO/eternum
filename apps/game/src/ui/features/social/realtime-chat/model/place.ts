import type { MapSelectionIntent } from "@/hooks/store/map-selection";
import { readStructureMeaning, troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { type IconMeaning, iconMeanings } from "@/ui/design-system/icon-meaning";
import { MAP_SITES, type MapSiteKind, mapSite, mapSiteOf } from "@/ui/features/frontier/sites/map-site-plan";
import { activeTileOccupancy, getEntityName } from "@bibliothecadao/eternum";
import type { GameRef, NativeFactStore } from "@bibliothecadao/eternum/game-client";

/** A tile of the map, on its layer (the surface, or the depth below). */
interface PlaceTile {
  col: number;
  row: number;
  alt: boolean;
}

/**
 * The game a place stands in: its shard's chain and its id there, which name it, and its name from its shard's
 * directory (GameProfile.name), which a player in another game reads.
 */
export type PlaceGame = GameRef & { name: string };

/** What a place is on its game's map: an army, a structure (a realm, a camp, ...), or a site on a tile (MAP_SITES). */
type PlaceTarget =
  | { kind: "army"; entityId: number }
  | { kind: "structure"; entityId: number }
  | { kind: "site"; site: MapSiteKind; tile: PlaceTile };

/**
 * A place on the map a message carries, in its metadata: the game it stands in (its shard's chain and its id there:
 * an entity's number names nothing in another game), what it is, its name and painting as the map gave them when it
 * was shared, and when, on the chain's clock. Where it stands is read when it is opened, so an army is found where it
 * has gone since, and one that is gone opens nothing.
 */
export type SharedPlace = PlaceTarget & {
  game: PlaceGame;
  name: string;
  icon: IconMeaning;
  /** When it was shared (chain seconds): Frontier's map is built again each day, so a place from a closed day is gone. */
  at: number;
};

/** The metadata a message carrying a place is sent with. */
export const placeMetadata = (place: SharedPlace) => ({ place });

const ICONS: ReadonlySet<string> = new Set(iconMeanings);
const SITES: ReadonlySet<string> = new Set(MAP_SITES.map((site) => site.kind));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Whether two references name one game: the same chain (its id in any case) and the same id there. */
export const sameGame = (a: GameRef, b: GameRef) =>
  a.chainId.toLowerCase() === b.chainId.toLowerCase() && a.gameId === b.gameId;

const gameOf = (value: unknown): PlaceGame | null =>
  isRecord(value) &&
  typeof value.chainId === "string" &&
  /^0x[0-9a-f]+$/i.test(value.chainId) &&
  Number.isSafeInteger(value.gameId) &&
  typeof value.name === "string"
    ? { chainId: value.chainId.toLowerCase(), gameId: value.gameId as number, name: value.name }
    : null;

const targetOf = (place: Record<string, unknown>): PlaceTarget | null => {
  const { kind, entityId, site, tile } = place;
  if ((kind === "army" || kind === "structure") && Number.isSafeInteger(entityId))
    return { kind, entityId: entityId as number };
  if (
    kind === "site" &&
    typeof site === "string" &&
    SITES.has(site) &&
    isRecord(tile) &&
    Number.isSafeInteger(tile.col) &&
    Number.isSafeInteger(tile.row) &&
    typeof tile.alt === "boolean"
  )
    return {
      kind,
      site: site as MapSiteKind,
      tile: { col: tile.col as number, row: tile.row as number, alt: tile.alt },
    };
  return null;
};

/** The place a message carries; none when it carries none, or its metadata is not a place's. */
export const placeOf = (metadata: Readonly<Record<string, unknown>> | undefined): SharedPlace | null => {
  const place = metadata?.place;
  if (!isRecord(place)) return null;
  const game = gameOf(place.game);
  const target = targetOf(place);
  const { name, icon, at } = place;
  return game &&
    target &&
    typeof name === "string" &&
    typeof icon === "string" &&
    ICONS.has(icon) &&
    typeof at === "number"
    ? { ...target, game, name, icon: icon as IconMeaning, at }
    : null;
};

/**
 * A message as plain words (the chat strip's line): its words, then the place it carries named as the chat names it
 * (`placeName`, the chip's own name). A message sent with a place and no words was written as the place's name when
 * sent (`sentName`), and reads as the place's name alone.
 */
export const messageWords = (content: string, sentName: string | null, placeName: string | null): string =>
  placeName === null ? content : content.trim() === sentName ? placeName : `${content} ${placeName}`;

/**
 * A place as its game's map holds it now (`store`, the game named `game`), named and painted as the map names and
 * paints it: an army or a structure by getEntityName and its troops' or its own painting, a site by MAP_SITES while
 * its tile still holds it. None once the map holds it no more.
 */
export const placeOnMap = (
  store: NativeFactStore,
  game: PlaceGame,
  target: PlaceTarget,
  at: number,
): SharedPlace | null => {
  const gameId = game.gameId;
  if (target.kind === "site") {
    const holds = mapSiteOf(activeTileOccupancy(store, { game_id: gameId, ...target.tile })?.category);
    const site = mapSite(target.site);
    return holds?.kind === target.site ? { ...target, game, name: site.name, icon: site.icon, at } : null;
  }
  const name = getEntityName(target.entityId, store);
  if (!name) return null;
  if (target.kind === "army") {
    const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: BigInt(target.entityId) });
    return army ? { ...target, game, name, icon: troopMeaning(army.troops), at } : null;
  }
  const structure = store.get("Structure", { game_id: gameId, entity_id: target.entityId });
  return structure ? { ...target, game, name, icon: readStructureMeaning(store, structure), at } : null;
};

/**
 * The place selected on the map, as a message carries it: an army, a structure, or the site on a selected tile (on the
 * map's layer, `alt`). A bare tile is no place to share.
 */
export const sharedPlaceOf = (
  store: NativeFactStore,
  game: PlaceGame,
  selection: MapSelectionIntent,
  alt: boolean,
  now: number,
): SharedPlace | null => {
  if (selection?.kind === "army" || selection?.kind === "structure")
    return placeOnMap(store, game, { kind: selection.kind, entityId: Number(selection.entityId) }, now);
  if (selection?.kind !== "hex") return null;
  const tile = { col: selection.hex.col, row: selection.hex.row, alt };
  const site = mapSiteOf(activeTileOccupancy(store, { game_id: game.gameId, ...tile })?.category);
  return site ? placeOnMap(store, game, { kind: "site", site: site.kind, tile }, now) : null;
};
