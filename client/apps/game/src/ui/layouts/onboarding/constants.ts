import { env } from "../../../../env";

export const mintUrl =
  env.VITE_PUBLIC_CHAIN === "mainnet" ? "https://empire.realms.world/" : "https://dev.empire.realms.world/";

/**
 * Rotating loading statements shown while the client bootstraps.
 */
export const DEFAULT_LOADING_STATEMENTS = [
  "Syncing Realms...",
  "Gathering Dragonhide...",
  "Stepping the world...",
  "Painting the Sky...",
  "Crafting Stories...",
  "Harvesting Wood...",
  "Cooking Donkeys...",
  "Preparing Surprises...",
  "Forging Adamantine...",
  "Summoning Paladins...",
  "Enchanting Hartwood...",
  "Mining Deep Crystal...",
  "Cultivating Wheat Fields...",
  "Smelting Cold Iron...",
  "Training Crossbowmen...",
  "Extracting Ethereal Silica...",
  "Polishing Twilight Quartz...",
  "Conquering everything...",
] as const;
