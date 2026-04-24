import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

/**
 * Close the "empty hex for a few seconds" gap between tx_confirmed and the
 * authoritative TileOpt delivery. Biome.getBiome is deterministic and mirrors
 * the Cairo biome_library, so we can render the destination biome immediately
 * on tx_confirmed and let the authoritative update overwrite the provisional
 * mark when it arrives.
 */
describe("Worldmap optimistic destination biome", () => {
  it("imports Biome from @bibliothecadao/eternum", () => {
    const source = readSource("worldmap.tsx");
    expect(source).toMatch(/import\s*\{[^}]*\bBiome\b[^}]*\}\s*from\s*"@bibliothecadao\/eternum"/);
  });

  it("handleTransactionComplete writes a provisional biome at the destination hex using Biome.getBiome on contract coords", () => {
    const source = readSource("worldmap.tsx");

    const bindStart = source.indexOf("bindTransactionFailureLifecycle(dojoContext: SetupResult)");
    expect(bindStart).toBeGreaterThan(0);
    // Scope to the handleTransactionComplete closure body, which runs up to
    // the sibling handleTransactionFailed assignment.
    const handlerStart = source.indexOf("this.handleTransactionComplete = ", bindStart);
    const handlerEnd = source.indexOf("this.handleTransactionFailed = ", handlerStart);
    expect(handlerStart).toBeGreaterThan(0);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    const body = source.slice(handlerStart, handlerEnd);

    expect(body).toContain("applyMovementPlan");
    expect(body).toContain("provisionalBiomes.mark");
    expect(body).toContain("exploredTilesGeneration.bump");
    // Must feed contract (felt-offset) coords to Biome.getBiome so the
    // provisional value matches what the Cairo biome_library will write —
    // otherwise the authoritative update will overwrite with a different
    // biome and the player sees the tile flicker.
    expect(body).toMatch(/Biome\.getBiome\(\s*[A-Za-z]+Contract\.x,\s*[A-Za-z]+Contract\.y\s*\)/);
    // The provisional write must live inside the applyMovementPlan.then block
    // so it fires in the same pass as the optimistic army tween.
    expect(body).toMatch(/applyMovementPlan\(plan,\s*\{\s*optimistic:\s*true\s*\}\)[\s\S]*?Biome\.getBiome/);
  });

  it("army TileOpt spawn-biome fallback uses Biome.getBiome on contract coords, not a hardcoded Grassland", () => {
    const source = readSource("worldmap.tsx");

    // Scope to registerArmyWorldUpdateSubscriptions so we don't collide with
    // the optimistic write in handleTransactionComplete above.
    const subStart = source.indexOf("private registerArmyWorldUpdateSubscriptions");
    expect(subStart).toBeGreaterThan(0);
    const subEnd = source.indexOf("private registerBattleWorldUpdateSubscriptions", subStart);
    expect(subEnd).toBeGreaterThan(subStart);
    const scope = source.slice(subStart, subEnd);

    const spawnCallStart = scope.indexOf("resolveArmySpawnBiome(");
    expect(spawnCallStart).toBeGreaterThan(-1);
    const spawnCallBlock = scope.slice(spawnCallStart, spawnCallStart + 500);

    // The fallback biome must come from Biome.getBiome on *contract* coords
    // (update.hexCoords is felt-offset from world-update-listener). Normalized
    // coords produce a different simplex output than the Cairo biome_library,
    // which would make the provisional value disagree with the authoritative.
    expect(spawnCallBlock).toMatch(/Biome\.getBiome\(\s*update\.hexCoords\.col,\s*update\.hexCoords\.row\s*\)/);

    // And the subsequent exploredTiles write must use spawnResult.biome, not a
    // hardcoded Grassland — otherwise the fallback upgrade is cosmetic.
    const writeBlock = scope.slice(spawnCallStart, spawnCallStart + 800);
    expect(writeBlock).toMatch(
      /exploredTiles\.get\(normalizedPos\.x\)!\.set\(normalizedPos\.y,\s*spawnResult\.biome\)/,
    );
  });
});
