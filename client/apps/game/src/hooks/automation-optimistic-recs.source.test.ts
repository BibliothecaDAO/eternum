// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readHookSource = (relativePath: string) =>
  readFileSync(resolve(__dirname, relativePath), {
    encoding: "utf8",
  });

describe("automation provisional resource spends", () => {
  it("routes production automation through the session-owned intent lifecycle", () => {
    const source = readHookSource("use-automation.tsx");

    expect(source).toContain("new ResourceManager(components, plan.realmId).submitProvisionalResourceTransaction");
    expect(source).not.toContain("automation-resource-reservations");
    expect(source).not.toContain("reserveAutomationResources");
    expect(source).not.toContain("applyAutomationReservationsToSnapshot");
  });

  it("routes transfer automation through the same lifecycle", () => {
    const source = readHookSource("use-transfer-automation-runner.ts");

    expect(source).toContain("rm.submitProvisionalResourceTransaction");
    expect(source).not.toContain("automation-resource-reservations");
    expect(source).not.toContain("reserveAutomationResources");
    expect(source).not.toContain("getSpendableResourceBalance");
  });
});
