import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("FactoryPage embedded styling", () => {
  it("uses dashboard-style embedded shells instead of the old standalone wood panels", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/admin/pages/factory.tsx"), "utf8");

    expect(source).toContain("max-w-[1500px]");
    expect(source).toContain("backdrop-blur-xl");
    expect(source).toContain("rounded-[28px]");
    expect(source).toContain("resolveFactoryPrimaryPanelClassName");
    expect(source).toContain("resolveFactorySecondaryPanelClassName");
    expect(source).toContain("const resolveFactoryPrimaryPanelClassName = (embedded: boolean) =>");
    expect(source).toContain('? "relative overflow-hidden rounded-[28px]');
  });
});
