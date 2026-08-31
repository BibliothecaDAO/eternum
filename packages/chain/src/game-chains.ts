export const GAME_CHAIN_NAMES = {
  appchain: "WP_REALMS_DEV",
  madara: "WP_REALMS_MADARA_LAB",
} as const;

export type GameChain = keyof typeof GAME_CHAIN_NAMES;
