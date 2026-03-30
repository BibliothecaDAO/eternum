// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameEntryModal asset prefetch timing", () => {
  it("starts play asset prefetch after world selection completes", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("prefetchPlayAssets");
    expect(source).toContain('updateTask("world", "complete")');
    expect(source).toContain("prefetchPlayAssets();");
  });
});
