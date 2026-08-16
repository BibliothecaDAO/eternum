import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "worldmap.tsx"), "utf8");

describe("worldmap new-model pipeline prewarm", () => {
  it("launches model compilation from the shared prefetch lane without changing visibility", () => {
    const methodStart = source.indexOf("private requestNewModelPipelinePrewarm");
    const methodEnd = source.indexOf("private configureWorldmapRecoveryLifecycle", methodStart);
    const method = source.slice(methodStart, methodEnd);

    expect(methodStart).toBeGreaterThan(-1);
    expect(method).not.toContain("object.visible = false");
    expect(method).not.toContain("object.visible = true");
    expect(method).toContain('.schedule("prefetch"');
    expect(method).toContain("this.prewarmObjectPipeline(object)");
    expect(method).not.toContain("await this.prewarmObjectPipeline(object)");
  });
});
