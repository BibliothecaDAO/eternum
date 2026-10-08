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
