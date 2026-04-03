import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("World availability tiering source", () => {
  it("exposes split hooks for core, player, and economics card data", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/use-world-availability.ts"), "utf8");

    expect(source).toContain("export const useWorldsCoreAvailability");
    expect(source).toContain("export const useWorldPlayerState");
    expect(source).toContain("export const useWorldEconomics");
  });
});
