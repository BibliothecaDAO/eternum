import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readChestManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "chest-manager.ts"), "utf8");
}

describe("ChestManager point batching wiring", () => {
  it("uses bulk point mutation APIs during visible chest renders", () => {
    const source = readChestManagerSource();

    expect(source).toMatch(/this\.pointsRenderer\.setMany\(/);
    expect(source).toMatch(/this\.pointsRenderer\.removeMany\(/);
    expect(source).not.toMatch(/this\.pointsRenderer!\.removePoint\(/);
  });
});
