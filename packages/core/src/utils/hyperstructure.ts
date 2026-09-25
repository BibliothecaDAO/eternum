import { type ID, ResourcesIds, StructureType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { configManager } from "../managers";
import { structureMapPosition } from "./expeditions";

const HYPERSTRUCTURE_REALM_COUNT_TWO_PLAYER_MODE = 2;

const getHyperstructureRealmCheckRadius = () => {
  const { spacing, mode } = configManager.getSettlementConfig();
  if (!Number.isSafeInteger(spacing) || spacing < 2) throw new Error("Invalid settlement spacing");
  return spacing + (mode === "Single" ? 2 : 0);
};

const getEffectiveHyperstructureRealmCount = (realmCountWithinRadius: number): number => {
  const isTwoPlayerMode = configManager.getSettlementConfig().mode === "Duel";
  return isTwoPlayerMode ? HYPERSTRUCTURE_REALM_COUNT_TWO_PLAYER_MODE : realmCountWithinRadius;
};

export const getRealmCountPerHyperstructure = (store: NativeFactStore): Map<ID, number> => {
  const structures = [...store.inGame("Structure", configManager.getActiveGameId())];
  const realms = structures.filter((structure) => structure.base.category === StructureType.Realm);
  const radiusSquared = getHyperstructureRealmCheckRadius() ** 2;
  const realmCounts = new Map<ID, number>();

  structures
    .filter((structure) => structure.base.category === StructureType.Hyperstructure)
    .forEach((hyperstructure) => {
      const center = structureMapPosition(store, hyperstructure);
      const count = realms.filter((realm) => {
        const position = structureMapPosition(store, realm);
        const colDistance = position.x - center.x;
        const rowDistance = position.y - center.y;
        return colDistance ** 2 + rowDistance ** 2 <= radiusSquared;
      }).length;
      realmCounts.set(hyperstructure.entity_id, getEffectiveHyperstructureRealmCount(count));
    });

  return realmCounts;
};

export const getHyperstructureProgress = (hyperstructureId: number, store: NativeFactStore) => {
  const game = configManager.getActiveGameId();
  const hyperstructure = store.get("Hyperstructure", { game_id: game, entity_id: hyperstructureId });
  const completed = hyperstructure?.stage === "Complete";
  if (completed) return { percentage: 100, initialized: true, completed: true };
  const amounts = getHyperstructureTotalContributableAmounts(hyperstructureId, store);
  const required = amounts.reduce((sum, row) => sum + BigInt(row.amount) * BigInt(RESOURCE_PRECISION), 0n);
  const current = [...store.inGame("HyperstructureProgress", game)]
    .filter((row) => row.entity_id === hyperstructureId)
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
  const seed = structure.entity_id;

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
