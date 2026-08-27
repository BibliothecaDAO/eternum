// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./use-structure-upgrade.ts", import.meta.url), "utf8");

describe("useStructureUpgrade", () => {
  it("keeps pending state in the acting hook instead of RECS", () => {
    expect(source).toContain("const [isUpgradeLocked, setUpgradeLocked] = useState(false)");
    expect(source).toContain("setUpgradeLocked(true)");
    expect(source).toContain("setUpgradeLocked(false)");
    expect(source).not.toContain("Provisional");
  });

  it("has no upgrade side store or reconciliation poll", () => {
    expect(source).not.toContain("useRealmUpgradeStore");
    expect(source).not.toContain("waitForRealmUpgradeSync");
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("setTimeout");
  });
});
