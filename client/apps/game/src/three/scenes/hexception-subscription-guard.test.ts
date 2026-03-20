import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("WorldUpdateListener setupSystem unsubscribe support", () => {
  const wulPath = path.resolve(
    import.meta.dirname ?? __dirname,
    "../../../../../../packages/core/src/systems/world-update-listener.ts",
  );
  const source = readFileSync(wulPath, "utf8");

  it("setupSystem returns an unsubscribe function", () => {
    // setupSystem should return () => void (an unsubscribe handle)
    expect(source).toMatch(/private\s+setupSystem[\s\S]*?:\s*\(\)\s*=>\s*void/);
  });

  it("onBuildingUpdate returns the result of setupSystem", () => {
    // The Buildings.onBuildingUpdate method should return the unsubscribe handle
    expect(source).toMatch(/onBuildingUpdate[\s\S]*?return\s+this\.setupSystem\(/);
  });
});
