import type { MapSelectionIntent } from "@/hooks/store/map-selection";
import { readStructureMeaning, troopMeaning } from "@/ui/design-system/domain-icon-meaning";
import { type IconMeaning, iconMeanings } from "@/ui/design-system/icon-meaning";
import { getEntityName } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

/**
 * A place on the map a message carries, in its metadata: what it is (an army, or a structure such as a realm or a
 * site), its name and painting as the map gives them when it was shared, and when, on the chain's clock. Where it stands
 * is read when it is opened, so an army is found where it has gone since, and one that is gone opens nothing.
 */
export interface SharedPlace {
  kind: "army" | "structure";
  entityId: number;
  name: string;
  icon: IconMeaning;
  /** When it was shared (chain seconds): Frontier's map is built again each day, so a place from a closed day is gone. */
  at: number;
}

/** The metadata a message carrying a place is sent with. */
export const placeMetadata = (place: SharedPlace) => ({ place });

const ICONS: ReadonlySet<string> = new Set(iconMeanings);

/** The place a message carries; none when it carries none, or its metadata is not a place's. */
export const placeOf = (metadata: Readonly<Record<string, unknown>> | undefined): SharedPlace | null => {
  const place = metadata?.place;
  if (typeof place !== "object" || place === null) return null;
  const { kind, entityId, name, icon, at } = place as Record<string, unknown>;
  return (kind === "army" || kind === "structure") &&
    Number.isSafeInteger(entityId) &&
    typeof name === "string" &&
    typeof icon === "string" &&
    ICONS.has(icon) &&
    typeof at === "number"
    ? { kind, entityId: entityId as number, name, icon: icon as IconMeaning, at }
    : null;
};

/**
 * A message as plain words (the chat strip's line, a notification): its words, and the place it carries after them.
 * A message sent with a place and no words is written as the place's name, and reads as that name alone.
 */
export const messageWords = (content: string, metadata: Readonly<Record<string, unknown>> | undefined): string => {
  const place = placeOf(metadata);
  return place && content.trim() !== place.name ? `${content} ${place.name}` : content;
};

/**
 * An army or a structure as the map holds it now, named and painted as the map names and paints it (getEntityName, the
 * structure's or troops' own painting); none once the map has it no more.
 */
export const placeOnMap = (
  store: NativeFactStore,
  gameId: number,
  kind: SharedPlace["kind"],
  entityId: number,
  at: number,
): SharedPlace | null => {
  const name = getEntityName(entityId, store);
  if (!name) return null;
  if (kind === "army") {
    const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: BigInt(entityId) });
    return army ? { kind, entityId, name, icon: troopMeaning(army.troops), at } : null;
  }
  const structure = store.get("Structure", { game_id: gameId, entity_id: entityId });
  return structure ? { kind, entityId, name, icon: readStructureMeaning(store, structure), at } : null;
};

/** The place selected on the map, as a message carries it: an army or a structure; a bare tile is no place to share. */
export const sharedPlaceOf = (
  store: NativeFactStore,
  gameId: number,
  selection: MapSelectionIntent,
  now: number,
): SharedPlace | null =>
  selection?.kind === "army" || selection?.kind === "structure"
    ? placeOnMap(store, gameId, selection.kind, Number(selection.entityId), now)
    : null;
