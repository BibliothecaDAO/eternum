import { describe, expect, it } from "vitest";
import { resolveCollectionTokensQueryMode } from "./query-selection";

describe("resolveCollectionTokensQueryMode", () => {
  it("uses listed_no_traits when listedOnly with no trait filters", () => {
    expect(resolveCollectionTokensQueryMode({ listedOnly: true, hasTraitFilters: false })).toBe("listed_no_traits");
  });

  it("uses listed_with_traits when listedOnly with trait filters", () => {
    expect(resolveCollectionTokensQueryMode({ listedOnly: true, hasTraitFilters: true })).toBe("listed_with_traits");
  });

  it("uses full mode when listedOnly is false", () => {
    expect(resolveCollectionTokensQueryMode({ listedOnly: false, hasTraitFilters: true })).toBe("full");
  });
});
