// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./use-structure-upgrade.ts", import.meta.url), "utf8");

describe("useStructureUpgrade", () => {
  it("uses one settled-duration intent for resources and the authoritative level", () => {
    expect(source).toContain('useProvisionalInputLock("Structure"');
    expect(source).toContain("resolveProvisionalResourceWrite");
    expect(source).toContain('model: "Structure"');
    expect(source).toContain("matchPatch: { base: { level: nextLevel } }");
    expect(source).toContain('{ lockUntil: "settled" }');
    expect(source).toContain("trackProvisionalTransaction(intent, account.account, result)");
  });

  it("has no upgrade side store or reconciliation poll", () => {
    expect(source).not.toContain("useRealmUpgradeStore");
    expect(source).not.toContain("waitForRealmUpgradeSync");
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("setTimeout");
  });
});
