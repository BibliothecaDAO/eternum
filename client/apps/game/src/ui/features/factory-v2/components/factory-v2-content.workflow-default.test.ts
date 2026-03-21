import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("FactoryV2Content workflow default", () => {
  it("defaults to the restored run instead of forcing the start panel", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/factory-v2/components/factory-v2-content.tsx"),
      "utf8",
    );

    expect(source).toContain("resolveInitialFactoryWorkflow(factory.selectedRun)");
    expect(source).toContain('return selectedRun ? "watch" : "start";');
    expect(source).not.toContain('setSelectedWorkflow("start");');
  });
});
