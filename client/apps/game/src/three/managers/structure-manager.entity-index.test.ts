import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureRecordStoreSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const filePath = resolve(currentDir, "structure-record-store.ts");
  return readFileSync(filePath, "utf8");
}

describe("Structures entity index", () => {
  it("keeps a direct entityId lookup map alongside type buckets", () => {
    const source = readStructureRecordStoreSource();

    expect(source).toMatch(/entityIdIndex/);
    expect(source).toMatch(/return this\.entityIdIndex\.get\(normalizedEntityId\)/);
  });
});
