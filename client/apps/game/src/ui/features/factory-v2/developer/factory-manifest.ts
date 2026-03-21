import { getGameManifest } from "@contracts";

import type { FactoryLaunchChain } from "../types";

export const getFactoryLookupManifest = (chain: FactoryLaunchChain) => {
  return getGameManifest(chain) as unknown as Record<string, unknown>;
};
