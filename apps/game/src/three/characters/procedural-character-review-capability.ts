const BASTION_KNIGHT_REVIEW_IDS = new Set([
  "t1-knight-bastion-default",
  "t1-knight-bastion-sword",
  "t1-knight-bastion-shield",
]);

export interface ProceduralCharacterReviewCapability {
  includeBastionKnight: boolean;
}

export function resolveProceduralCharacterReviewCapability(input: {
  isDevelopment: boolean;
  search: string;
}): ProceduralCharacterReviewCapability {
  return {
    includeBastionKnight: input.isDevelopment && new URLSearchParams(input.search).get("bastionKnight") === "1",
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
  if (capability.includeBastionKnight) return options;
  return options.filter(({ id }) => !BASTION_KNIGHT_REVIEW_IDS.has(id));
}
