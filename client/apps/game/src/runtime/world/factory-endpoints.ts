import type { Chain } from "@contracts";
import { getFactorySqlBaseUrl as sharedFactorySqlBase } from "../../../../../../common/factory/endpoints";
import { resolveConfiguredRuntimeRegistry } from "../../config/runtime-endpoints";

// Factory SQL base endpoints by chain. Delegates to shared helper.
export const getFactorySqlBaseUrl = (chain: Chain): string =>
  sharedFactorySqlBase(chain, {
    registry: resolveConfiguredRuntimeRegistry(),
  });
