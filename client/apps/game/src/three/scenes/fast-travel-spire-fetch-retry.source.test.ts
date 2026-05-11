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
});
