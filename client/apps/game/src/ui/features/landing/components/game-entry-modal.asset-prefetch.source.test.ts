// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameEntryModal asset prefetch timing", () => {
  it("schedules play asset prefetch after world selection and bootstrap start", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("primePlayEntryAssets");
    expect(source).toContain('updateTask("world", "complete")');
    expect(source).toContain('markGameEntryMilestone("bootstrap-started")');
    expect(source).toContain("primePlayEntryAssets();");
  });
});
