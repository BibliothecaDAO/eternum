import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

// updateArmyHexes maintains the spatial/clickability cache (armiesPositions,
// armyHexes, worker hex map) — separate from the 3D model. Two silent failures
// previously let a bogus owner:0n poison that cache (army wrongly treated as
// unowned/defeated) with no signal. These guards keep those paths observable
// and prevent caching a known-bad owner. The worldmap scene cannot be
// instantiated in isolation, so we assert on the source like the sibling
// ghosting guards (see army-manager.chunk-eviction-ghost.test.ts).
function updateArmyHexesBody(): string {
  const src = readSource("worldmap.tsx");
  const start = src.indexOf("public updateArmyHexes(");
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf("public updateStructureHexes(", start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("worldmap updateArmyHexes owner resolution", () => {
  it("no longer swallows the structure-owner ECS lookup failure silently", () => {
    const body = updateArmyHexesBody();

    // The previous bare `catch {}` swallowed the failure with no signal.
    expect(body).not.toMatch(/catch\s*\{/);
    expect(body).toContain("catch (error)");
    expect(body).toContain("Structure owner ECS lookup failed");
  });

  it("skips the spatial-cache write for a new army whose owner stays unresolved (0n)", () => {
    const body = updateArmyHexesBody();

    // Anchor on the unique guard message (the method also has a separate 0n
    // branch that evicts an already-cached army — not this one).
    const skipPos = body.indexOf("Skipping spatial cache write");
    expect(skipPos).toBeGreaterThan(-1);

    // The guard must bail out (return) rather than fall through to the
    // armyHexData write, which would persist owner: 0n.
    expect(body.slice(skipPos, skipPos + 220)).toContain("return;");

    // And it must sit before the cache write it is meant to skip.
    const writePos = body.indexOf("const armyHexData = { id: entityId, owner: actualOwnerAddress }");
    expect(writePos).toBeGreaterThan(-1);
    expect(skipPos).toBeLessThan(writePos);
  });
});
