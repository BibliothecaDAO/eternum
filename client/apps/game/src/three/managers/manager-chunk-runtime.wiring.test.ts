import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readManagerSource(fileName: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, fileName), "utf8");
}

describe("manager chunk runtime wiring", () => {
  it("routes army, structure, and chest chunk updates through the shared runtime", () => {
    const armyManagerSource = readManagerSource("army-manager.ts");
    const structureManagerSource = readManagerSource("structure-manager.ts");
    const chestManagerSource = readManagerSource("chest-manager.ts");

    expect(armyManagerSource).toMatch(/runManagerChunkUpdateRuntime\(\{/);
    expect(armyManagerSource).toMatch(/state: this\.resolveChunkUpdateRuntimeState\(\)/);
    expect(armyManagerSource).toMatch(/prepareForUpdate: \(\) => this\.armyModel\.loadPromise/);
    expect(armyManagerSource).toMatch(
      /executeChunkUpdate: \(nextChunkKey, nextOptions\) => this\.renderVisibleArmies\(nextChunkKey, nextOptions\)/,
    );

    expect(structureManagerSource).toMatch(/runManagerChunkUpdateRuntime\(\{/);
    expect(structureManagerSource).toMatch(/state: this\.resolveChunkUpdateRuntimeState\(\)/);
    expect(structureManagerSource).toMatch(/shouldRunManagerChunkUpdate\(\{/);
    expect(structureManagerSource).toMatch(/await this\.requestVisibleStructuresRefresh\(\)/);

    expect(chestManagerSource).toMatch(/runManagerChunkUpdateRuntime\(\{/);
    expect(chestManagerSource).toMatch(/state: this\.resolveChunkUpdateRuntimeState\(\)/);
    expect(chestManagerSource).toMatch(/shouldRunManagerChunkUpdate\(\{/);
    expect(chestManagerSource).toMatch(/this\.renderVisibleChests\(nextChunkKey\)/);
  });
});
