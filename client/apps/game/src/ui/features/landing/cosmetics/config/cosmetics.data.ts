export interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  modelPath: string;
}

/**
 * Temporary curated list for the grid; replace with indexer-backed data when available.
 */
export const COSMETIC_ITEMS: CosmeticItem[] = [
  {
    id: "hyperstructure",
    name: "Hyperstructure Finale",
    description: "Signature build celebrating the endgame of Eternum's first season.",
    modelPath: "/models/new-buildings-opt/hyperstructure_finish.glb",
  },
  {
    id: "archer-range",
    name: "Archer Range",
    description: "Tiered archery outpost with animated training lanes for ranged troops.",
    modelPath: "/models/new-buildings-opt/archerrange.glb",
  },
  {
    id: "bank",
    name: "Bank Pavilion",
    description: "Luxury vault architecture with rotating lords crystals for high-end finance.",
    modelPath: "/models/new-buildings-opt/bank.glb",
  },
  {
    id: "barracks",
    name: "Bannered Barracks",
    description: "Military staging area draped in guild standards and training props.",
    modelPath: "/models/new-buildings-opt/barracks.glb",
  },
  {
    id: "castle-bastion",
    name: "Castle Bastion",
    description: "Core keep with fortified ramparts, ideal for flagship cosmetics.",
    modelPath: "/models/new-buildings-opt/castle2.glb",
  },
  {
    id: "castle-lite",
    name: "Castle Lite",
    description: "Streamlined castle shell tuned for performant showcase builds.",
    modelPath: "/models/new-buildings-opt/castle3.glb",
  },
  {
    id: "dragonhide",
    name: "Dragonhide Vault",
    description: "Scaled plating and ember-lit trim for endgame cosmetic flexing.",
    modelPath: "/models/new-buildings-opt/dragonhide.glb",
  },
  {
    id: "forge",
    name: "Forgeworks",
    description: "Industrial furnace with molten metal effects for crafting themes.",
    modelPath: "/models/new-buildings-opt/forge.glb",
  },
  {
    id: "farmstead",
    name: "Golden Farmstead",
    description: "Agrarian cosmetic set complete with wind-swept grain silos.",
    modelPath: "/models/new-buildings-opt/farm.glb",
  },
  {
    id: "fishery",
    name: "Moonlit Fishery",
    description: "Harbor-inspired cosmetic with bioluminescent netting.",
    modelPath: "/models/new-buildings-opt/fishery.glb",
  },
  {
    id: "wonder-castle",
    name: "Realm Wonder",
    description: "Signature castle variant to stress-test lighting passes and scale tweaks.",
    modelPath: "/models/new-buildings-opt/castle1.glb",
  },
];
