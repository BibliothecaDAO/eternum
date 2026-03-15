import { describe, expect, test } from "bun:test";
import { parseStartTime } from "../time";

describe("parseStartTime", () => {
  test("parses unix seconds", () => {
    expect(parseStartTime("1763112600")).toBe(1763112600);
  });

  test("parses unix milliseconds", () => {
    expect(parseStartTime("1763112600000")).toBe(1763112600);
  });

  test("parses ISO-8601", () => {
    expect(parseStartTime("2025-11-14T09:30:00Z")).toBe(1763112600);
  });

  test("rejects invalid values", () => {
    expect(() => parseStartTime("tomorrow-ish")).toThrow(
      'Invalid game start time "tomorrow-ish". Use unix seconds, unix milliseconds, or ISO-8601.',
    );
  });
});
