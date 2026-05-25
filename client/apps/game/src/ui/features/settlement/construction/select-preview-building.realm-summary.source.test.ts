// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("SelectPreviewBuildingMenu realm summary wiring", () => {
  it("renders a built-here summary strip above the construction tabs", () => {
    const source = readSource("src/ui/features/settlement/construction/select-preview-building.tsx");

    expect(source).toContain("RealmBuildingSummary");
    expect(source).toContain("realm-summary-selector");
    expect(source).toContain("Built here");
  });
});
