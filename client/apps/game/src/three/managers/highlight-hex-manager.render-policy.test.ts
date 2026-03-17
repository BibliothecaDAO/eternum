import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readHighlightHexManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "highlight-hex-manager.ts"), "utf8");
}

describe("HighlightHexManager render policy", () => {
  it("keeps movement and exploration layers off the tone-mapped path", () => {
    const source = readHighlightHexManagerSource();

    expect(source).toMatch(/toneMapped:\s*config\.toneMapped\s*\?\?\s*false/);
  });
});
