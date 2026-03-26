import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Social tab mode gating", () => {
  it("gates blitz and faith tabs by resolved world mode", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/social/components/social.tsx"), "utf8");

    expect(source).toContain('const isBlitzMode = resolvedWorldMode === "blitz";');
    expect(source).toContain('const isEternumMode = resolvedWorldMode === "eternum";');
    expect(source).toContain("if (isEternumMode) {");
    expect(source).toContain("if (isBlitzMode) {");
    expect(source).toContain("if (isBlitzMode && mmrEnabled) {");
  });
});
