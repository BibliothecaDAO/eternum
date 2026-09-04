import { describe, it, expect } from "vitest";
import { EMOJIS, EMOJI_CATEGORIES } from "./emoji-picker";

describe("EMOJIS array", () => {
  it("should contain no duplicate emoji codepoints", () => {
    const unique = new Set(EMOJIS);
    expect(unique.size).toBe(EMOJIS.length);
  });
});

describe("EMOJI_CATEGORIES", () => {
  it("should have the expected category names", () => {
    expect(Object.keys(EMOJI_CATEGORIES)).toEqual(["General", "War", "Castle"]);
  });

  it("should produce EMOJIS as all categories flattened", () => {
    const flattened = Object.values(EMOJI_CATEGORIES).flat();
    expect(EMOJIS).toEqual(flattened);
  });
});
