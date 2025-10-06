import { CosmeticRegistryEntry } from "./types";

/**
 * Centralised cosmetic registry. Populate this list to expose new cosmetics to the renderer.
 * Entries are intentionally data-only so gameplay code can remain generic.
 */
const cosmeticRegistry: CosmeticRegistryEntry[] = [];

export function registerCosmetic(entry: CosmeticRegistryEntry) {
  cosmeticRegistry.push(entry);
}

export function getCosmeticRegistry(): readonly CosmeticRegistryEntry[] {
  return cosmeticRegistry;
}

export function findCosmeticById(id: string): CosmeticRegistryEntry | undefined {
  return cosmeticRegistry.find((entry) => entry.id === id);
}

export function clearRegistry() {
  cosmeticRegistry.length = 0;
}
