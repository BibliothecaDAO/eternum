import { describe, expect, it } from "vitest";
import { formatClock } from "./frontier-format";

describe("formatClock", () => {
  it("keeps one h:mm:ss shape so the countdown never jumps", () => {
    expect(formatClock(7 * 3600 + 12 * 60 + 4)).toBe("7:12:04");
    expect(formatClock(59)).toBe("0:00:59");
  });

  it("rounds a partial second up and never goes below zero", () => {
    expect(formatClock(0.2)).toBe("0:00:01");
    expect(formatClock(-3)).toBe("0:00:00");
  });
});
