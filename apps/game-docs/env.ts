/** The docs read presets and addresses from madara, the one configuration network there is. */
export const DOCS_CHAIN = "madara";

export const env = {
  VITE_PUBLIC_FORCE_GAME_MODE_ID: process.env.VITE_PUBLIC_FORCE_GAME_MODE_ID || "eternum",
} as const;
