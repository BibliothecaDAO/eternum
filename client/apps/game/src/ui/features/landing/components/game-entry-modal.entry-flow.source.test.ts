// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Game entry modal flow", () => {
  it("uses direct entry target resolution and removes the fixed auto-enter delay", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("resolveKnownEntryTarget");
    expect(source).not.toContain("const timer = setTimeout(() => {");
    expect(source).not.toContain("}, 500);");
    expect(source).not.toContain("worldMapPosition: { col: 0, row: 0 }");
    expect(source).toContain("/play/hex?col=0&row=0");
    expect(source).toContain('markGameEntryMilestone("direct-map-entry-resolved")');
    expect(source).toContain('markGameEntryMilestone("direct-map-entry-fallback")');
  });
});
