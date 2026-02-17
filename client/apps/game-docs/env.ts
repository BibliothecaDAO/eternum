export const env = {
  VITE_PUBLIC_CHAIN: process.env.VITE_PUBLIC_CHAIN || "mainnet",
  VITE_PUBLIC_GAME_TYPE: process.env.VITE_PUBLIC_GAME_TYPE || "eternum",
} as const;
