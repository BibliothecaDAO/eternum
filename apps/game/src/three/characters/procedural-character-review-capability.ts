import { PROCEDURAL_CHARACTER_APPEARANCES } from "./procedural-character-appearance";

const T1_KNIGHT_DEFAULT_REVIEW_IDS = new Set([
  "t1-knight-default",
  "t1-knight-default-sword",
  "t1-knight-default-shield",
]);

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

export function filterProceduralCharacterReviewOptions<T extends { id: string }>(
  options: readonly T[],
  capability: ProceduralCharacterReviewCapability,
): readonly T[] {
  if (capability.includeT1KnightDefault) return options;
  return options.filter(({ id }) => !T1_KNIGHT_DEFAULT_REVIEW_IDS.has(id));
}

/**
 * The one answer to which appearances a selector may offer. A review-only appearance needs the flag, and a selector
 * that mixes unit kinds never offers an appearance restricted to some of them.
 */
export function listOfferedProceduralCharacterAppearances(
  capability: ProceduralCharacterReviewCapability,
  selector: { mixesUnitKinds: boolean },
) {
  const reviewed = filterProceduralCharacterReviewOptions(PROCEDURAL_CHARACTER_APPEARANCES, capability);
  return selector.mixesUnitKinds ? reviewed.filter(({ compatibleKinds }) => !compatibleKinds) : reviewed;
}
