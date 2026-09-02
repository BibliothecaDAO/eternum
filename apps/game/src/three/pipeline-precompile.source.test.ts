import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

// Half two class 1: structure and army models compile their pipelines before they join the scene, so the first frame
// that draws a chunk pays for terrain pipelines only.
describe("pipeline precompile wiring", () => {
  it("renderer hands scenes one compiler over the live backend", () => {
    const renderer = read("./game-renderer.ts");
    expect(renderer).toContain("createPipelineCompiler({");
    expect(renderer).toContain("compilePipelines: this.pipelineCompiler,");
  });

  it("structure models compile before they attach", () => {
    const manager = read("./managers/structure-manager.ts");
    expect(manager).toContain(
      "await this.compileModelPipelines(models);\n        this.structureModels.set(structureType, models);",
    );
    expect(manager).toContain(
      "await this.compileModelPipelines(models);\n        this.cosmeticStructureModels.set(cosmeticId, models);",
    );
  });

  it("army models compile before they join the scene", () => {
    const model = read("./managers/army-model.ts");
    expect(
      model.match(
        /await this\.compilePipelines\?\.\(modelData\.group, this\.scene\);\n\s+this\.scene\.add\(modelData\.group\);/g,
      ),
    ).toHaveLength(2);
  });
});
