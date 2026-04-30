// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("useAutomation source", () => {
  it("uses readable automation failure messages instead of stringifying structured errors", () => {
    const source = readSource("src/hooks/use-automation.tsx");

    expect(source).toContain("extractReadableErrorMessage");
    expect(source).not.toContain("String(rawError)");
  });

  it("uses wall clock time for scheduling so stale chain time cannot freeze production automation", () => {
    const source = readSource("src/hooks/use-automation.tsx");

    expect(source).toContain("Use wall clock time for scheduling");
    expect(source).toContain("const nowMs = Date.now();");
    expect(source).toContain("if (nowMs < nextEligibleMs)");
    expect(source).not.toContain("const blockTimestampMs = currentBlockTimestamp * 1000");
  });

  it("only advances the scheduler clock when processRealms actually ran", () => {
    const source = readSource("src/hooks/use-automation.tsx");

    expect(source).toContain("type ProcessRealmsResult = { ran: boolean; anyExecuted: boolean }");
    expect(source).toContain("shouldAdvanceSchedulerBookkeeping(ran, pruneDuringProcessingRef.current)");
    expect(source).toContain("return { ran: false, anyExecuted: false }");
    expect(source).toContain("return { ran: true, anyExecuted }");
  });

  it("uses the shared signature helper which hashes autoBalance and percentage values", () => {
    const source = readSource("src/hooks/use-automation.tsx");

    expect(source).toContain("computeAutomationConfigSignature");
    // The inline signature that only hashed preset + customKeys must be gone.
    expect(source).not.toContain("const customKeys = Object.keys(realm.customPercentages");
  });

  it("resets scheduler refs when pruneForGame runs and guards in-flight passes", () => {
    const source = readSource("src/hooks/use-automation.tsx");

    expect(source).toContain("pruneDuringProcessingRef = useRef");
    expect(source).toContain("pruneForGame(gameId)");
    // The pruneForGame effect must reset the scheduler clock via the shared helper.
    expect(source).toMatch(/pruneForGame\(gameId\);[\s\S]*computePostPassSchedulerUpdate\(nowMs\)/);
  });

  it("rebuilds the automation projection inside the realm loop instead of planning the whole pass up front", () => {
    const source = readSource("src/hooks/use-automation.tsx");

    expect(source).toContain("Starting just-in-time planning");
    expect(source).toContain("Rebuild the conservative projection immediately before each realm submission");
    expect(source).toContain("const { currentDefaultTick: conservativeTick } = getAutomationProjectionTick();");
    expect(source).not.toContain("const executablePlans: ExecutableProductionPlan[] = [];");
    expect(source).not.toContain("executeProductionPlansSequentially");
  });

  it("applies and records automation resource reservations around production submits", () => {
    const source = readSource("src/hooks/use-automation.tsx");

    expect(source).toContain("applyAutomationReservationsToSnapshot");
    expect(source).toContain("reserveAutomationResources");
    expect(source).toContain("releaseAutomationReservation(reservationToken)");
    expect(source).toContain("buildProductionReservationResources(plan)");
  });

  it("scheduled transfer automation plans against spendable reserved balances", () => {
    const source = readSource("src/hooks/use-transfer-automation-runner.ts");

    expect(source).toContain("getSpendableResourceBalance");
    expect(source).toContain("reserveAutomationResources");
    expect(source).toContain("releaseAutomationReservation(reservationToken)");
    expect(source).toMatch(/resources: transferList/);
  });
});
