import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "world-update-listener.ts"), "utf8");
}

describe("Army.onTileUpdate stale-TileOpt suppression", () => {
  it("cross-checks ExplorerTroops.coord against TileOpt (col, row) before emitting", () => {
    const source = readSource();

    // The filter reads ExplorerTroops by entityId and compares its coord to the
    // TileOpt's (col, row). If they disagree, the listener must return early
    // without emitting an update — otherwise a stale subscription replay would
    // rubber-band the visual back to an outdated tile.
    const onTileStart = source.indexOf("onTileUpdate:");
    expect(onTileStart).toBeGreaterThan(0);
    const onTileEnd = source.indexOf("onExplorerTroopsUpdate:", onTileStart);
    expect(onTileEnd).toBeGreaterThan(onTileStart);
    const handlerBody = source.slice(onTileStart, onTileEnd);

    expect(handlerBody).toMatch(/components\.ExplorerTroops/);
    expect(handlerBody).toMatch(/explorerTroops\?\.coord/);
    expect(handlerBody).toMatch(/!== currentState\.col \|\| .*!== currentState\.row/);
  });

  it("runs the cross-check before emitting the tileopt_component_received phase", () => {
    const source = readSource();

    const onTileStart = source.indexOf("onTileUpdate:");
    const checkPos = source.indexOf("!== currentState.col", onTileStart);
    const phasePos = source.indexOf('"tileopt_component_received"', onTileStart);

    expect(checkPos).toBeGreaterThan(0);
    expect(phasePos).toBeGreaterThan(0);
    expect(checkPos).toBeLessThan(phasePos);
  });
});
