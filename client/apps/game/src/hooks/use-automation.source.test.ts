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
    expect(source).toContain("if (ran && !pruneDuringProcessingRef.current)");
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
    // The pruneForGame effect must reset the scheduler clock.
    expect(source).toMatch(/pruneForGame\(gameId\);[\s\S]*lastRunTimestampRef\.current = nowMs/);
  });
});
