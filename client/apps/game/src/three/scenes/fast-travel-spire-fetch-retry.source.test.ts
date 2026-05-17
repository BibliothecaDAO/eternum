import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("FastTravelScene paired world spire sync", () => {
  it("retries opening the travel modal only after the world-tile sync succeeds", () => {
    const source = readSource("fast-travel.ts");

    const methodStart = source.indexOf("private openFastTravelSpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 1800);
    expect(methodBody).toContain(".then(() =>");
    expect(methodBody).not.toContain(".finally(");
  });

  it("shows an error instead of traveling when the paired world tile is still missing after sync", () => {
    const source = readSource("fast-travel.ts");

    const methodStart = source.indexOf("private openFastTravelSpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private async syncPairedWorldSpireTile(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    const syncedRetryIndex = methodBody.indexOf("hasSyncedPairedWorldTile");
    const missingTileGuardIndex = methodBody.indexOf("if (!pairedWorldTile) {");
    const traversalIndex = methodBody.indexOf("const traversalAction = resolveSpireTraversalAction({");

    expect(syncedRetryIndex).toBeGreaterThan(-1);
    expect(missingTileGuardIndex).toBeGreaterThan(syncedRetryIndex);
    expect(traversalIndex).toBeGreaterThan(missingTileGuardIndex);
    expect(methodBody).toContain('toast.error("Unable to verify the linked world tile right now.");');
  });

  it("syncs existing paired world explorer tiles when ownership is not hydrated yet", () => {
    const source = readSource("fast-travel.ts");

    const methodStart = source.indexOf("private openFastTravelSpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private async syncPairedWorldSpireTile(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("this.shouldSyncPairedWorldSpireTraversalTile(pairedWorldTile)");

    const syncPolicyStart = source.indexOf("private shouldSyncPairedWorldSpireTraversalTile(");
    expect(syncPolicyStart).toBeGreaterThan(-1);

    const syncPolicyBody = source.slice(syncPolicyStart, syncPolicyStart + 900);
    expect(syncPolicyBody).toContain("this.resolveArmyOwnerAddress(pairedWorldTile.occupier_id)");
    expect(syncPolicyBody).toContain("ownerAddress === 0n");
  });

  it("keeps the adjacent spire hex as the attack direction target", () => {
    const source = readSource("fast-travel.ts");

    const methodStart = source.indexOf("private openFastTravelSpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private async syncPairedWorldSpireTile(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("directionHex: { x: targetHex.col, y: targetHex.row }");
  });
});
