import meanings from "../../../asset-sources/facets/semantic-map.json";
import resources from "../../../asset-sources/facets/resources.json";
import type { ResourcesIds } from "@bibliothecadao/types";

export type IconMeaning = keyof typeof meanings;
export type IconPixels = 64 | 128 | 256;
export const iconMeanings = Object.keys(meanings) as IconMeaning[];

type Meaning = { art: string; label: string; family: string; rotation?: number; orderId?: number };
export function iconDefinition(name: IconMeaning): Meaning {
  const definition: Meaning = meanings[name];
  if (!definition) throw new Error(`Unknown icon meaning: ${name}`);
  return definition;
}

export function iconUrl(name: IconMeaning, pixels: IconPixels = 64): string {
  return `/icons/facets/${pixels}/${iconDefinition(name).art}.webp`;
}

/** A resource's painting, by its id: the one way to name a resource's icon (a display name is not a key). */
export function resourceMeaning(resource: ResourcesIds): IconMeaning {
  const entry = resources[String(resource) as keyof typeof resources];
  if (!entry) throw new Error(`Unknown resource icon: ${resource}`);
  return entry.meaning as IconMeaning;
}

const orderMeanings = new Map(
  iconMeanings.flatMap((name) => {
    const entry = iconDefinition(name);
    return entry.orderId === undefined ? [] : [[entry.orderId, name] as const];
  }),
);
export function orderMeaning(order: number): IconMeaning {
  const meaning = orderMeanings.get(order);
  if (!meaning) throw new Error(`Unknown Order icon: ${order}`);
  return meaning;
}
