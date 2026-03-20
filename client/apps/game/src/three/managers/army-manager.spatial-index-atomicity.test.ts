import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("ArmyManager atomic spatial index", () => {
  it("atomicSpatialTransfer removes from source before adding to destination", () => {
    const source = readSource("./army-manager.ts");

    // Find the atomicSpatialTransfer method
    const methodStart = source.indexOf("atomicSpatialTransfer(entityId: ID");
    expect(methodStart).toBeGreaterThan(-1);

    const bodyAfterMethod = source.substring(methodStart);

    const deleteIdx = bodyAfterMethod.indexOf("fromBucket.delete(entityId)");
    const addIdx = bodyAfterMethod.indexOf("toBucket.add(entityId)");

    expect(deleteIdx).toBeGreaterThan(-1);
    expect(addIdx).toBeGreaterThan(-1);

    // Delete from source must happen before add to destination
    expect(deleteIdx).toBeLessThan(addIdx);
  });

  it("atomicSpatialTransfer cleans up empty source buckets", () => {
    const source = readSource("./army-manager.ts");

    // Find the atomicSpatialTransfer method
    const methodStart = source.indexOf("atomicSpatialTransfer(entityId: ID");
    expect(methodStart).toBeGreaterThan(-1);

    const bodyAfterMethod = source.substring(methodStart, methodStart + 500);

    // Should delete the bucket key when empty
    expect(bodyAfterMethod).toContain("this.chunkToArmies.delete(fromKey)");
  });

  it("movement-complete callback guards against removed army", () => {
    const source = readSource("./army-manager.ts");

    // Find the setMovementCompleteCallback call with its callback body
    const callbackStart = source.indexOf("setMovementCompleteCallback(numericEntityId, () => {");
    expect(callbackStart).toBeGreaterThan(-1);

    const bodyAfterCallback = source.substring(callbackStart, callbackStart + 400);

    // The first meaningful check inside the callback should be the armies.has guard
    const armyGuardIdx = bodyAfterCallback.indexOf("if (!this.armies.has(entityId)) return");
    expect(armyGuardIdx).toBeGreaterThan(-1);

    // The guard must appear before any spatial cleanup
    const cleanupIdx = bodyAfterCallback.indexOf("this.cleanupMovementSourceBucket");
    expect(cleanupIdx).toBeGreaterThan(-1);
    expect(armyGuardIdx).toBeLessThan(cleanupIdx);
  });

  it("atomicSpatialTransfer is a synchronous method", () => {
    const source = readSource("./army-manager.ts");

    // Find the method signature
    const methodSignatureMatch = source.match(/(?:private|public|protected)\s+(async\s+)?atomicSpatialTransfer\(/);
    expect(methodSignatureMatch).not.toBeNull();

    // The async capture group should be undefined (no async keyword)
    expect(methodSignatureMatch![1]).toBeUndefined();
  });
});
