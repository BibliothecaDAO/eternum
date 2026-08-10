import { env } from "../../../env";

const CARTRIDGE_API_BASE = "https://api.cartridge.gg";

/**
 * Where to query a world's data.
 *
 * Cartridge chains give every game its own torii, addressed by game name. The
 * appchain runs ONE torii for the persistent s2 world, so the name is not part
 * of the URL and the shared endpoint from the environment is used instead —
 * queries there scope by `game_id` (see runtime/world/game-registry.ts).
 */
export const resolveWorldToriiBaseUrl = (worldName: string): string => {
  if (env.VITE_PUBLIC_CHAIN === "appchain" && env.VITE_PUBLIC_TORII) {
    return env.VITE_PUBLIC_TORII.replace(/\/+$/, "");
  }

  return `${CARTRIDGE_API_BASE}/x/${worldName}/torii`;
};
