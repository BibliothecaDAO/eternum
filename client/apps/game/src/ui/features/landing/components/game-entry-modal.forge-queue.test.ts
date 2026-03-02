// @vitest-environment node
import { describe, expect, it } from "vitest";

import { reconcileActiveForgeRemaining, resolveForgeSeedRemaining } from "./game-entry-modal.forge-queue";

describe("game-entry-modal forge queue helpers", () => {
  it("uses live remaining when available for queue seed", () => {
    expect(resolveForgeSeedRemaining(7, 10)).toBe(10);
    expect(resolveForgeSeedRemaining(10, 7)).toBe(7);
  });

  it("falls back to ui remaining when live value is unavailable", () => {
    expect(resolveForgeSeedRemaining(9, null)).toBe(9);
  });

  it("never increases remaining during active queue sync", () => {
    expect(reconcileActiveForgeRemaining(7, 10)).toBe(7);
  });

  it("decreases remaining when live value is lower", () => {
    expect(reconcileActiveForgeRemaining(7, 3)).toBe(3);
  });

  it("clamps negative values to zero", () => {
    expect(resolveForgeSeedRemaining(-2, null)).toBe(0);
    expect(reconcileActiveForgeRemaining(5, -4)).toBe(0);
  });
});
