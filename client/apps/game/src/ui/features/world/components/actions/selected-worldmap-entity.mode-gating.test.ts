import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Selected worldmap faith action mode gating", () => {
  it("only treats faith actions as eligible in eternum mode", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/world/components/actions/selected-worldmap-entity.tsx"),
      "utf8",
    );

    expect(source).toContain('const isEternumMode = resolvedWorldMode === "eternum";');
    expect(source).toContain("const isFaithEligible =");
    expect(source).toContain("isEternumMode &&");
  });
});
