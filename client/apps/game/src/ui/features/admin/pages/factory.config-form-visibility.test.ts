import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Factory config form visibility", () => {
  it("renders configure controls independently from deployed status gating", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/admin/pages/factory.tsx"), "utf8");

    const configureSectionIndex = source.indexOf("Step 2: Configure");
    const deployedGateIndex = source.indexOf("{worldDeployedStatus[name] && (");

    expect(configureSectionIndex).toBeGreaterThan(-1);
    expect(deployedGateIndex).toBeGreaterThan(-1);
    expect(configureSectionIndex).toBeLessThan(deployedGateIndex);
  });
});
