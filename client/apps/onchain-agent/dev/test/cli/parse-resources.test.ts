import { describe, it, expect } from "vitest";
import { parseResources } from "../../../src/cli/parse-resources.js";

describe("parseResources", () => {
  it("parses a single resource", () => {
    expect(parseResources("38:100")).toEqual([{ resourceId: 38, amount: 100 }]);
  });

  it("parses multiple comma-separated resources", () => {
    expect(parseResources("38:100,3:500,7:25")).toEqual([
      { resourceId: 38, amount: 100 },
      { resourceId: 3, amount: 500 },
      { resourceId: 7, amount: 25 },
    ]);
  });

  it("handles whitespace around separators", () => {
    expect(parseResources("38:100, 3:500")).toEqual([
      { resourceId: 38, amount: 100 },
      { resourceId: 3, amount: 500 },
    ]);
  });

  it("throws on empty string", () => {
    expect(() => parseResources("")).toThrow();
  });

  it("throws on invalid format", () => {
    expect(() => parseResources("abc")).toThrow();
  });

  it("throws on missing amount", () => {
    expect(() => parseResources("38:")).toThrow();
  });
});
