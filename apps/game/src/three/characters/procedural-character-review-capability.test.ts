import { describe, expect, it } from "vitest";

import {
  filterProceduralCharacterReviewOptions,
  listOfferedProceduralCharacterAppearances,
  resolveProceduralCharacterReviewCapability,
} from "./procedural-character-review-capability";

const options = [
  { id: "modular-fantasy", rigAdapterId: "quaternius-universal" },
  { id: "t1-knight-default", rigAdapterId: "t1-knight-default" },
  { id: "iron-longsword" },
  { id: "t1-knight-default-sword", fittedRigAdapterId: "t1-knight-default" },
  { id: "round-shield" },
  { id: "t1-knight-default-shield", fittedRigAdapterId: "t1-knight-default" },
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

  it("offers the Knight appearance only to selectors whose every kind can use it", () => {
    const capability = { includeT1KnightDefault: true };
    const offeredTo = (kinds: Parameters<typeof listOfferedProceduralCharacterAppearances>[1]) =>
      listOfferedProceduralCharacterAppearances(capability, kinds).map(({ id }) => id);

    expect(offeredTo(["knight"])).toContain("t1-knight-default");
    for (const kind of ["archer", "crossbowman", "paladin"] as const)
      expect(offeredTo([kind])).not.toContain("t1-knight-default");
    expect(offeredTo(["knight", "archer"])).not.toContain("t1-knight-default");
  });
});
