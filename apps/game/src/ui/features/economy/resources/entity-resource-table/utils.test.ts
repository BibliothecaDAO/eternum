import { expect, it } from "vitest";

import { productionTimeLeft } from "./utils";

it("names production that never runs out instead of writing a duration", () => {
  expect(productionTimeLeft(Number.POSITIVE_INFINITY)).toBe("no end");
  expect(productionTimeLeft(90_000)).toBe("1d 1h");
  expect(productionTimeLeft(754)).toBe("13m");
});
