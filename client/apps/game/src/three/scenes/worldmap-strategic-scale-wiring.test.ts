import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap strategic scale wiring", () => {
  it("syncs the transition overlay scale from live camera projection", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/private syncWorldNavigationOverlayScale\(\): void/);
    expect(source).toMatch(/resolveMatchedStrategicMapScale\(/);
    expect(source).toMatch(
      /if \(this\.worldNavigationModeState\.mode !== "strategic_2d"\) \{\s*this\.syncWorldNavigationOverlayScale\(\);\s*\}/,
    );
  });

  it("does not reset strategic scale during promotion or exit handoff", () => {
    const source = readSceneSource("worldmap.tsx");
    const entrySegment =
      source.match(/const isEnteringStrategicMode[\s\S]*?this\.worldNavigationModeState = nextModeState;/)?.[0] ?? "";
    const exitMethodBody = extractMethodBody(source, "private startStrategicModeExit(targetHex: HexPosition): void {");

    expect(entrySegment).not.toMatch(/strategicMapScale/);
    expect(exitMethodBody).not.toMatch(/strategicMapScale/);
  });

  it("renders both transition and strategic overlays from the store-backed matched scale", () => {
    const source = readSceneSource("../../ui/features/world/components/strategic-map/strategic-map-layer.tsx");

    expect(source).toMatch(
      /const resolvedStrategicMapScale = strategicMapScale \?\? resolveStrategicMapFallbackScale\(\)/,
    );
    expect(source).toMatch(/scale={resolvedStrategicMapScale}/);
  });
});

function extractMethodBody(source: string, methodSignature: string): string {
  const methodStartIndex = source.indexOf(methodSignature);
  if (methodStartIndex === -1) {
    return "";
  }

  let braceDepth = 0;
  let methodBodyStart = -1;

  for (let index = methodStartIndex; index < source.length; index += 1) {
    if (source[index] === "{") {
      braceDepth += 1;
      if (methodBodyStart === -1) {
        methodBodyStart = index;
      }
    } else if (source[index] === "}") {
      braceDepth -= 1;
      if (methodBodyStart !== -1 && braceDepth === 0) {
        return source.slice(methodBodyStart, index + 1);
      }
    }
  }

  return "";
}
