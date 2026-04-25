// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("RealmInfoPanel build summary wiring", () => {
  it("shows the realm building summary with quick-build actions on the overview panel", () => {
    const source = readSource("src/ui/modules/entity-details/realm/realm-info-panel.tsx");

    expect(source).toContain("RealmBuildingSummary");
    expect(source).toContain('headline="Built here"');
    expect(source).toContain("realmBuildingSummaryActions");
    expect(source).toContain("handleBuildSummaryItem");
    expect(source).toContain("const realm = structureEntityId ? getRealmInfo(");
    expect(source).not.toContain("const realm = useMemo(() =>");
  });
});
