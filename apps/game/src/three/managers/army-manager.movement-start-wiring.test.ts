import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

describe("ArmyManager movement start wiring", () => {
  it("exposes an onMovementStart listener seam alongside movement completion", () => {
    const source = readSource();

    expect(source).toContain("private movementStartListeners");
    expect(source).toContain("public onMovementStart(entityId: ID, callback: () => void): () => void");
  });

  it("fires movement-start listeners from the renderer-owned move path", () => {
    const source = readSource();

    expect(source).toContain("this.runMovementStartListeners(numericEntityId)");
    expect(source).toContain("this.armyModel.startMovement");
  });
});
