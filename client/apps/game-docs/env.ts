export const env = {
  VITE_PUBLIC_CHAIN: process.env.VITE_PUBLIC_CHAIN || "mainnet",
  VITE_PUBLIC_FORCE_GAME_MODE_ID: process.env.VITE_PUBLIC_FORCE_GAME_MODE_ID || "eternum",
} as const;
