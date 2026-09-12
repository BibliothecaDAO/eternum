import { describe, expect, it } from "vitest";
import { hasGameEnded } from "./game-lifecycle";

describe("game lifecycle", () => {
  it("closes at the exact end time without requiring a status transaction", () => {
    expect(hasGameEnded("Live", 100, 99)).toBe(false);
    expect(hasGameEnded("Live", 100, 100)).toBe(true);
    expect(hasGameEnded("Registration", 100, 101)).toBe(true);
  });
  it("keeps untimed games open and honors explicit closure", () => {
    expect(hasGameEnded("Live", 0, 100)).toBe(false);
    expect(hasGameEnded("Ended", 0, 100)).toBe(true);
    expect(hasGameEnded("Settled", 200, 100)).toBe(true);
  });
  it("rejects missing or malformed end clocks", () => {
    expect(() => hasGameEnded("Live", NaN, 100)).toThrow("GameRegistry.end_at");
    expect(() => hasGameEnded("Live", -1, 100)).toThrow("GameRegistry.end_at");
  });
});
