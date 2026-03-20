import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap army suppression integration", () => {
  it("cancelPendingArmyRemoval calls unsuppressArmy", () => {
    const src = readSource("worldmap.tsx");

    const methodStart = src.indexOf("private cancelPendingArmyRemoval(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 500);
    expect(methodBody).toContain("unsuppressArmy(entityId)");
  });
});
