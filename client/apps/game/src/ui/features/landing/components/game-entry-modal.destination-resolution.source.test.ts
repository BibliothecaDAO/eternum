// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameEntryModal destination resolution timeline", () => {
  it("records destination resolution before world selection work starts", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain('markGameEntryMilestone("destination-resolved")');
    expect(source).toMatch(
      /markGameEntryMilestone\("destination-resolved"\);\s*markGameEntryMilestone\("world-selection-started"\);/s,
    );
  });
});
