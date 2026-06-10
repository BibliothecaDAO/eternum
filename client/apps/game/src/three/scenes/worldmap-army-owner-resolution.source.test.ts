import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

// Wiring guard for the worldmap owner-resolution integration. The decision
// itself is unit-tested in worldmap-army-owner-resolution.test.ts; here we only
// assert the scene routes updateArmyHexes through that pure helper and keeps the
// ECS lookup observable (the original bug was a bare `catch {}` that let a bogus
// owner:0n silently poison the spatial cache). The worldmap scene cannot be
// instantiated in isolation, so we guard the source like the sibling
// *.wiring.test.ts files.
function ownerResolutionRegion(): string {
  const src = readSource("worldmap.tsx");
  const start = src.indexOf("public updateArmyHexes(");
  expect(start).toBeGreaterThan(-1);
  // Region spans updateArmyHexes + its extracted private helpers
  // (findCachedArmyOwner, resolveArmyOwnerFromEcs), up to the next public method.
  const end = src.indexOf("public updateStructureHexes(", start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("worldmap updateArmyHexes owner resolution wiring", () => {
  it("imports the pure decision helper", () => {
    const src = readSource("worldmap.tsx");
    expect(src).toContain('import { resolveArmyOwnerCacheAction } from "./worldmap-army-owner-resolution"');
  });

  it("routes the owner decision through resolveArmyOwnerCacheAction and handles every action kind", () => {
    const region = ownerResolutionRegion();

    expect(region).toContain("resolveArmyOwnerCacheAction({");
    expect(region).toContain('action.kind === "evict"');
    expect(region).toContain('action.kind === "skip"');
    expect(region).toContain("action.owner");
  });

  it("no longer swallows the structure-owner ECS lookup failure silently", () => {
    const region = ownerResolutionRegion();

    // The original bug was a bare `catch {}` that hid the failure.
    expect(region).not.toMatch(/catch\s*\{/);
    expect(region).toContain("catch (error)");
    expect(region).toContain("Structure owner ECS lookup failed");
  });

  it("keeps the skip guard ahead of (and short-circuiting) the spatial-cache write", () => {
    const region = ownerResolutionRegion();

    const skipPos = region.indexOf("Skipping spatial cache write");
    expect(skipPos).toBeGreaterThan(-1);

    // The skip branch must bail out rather than fall through to the cache write.
    expect(region.slice(skipPos, skipPos + 260)).toContain("return;");

    const writePos = region.indexOf("const armyHexData = { id: entityId, owner: actualOwnerAddress }");
    expect(writePos).toBeGreaterThan(-1);
    expect(skipPos).toBeLessThan(writePos);
  });
});
