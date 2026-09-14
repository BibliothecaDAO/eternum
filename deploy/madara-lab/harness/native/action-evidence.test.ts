import { describe, expect, it } from "bun:test";
import { parseExecutionTime } from "./action-evidence";

const batch = (block: number, count: number, duration: string) =>
  `INFO Executed and added ${count} transaction(s) to the preconfirmed block at height ${block} - ${duration}`;

describe("slice execution evidence", () => {
  it("attributes an isolated batch and converts its units", () => {
    expect(parseExecutionTime([batch(8, 2, "99ms"), batch(9, 1, "340µs")].join("\n"), 9)).toBe(0.34);
    expect(parseExecutionTime(batch(9, 1, "1.2s"), 9)).toBe(1200);
  });
  it("refuses to invent an action time from a shared or missing batch", () => {
    expect(() => parseExecutionTime(batch(9, 2, "50ms"), 9)).toThrow("Cannot attribute");
    expect(() => parseExecutionTime([batch(9, 1, "30ms"), batch(9, 1, "40ms")].join("\n"), 9)).toThrow(
      "Cannot attribute",
    );
    expect(() => parseExecutionTime(batch(8, 1, "30ms"), 9)).toThrow("Cannot attribute");
  });
});
