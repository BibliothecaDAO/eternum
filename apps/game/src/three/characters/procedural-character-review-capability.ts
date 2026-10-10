import {
  isProceduralCharacterAppearanceCompatibleWithKind,
  PROCEDURAL_CHARACTER_APPEARANCES,
} from "./procedural-character-appearance";
import type { HumanoidRigAdapterId } from "./humanoid-rig-adapters";
import type { ProceduralUnitKind } from "./procedural-unit-config";

/** The one rig under review: an appearance that uses it, and gear fitted to it, are review-only. */
const REVIEW_ONLY_RIG_ADAPTER_ID: HumanoidRigAdapterId = "t1-knight-default";

/** An appearance names its rig; gear names the rig it was fitted to. */
interface ProceduralCharacterReviewOption {
  id: string;
  fittedRigAdapterId?: HumanoidRigAdapterId;
  rigAdapterId?: HumanoidRigAdapterId;
}

export interface ProceduralCharacterReviewCapability {
  includeT1KnightDefault: boolean;
}

export function resolveProceduralCharacterReviewCapability(input: {
  isDevelopment: boolean;
  search: string;
}): ProceduralCharacterReviewCapability {
  return {
    includeT1KnightDefault: input.isDevelopment && new URLSearchParams(input.search).get("t1KnightDefault") === "1",
  };
}

export function resolveActiveProceduralCharacterReviewCapability(): ProceduralCharacterReviewCapability {
  return resolveProceduralCharacterReviewCapability({
    isDevelopment: import.meta.env.DEV,
    search: typeof window === "undefined" ? "" : window.location.search,
  });
}

export function filterProceduralCharacterReviewOptions<T extends ProceduralCharacterReviewOption>(
  options: readonly T[],
  capability: ProceduralCharacterReviewCapability,
): readonly T[] {
  if (capability.includeT1KnightDefault) return options;
  return options.filter(
    ({ fittedRigAdapterId, rigAdapterId }) =>
      fittedRigAdapterId !== REVIEW_ONLY_RIG_ADAPTER_ID && rigAdapterId !== REVIEW_ONLY_RIG_ADAPTER_ID,
  );
}

/**
 * The one answer to which appearances a selector may offer. A review-only appearance needs the flag, and a selector
 * that applies to several unit kinds offers an appearance only if every one of them can use it.
 */
export function listOfferedProceduralCharacterAppearances(
  capability: ProceduralCharacterReviewCapability,
  kinds: readonly ProceduralUnitKind[],
) {
  return filterProceduralCharacterReviewOptions(PROCEDURAL_CHARACTER_APPEARANCES, capability).filter(({ id }) =>
    kinds.every((kind) => isProceduralCharacterAppearanceCompatibleWithKind(id, kind)),
  );
}
