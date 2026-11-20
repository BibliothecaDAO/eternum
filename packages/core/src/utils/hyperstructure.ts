import { safeInteger } from "./safe-integer";
import { StructureType, structureName } from "@bibliothecadao/types";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

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
  const typeName = structureName(StructureType.Hyperstructure);

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
  let hyperstructureName = `${hyperstructureAdjectives[adjIndex]} ${typeName}`;

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

    hyperstructureName = `${selectedDescriptor} of ${selectedPrefix} ${typeName}`;

    // Add additional suffix for legendary items (greatness === 20)
    if (greatness === 20) {
      const epicSuffixIndex = hash(seed * 5) % hyperstructureSuffixes.length;
      hyperstructureName += ` ${hyperstructureSuffixes[epicSuffixIndex]}`;
    }
  }

  return hyperstructureName;
};
