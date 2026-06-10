// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readHookSource = (relativePath: string) =>
  readFileSync(resolve(__dirname, relativePath), {
    encoding: "utf8",
  });

describe("automation RECS optimistic resource spends", () => {
  it("keeps production automation on ResourceManager RECS overrides", () => {
    const source = readHookSource("use-automation.tsx");

    expect(source).toContain("new ResourceManager(components, plan.realmId).optimisticResourceUpdates");
    expect(source).not.toContain("automation-resource-reservations");
    expect(source).not.toContain("reserveAutomationResources");
    expect(source).not.toContain("applyAutomationReservationsToSnapshot");
  });

  it("keeps transfer automation on ResourceManager RECS overrides", () => {
    const source = readHookSource("use-transfer-automation-runner.ts");

    expect(source).toContain("rm.optimisticResourceUpdates");
    expect(source).not.toContain("automation-resource-reservations");
    expect(source).not.toContain("reserveAutomationResources");
    expect(source).not.toContain("getSpendableResourceBalance");
  });
});
