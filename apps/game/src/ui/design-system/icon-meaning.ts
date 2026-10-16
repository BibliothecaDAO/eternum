import meanings from "../../../asset-sources/facets/semantic-map.json";
import resources from "../../../asset-sources/facets/resources.json";

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

const resourceNames = Object.fromEntries(
  Object.values(resources).map(({ name, meaning }) => [name.toLowerCase(), meaning as IconMeaning]),
);
const resourceLabels: Record<string, IconMeaning> = {
  strk: "strk",
  house: "home",
  silo: "granary",
  timeglass: "hourglass",
};
export function resourceMeaning(resource: number | string): IconMeaning {
  const id = resources[String(resource) as keyof typeof resources];
  const name = String(resource).replace(/[\s']/g, "").toLowerCase();
  const meaning = id?.meaning ?? resourceNames[name] ?? resourceLabels[name];
  if (!meaning) throw new Error(`Unknown resource icon: ${resource}`);
  return meaning as IconMeaning;
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
