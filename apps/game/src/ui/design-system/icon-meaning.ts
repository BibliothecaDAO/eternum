import meanings from "../../../asset-sources/facets/semantic-map.json";
import resources from "../../../asset-sources/facets/resources.json";
import type { ResourcesIds } from "@bibliothecadao/types";

/**
 * The brand's marks the app draws, each the Realms Brand Kit v3 drawing for the size it is shown at (the kit's README:
 * the lettered mark above 120 px, the contour globe from 64 to 120 px, the small globe below 64 px). Exported from the
 * kit by scripts/build-brand.sh; the static pages (index.html, public/*.html) name the same files.
 */
export const REALMS_MARK = {
  /** The parent mark with its word, above 120 px: the first frame. */
  lettered: "/images/logos/realms-lettered.webp",
  /** The unlettered globe, 64 to 120 px: a loader. */
  contour: "/images/logos/realms-contour.webp",
  /** The retained small globe, under 64 px: the bar's mark. */
  small: "/images/logos/realms-small.webp",
} as const;

/** Frontier's complete lockup, with real alpha, for a painting or a dark field. */
export const FRONTIER_LOCKUP = "/images/logos/frontier-lockup.webp";

export type IconMeaning = keyof typeof meanings;
export type IconPixels = 64 | 128 | 256;
export const iconMeanings = Object.keys(meanings) as IconMeaning[];

type Meaning = { label: string; family: string; rotation?: number; orderId?: number } & (
  | { art: string; token?: never; rewardChest?: never }
  | { token: string; art?: never; rewardChest?: never }
  | { rewardChest: string; art?: never; token?: never }
);
export function iconDefinition(name: IconMeaning): Meaning {
  const definition: Meaning = meanings[name];
  if (!definition) throw new Error(`Unknown icon meaning: ${name}`);
  return definition;
}

export function iconUrl(name: IconMeaning, pixels: IconPixels = 64): string {
  const definition = iconDefinition(name);
  if (definition.rewardChest) return `/images/blitz-chests/${definition.rewardChest}.webp`;
  return definition.token ? `/tokens/${definition.token}.svg` : `/icons/facets/${pixels}/${definition.art}.webp`;
}

/** A resource's artwork, by its id: the one way to name a resource's icon (a display name is not a key). */
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
