/**
 * Re-export from shared package for backwards compatibility.
 * Desktop-specific customization: uses env.VITE_PUBLIC_CARTRIDGE_API_BASE
 */
import {
  useWorldAvailability as useWorldAvailabilityBase,
  useWorldsAvailability as useWorldsAvailabilityBase,
  getAvailabilityStatus,
  getWorldKey,
  type WorldRef,
  type WorldAvailability,
  type WorldConfigMeta,
} from "@bibliothecadao/game-selection";
import { env } from "../../env";

export { getAvailabilityStatus, getWorldKey };
export type { WorldRef, WorldAvailability, WorldConfigMeta };

/**
 * Desktop-specific wrapper that provides the cartridge API base from env
 */
export const useWorldAvailability = (world: WorldRef | null, enabled = true) => {
  return useWorldAvailabilityBase(world, {
    enabled,
    cartridgeApiBase: env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg",
  });
};

/**
 * Desktop-specific wrapper that provides the cartridge API base from env
 */
export const useWorldsAvailability = (worlds: WorldRef[], enabled = true) => {
  return useWorldsAvailabilityBase(worlds, {
    enabled,
    cartridgeApiBase: env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg",
  });
};
