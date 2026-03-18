import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("FactoryV2Content workflow default", () => {
  it("keeps the workflow selection stable when the game type changes", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/factory-v2/components/factory-v2-content.tsx"),
      "utf8",
    );

    expect(source).toContain('useState<FactoryWorkflowView>("start")');
    expect(source).not.toContain('setSelectedWorkflow("start");');
    expect(source).not.toContain("[factory.selectedMode]");
  });
});
