export type CollectionTokensQueryMode = "listed_with_traits" | "listed_no_traits" | "full";

export function resolveCollectionTokensQueryMode(options: {
  listedOnly: boolean;
  hasTraitFilters: boolean;
}): CollectionTokensQueryMode {
  if (!options.listedOnly) {
    return "full";
  }

  return options.hasTraitFilters ? "listed_with_traits" : "listed_no_traits";
}
