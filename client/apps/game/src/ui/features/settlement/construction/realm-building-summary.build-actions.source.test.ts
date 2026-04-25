// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("RealmBuildingSummary hover build affordance", () => {
  it("renders resource icons and a hover-only quick build button", () => {
    const source = readSource("src/ui/features/settlement/construction/realm-building-summary.tsx");

    expect(source).toContain("ResourceIcon");
    expect(source).toContain("Plus");
    expect(source).toContain("group-hover:opacity-100");
    expect(source).toContain("buildActions?.get(item.buildingId)");
  });
});
