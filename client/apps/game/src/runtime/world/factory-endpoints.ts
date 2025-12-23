import { getFactorySqlBaseUrl as sharedFactorySqlBase } from "@bibliothecadao/world";
import type { Chain } from "@bibliothecadao/world";
import { env } from "../../../env";

// Factory SQL base endpoints by chain. Delegates to shared helper.
export const getFactorySqlBaseUrl = (chain: Chain): string =>
  sharedFactorySqlBase(chain, env.VITE_PUBLIC_CARTRIDGE_API_BASE);
