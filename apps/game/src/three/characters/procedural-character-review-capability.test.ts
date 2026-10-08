import { describe, expect, it } from "vitest";

import {
  filterProceduralCharacterReviewOptions,
  resolveProceduralCharacterReviewCapability,
} from "./procedural-character-review-capability";

const options = [
  { id: "modular-fantasy" },
  { id: "t1-knight-default" },
  { id: "iron-longsword" },
  { id: "t1-knight-default-sword" },
  { id: "round-shield" },
  { id: "t1-knight-default-shield" },
] as const;

describe("procedural character review capability", () => {
  it("keeps the legacy option lists when the development flag is absent", () => {
    const capability = resolveProceduralCharacterReviewCapability({ isDevelopment: true, search: "" });

    expect(filterProceduralCharacterReviewOptions(options, capability).map(({ id }) => id)).toEqual([
      "modular-fantasy",
      "iron-longsword",
      "round-shield",
    ]);
  });

  it("exposes every Knight review option behind the development flag", () => {
    const capability = resolveProceduralCharacterReviewCapability({
      isDevelopment: true,
      search: "?t1KnightDefault=1",
    });

    expect(filterProceduralCharacterReviewOptions(options, capability)).toBe(options);
  });

  it("keeps Knight review options disabled in production regardless of the query", () => {
    expect(resolveProceduralCharacterReviewCapability({ isDevelopment: false, search: "?t1KnightDefault=1" })).toEqual({
      includeT1KnightDefault: false,
    });
  });
});
