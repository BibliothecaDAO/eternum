// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@config", () => ({
  getConfigFromNetwork: () => ({}),
}));

import { resolveConfigGameType } from "./config";

describe("resolveConfigGameType", () => {
  it("uses an explicit game type when provided", () => {
    expect(resolveConfigGameType("eternum", "blitz")).toBe("eternum");
  });

  it("falls back to the env game type when no explicit override is present", () => {
    expect(resolveConfigGameType(undefined, "eternum")).toBe("eternum");
  });

  it("defaults to blitz when neither explicit nor env game type is set", () => {
    expect(resolveConfigGameType(undefined, undefined)).toBe("blitz");
  });
});
