import type { Chain } from "@contracts";
import { getFactorySqlBaseUrl as sharedFactorySqlBase } from "../../../../../../common/factory/endpoints";
import { env } from "../../../env";

// Factory SQL base endpoints by chain. Delegates to shared helper.
export const getFactorySqlBaseUrl = (chain: Chain): string =>
  sharedFactorySqlBase(chain, env.VITE_PUBLIC_CARTRIDGE_API_BASE || "https://api.cartridge.gg");
