import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readFastTravelSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const scenePath = resolve(currentDir, "fast-travel.ts");
  return readFileSync(scenePath, "utf8");
}

describe("FastTravelScene movement parity wiring", () => {
  it("keeps movement feedback wired through shared managers without restoring a filled selection pulse", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/SelectedHexManager/);
    expect(source).toMatch(/SelectionPulseManager/);
    expect(source).toMatch(/PathRenderer\.getInstance\(\)/);
    expect(source).toMatch(/resolveFastTravelMovement/);
    expect(source).toMatch(/pathRenderer\.createPath\(/);
    expect(source).toMatch(/selectionPulseManager\.hideSelection\(/);
    expect(source).not.toMatch(/selectionPulseManager\.showSelection\(/);
    expect(source).toMatch(/selectedHexManager\.setPosition\(/);
  });

  it("handles hover and click traversal through fast-travel hex interaction hooks", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/protected onHexagonMouseMove/);
    expect(source).toMatch(/protected onHexagonClick/);
    expect(source).toMatch(/previewFastTravelMovement/);
    expect(source).toMatch(/commitFastTravelMovement/);
  });
});
