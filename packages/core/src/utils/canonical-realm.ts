import canonicalRealms from "../data/canonical-realms.json";

/** A Realm's immutable canonical traits; gameplay state still comes from the selected world. */
interface CanonicalRealm {
  name: string;
  /** Its Order's id, as `orders` numbers them. */
  order: number;
  /** The resources it was minted with, by name. */
  resources: string[];
  /** Its wonder, for the 50 Realms minted with one. */
  wonder: string | null;
}

/**
 * The 8,000 Realms, by number less one: each one's name, Order id, resources (indexes into `resources`) and, for the 50
 * that have one, its wonder (an index into `wonders`).
 */
const table = canonicalRealms as {
  resources: string[];
  wonders: string[];
  realms: [name: string, order: number, resources: number[], wonder?: number][];
};

/** A Realm's canonical traits, by its number (1 to 8000). */
export function canonicalRealm(realmId: number): CanonicalRealm {
  if (!Number.isInteger(realmId) || realmId < 1 || realmId > table.realms.length) {
    throw new Error("Choose a realm number from 1 to 8000.");
  }
  const [name, order, resources, wonder] = table.realms[realmId - 1]!;
  return {
    name,
    order,
    resources: resources.map((resource) => table.resources[resource]!),
    wonder: wonder === undefined ? null : table.wonders[wonder]!,
  };
}
