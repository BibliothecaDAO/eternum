import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(fileName: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, fileName), "utf8");
}

describe("FastTravelScene hover visuals", () => {
  it("switches the shared hover manager to outline-only mode in fast travel", () => {
    const fastTravelSource = readSceneSource("fast-travel.ts");
    const hoverManagerSource = readSceneSource("../managers/hover-hex-manager.ts");

    expect(fastTravelSource).toMatch(/interactiveHexManager\.setHoverVisualMode\("outline"\)/);
    expect(hoverManagerSource).toMatch(/setVisualMode\(mode: HoverVisualMode\)/);
    expect(hoverManagerSource).toMatch(/if \(this\.visualMode === "fill"\)/);
  });

  it("keeps selection and path feedback free of a filled selection pulse", () => {
    const fastTravelSource = readSceneSource("fast-travel.ts");

    expect(fastTravelSource).not.toMatch(/selectionPulseManager\.showSelection\(/);
    expect(fastTravelSource).toMatch(/selectionPulseManager\.hideSelection\(\)/);
    expect(fastTravelSource).toMatch(/pathRenderer\.createPath\(/);
  });
});
