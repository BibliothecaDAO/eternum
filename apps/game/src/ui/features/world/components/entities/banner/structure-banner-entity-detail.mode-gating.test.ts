import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Structure banner faith tab mode gating", () => {
  it("requires eternum mode before rendering faith tab", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/world/components/entities/banner/structure-banner-entity-detail.tsx"),
      "utf8",
    );

    expect(source).toContain('const isEternumMode = resolvedWorldMode === "eternum";');
    expect(source).toContain("const showFaithTab =");
    expect(source).toContain("isEternumMode &&");
  });
});
