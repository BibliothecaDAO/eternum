import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("army manager remote path wiring", () => {
  it("chooses a cheaper strategy for foreign movement trails", () => {
    const source = readSource("army-manager.ts");

    expect(source).toMatch(/shouldUseWorkerPathForArmy\(\{ isMine: armyData\.isMine \}\)/);
    expect(source).toMatch(/incrementWorldmapRenderCounter\("workerFindPathBypasses"\)/);
    expect(source).toMatch(/const workerPath = shouldUseWorkerPath[\s\S]*\? await gameWorkerManager\.findPath/);
  });

  it("keeps the path fallback helper available for direct foreign segments", () => {
    const source = readSource("army-move-path.ts");

    expect(source).toMatch(/return \[start, target\]/);
  });
});
