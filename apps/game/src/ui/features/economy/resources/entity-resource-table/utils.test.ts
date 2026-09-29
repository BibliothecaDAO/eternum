import { expect, it } from "vitest";

import { formatTimeRemaining } from "./utils";

it("names production that never runs out instead of formatting a duration", () => {
  expect(formatTimeRemaining(Number.POSITIVE_INFINITY)).toBe("∞");
  expect(formatTimeRemaining(90_000)).toBe("1d");
});
