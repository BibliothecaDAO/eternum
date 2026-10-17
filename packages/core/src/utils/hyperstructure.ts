import { safeInteger } from "./safe-integer";
import { type ID, ResourcesIds, StructureType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { configManager } from "../managers";
import { structureMapPosition } from "./expeditions";
import { getTileAt } from "./tile";

type VictoryPointGrants = ReturnType<typeof configManager.getVictoryPointGrants>;

/** A Hyperstructure's rate: the whole points a second it pays whoever holds it, and whether a player holds it now. */
export interface HyperstructureRate {
  pointsPerSecond: number;
  taken: boolean;
}

/**
 * The one rate every surface shows for a Hyperstructure. A held one pays the game's rate times the multiplier its share
 * allocation was struck at when it was taken, zero included, and has no rate until that allocation is known; an
 * untaken one shows what taking it now would pay: the game's rate times 1, or, where the multiplier rule is on, 2 in a
 * Duel or the realms the contract's scan counts around it.
 */
export const getHyperstructureRates = (store: NativeFactStore): Map<ID, HyperstructureRate> => {
  const game_id = configManager.getActiveGameId();
  const grants = configManager.getVictoryPointGrants();
  const rates = new Map<ID, HyperstructureRate>();
  for (const hyperstructure of store.inGame("Structure", game_id)) {
    if (hyperstructure.base.category !== StructureType.Hyperstructure) continue;
    const position = structureMapPosition(store, hyperstructure);
    if (!position) continue;
    const entity_id = safeInteger(hyperstructure.entity_id);
    const shares = store.get("HyperstructureShares", { game_id, entity_id });
    const rate = hyperstructureRate(grants, {
      taken: hyperstructure.owner !== 0n,
      struckMultiplier: shares ? Number(shares.multiplier) : null,
      realmsInScan: realmsInMultiplierScan(store, position),
    });
    if (rate) rates.set(entity_id, rate);
  }
  return rates;
};

/** One Hyperstructure's rate, by the rule above, from what the chain and the map say about it; null while unknown. */
export const hyperstructureRate = (
  grants: Pick<VictoryPointGrants, "hyperstructurePerSecond" | "hyperstructureScale">,
  hyperstructure: { taken: boolean; struckMultiplier: number | null; realmsInScan: number },
): HyperstructureRate | null => {
  const { taken, struckMultiplier, realmsInScan } = hyperstructure;
  if (taken) {
    return struckMultiplier === null
      ? null
      : { pointsPerSecond: grants.hyperstructurePerSecond * struckMultiplier, taken };
  }
  const multiplier =
    grants.hyperstructureScale === "flat" ? 1 : grants.hyperstructureScale === "double" ? 2 : realmsInScan;
  return { pointsPerSecond: grants.hyperstructurePerSecond * multiplier, taken };
};

/** The six turns of the contract's scan: out one way, then half as far another, around the hexagon. */
const SCAN_TURNS = [
  [0, 4],
  [1, 5],
  [2, 0],
  [3, 1],
  [4, 2],
  [5, 3],
] as const;

/**
 * The realms the contract counts for a Hyperstructure's multiplier (hyperstructures.cairo `multiplier`): the six tiles
 * reached by going the scan distance one way and half of it another, the scan distance being the game's settlement
 * spacing, two more in a Single game (settlement_grid.cairo `hyperstructure_scan_distance`). A realm anywhere else,
 * however near, is not counted.
 */
const realmsInMultiplierScan = (store: NativeFactStore, origin: { x: number; y: number }): number => {
  const game_id = configManager.getActiveGameId();
  const { spacing, mode } = configManager.getSettlementConfig();
  const distance = Number(spacing) + (mode === "Single" ? 2 : 0);
  return SCAN_TURNS.filter(([first, second]) => {
    const tile = stepsFrom(stepsFrom(origin, first, distance), second, Math.floor(distance / 2));
    const occupant = getTileAt(store, false, tile.x, tile.y, game_id);
    if (!occupant?.occupier_is_structure) return false;
    const structure = store.get("Structure", { game_id, entity_id: occupant.occupier_id });
    return structure?.base.category === StructureType.Realm;
  }).length;
};

/** A surface tile `distance` steps away in one of six directions, as geometry.cairo `checked_neighbor_at_distance`. */
const stepsFrom = ({ x, y }: { x: number; y: number }, direction: number, distance: number) => {
  const column = x - (y + (y % 2)) / 2;
  const [stepped, row] = [
    [column + distance, y],
    [column, y + distance],
    [column - distance, y + distance],
    [column - distance, y],
    [column, y - distance],
    [column + distance, y - distance],
  ][direction];
  return { x: stepped + (row + (row % 2)) / 2, y: row };
};

/** The words after a Hyperstructure's rate, the same on its map label and its panel. */
export const hyperstructureRateUnit = (taken: boolean): string => (taken ? "points/s" : "points/s once taken");

export const getHyperstructureProgress = (hyperstructureId: number, store: NativeFactStore) => {
  const game = configManager.getActiveGameId();
  const hyperstructure = store.get("Hyperstructure", { game_id: game, entity_id: hyperstructureId });
  const completed = hyperstructure?.stage === "Complete";
  if (completed) return { percentage: 100, initialized: true, completed: true };
  const amounts = getHyperstructureTotalContributableAmounts(hyperstructureId, store);
  const required = amounts.reduce((sum, row) => sum + BigInt(row.amount) * BigInt(RESOURCE_PRECISION), 0n);
  const current = [...store.inGame("HyperstructureProgress", game)]
    .filter((row) => row.entity_id === BigInt(hyperstructureId))
    .reduce((sum, row) => sum + row.contributed, 0n);
  if (!completed && required === 0n && current > 0n) {
    throw new Error(`Hyperstructure ${hyperstructureId} has contributions without resource requirements`);
  }
  return {
    percentage: completed ? 100 : required === 0n ? 0 : Math.min(100, Number((current * 10000n) / required) / 100),
    initialized: hyperstructure !== undefined && hyperstructure.stage !== "Foundation",
    completed,
  };
};

export const getHyperstructureTotalContributableAmounts = (
  hyperstructureId: number,
  store: NativeFactStore,
): { resource: ResourcesIds; amount: number }[] => {
  const game = configManager.getActiveGameId();
  const hyperstructure = store.get("Hyperstructure", { game_id: game, entity_id: hyperstructureId });
  if (!hyperstructure || hyperstructure.stage === "Foundation") return [];
  return store
    .require("HyperstructureRules", { game_id: game })
    .resources.map(({ resource_type, minimum, maximum }) => ({
      resource: resource_type as ResourcesIds,
      amount:
        minimum +
        (minimum === maximum ? 0 : Number((hyperstructure.seed / BigInt(resource_type)) % BigInt(maximum - minimum))),
    }));
};

const hyperstructureAdjectives = [
  "Majestic",
  "Towering",
  "Colossal",
  "Eternal",
  "Celestial",
  "Arcane",
  "Ancient",
  "Mystical",
  "Radiant",
  "Crystalline",
  "Obsidian",
  "Golden",
  "Silver",
  "Ethereal",
  "Divine",
  "Infernal",
  "Sacred",
  "Cursed",
  "Blessed",
  "Legendary",
  "Mythical",
  "Prismatic",
  "Luminous",
  "Shadowed",
  "Spectral",
  "Temporal",
  "Dimensional",
  "Quantum",
  "Vortex",
  "Nexus",
];

const hyperstructureDescriptors = [
  "Citadel",
  "Spire",
  "Monolith",
  "Nexus",
  "Sanctum",
  "Bastion",
  "Fortress",
  "Tower",
  "Keep",
  "Obelisk",
  "Pinnacle",
  "Apex",
  "Zenith",
  "Observatory",
  "Beacon",
  "Shrine",
  "Temple",
  "Cathedral",
  "Vault",
  "Archive",
  "Conduit",
  "Gateway",
  "Portal",
  "Threshold",
  "Confluence",
  "Convergence",
  "Axis",
  "Core",
  "Heart",
  "Soul",
];

// Power-themed name prefixes
const hyperstructurePrefixes = [
  "Storm",
  "Thunder",
  "Lightning",
  "Flame",
  "Frost",
  "Shadow",
  "Light",
  "Void",
  "Cosmos",
  "Chaos",
  "Order",
  "Balance",
  "Harmony",
  "Discord",
  "Twilight",
  "Dawn",
  "Dusk",
  "Eclipse",
  "Solstice",
  "Equinox",
  "Infinity",
  "Eternity",
  "Destiny",
  "Fate",
  "Fortune",
  "Glory",
  "Honor",
  "Valor",
  "Victory",
  "Triumph",
];

// Epic suffixes for legendary hyperstructures
const hyperstructureSuffixes = [
  "of Power",
  "of Wisdom",
  "of Strength",
  "of Glory",
  "of Eternity",
  "of Infinity",
  "of the Cosmos",
  "of the Void",
  "of the Elements",
  "of the Ancients",
  "of the Gods",
  "of the Titans",
  "of the Stars",
  "of the Heavens",
  "of the Depths",
  "of the Unknown",
  "of Destinies",
  "of Realities",
  "of Dimensions",
  "of Time",
];

export const getHyperstructureName = (structure: NativeRows["Structure"]): string => {
  const seed = safeInteger(structure.entity_id);

  // Same hash function as chest naming for consistency
  const hash = (n: number) => {
    let h = n;
    h = ((h << 16) ^ h) >>> 0;
    h = (h * 0x21f0aaad) >>> 0;
    h = ((h << 15) ^ h) >>> 0;
    h = (h * 0x735a2d97) >>> 0;
    h = ((h << 15) ^ h) >>> 0;
    return h;
  };

  const rand = hash(seed);

  // Base hyperstructure name
  const adjIndex = rand % hyperstructureAdjectives.length;
  let hyperstructureName = `${hyperstructureAdjectives[adjIndex]} Hyperstructure`;

  // Determine rarity/greatness (0-20)
  const greatness = rand % 21;

  // Add suffix for rare items (greatness 15-18)
  if (greatness >= 15 && greatness < 19) {
    const suffixIndex = hash(seed * 2) % hyperstructureSuffixes.length;
    hyperstructureName += ` ${hyperstructureSuffixes[suffixIndex]}`;
  }

  // Add descriptor and prefix for very rare items (greatness >= 19)
  if (greatness >= 19) {
    const descriptorIndex = hash(seed * 3) % hyperstructureDescriptors.length;
    const prefixIndex = hash(seed * 4) % hyperstructurePrefixes.length;

    const selectedDescriptor = hyperstructureDescriptors[descriptorIndex];
    const selectedPrefix = hyperstructurePrefixes[prefixIndex];

    hyperstructureName = `${selectedDescriptor} of ${selectedPrefix} Hyperstructure`;

    // Add additional suffix for legendary items (greatness === 20)
    if (greatness === 20) {
      const epicSuffixIndex = hash(seed * 5) % hyperstructureSuffixes.length;
      hyperstructureName += ` ${hyperstructureSuffixes[epicSuffixIndex]}`;
    }
  }

  return hyperstructureName;
};
