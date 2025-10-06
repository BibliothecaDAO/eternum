import { CosmeticResolutionParams, CosmeticResolutionResult } from "./types";

/**
 * Development-only overrides. No-op by default; filled in during later phases.
 */
export class CosmeticDebugController {
  resolveOverride(_params: CosmeticResolutionParams): CosmeticResolutionResult | undefined {
    return undefined;
  }
}

export const cosmeticDebugController = new CosmeticDebugController();
