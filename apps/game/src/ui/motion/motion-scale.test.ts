import { describe, expect, it } from "vitest";
import { momentSpeed, tickDurationMs } from "./motion-scale";

describe("tickDurationMs", () => {
  it("rolls 300 + 150·log10(Δ) ms, clamped to 300–1,400 (design §3.11)", () => {
    expect(tickDurationMs(100, 1)).toBe(600);
    expect(Math.round(tickDurationMs(6_000, 1))).toBe(867);
    expect(tickDurationMs(1, 1)).toBe(300);
    expect(tickDurationMs(10 ** 12, 1)).toBe(1_400);
  });

  it("runs faster on a repeat", () => {
    expect(tickDurationMs(100, 0.5)).toBe(300);
  });
});

describe("momentSpeed", () => {
  it("halves a moment from its third play within five minutes", () => {
    const start = 1_000_000;
    expect([0, 1_000, 2_000].map((offset) => momentSpeed("chest-a", 0, start + offset))).toEqual([1, 1, 0.5]);
    expect(momentSpeed("chest-a", 0, start + 6 * 60_000)).toBe(1);
  });

  it("always plays an epic in full", () => {
    const start = 2_000_000;
    [0, 1, 2].forEach((offset) => momentSpeed("chest-b", 3, start + offset));
    expect(momentSpeed("chest-b", 3, start + 3)).toBe(1);
  });
});
