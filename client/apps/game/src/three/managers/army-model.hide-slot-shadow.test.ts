import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("hideInstanceSlot contact shadow consistency", () => {
  it("hideInstanceSlot zeros contactShadowMesh matrix", () => {
    const src = readSource("army-model.ts");

    const methodStart = src.indexOf("public hideInstanceSlot");
    expect(methodStart).toBeGreaterThan(-1);

    const nextMethodMatch = src.slice(methodStart + 1).search(/\n  (public|private|protected) /);
    const methodEnd = nextMethodMatch > -1 ? methodStart + 1 + nextMethodMatch : methodStart + 1200;
    const methodBody = src.slice(methodStart, methodEnd);

    expect(methodBody).toContain("contactShadowMesh");
    expect(methodBody).toContain("zeroInstanceMatrix");
  });

  it("hideInstanceSlot and clearModelSlot both handle contactShadowMesh", () => {
    const src = readSource("army-model.ts");

    const hideStart = src.indexOf("public hideInstanceSlot");
    const clearStart = src.indexOf("private clearModelSlot");

    expect(hideStart).toBeGreaterThan(-1);
    expect(clearStart).toBeGreaterThan(-1);

    const hideBody = src.slice(hideStart, hideStart + 1200);
    const clearBody = src.slice(clearStart, clearStart + 500);

    expect(hideBody).toContain("contactShadowMesh");
    expect(clearBody).toContain("contactShadowMesh");
  });
});
