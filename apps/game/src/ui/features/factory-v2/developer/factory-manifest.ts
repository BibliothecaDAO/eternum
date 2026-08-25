import { getFactoryConfigManifest } from "@/ui/features/factory/shared/factory-metadata";

import type { FactoryLaunchChain } from "../types";

type FactoryLookupManifest = Record<string, unknown>;

export const getFactoryLookupManifest = (chain: FactoryLaunchChain): FactoryLookupManifest =>
  getFactoryConfigManifest(chain) as unknown as FactoryLookupManifest;
