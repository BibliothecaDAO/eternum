import { describe, expect, test } from "vitest";
import {
  advanceExitFamilyPosition,
  allocateExitFamilyIndex,
  countExitFamilyMigrationChunks,
  parseExitFamilyId,
  resolveExitFamilyMigrationChunk,
  validateExitFamilySourceIdentityShape,
} from "./exit-family-layout";

const MAX_U64 = (1n << 64n) - 1n;

describe("A22 exit-family reference layout", () => {
  test("allocates monotonic u64 indexes without claiming an operational cardinality cap", () => {
    const resourceFamily = parseExitFamilyId(1);

    expect(allocateExitFamilyIndex(resourceFamily, 0n)).toEqual({ index: 0n, nextHighWatermark: 1n });
    expect(allocateExitFamilyIndex(resourceFamily, MAX_U64 - 1n)).toEqual({
      index: MAX_U64 - 1n,
      nextHighWatermark: MAX_U64,
    });
    expect(() => allocateExitFamilyIndex(resourceFamily, MAX_U64)).toThrow(/u64 index space exhausted/);
    expect(() => allocateExitFamilyIndex(resourceFamily, -1n)).toThrow(/must be a u64/);
    expect(() => parseExitFamilyId(99)).toThrow(/unknown exit family/);
  });

  test("validates only the frozen source-identity shape and makes tombstones terminal", () => {
    const resourceFamily = parseExitFamilyId(1);

    expect(() =>
      validateExitFamilySourceIdentityShape(resourceFamily, { entity_id: "0x1", resource_id: "37" }),
    ).not.toThrow();
    expect(() => validateExitFamilySourceIdentityShape(resourceFamily, { entity_id: "0x1" })).toThrow(
      /reference shape/,
    );
    expect(() =>
      validateExitFamilySourceIdentityShape(resourceFamily, {
        entity_id: "0x1",
        resource_id: "37",
        owner: "0x2",
      }),
    ).toThrow(/reference shape/);

    const active = { familyId: resourceFamily, index: 7n, generation: 0n, tombstoned: false };
    const nextGeneration = advanceExitFamilyPosition(active, "advance-generation");
    expect(nextGeneration).toEqual({ ...active, generation: 1n });
    const tombstone = advanceExitFamilyPosition(nextGeneration, "tombstone");
    expect(tombstone).toEqual({ ...nextGeneration, tombstoned: true });
    expect(() => advanceExitFamilyPosition(tombstone, "advance-generation")).toThrow(/already tombstoned/);
    expect(() => advanceExitFamilyPosition(active, "merge" as never)).toThrow(/unsupported/);
    expect(() => advanceExitFamilyPosition({ ...active, generation: MAX_U64 }, "advance-generation")).toThrow(
      /generation is exhausted/,
    );
  });

  test("resolves ascending chunks without materializing an unbounded migration plan", () => {
    const resourceFamily = parseExitFamilyId(1);

    expect(countExitFamilyMigrationChunks(resourceFamily, 65_535n)).toBe(1_024n);
    expect(resolveExitFamilyMigrationChunk(resourceFamily, 65_535n, 0n)).toEqual({
      familyId: resourceFamily,
      chunkIndex: 0n,
      startIndex: 0n,
      positionCount: 64,
    });
    expect(resolveExitFamilyMigrationChunk(resourceFamily, 65_535n, 1_023n)).toEqual({
      familyId: resourceFamily,
      chunkIndex: 1_023n,
      startIndex: 65_472n,
      positionCount: 63,
    });
    expect(countExitFamilyMigrationChunks(resourceFamily, MAX_U64)).toBe(1n << 58n);
    expect(resolveExitFamilyMigrationChunk(resourceFamily, MAX_U64, (1n << 58n) - 1n).positionCount).toBe(63);
    expect(countExitFamilyMigrationChunks(resourceFamily, 0n)).toBe(0n);
    expect(() => resolveExitFamilyMigrationChunk(resourceFamily, 0n, 0n)).toThrow(/outside its high-watermark/);
  });
});
